<script setup lang="ts">
import type { SelectedLocation } from '../../types/location'
import type { PassengerCategory } from '../../types/tripPlan'
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
const approximatePaths = useApproximateJourneyPaths(tripPlan.selectedJourney)
const form = reactive({ origin: '', destination: '', departure: 'Depart now', scheduledDeparture: '', passengerCategory: 'Regular fare' })
const originLocation = ref<SelectedLocation | null>(null)
const destinationLocation = ref<SelectedLocation | null>(null)
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
const canSearch = computed(() => Boolean(originLocation.value && destinationLocation.value && !tripPlan.loading.value))
const mapPresentation = computed(() => journeyMapPresentation(tripPlan.selectedJourney.value, originLocation.value, destinationLocation.value))
const mapLines = computed(() => [...mapPresentation.value.lines, ...approximatePaths.lines.value])
const mapFitKey = computed(() => [originLocation.value?.id ?? '', destinationLocation.value?.id ?? '', tripPlan.selectedJourneyId.value ?? ''].join('|'))
const reportJourneyLink = computed(() => {
  const transit = tripPlan.selectedJourney.value?.legs.find(leg => leg.type === 'TRANSIT')
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

watch(originLocation, value => { form.origin = value?.label ?? form.origin })
watch(destinationLocation, value => { form.destination = value?.label ?? form.destination })
// Post-render selection drives only the guide. Cards/details/map never await AI.
watch(() => tripPlan.selectedJourney.value, journey => {
  if (!journey || !originLocation.value || !destinationLocation.value) return
  void journeyExplanation.explain(journey.id, buildJourneyExplanationRequest(originLocation.value.label, destinationLocation.value.label, journey))
}, { flush: 'post' })
watch(
  () => `${originLocation.value?.id ?? ''}|${originLocation.value?.lat ?? ''}|${originLocation.value?.lng ?? ''}|${destinationLocation.value?.id ?? ''}|${destinationLocation.value?.lat ?? ''}|${destinationLocation.value?.lng ?? ''}`,
  (value, previous) => {
    if (previous && value !== previous) journeyExplanation.reset()
    if (previous && value !== previous && tripPlan.searched.value) tripPlan.reset()
  },
)

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

function loadLocationsFromQuery() {
  const origin = getQueryValue(pageRoute.query.from) || getQueryValue(pageRoute.query.origin)
  const destination = getQueryValue(pageRoute.query.to) || getQueryValue(pageRoute.query.destination)
  if (!origin.trim() && !destination.trim()) return false
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
  void Promise.all([resolve(origin), resolve(destination)]).then(([resolvedOrigin, resolvedDestination]) => {
    if (signal.aborted) return
    originLocation.value = resolvedOrigin
    destinationLocation.value = resolvedDestination
  })
  return true
}

function updateLocationText(mode: 'origin' | 'destination', value: string) { form[mode] = value }

function swapLocations() {
  const currentOrigin = originLocation.value
  originLocation.value = destinationLocation.value
  destinationLocation.value = currentOrigin
  form.origin = originLocation.value?.label ?? ''
  form.destination = destinationLocation.value?.label ?? ''
}

function departureAt() {
  if (form.departure === 'Depart now') return new Date().toISOString()
  if (!form.scheduledDeparture) return null
  const selected = new Date(form.scheduledDeparture)
  return Number.isFinite(selected.getTime()) && selected.getTime() >= Date.now() - 60_000 ? selected.toISOString() : null
}

function validateSearch() {
  if (!originLocation.value || !destinationLocation.value) {
    toast.add({ title: 'Select resolved locations', description: 'Choose both places from the suggestions before searching.', color: 'warning' })
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
  await router.replace({ query: { ...pageRoute.query, from: form.origin.trim(), to: form.destination.trim() } })
}

async function findJourneys() {
  if (tripPlan.loading.value) return
  if (!validateSearch() || !originLocation.value || !destinationLocation.value) return
  const requestedDeparture = departureAt()
  if (!requestedDeparture) return
  journeyExplanation.reset()
  await updateSearchQuery()
  await tripPlan.search(buildTripPlanRequest(originLocation.value, destinationLocation.value, requestedDeparture, passengerCategories[form.passengerCategory] || 'REGULAR'))
}

async function explainSelectedJourney() {
  const journey = tripPlan.selectedJourney.value
  if (!journey || !originLocation.value || !destinationLocation.value) return
  await journeyExplanation.explain(journey.id, buildJourneyExplanationRequest(originLocation.value.label, destinationLocation.value.label, journey), true)
}

onMounted(() => {
  if (loadLocationsFromQuery()) {
    // Query text is resolved to coordinates; planning remains explicitly user initiated.
  }
})
onBeforeUnmount(() => queryLocationAbort?.abort())
</script>

<template>
  <div class="min-w-0">
    <PamanaPageHeader title="Trip Planner" role="passenger" />
    <div class="grid min-w-0 items-start gap-5 lg:grid-cols-5">
      <div class="min-w-0 space-y-5 lg:col-span-2">
        <UCard class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-sm font-semibold text-neutral-900">Where to?</h2>
            <UIcon name="i-lucide-navigation" class="size-4 text-lime-600" />
          </div>

          <form class="mt-4 space-y-3" @submit.prevent="findJourneys">
            <LocationPamanaLocationSearch v-model="originLocation" mode="origin" placeholder="Current location or search a place" :initial-query="form.origin" allow-current-location @text-updated="updateLocationText('origin', $event)" />
            <div class="flex items-center justify-center">
              <button type="button" class="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:border-lime-400 hover:bg-lime-50 hover:text-lime-700" aria-label="Swap origin and destination" @click="swapLocations">
                <UIcon name="i-lucide-arrow-down-up" class="size-4" />
              </button>
            </div>
            <LocationPamanaLocationSearch v-model="destinationLocation" mode="destination" placeholder="Search destination" :initial-query="form.destination" @text-updated="updateLocationText('destination', $event)" />

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <USelect v-model="form.departure" :items="departureOptions" aria-label="Departure preference" class="w-full" />
              <USelect v-model="form.passengerCategory" :items="passengerCategoryOptions" aria-label="Passenger fare category" class="w-full" />
            </div>
            <label v-if="form.departure === 'Schedule for later'" class="grid gap-1 text-xs font-medium text-neutral-600">
              Departure date and time
              <input v-model="form.scheduledDeparture" type="datetime-local" :min="minimumDeparture" class="min-h-11 border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-lime-500" required>
            </label>

            <UButton type="submit" block size="lg" icon="i-lucide-search" class="search-button rounded-full font-semibold" :loading="tripPlan.loading.value" :disabled="!canSearch">
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
          <div v-if="resultState.kind === 'results'" class="grid grid-cols-2 gap-2" aria-label="Route preferences">
            <button v-for="category in categories" :key="category.key" type="button" class="min-h-12 min-w-0 rounded-2xl border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-lime-600" :class="category.journeyId && tripPlan.selectedJourneyId.value === category.journeyId ? 'border-lime-300 bg-lime-50 text-lime-900' : 'border-neutral-200 bg-white/80 text-neutral-700'" :disabled="!category.journeyId" :aria-pressed="Boolean(category.journeyId && tripPlan.selectedJourneyId.value === category.journeyId)" @click="selectCategory(category.journeyId)">
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
          <JourneyPamanaJourneyCard v-for="(journey, index) in tripPlan.journeys.value" v-else-if="resultState.kind === 'results'" :key="journey.id" :journey="journey" :option-number="index + 1" :badges="badgesFor(journey.id)" :selected="tripPlan.selectedJourneyId.value === journey.id" @select="tripPlan.selectedJourneyId.value = $event" />
          <UCard v-else class="rounded-3xl bg-white/80" :ui="{ root: 'ring-1 ring-neutral-200 rounded-3xl' }">
            <UIcon :name="resultState.kind === 'error' ? 'i-lucide-wifi-off' : 'i-lucide-route'" class="size-6 text-lime-700" />
            <p class="mt-2 text-sm leading-relaxed text-neutral-600">{{ resultState.description }}</p>
            <UButton v-if="resultState.kind === 'error'" color="neutral" variant="soft" class="mt-3 rounded-full" :disabled="!canSearch" @click="findJourneys">Try again</UButton>
          </UCard>
        </section>
      </div>
      <div class="min-w-0 space-y-4 lg:sticky lg:top-5 lg:col-span-3">
        <div class="min-w-0 space-y-2">
          <PamanaMapPanel provider="maplibre" icon="i-lucide-map" :label="tripPlan.selectedJourney.value ? 'Selected journey map' : 'Trip locations map'" height="clamp(300px, 42vw, 460px)" tone="lime" :nodes="mapPresentation.nodes" :lines="mapLines" :disruptions="mapPresentation.disruptions" :fit-key="mapFitKey" />
          <p class="px-1 text-xs text-neutral-500">Select an option to see its route. Dashed lines show walking connections.</p>
        </div>
        <JourneyPamanaJourneyDetails v-if="tripPlan.selectedJourney.value" :journey="tripPlan.selectedJourney.value" />
        <UButton v-if="reportJourneyLink" :to="reportJourneyLink" color="neutral" variant="soft" size="sm" icon="i-lucide-message-square-warning" class="rounded-full">Report an issue with this journey</UButton>
        <JourneyPamanaTripGuide v-if="tripPlan.selectedJourney.value" :loading="journeyExplanation.loading.value" :response="journeyExplanation.response.value" :fallback="fallbackGuide" @regenerate="explainSelectedJourney" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-button { background-color: #84cc16 !important; color: #171717 !important; }
.search-button:hover { background-color: #65a30d !important; color: #ffffff !important; }
.search-button:disabled { cursor: not-allowed; opacity: 0.65; }
</style>
