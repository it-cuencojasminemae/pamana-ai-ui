<script setup lang="ts">
import type { SelectedLocation } from '../../types/location'
import type { PassengerCategory, TripPlanRequest, AccessPreference } from '../../types/tripPlan'
import { researchReferenceFeatures } from '../../services/researchPlanningPresentation'
import { pinQuery, readPinQuery } from '../../services/mapPins'
import { landmarkQuery, readLandmarkQuery, landmarkLocation } from '../../services/pilotLandmarks'
import { buildTripPlanRequest } from '../../services/tripPlan'
import { buildJourneyExplanationRequest, deterministicTripGuide } from '../../services/journeyExplanation'
import { journeyMapPresentation } from '../../services/tripPlanPresentation'

import { passengerText, routeCategories, routeResultState } from '../../services/routeOptionsPresentation'

definePageMeta({ middleware: ['auth', 'passenger'] })
useHead({ title: 'Trip Planner | PAMANA' })

const toast = useToast()
const pageRoute = useRoute()
const router = useRouter()
const geoapify = useGeoapify()
const tripPlan = useTripPlan()
const journeyExplanation = useJourneyExplanation()
const pins = useMapPins()
const landmarks = usePilotLandmarks()
const travelTime = useTravelTime()
const planning = usePlanningCapabilities()
const journeyDetails = useJourneyDetails()
const accessPreference = ref<AccessPreference>('AUTO')
const pageReady = ref(false)
let viewActive = true
const researchMarkers = computed(() => researchReferenceFeatures(planning.referenceLocations.value))
const mapLandmarks = computed(() => landmarks.items.value.filter(item => !item.nodeType))
const lastTripRequest = shallowRef<TripPlanRequest | null>(null)
const approximatePaths = useApproximateJourneyPaths(tripPlan.selectedJourney)
const form = reactive({ origin: '', destination: '', departure: 'Depart now', scheduledDeparture: '', passengerCategory: 'Regular fare' })
const originLocation = ref<SelectedLocation | null>(null)
const destinationLocation = ref<SelectedLocation | null>(null)
const preferenceMenuRoot = ref<HTMLElement | null>(null)
const openPreference = ref<'departure' | 'fare' | null>(null)
let queryLocationAbort: AbortController | null = null

const departureOptions = ['Depart now', 'Schedule for later']
const passengerCategoryOptions = ['Regular fare', 'Student', 'Senior citizen', 'PWD']
const passengerCategories: Record<string, PassengerCategory> = {
  'Regular fare': 'REGULAR', Student: 'STUDENT', 'Senior citizen': 'SENIOR', PWD: 'PWD',
}
const minimumDeparture = computed(() => {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
})
const canSearch = computed(() => Boolean(pageReady.value && originLocation.value && destinationLocation.value && !tripPlan.loading.value))
const mapPresentation = computed(() => journeyMapPresentation(tripPlan.selectedJourney.value, originLocation.value, destinationLocation.value))
const mapLines = computed(() => [...mapPresentation.value.lines, ...approximatePaths.lines.value])
const mapFitKey = computed(() => [originLocation.value?.lat ?? '', originLocation.value?.lng ?? '', destinationLocation.value?.lat ?? '', destinationLocation.value?.lng ?? '', tripPlan.selectedJourneyId.value ?? ''].join('|'))
const reportJourneyLink = computed(() => {
  const transit = tripPlan.selectedJourney.value?.legs.find(leg => leg.type === 'TRANSIT')
  if (planning.mode.value === 'RESEARCH_PREVIEW') return null
  if (!transit || transit.type !== 'TRANSIT') return null
  return {
    path: '/passenger/reports',
    query: {
      route: transit.route.id || undefined,
      variant: transit.variant.id || undefined,
      node: transit.boardAt?.nodeId || undefined,
      context: [passengerText(transit.signboard, 'Selected journey'), passengerText(transit.boardAt?.name, 'Pickup point')].join(' · '),
    },
  }
})

