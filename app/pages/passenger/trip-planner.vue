<script setup lang="ts">
import type { SelectedLocation } from '../../types/location'
import type { PassengerCategory, TripPlanClientError, TripPlanStatus } from '../../types/tripPlan'
import { buildTripPlanRequest } from '../../services/tripPlan'
import { formatFare, journeyMapPresentation } from '../../services/tripPlanPresentation'

definePageMeta({ middleware: ['auth', 'passenger'] })
useHead({ title: 'Trip Planner | PAMANA' })

const toast = useToast()
const pageRoute = useRoute()
const router = useRouter()
const geoapify = useGeoapify()
const tripPlan = useTripPlan()
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
const mapFitKey = computed(() => [originLocation.value?.id ?? '', destinationLocation.value?.id ?? '', tripPlan.selectedJourneyId.value ?? ''].join('|'))
const selectedFare = computed(() => {
  const summary = tripPlan.selectedJourney.value?.fareSummary
  if (!summary) return 'Search to calculate'
  if (summary.totalStatus === 'KNOWN') return formatFare(summary.totalFare, summary.currency || 'PHP')
  if (summary.knownSubtotal !== null) return `Known subtotal ${formatFare(summary.knownSubtotal, summary.currency || 'PHP')}`
  return 'Fare unavailable'
})

const clientErrorCopy: Record<TripPlanClientError, { title: string; description: string }> = {
  INVALID_INPUT: { title: 'Check your trip details', description: 'Choose valid origin and destination suggestions, then try again.' },
  AUTH_REQUIRED: { title: 'Sign in required', description: 'Your session may have expired. Sign in again to plan a trip.' },
  PROVIDER_UNAVAILABLE: { title: 'Walking directions unavailable', description: 'The walking route provider is temporarily unavailable. Your selected places have been kept.' },
  SERVICE_UNAVAILABLE: { title: 'Trip planning unavailable', description: 'PAMANA could not complete this request right now. Please try again.' },
  INVALID_RESPONSE: { title: 'Trip planning unavailable', description: 'PAMANA returned an incomplete response. Please try again.' },
  CANCELLED: { title: 'Search cancelled', description: 'The previous search was cancelled.' },
}
const domainCopy: Record<Exclude<TripPlanStatus, 'JOURNEYS_FOUND'>, { title: string; description: string }> = {
  NO_ELIGIBLE_ACCESS_NODES: { title: 'No verified access points are available yet', description: 'PAMANA does not yet have enough verified boarding and drop-off coordinates for these places. Try another nearby origin or destination.' },
  NO_TRANSPORT_JOURNEY: { title: 'No verified journey found', description: 'No eligible public-transport connection is currently available between the selected places.' },
  ROUTING_PROVIDER_UNAVAILABLE: { title: 'Walking directions unavailable', description: 'PAMANA could not verify the walking access and egress connectors. Please try again later.' },
}
const currentDomainState = computed(() => {
  const status = tripPlan.response.value?.status
  return status && status !== 'JOURNEYS_FOUND' ? domainCopy[status] : null
})
const currentError = computed(() => tripPlan.error.value ? clientErrorCopy[tripPlan.error.value] : null)

watch(originLocation, value => { form.origin = value?.label ?? form.origin })
watch(destinationLocation, value => { form.destination = value?.label ?? form.destination })
watch(
  () => `${originLocation.value?.id ?? ''}|${originLocation.value?.lat ?? ''}|${originLocation.value?.lng ?? ''}|${destinationLocation.value?.id ?? ''}|${destinationLocation.value?.lat ?? ''}|${destinationLocation.value?.lng ?? ''}`,
  (value, previous) => { if (previous && value !== previous && tripPlan.searched.value) tripPlan.reset() },
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
  if (!validateSearch() || !originLocation.value || !destinationLocation.value) return
  const requestedDeparture = departureAt()
  if (!requestedDeparture) return
  await updateSearchQuery()
  await tripPlan.search(buildTripPlanRequest(originLocation.value, destinationLocation.value, requestedDeparture, passengerCategories[form.passengerCategory] || 'REGULAR'))
}