const categories = computed(() => routeCategories(tripPlan.response.value, tripPlan.journeys.value))
const resultState = computed(() => routeResultState(tripPlan.loading.value, tripPlan.error.value, tripPlan.searched.value, tripPlan.journeys.value, tripPlan.response.value))
function badgesFor(id: string) { return categories.value.filter(category => category.journeyId === id).map(category => category.label) }
function selectCategory(id: string | null) { if (id && tripPlan.journeys.value.some(journey => journey.id === id)) tripPlan.selectedJourneyId.value = id }
const fallbackGuide = computed(() => tripPlan.selectedJourney.value ? deterministicTripGuide(tripPlan.selectedJourney.value) : '')

function togglePreference(name: 'departure' | 'fare') {
  if (tripPlan.loading.value) return
  openPreference.value = openPreference.value === name ? null : name
}

function selectDeparturePreference(value: string) {
  form.departure = value
  openPreference.value = null
  preferenceMenuRoot.value?.querySelector<HTMLButtonElement>('[aria-controls="departure-preference-options"]')?.focus()
}

function selectFarePreference(value: string) {
  form.passengerCategory = value
  openPreference.value = null
  preferenceMenuRoot.value?.querySelector<HTMLButtonElement>('[aria-controls="passenger-category-options"]')?.focus()
}

function closePreferenceMenu(event: PointerEvent) {
  if (event.target instanceof Node && !preferenceMenuRoot.value?.contains(event.target)) {
    openPreference.value = null
  }
}