onMounted(() => {
  if (loadLocationsFromQuery()) {
    // Query text is resolved to coordinates; planning remains explicitly user initiated.
  }
})
onBeforeUnmount(() => queryLocationAbort?.abort())
</script>

<template>
  <div>
    <PamanaPageHeader title="Trip Planner" role="passenger" />

    <div class="grid gap-5 lg:grid-cols-5">
      <div class="space-y-4 lg:col-span-2">
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
              {{ tripPlan.loading.value ? 'Planning your trip…' : 'Find Best Route' }}
            </UButton>
          </form>
        </UCard>

        <UCard class="glass glow-lime rounded-30" :ui="{ root: 'ring-0 rounded-30', body: 'relative z-10' }">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-display text-sm font-semibold text-neutral-900">Selected journey fare</p>
              <p class="mt-2 text-lg font-semibold text-neutral-900">{{ selectedFare }}</p>
            </div>
            <span v-if="tripPlan.journeys.value.length" class="pill bg-lime-300/15 text-lime-700">{{ tripPlan.journeys.value.length }} {{ tripPlan.journeys.value.length === 1 ? 'OPTION' : 'OPTIONS' }}</span>
          </div>
          <p class="mt-2 text-xs text-neutral-500">Fare, service, and availability come from verified PAMANA records. Unknown information remains marked unavailable.</p>
        </UCard>
      </div>

      <div class="space-y-3 lg:col-span-3">
        <div v-if="tripPlan.loading.value" class="grid gap-3" role="status" aria-live="polite">
          <UCard v-for="index in 2" :key="index" class="glass rounded-30 animate-pulse" :ui="{ root: 'ring-0 rounded-30' }">
            <div class="h-3 w-28 rounded-full bg-neutral-200" /><div class="mt-3 h-5 w-48 rounded-full bg-neutral-200" />
            <div class="mt-4 grid grid-cols-3 gap-2"><span v-for="item in 3" :key="item" class="h-16 rounded-2xl bg-neutral-100" /></div>
          </UCard>
          <span class="sr-only">Planning verified journey options</span>
        </div>

        <template v-else-if="tripPlan.journeys.value.length">
          <JourneyPamanaJourneyCard v-for="(journey, index) in tripPlan.journeys.value" :key="journey.id" :journey="journey" :option-number="index + 1" :selected="tripPlan.selectedJourneyId.value === journey.id" @select="tripPlan.selectedJourneyId.value = $event" />
        </template>

        <UAlert v-if="currentError" color="error" variant="soft" icon="i-lucide-wifi-off" :title="currentError.title" :description="currentError.description" class="rounded-2xl" />
        <UAlert v-else-if="currentDomainState" color="warning" variant="soft" icon="i-lucide-route-off" :title="currentDomainState.title" :description="currentDomainState.description" class="rounded-2xl" />

        <UCard v-if="!tripPlan.loading.value && !tripPlan.journeys.value.length && !currentError && !currentDomainState" class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex flex-col items-center py-7 text-center">
            <span class="flex size-12 items-center justify-center rounded-2xl bg-lime-300/15"><UIcon name="i-lucide-route" class="size-6 text-lime-600" /></span>
            <h2 class="mt-3 font-display font-semibold text-neutral-900">Ready to plan your trip</h2>
            <p class="mt-1 max-w-sm text-sm text-neutral-500">Choose resolved locations to see verified transport journey options.</p>
          </div>
        </UCard>

        <PamanaMapPanel provider="maplibre" icon="i-lucide-map" :label="tripPlan.selectedJourney.value ? 'Selected journey map' : 'Trip locations map'" height="clamp(320px, 48vw, 480px)" tone="lime" :nodes="mapPresentation.nodes" :lines="mapPresentation.lines" :fit-key="mapFitKey" />

        <p class="text-xs text-neutral-500">Dashed lines are Geoapify walking connectors. Solid lines appear only when PAMANA supplies verified transit geometry. Selecting another journey fits that journey once; live updates do not reset the map camera.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-button { background-color: #84cc16 !important; color: #171717 !important; }
.search-button:hover { background-color: #65a30d !important; color: #ffffff !important; }
.search-button:disabled { cursor: not-allowed; opacity: 0.65; }
</style>