function handlePreferenceKeydown(event: KeyboardEvent) {
  if (!openPreference.value) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const control = (event.target as HTMLElement).closest('[aria-controls]')?.getAttribute('aria-controls')
    if (!control) return
    openPreference.value = control === 'departure-preference-options' ? 'departure' : 'fare'
    event.preventDefault()
    void nextTick(() => preferenceMenuRoot.value?.querySelector<HTMLButtonElement>('[role="listbox"] [aria-selected="true"]')?.focus())
    return
  }
  if (event.key === 'Escape') {
    const id = openPreference.value === 'departure' ? 'departure-preference-options' : 'passenger-category-options'
    openPreference.value = null
    preferenceMenuRoot.value?.querySelector<HTMLButtonElement>(`[aria-controls="${id}"]`)?.focus()
    event.preventDefault()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const options = Array.from(preferenceMenuRoot.value?.querySelectorAll<HTMLButtonElement>('[role="listbox"] [role="option"]') ?? [])
  if (!options.length) return
  const current = options.indexOf(event.target as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
    : event.key === 'ArrowDown' ? (current + 1) % options.length : (current <= 0 ? options.length - 1 : current - 1)
  options[next]?.focus()
  event.preventDefault()
}

watch(originLocation, value => { form.origin = value?.label ?? form.origin })
watch(destinationLocation, value => { form.destination = value?.label ?? form.destination })
// Post-render selection drives only the guide. Cards/details/map never await AI.
watch(() => tripPlan.selectedJourney.value, journey => {
  if (planning.mode.value === 'RESEARCH_PREVIEW') { journeyExplanation.reset(); return }
  if (!journey || !originLocation.value || !destinationLocation.value) return
  void journeyExplanation.explain(journey.id, buildJourneyExplanationRequest(originLocation.value.label, destinationLocation.value.label, journey))
}, { flush: 'post' })
watch([() => tripPlan.selectedJourney.value?.id, () => lastTripRequest.value], () => {
  const journey = tripPlan.selectedJourney.value
  if (!journey || !lastTripRequest.value) { journeyDetails.reset(); return }
  void journeyDetails.load(lastTripRequest.value, journey.id, updated => {
    tripPlan.journeys.value = tripPlan.journeys.value.map(item => item.id === updated.id ? updated : item)
  })
}, { flush: 'post' })
watch([planning.mode, accessPreference], () => {
  tripPlan.reset(); journeyExplanation.reset(); travelTime.reset(); journeyDetails.reset(); lastTripRequest.value = null
  pins.mode.value = null
  for (const selected of [originLocation, destinationLocation]) if (selected.value?.landmarkId?.startsWith('research-reference-') && planning.mode.value !== 'RESEARCH_PREVIEW') selected.value = null
})
watch([() => tripPlan.selectedJourney.value?.id, () => pins.area.value?.travelTimeEnabled, () => lastTripRequest.value], () => {
  const journey = tripPlan.selectedJourney.value
  if (!journey || !lastTripRequest.value || !pins.area.value?.travelTimeEnabled) { travelTime.reset(); return }
  void travelTime.load(lastTripRequest.value, journey.id)
}, { flush: 'post' })
watch(
  () => `${originLocation.value?.id ?? ''}|${originLocation.value?.lat ?? ''}|${originLocation.value?.lng ?? ''}|${destinationLocation.value?.id ?? ''}|${destinationLocation.value?.lat ?? ''}|${destinationLocation.value?.lng ?? ''}`,
  (value, previous) => {
    if (previous && value !== previous) journeyExplanation.reset()
    if (previous && value !== previous && tripPlan.searched.value) tripPlan.reset()
    if (previous && value !== previous) { travelTime.reset(); lastTripRequest.value = null }
    if (previous && value !== previous) journeyDetails.reset()
  },
)

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

function loadLocationsFromQuery() {
  const originPin = readPinQuery(pageRoute.query, 'origin')
  const destinationPin = readPinQuery(pageRoute.query, 'destination')
  const originLandmark = readLandmarkQuery(pageRoute.query, 'origin', landmarks.items.value)
  const destinationLandmark = readLandmarkQuery(pageRoute.query, 'destination', landmarks.items.value)
  const origin = getQueryValue(pageRoute.query.from) || getQueryValue(pageRoute.query.origin)
  const destination = getQueryValue(pageRoute.query.to) || getQueryValue(pageRoute.query.destination)
  if (!origin.trim() && !destination.trim() && !originPin.present && !destinationPin.present && !originLandmark.present && !destinationLandmark.present) return false
  form.origin = origin.trim()
  form.destination = destination.trim()
  queryLocationAbort?.abort()
  queryLocationAbort = new AbortController()
  const signal = queryLocationAbort.signal
  const resolve = async (text: string) => {
    if (!text.trim()) return null
    const result = await geoapify.forwardGeocodeLocations(text.trim(), undefined, signal)
    return result.ok ? result.data[0] ?? null : null
  }
  const restore = (pin: ReturnType<typeof readPinQuery>) => {
    if (!pin.location) { pins.error.value = 'This saved pin is invalid. Select a new point inside San Juan.'; return null }
    return pins.choose(pin.location)
  }
  // Catalog IDs and explicit pins take precedence. Invalid IDs never geocode labels.
  void Promise.all([originLandmark.present ? originLandmark.location : originPin.present ? restore(originPin) : resolve(origin), destinationLandmark.present ? destinationLandmark.location : destinationPin.present ? restore(destinationPin) : resolve(destination)]).then(([resolvedOrigin, resolvedDestination]) => {
    if (signal.aborted) return
    originLocation.value = resolvedOrigin
    destinationLocation.value = resolvedDestination
  })
  return true
}

function updateLocationText(mode: 'origin' | 'destination', value: string) {
  queryLocationAbort?.abort()
  form[mode] = value
  // Remove a cleared/edited pin from the URL before a refresh can restore it.
  const location = mode === 'origin' ? originLocation.value : destinationLocation.value
  if (location?.source !== 'MAP_PIN') void router.replace({ query: { ...pageRoute.query, planningMode: planning.mode.value, accessPreference: accessPreference.value, ...pinQuery(mode, null), ...landmarkQuery(mode, location), [mode === 'origin' ? 'from' : 'to']: value || undefined } })
}

function chooseLandmark(id: string, mode: 'origin' | 'destination') {
  if (!pageReady.value) return
  const item = landmarks.items.value.find(i => i.id === id)
  if (!item) return
  queryLocationAbort?.abort()
  pins.mode.value = null
  const selected = mode === 'origin' ? originLocation : destinationLocation
  selected.value = landmarkLocation(item)
  form[mode] = item.name
  void updateSearchQuery()
}

function selectMapCoordinate(point: { lat: number; lng: number }) {
  const mode = pins.mode.value
  if (!mode) return
  const pin = pins.choose(point)
  if (!pin) return
  queryLocationAbort?.abort()
  const selected = mode === 'origin' ? originLocation : destinationLocation
  selected.value = pin
  form[mode] = pin.label
  void updateSearchQuery()
  void pins.enrich(pin, enriched => {
    if (selected.value?.id !== pin.id || selected.value.source !== 'MAP_PIN') return
    selected.value = enriched
    form[mode] = enriched.label
    void updateSearchQuery()
  })
}

function swapLocations() {
  const currentOrigin = originLocation.value
  originLocation.value = destinationLocation.value
  destinationLocation.value = currentOrigin
  form.origin = originLocation.value?.label ?? ''
  form.destination = destinationLocation.value?.label ?? ''
  void updateSearchQuery()
}

function departureAt() {
  if (form.departure === 'Depart now') return new Date().toISOString()
  if (!form.scheduledDeparture) return null
  const selected = new Date(form.scheduledDeparture)
  return Number.isFinite(selected.getTime()) && selected.getTime() >= Date.now() - 60_000 ? selected.toISOString() : null
}

function validateSearch() {
  if (!originLocation.value || !destinationLocation.value) {
    toast.add({ title: 'Select resolved locations', description: 'Choose both places from suggestions, your location, or map pins before searching.', color: 'warning' })
    return false
  }
  if (originLocation.value.lat === destinationLocation.value.lat && originLocation.value.lng === destinationLocation.value.lng) {
    toast.add({ title: 'Choose another destination', description: 'Your starting point and destination cannot be the same.', color: 'warning' })
    return false
  }
  if (!departureAt()) {
    toast.add({ title: 'Choose a departure time', description: 'Select a valid future date and time.', color: 'warning' })
    return false
  }
  return true
}

async function updateSearchQuery() {
  await router.replace({ query: { ...pageRoute.query, planningMode: planning.mode.value, accessPreference: accessPreference.value, from: form.origin.trim(), to: form.destination.trim(), ...pinQuery('origin', originLocation.value), ...pinQuery('destination', destinationLocation.value), ...landmarkQuery('origin', originLocation.value), ...landmarkQuery('destination', destinationLocation.value) } })
}

async function findJourneys() {
  if (!pageReady.value || tripPlan.loading.value) return
  if (!validateSearch() || !originLocation.value || !destinationLocation.value) return
  const requestedDeparture = departureAt()
  if (!requestedDeparture) return
  pins.mode.value = null
  journeyExplanation.reset()
  travelTime.reset()
  await updateSearchQuery()
  lastTripRequest.value = buildTripPlanRequest(originLocation.value, destinationLocation.value, requestedDeparture, passengerCategories[form.passengerCategory] || 'REGULAR')
  lastTripRequest.value.planningMode = planning.mode.value
  lastTripRequest.value.accessPreference = accessPreference.value
  await tripPlan.search(lastTripRequest.value)
}

async function explainSelectedJourney() {
  if (planning.mode.value === 'RESEARCH_PREVIEW') return
  const journey = tripPlan.selectedJourney.value
  if (!journey || !originLocation.value || !destinationLocation.value) return
  await journeyExplanation.explain(journey.id, buildJourneyExplanationRequest(originLocation.value.label, destinationLocation.value.label, journey), true)
}

onMounted(async () => {
  if (typeof document !== 'undefined') document.addEventListener('pointerdown', closePreferenceMenu)
  await Promise.all([pins.load(), landmarks.load(), planning.load()])
  if (!viewActive) return
  planning.restore()
  await router.replace({ query: { ...pageRoute.query, planningMode: planning.mode.value, accessPreference: 'AUTO' } })
  if (!viewActive) return
  if (loadLocationsFromQuery()) {
    // Query text is resolved to coordinates; planning remains explicitly user initiated.
  }
  pageReady.value = true
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('pointerdown', closePreferenceMenu)
  viewActive = false
  queryLocationAbort?.abort()
})
</script>

<template>
  <div class="min-w-0">
    <PamanaPageHeader title="Trip Planner" role="passenger" />
    <PamanaWeather :location="originLocation" class="mb-5" />
    <div class="grid min-w-0 items-start gap-5 lg:grid-cols-5">
      <div class="min-w-0 space-y-5 lg:col-span-2">
        <UCard v-pamana-reveal class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-sm font-semibold text-neutral-900">Where to?</h2>
            <UIcon name="i-lucide-navigation" class="size-4 text-lime-600" />
          </div>

          <form class="mt-4 space-y-3" @submit.prevent="findJourneys">
            <LocationPamanaLocationSearch v-model="originLocation" mode="origin" placeholder="Current location or search a place" :initial-query="form.origin" allow-current-location @text-updated="updateLocationText('origin', $event)" />
            <div class="flex items-center justify-center">
              <button data-pamana-feedback type="button" class="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:border-lime-400 hover:bg-lime-50 hover:text-lime-700" aria-label="Swap origin and destination" @click="swapLocations">
                <UIcon name="i-lucide-arrow-down-up" class="size-4" />
              </button>
            </div>
            <LocationPamanaLocationSearch v-model="destinationLocation" mode="destination" placeholder="Search destination" :initial-query="form.destination" @text-updated="updateLocationText('destination', $event)" />

            <div ref="preferenceMenuRoot" class="grid grid-cols-1 gap-3 sm:grid-cols-2" @keydown="handlePreferenceKeydown">
              <div class="relative grid min-w-0 gap-1.5">
                <span class="text-xs font-semibold text-neutral-700">When do you want to leave?</span>
                <button data-pamana-feedback type="button" class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm font-medium text-neutral-800 shadow-sm outline-none transition hover:border-lime-400 hover:bg-lime-50/50 focus-visible:border-lime-500 focus-visible:ring-2 focus-visible:ring-lime-500/20 disabled:cursor-wait disabled:opacity-60" :aria-expanded="openPreference === 'departure'" aria-haspopup="listbox" aria-controls="departure-preference-options" aria-label="Departure preference" :disabled="tripPlan.loading.value" @click="togglePreference('departure')">
                  <span class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-clock-3" class="size-4 shrink-0 text-lime-700" />
                    <span class="truncate">{{ form.departure }}</span>
                  </span>
                  <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-neutral-500 transition-transform" :class="{ 'rotate-180': openPreference === 'departure' }" />
                </button>
                <div v-pamana-reveal="{ preset: 'panel' }" v-if="openPreference === 'departure'" id="departure-preference-options" class="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-lime-900/10 bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(22,48,30,0.35)] ring-1 ring-black/5" role="listbox" aria-label="Departure preference options">
                  <button v-for="option in departureOptions" :key="option" type="button" role="option" class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-lime-50 focus-visible:bg-lime-50 focus-visible:outline-none" :class="form.departure === option ? 'bg-lime-50 font-semibold text-lime-900' : 'text-neutral-700'" :aria-selected="form.departure === option" @click="selectDeparturePreference(option)">
                    <span class="flex items-center gap-2.5">
                      <UIcon :name="option === 'Depart now' ? 'i-lucide-zap' : 'i-lucide-calendar-clock'" class="size-4 text-lime-700" />
                      {{ option }}
                    </span>
                    <UIcon v-if="form.departure === option" name="i-lucide-check" class="size-4 text-lime-700" />
                  </button>
                </div>
              </div>
              <div class="relative grid min-w-0 gap-1.5">
                <span class="text-xs font-semibold text-neutral-700">Passenger fare</span>
                <button data-pamana-feedback type="button" class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm font-medium text-neutral-800 shadow-sm outline-none transition hover:border-lime-400 hover:bg-lime-50/50 focus-visible:border-lime-500 focus-visible:ring-2 focus-visible:ring-lime-500/20 disabled:cursor-wait disabled:opacity-60" :aria-expanded="openPreference === 'fare'" aria-haspopup="listbox" aria-controls="passenger-category-options" aria-label="Passenger fare category" :disabled="tripPlan.loading.value" @click="togglePreference('fare')">
                  <span class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-ticket-percent" class="size-4 shrink-0 text-lime-700" />
                    <span class="truncate">{{ form.passengerCategory }}</span>
                  </span>
                  <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-neutral-500 transition-transform" :class="{ 'rotate-180': openPreference === 'fare' }" />
                </button>
                <div v-pamana-reveal="{ preset: 'panel' }" v-if="openPreference === 'fare'" id="passenger-category-options" class="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-lime-900/10 bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(22,48,30,0.35)] ring-1 ring-black/5" role="listbox" aria-label="Passenger fare options">
                  <button v-for="option in passengerCategoryOptions" :key="option" type="button" role="option" class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-lime-50 focus-visible:bg-lime-50 focus-visible:outline-none" :class="form.passengerCategory === option ? 'bg-lime-50 font-semibold text-lime-900' : 'text-neutral-700'" :aria-selected="form.passengerCategory === option" @click="selectFarePreference(option)">
                    <span class="flex items-center gap-2.5">
                      <UIcon :name="option === 'Regular fare' ? 'i-lucide-user-round' : option === 'Student' ? 'i-lucide-graduation-cap' : option === 'Senior citizen' ? 'i-lucide-accessibility' : 'i-lucide-heart-handshake'" class="size-4 text-lime-700" />
                      {{ option }}
                    </span>
                    <UIcon v-if="form.passengerCategory === option" name="i-lucide-check" class="size-4 text-lime-700" />
                  </button>
                </div>
              </div>
            </div>
            <label v-if="form.departure === 'Schedule for later'" class="grid gap-1 text-xs font-medium text-neutral-600">
              Departure date and time
              <input v-model="form.scheduledDeparture" type="datetime-local" :min="minimumDeparture" class="min-h-11 border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-lime-500" required>
            </label>

            <p class="text-xs leading-relaxed text-neutral-600">Preferences apply when you press Find Best Route.</p>

            <UButton data-pamana-feedback type="submit" block size="lg" icon="i-lucide-search" class="search-button rounded-full font-semibold" :loading="tripPlan.loading.value" :disabled="!canSearch">
              {{ tripPlan.loading.value ? 'Finding the best routes…' : 'Find Best Route' }}
            </UButton>
          </form>
        </UCard>
        <section class="min-w-0 space-y-3" aria-label="Route options" aria-live="polite" :aria-busy="tripPlan.loading.value">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display text-lg font-semibold text-neutral-900">{{ resultState.title }}</h2>
            <span v-if="tripPlan.journeys.value.length" class="text-xs text-neutral-500">{{ tripPlan.journeys.value.length }} {{ tripPlan.journeys.value.length === 1 ? 'option' : 'options' }}</span>
          </div>
          <p v-if="resultState.kind === 'results'" class="text-sm text-neutral-500">{{ resultState.description }}</p>
          <p v-if="tripPlan.response.value?.meta.pendingAccessConnections" class="rounded-xl bg-amber-50 p-3 text-xs text-amber-900" role="status">Some nearby access paths are still unresolved. Only journeys with established connections are shown. Retry to check the remaining candidates.</p>
          <div v-if="resultState.kind === 'results'" class="grid grid-cols-2 gap-2" aria-label="Route preferences">
            <button data-pamana-feedback v-for="category in categories" :key="category.key" type="button" class="min-h-12 min-w-0 rounded-2xl border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-lime-600" :class="category.journeyId && tripPlan.selectedJourneyId.value === category.journeyId ? 'border-lime-300 bg-lime-50 text-lime-900' : 'border-neutral-200 bg-white/80 text-neutral-700'" :disabled="!category.journeyId" :aria-pressed="Boolean(category.journeyId && tripPlan.selectedJourneyId.value === category.journeyId)" @click="selectCategory(category.journeyId)">
              <span class="block text-xs font-semibold">{{ category.label }}</span>
              <span v-if="!category.journeyId" class="mt-0.5 block text-[11px] leading-snug text-neutral-500">{{ category.unavailable }}</span>
            </button>
          </div>
          <div v-if="resultState.kind === 'loading'" class="space-y-3" role="status">
            <UCard v-for="index in 2" :key="index" class="animate-pulse rounded-3xl" :ui="{ root: 'ring-1 ring-neutral-200 rounded-3xl' }">
              <div class="h-3 w-20 rounded-full bg-neutral-200" /><div class="mt-4 h-5 w-4/5 rounded-full bg-neutral-200" />
              <div class="mt-5 grid grid-cols-2 gap-3"><span v-for="item in 2" :key="item" class="h-12 rounded-xl bg-neutral-100" /></div>
            </UCard>
            <p class="text-sm text-neutral-500">{{ resultState.description }}</p>
          </div>
          <JourneyPamanaJourneyCard v-for="(journey, index) in tripPlan.journeys.value" v-else-if="resultState.kind === 'results'" :key="journey.id" :journey="journey" :research="planning.mode.value === 'RESEARCH_PREVIEW'" :option-number="index + 1" :badges="badgesFor(journey.id)" :selected="tripPlan.selectedJourneyId.value === journey.id" @select="tripPlan.selectedJourneyId.value = $event" />
          <UCard v-pamana-reveal v-else class="rounded-3xl bg-white/80" :ui="{ root: 'ring-1 ring-neutral-200 rounded-3xl' }">
            <UIcon :name="resultState.kind === 'error' ? 'i-lucide-wifi-off' : 'i-lucide-route'" class="size-6 text-lime-700" />
            <p class="mt-2 text-sm leading-relaxed text-neutral-600">{{ resultState.description }}</p>
            <UButton data-pamana-feedback v-if="resultState.kind === 'error'" color="neutral" variant="soft" class="mt-3 rounded-full" :disabled="!canSearch" @click="findJourneys">Try again</UButton>
          </UCard>
        </section>
      </div>
      <div class="min-w-0 space-y-4 lg:sticky lg:top-5 lg:col-span-3">
        <div class="min-w-0 space-y-2">
          <LocationPamanaPinControls :area-label="pins.area.value?.label" :enabled="pageReady && pins.enabled.value" :loading="!pageReady || pins.loading.value" :mode="pins.mode.value" :error="pins.error.value" @choose="pins.start" @retry="pins.load" />
          <PamanaMapPanel provider="maplibre" passenger-focus icon="i-lucide-map" :label="tripPlan.selectedJourney.value ? 'Selected journey map' : 'Trip locations map'" height="clamp(300px, 42vw, 460px)" tone="lime" :nodes="[...mapPresentation.nodes, ...researchMarkers]" :lines="mapLines" :disruptions="mapPresentation.disruptions" :fit-key="mapFitKey" :pin-boundary="pins.displayBoundary.value" :pin-selection-active="Boolean(pins.mode.value)" :landmarks="mapLandmarks" @landmark-chosen="chooseLandmark" @coordinate-selected="selectMapCoordinate" />
          <p class="px-1 text-xs text-neutral-500">Select an option to see its route. Dashed lines show walking connections.</p>
        </div>
        <JourneyPamanaJourneyDetails v-if="tripPlan.selectedJourney.value" :journey="tripPlan.selectedJourney.value" />
        <p v-if="journeyDetails.notice.value" class="text-xs text-neutral-500" role="status">{{ journeyDetails.notice.value }}</p>
        <UButton data-pamana-feedback v-if="reportJourneyLink" :to="reportJourneyLink" color="neutral" variant="soft" size="sm" icon="i-lucide-message-square-warning" class="rounded-full">Report an issue with this journey</UButton>
        <JourneyPamanaTripGuide v-if="tripPlan.selectedJourney.value" :research="planning.mode.value === 'RESEARCH_PREVIEW'" :loading="journeyExplanation.loading.value" :response="journeyExplanation.response.value" :fallback="fallbackGuide" @regenerate="explainSelectedJourney" />
        <JourneyPamanaTravelTime v-if="tripPlan.selectedJourney.value && pins.area.value?.travelTimeEnabled" :loading="travelTime.loading.value" :estimate="travelTime.response.value" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-button { background-color: #84cc16 !important; color: #171717 !important; }
.search-button:hover { background-color: #65a30d !important; color: #ffffff !important; }
.search-button:disabled { cursor: not-allowed; opacity: 0.65; }
</style>
