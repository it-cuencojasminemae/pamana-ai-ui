<script setup lang="ts">
// @ts-nocheck

definePageMeta({
  middleware: ['auth', 'passenger']
})

useHead({
  title: 'Trip Planner | PAMANA'
})

const { apiFetch } = useApi()
const toast = useToast()
const pageRoute = useRoute()
const router = useRouter()

const form = reactive({
  origin: '',
  destination: '',
  departure: 'Depart now',
  vehicle: 'All vehicle types'
})

const departureOptions = [
  'Depart now',
  'Schedule for later'
]

const vehicleOptions = [
  'All vehicle types',
  'Jeepney only',
  'Van (UV Express)'
]

interface TripOptionStop {
  id: number
  documentId: string
  name: string
  sequence: number
  latitude: number | null
  longitude: number | null
  stop_type: string | null
  source: string
}

interface TripOptionVehicle {
  id: number
  documentId: string
  vehicle_number: string
  plate_number: string | null
  vehicle_type: string
  vehicle_status: string
  occupancy_level: string | null
  data_mode: 'REAL' | 'SIMULATED'
  source: string
  location: {
    latitude: number
    longitude: number
    recorded_at: string | null
    source: string
  } | null
}

interface TripDataQuality {
  route: string
  fare: string
  travel_time: string
  wait_time: string
  vehicle: string
  occupancy: string
}

interface RouteVerification {
  planning_enabled: boolean
  verification_status: 'AUTHORITATIVE_CURRENT' | 'FIELD_VERIFIED'
  data_mode: 'REAL'
  verified_at: string
  source_name: string
  source_url: string | null
  source_reference: string | null
}

type TripOptionCategory = 'cheapest' | 'fastest' | 'most_reliable'

interface TripOption {
  id: string
  category: TripOptionCategory
  categories: TripOptionCategory[]
  is_cheapest: boolean
  is_fastest: boolean
  is_most_reliable: boolean
  route_id: string
  route_code: string
  route_name: string
  route_verification: RouteVerification
  direction: 'outbound' | 'inbound'
  origin: string
  destination: string
  service_name: string
  vehicle: TripOptionVehicle | null
  pickup_stop: TripOptionStop | null
  dropoff_stop: TripOptionStop | null
  transfer_stop: TripOptionStop | null
  fare: number | null
  fare_source: string
  estimated_travel_minutes: number | null
  travel_time_source: string
  predicted_wait_minutes: { low: number; high: number } | null
  wait_source: string
  reliability_score: number
  reliability_classification: string
  confidence: number
  transfer_count: number
  total_journey_minutes: number
  recommendation_score: number | null
  stops: TripOptionStop[]
  is_recommended: boolean
  reason: string | null
  data_quality: TripDataQuality
  data_notice: string
}

interface TripSearchResponse {
  origin: string
  destination: string
  options: TripOption[]
  recommended_option_id: string | null
  recommendation_explanation: string | null
  demo_mode: boolean
}

const CATEGORY_META: Record<TripOptionCategory, { label: string; icon: string; badgeClass: string; ringClass: string }> = {
  cheapest: {
    label: 'Cheapest',
    icon: 'i-lucide-wallet',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    ringClass: 'border-emerald-400/70 ring-2 ring-emerald-300/25'
  },
  fastest: {
    label: 'Fastest',
    icon: 'i-lucide-zap',
    badgeClass: 'bg-teal-100 text-teal-700',
    ringClass: 'border-teal-400/70 ring-2 ring-teal-300/25'
  },
  most_reliable: {
    label: 'Most Reliable',
    icon: 'i-lucide-shield-check',
    badgeClass: 'bg-sky-100 text-sky-700',
    ringClass: 'border-sky-400/70 ring-2 ring-sky-300/25'
  }
}

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_transit: 'In Transit',
  full: 'Full',
  offline: 'Offline'
}

const OCCUPANCY_LABELS: Record<string, string> = {
  empty: 'Empty',
  low: 'Low occupancy',
  moderate: 'Moderate occupancy',
  near_full: 'Near full',
  full: 'Full'
}

function vehicleStatusLabel(vehicle: TripOptionVehicle | null) {
  if (!vehicle) return 'Not specified'

  // occupancy can push a nominally "available" vehicle to effectively
  // "Near Full" from the passenger's point of view, so it takes priority
  // over the raw vehicle_status label.
  if (vehicle.occupancy_level === 'near_full') return 'Near Full'
  if (vehicle.occupancy_level === 'full' || vehicle.vehicle_status === 'full') return 'Full'

  return VEHICLE_STATUS_LABELS[vehicle.vehicle_status] || 'Unavailable'
}

function occupancyLabel(vehicle: TripOptionVehicle | null) {
  if (!vehicle?.occupancy_level) return null
  return OCCUPANCY_LABELS[vehicle.occupancy_level] || vehicle.occupancy_level
}

function reliabilityLabel(score: number) {
  if (score >= 0.7) return 'High'
  if (score >= 0.45) return 'Medium'
  return 'Low'
}

const options = ref<TripOption[]>([])
const recommendedOptionId = ref<string | null>(null)
const selectedOptionId = ref<string | null>(null)
const loading = ref(false)
const explainingRecommendation = ref(false)
const searched = ref(false)
const errorMessage = ref<string | null>(null)
const recommendationExplanation = ref<string | null>(null)
const config = useRuntimeConfig()
const demoMode = computed(() => String(config.public.demoMode).toLowerCase() !== 'false')

const selectedOption = computed<TripOption | null>(() => {
  return options.value.find(option => option.id === selectedOptionId.value) ?? options.value[0] ?? null
})

const fareRange = computed(() => {
  const fares = options.value
    .map(option => option.fare)
    .filter((fare): fare is number => typeof fare === 'number' && Number.isFinite(fare))

  if (!fares.length) {
    return null
  }

  return {
    min: Math.min(...fares),
    max: Math.max(...fares)
  }
})

const selectedOptionStops = computed(() => {
  if (!Array.isArray(selectedOption.value?.stops)) {
    return []
  }

  return [...selectedOption.value.stops].sort((first, second) => (first.sequence ?? 0) - (second.sequence ?? 0))
})

const sourceLabel = (source: string) => {
  const labels: Record<string, string> = {
    observed: 'Observed',
    crowdsourced: 'Crowdsourced',
    reference: 'Reference estimate',
    simulation: 'Demo data',
    SIMULATED: 'Simulated',
    REAL: 'Real operational data',
    UNAVAILABLE: 'Unavailable',
    AUTHORITATIVE_CURRENT: 'Authoritative current',
    FIELD_VERIFIED: 'Field verified',
    fallback: 'Fallback estimate',
    unverified: 'Unverified'
  }

  return labels[source] || 'Unverified'
}

const waitLabel = (option: TripOption) => option.wait_source === 'observed' ? 'Predicted wait' : 'Estimated wait'

const isDemoSource = (source: string) => source === 'simulation' || source === 'SIMULATED'

const selectedRouteColor = computed(() => {
  return '#65a30d'
})

const selectedRouteIsSimulated = computed(() => selectedOption.value?.data_quality.route === 'SIMULATED_DEMO')

const locationSourceLabel = (source: string) => {
  if (source === 'reference') return 'Reference location'
  if (source === 'simulation') return 'Demo/simulated location'
  if (source === 'FIELD_VERIFIED') return 'Field-verified location'
  if (source === 'AUTHORITATIVE_CURRENT') return 'Authoritative current location'
  if (source === 'observed') return 'Observed location'
  return 'Location source not verified'
}

// Map panel reacts to the selected card. Coordinates come only from the
// stored route stops, so the polyline is a corridor visualization—not
// fabricated turn-by-turn road geometry. No vehicle marker is added until a
// vehicle location is actually supplied by the backend.
const selectedOptionMarkers = computed(() => {
  if (!selectedOption.value) return []

  const option = selectedOption.value
  const pickupId = option.pickup_stop?.documentId
  const dropoffId = option.dropoff_stop?.documentId
  const transferId = option.transfer_stop?.documentId

  const stopMarkers = selectedOptionStops.value.map((stop, index) => {
    const isPickup = stop.documentId === pickupId
    const isDropoff = stop.documentId === dropoffId
    const isTransfer = stop.documentId === transferId
    const kind = isTransfer ? 'transfer' : isPickup ? 'pickup' : isDropoff ? 'dropoff' : 'intermediate'
    const role = isTransfer
      ? `${option.data_quality.route === 'simulation' ? 'Demo ' : ''}transfer stop`
      : isPickup
        ? 'Origin / boarding stop'
        : isDropoff
          ? 'Destination / drop-off stop'
          : 'Intermediate stop'

    return {
      ...stop,
      kind,
      popupLines: [
        stop.name,
        role,
        `Stop type: ${stop.stop_type || 'not specified'}`,
        locationSourceLabel(stop.source)
      ],
      label: `${index + 1}. ${stop.name}`
    }
  })

  const vehicleLocation = option.vehicle?.location
  if (vehicleLocation) {
    stopMarkers.push({
      latitude: vehicleLocation.latitude,
      longitude: vehicleLocation.longitude,
      kind: 'vehicle',
      source: vehicleLocation.source,
      popupLines: [
        option.vehicle?.vehicle_number || 'Vehicle',
        isDemoSource(option.data_quality.vehicle) ? 'Demo Vehicle' : 'Vehicle',
        vehicleLocation.source === 'observed' ? 'Live location' : 'Simulated location',
        `Route: ${option.route_name}`,
        `${isDemoSource(option.data_quality.vehicle) ? 'Demo ' : ''}status: ${vehicleStatusLabel(option.vehicle)}`,
        `${isDemoSource(option.data_quality.occupancy) ? 'Demo ' : ''}occupancy: ${occupancyLabel(option.vehicle) || 'not reported'}`,
        vehicleLocation.recorded_at ? `Last update: ${new Date(vehicleLocation.recorded_at).toLocaleString()}` : 'Last update: not available'
      ]
    })
  }

  return stopMarkers
})

function getQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }

  return typeof value === 'string' ? value : ''
}

function loadLocationsFromQuery() {
  const origin = getQueryValue(pageRoute.query.from) || getQueryValue(pageRoute.query.origin)
  const destination = getQueryValue(pageRoute.query.to) || getQueryValue(pageRoute.query.destination)

  if (origin.trim()) {
    form.origin = origin.trim()
  }

  if (destination.trim()) {
    form.destination = destination.trim()
  }

  return Boolean(origin.trim() && destination.trim())
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Fare unavailable'
  }

  return `₱${value.toFixed(2)}`
}

function optionMatchesVehiclePreference(option: TripOption) {
  if (form.vehicle === 'All vehicle types') {
    return true
  }

  const vehicleType = option.vehicle?.vehicle_type?.toLowerCase() || ''

  if (form.vehicle === 'Jeepney only') {
    return vehicleType.includes('jeep')
  }

  if (form.vehicle === 'Van (UV Express)') {
    return vehicleType.includes('van') || vehicleType.includes('uv')
  }

  return true
}

function validateSearch() {
  const origin = form.origin.trim()
  const destination = form.destination.trim()

  if (!origin || !destination) {
    toast.add({
      title: 'Location required',
      description: 'Enter both your starting point and destination.',
      color: 'error'
    })

    return false
  }

  if (origin.toLowerCase() === destination.toLowerCase()) {
    toast.add({
      title: 'Choose another destination',
      description: 'Your starting point and destination cannot be the same.',
      color: 'warning'
    })

    return false
  }

  return true
}

function swapLocations() {
  const currentOrigin = form.origin

  form.origin = form.destination
  form.destination = currentOrigin
}

async function updateSearchQuery() {
  await router.replace({
    query: {
      ...pageRoute.query,
      from: form.origin.trim(),
      to: form.destination.trim()
    }
  })
}

// Called directly by the search button. A direct page load searches only
// when both locations were supplied in the URL; there is no corridor fallback.
async function searchRoutes(updateQuery = true) {
  if (!validateSearch()) {
    return
  }

  loading.value = true
  errorMessage.value = null
  recommendationExplanation.value = null

  try {
    if (updateQuery) {
      await updateSearchQuery()
    }

    const response = await apiFetch<{ data: TripSearchResponse }>('/api/trip-search', {
      query: {
        origin: form.origin.trim(),
        destination: form.destination.trim()
      }
    })

    const receivedOptions = Array.isArray(response?.data?.options) ? response.data.options : []

    options.value = receivedOptions.filter(optionMatchesVehiclePreference)
    recommendedOptionId.value = response?.data?.recommended_option_id ?? null

    const recommended = options.value.find(option => option.id === recommendedOptionId.value)
    selectedOptionId.value = recommended?.id ?? options.value[0]?.id ?? null
  } catch (error: any) {
    options.value = []
    recommendedOptionId.value = null
    selectedOptionId.value = null

    errorMessage.value =
      error?.data?.error?.message ||
      error?.statusMessage ||
      'Unable to reach PAMANA right now. Please try again.'

    toast.add({
      title: 'Unable to search routes',
      description: errorMessage.value,
      color: 'error'
    })
  } finally {
    searched.value = true
    loading.value = false
  }
}

async function explainRecommendation() {
  if (!recommendedOptionId.value) {
    return
  }

  explainingRecommendation.value = true

  try {
    const response = await apiFetch<{ data: TripSearchResponse }>('/api/trip-search', {
      query: {
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        explain: 'true'
      }
    })

    recommendationExplanation.value = response?.data?.recommendation_explanation ||
      'PAMANA could not generate an explanation right now. Please use the route details shown above.'
  } catch {
    recommendationExplanation.value =
      'PAMANA could not generate an explanation right now. Please use the route details shown above.'
  } finally {
    explainingRecommendation.value = false
  }
}

onMounted(() => {
  if (loadLocationsFromQuery()) {
    searchRoutes(false)
  }
})
</script>

<template>
  <div>
    <PamanaPageHeader
      title="Trip Planner"
      role="passenger"
    />

    <div
      v-if="demoMode"
      class="mb-5 flex items-start gap-2 rounded-2xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-900"
    >
      <UIcon name="i-lucide-flask-conical" class="mt-0.5 size-4 shrink-0" />
      <p><strong>DEMO MODE</strong> — Some vehicle availability, occupancy, route alternatives, and prediction values are simulated or fallback estimates.</p>
    </div>

    <div class="grid gap-5 lg:grid-cols-5">
      <!-- Search controls -->
      <div class="space-y-4 lg:col-span-2">
        <UCard
          class="glass rounded-30"
          :ui="{
            root: 'ring-0 rounded-30'
          }"
        >
          <div class="flex items-center justify-between">
            <h2
              class="font-display text-sm font-semibold text-neutral-900"
            >
              Where to?
            </h2>

            <UIcon
              name="i-lucide-navigation"
              class="size-4 text-lime-600"
            />
          </div>

          <form
            class="mt-4 space-y-3"
            @submit.prevent="searchRoutes(true)"
          >
            <!-- Origin -->
            <div
              class="flex items-center gap-2 rounded-2xl border border-neutral-900/10 bg-white/70 px-3 py-1.5 transition focus-within:border-lime-500 focus-within:ring-4 focus-within:ring-lime-300/15"
            >
              <UIcon
                name="i-lucide-circle"
                class="size-3 shrink-0 text-neutral-500"
              />

              <UInput
                v-model="form.origin"
                aria-label="Trip origin"
                placeholder="Enter your starting point"
                autocomplete="off"
                variant="none"
                class="planner-input w-full"
              />
            </div>

            <!-- Swap button -->
            <div class="flex items-center justify-center">
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:border-lime-400 hover:bg-lime-50 hover:text-lime-700"
                aria-label="Swap origin and destination"
                @click="swapLocations"
              >
                <UIcon
                  name="i-lucide-arrow-down-up"
                  class="size-4"
                />
              </button>
            </div>

            <!-- Destination -->
            <div
              class="flex items-center gap-2 rounded-2xl border border-lime-400/40 bg-white/70 px-3 py-1.5 transition focus-within:border-lime-500 focus-within:ring-4 focus-within:ring-lime-300/15"
            >
              <UIcon
                name="i-lucide-map-pin"
                class="size-4 shrink-0 text-lime-600"
              />

              <UInput
                v-model="form.destination"
                aria-label="Trip destination"
                placeholder="Enter your destination"
                autocomplete="off"
                variant="none"
                class="planner-input w-full"
              />
            </div>

            <!-- Preferences -->
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <USelect
                v-model="form.departure"
                :items="departureOptions"
                aria-label="Departure preference"
                class="w-full"
              />

              <USelect
                v-model="form.vehicle"
                :items="vehicleOptions"
                aria-label="Vehicle preference"
                class="w-full"
              />
            </div>

            <UButton
              type="submit"
              block
              size="lg"
              icon="i-lucide-search"
              class="search-button rounded-full font-semibold"
              :loading="loading"
              :disabled="
                loading ||
                !form.origin.trim() ||
                !form.destination.trim()
              "
            >
              {{ loading ? 'Searching…' : 'Search Routes' }}
            </UButton>
          </form>
        </UCard>

        <!-- Fare estimate -->
        <UCard
          class="glass glow-lime rounded-30"
          :ui="{
            root: 'ring-0 rounded-30',
            body: 'relative z-10'
          }"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p
                class="font-display text-sm font-semibold text-neutral-900"
              >
                Fare estimate
              </p>

              <p
                v-if="fareRange"
                class="stat-num mt-2 text-3xl text-neutral-900"
              >
                ₱{{ fareRange.min.toFixed(0) }}

                <span
                  v-if="fareRange.max !== fareRange.min"
                >
                  –{{ fareRange.max.toFixed(0) }}
                </span>
              </p>

              <p
                v-else
                class="mt-2 text-sm font-medium text-neutral-500"
              >
                Search to calculate
              </p>
            </div>

            <span
              v-if="options.length"
              class="pill bg-lime-300/15 text-lime-700"
            >
              {{ options.length }} {{ options.length === 1 ? 'OPTION' : 'OPTIONS' }}
            </span>
          </div>

          <p class="mt-2 text-xs text-neutral-500">
            Comparison labels are calculated from the returned route data.
            Check each card’s source labels before treating a value as live.
          </p>
        </UCard>
      </div>

      <!-- Trip option comparison cards -->
      <div class="space-y-3 lg:col-span-3">
        <div
          v-if="options.length"
          class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          <button
            v-for="option in options"
            :key="option.id"
            type="button"
            class="glass card-lift flex h-full w-full flex-col rounded-30 p-4 text-left transition"
            :class="
              selectedOptionId === option.id
                ? CATEGORY_META[option.category].ringClass
                : ''
            "
            :aria-pressed="selectedOptionId === option.id"
            :aria-label="`View ${option.categories.map(category => CATEGORY_META[category].label).join(', ')} option on map`"
            @click="selectedOptionId = option.id"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="category in option.categories"
                :key="category"
                class="pill inline-flex items-center gap-1"
                :class="CATEGORY_META[category].badgeClass"
              >
                <UIcon :name="CATEGORY_META[category].icon" class="size-3" />
                {{ CATEGORY_META[category].label }}
              </span>

              <span
                v-if="option.is_recommended"
                class="pill bg-lime-100 text-lime-700"
              >
                Recommended
              </span>
            </div>

            <p class="mt-2.5 text-xs text-neutral-500">
              {{ option.origin }} → {{ option.destination }}
            </p>

            <p class="mt-0.5 text-sm font-semibold text-neutral-900">
              {{ option.service_name }}
            </p>

            <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <p class="text-[10px] uppercase tracking-wide text-neutral-400">
                  {{ option.fare_source === 'simulation' ? 'Demo fare' : 'Fare estimate' }}
                </p>
                <p class="font-semibold text-lime-700">{{ formatMoney(option.fare) }}</p>
                <p class="text-[10px] text-neutral-400">{{ sourceLabel(option.fare_source) }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wide text-neutral-400">
                  {{ option.travel_time_source === 'simulation' ? 'Demo travel time' : 'Travel estimate' }}
                </p>
                <p class="font-semibold text-neutral-900">{{ option.estimated_travel_minutes ?? '—' }} min</p>
                <p class="text-[10px] text-neutral-400">{{ sourceLabel(option.travel_time_source) }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wide text-neutral-400">{{ waitLabel(option) }}</p>
                <p class="font-semibold text-neutral-900">
                  <template v-if="option.predicted_wait_minutes">
                    {{ option.predicted_wait_minutes.low }}–{{ option.predicted_wait_minutes.high }} min
                  </template>
                  <template v-else>—</template>
                </p>
                <p class="text-[10px] text-neutral-400">{{ sourceLabel(option.wait_source) }}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wide text-neutral-400">Reliability</p>
                <p class="font-semibold text-neutral-900">
                  {{ option.reliability_classification || reliabilityLabel(option.reliability_score) }} · {{ Math.round(option.reliability_score * 100) }}%
                </p>
                <p class="text-[10px] text-neutral-400">Score for this comparison</p>
              </div>
            </div>

            <div class="mt-3 space-y-1 rounded-2xl bg-neutral-900/[0.035] p-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="text-neutral-500">{{ isDemoSource(option.data_quality.vehicle) ? 'Demo vehicle' : 'Vehicle' }}</span>
                <span class="font-semibold text-neutral-900">{{ option.vehicle?.vehicle_number || 'Not yet assigned' }}</span>
              </div>
              <div v-if="option.vehicle?.plate_number" class="flex items-center justify-between gap-2">
                <span class="text-neutral-500">Plate</span>
                <span class="font-medium text-neutral-700">{{ option.vehicle.plate_number }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-neutral-500">{{ isDemoSource(option.data_quality.vehicle) ? 'Demo status' : 'Status' }}</span>
                <span class="font-medium text-neutral-700">{{ vehicleStatusLabel(option.vehicle) }}</span>
              </div>
              <div v-if="occupancyLabel(option.vehicle)" class="flex items-center justify-between gap-2">
                <span class="text-neutral-500">{{ isDemoSource(option.data_quality.occupancy) ? 'Demo occupancy' : 'Occupancy' }}</span>
                <span class="font-medium text-neutral-700">{{ occupancyLabel(option.vehicle) }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-neutral-500">Pickup</span>
                <span class="truncate font-medium text-neutral-700">{{ option.pickup_stop?.name || '—' }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-neutral-500">Drop-off</span>
                <span class="truncate font-medium text-neutral-700">{{ option.dropoff_stop?.name || '—' }}</span>
              </div>
              <div v-if="option.transfer_stop" class="flex items-center gap-1.5 pt-1 text-amber-700">
                <UIcon name="i-lucide-repeat" class="size-3.5 shrink-0" />
                <span>{{ option.data_quality.route === 'simulation' ? 'Demo transfer at' : 'Transfer at' }} {{ option.transfer_stop.name }}</span>
              </div>
            </div>

            <p
              v-if="option.reason"
              class="mt-2.5 text-xs leading-relaxed text-neutral-500"
            >
              {{ option.reason }}
            </p>

            <p class="mt-2 text-[10px] leading-relaxed text-neutral-400">
              {{ option.data_notice }}
            </p>
          </button>
        </div>

        <!-- API error -->
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-wifi-off"
          title="Unable to search routes"
          :description="errorMessage"
          class="rounded-2xl"
        />

        <!-- No results / ready state -->
        <UCard
          v-if="!loading && !options.length && !errorMessage"
          class="glass rounded-30"
          :ui="{ root: 'ring-0 rounded-30' }"
        >
          <div
            class="flex flex-col items-center py-7 text-center"
          >
            <span
              class="flex size-12 items-center justify-center rounded-2xl bg-lime-300/15"
            >
              <UIcon
                :name="
                  searched
                    ? 'i-lucide-route-off'
                    : 'i-lucide-route'
                "
                class="size-6 text-lime-600"
              />
            </span>

            <h2
              class="mt-3 font-display font-semibold text-neutral-900"
            >
              {{
                searched
                  ? 'No matching active routes'
                  : 'Ready to plan your trip'
              }}
            </h2>

            <p
              class="mt-1 max-w-sm text-sm text-neutral-500"
            >
              Try a different origin, destination, or vehicle
              preference.
            </p>
          </div>
        </UCard>

        <!-- Stops -->
        <UAlert
          v-if="selectedOptionStops.length"
          color="warning"
          variant="soft"
          icon="i-lucide-info"
          :title="selectedOption ? `${CATEGORY_META[selectedOption.category].label} route stop details` : 'Route stop details'"
          :description="
            selectedOptionStops
              .map(stop => stop.name)
              .join(' → ')
          "
          class="rounded-2xl"
        />

        <!-- Map -->
        <PamanaMapPanel
          icon="i-lucide-map"
          :label="
            selectedOption
              ? `${selectedOption.route_code} · ${CATEGORY_META[selectedOption.category].label} route preview`
              : 'Route preview map'
          "
          height="clamp(320px, 48vw, 480px)"
          tone="lime"
          :route-points="selectedOptionStops"
          :markers="selectedOptionMarkers"
          :route-color="selectedRouteColor"
          :route-label="selectedOption ? `${selectedOption.service_name} · Approximate corridor` : 'Approximate corridor'"
          :route-dashed="selectedRouteIsSimulated"
          :fit-key="selectedOption?.id"
        >
          <template #overlay>
            <div class="m-3 ml-auto grid w-fit max-w-[calc(100%-1.5rem)] grid-cols-2 gap-x-3 gap-y-1 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-[10px] text-neutral-600 shadow-lg shadow-neutral-900/10 backdrop-blur sm:grid-cols-3">
              <span><span class="mr-1 text-lime-600">●</span>Origin</span>
              <span><span class="mr-1 text-orange-500">●</span>Destination</span>
              <span><span class="mr-1 text-slate-500">●</span>Intermediate</span>
              <span><span class="mr-1 text-violet-600">↔</span>Transfer</span>
              <span class="col-span-2 text-neutral-500 sm:col-span-1"><span class="mr-1 inline-block h-0.5 w-4 align-middle bg-lime-600"></span>Selected corridor</span>
            </div>
            <div class="hidden">
              <span><span class="mr-1 text-lime-600">●</span> Origin / pickup</span>
              <span><span class="mr-1 text-amber-600">●</span> Destination / drop-off</span>
              <span><span class="mr-1 text-slate-500">●</span> Intermediate stop</span>
              <span><span class="mr-1 text-violet-600">●</span> Transfer</span>
              <span v-if="selectedOption?.vehicle?.location"><span class="mr-1 text-cyan-600">●</span> Vehicle location</span>
              <span class="text-neutral-400">— Selected corridor</span>
            </div>
          </template>
        </PamanaMapPanel>

        <p class="text-xs text-neutral-500">
          Select a card to update the approximate corridor and stop markers. The line
          connects reference or demo stops in sequence; it is not verified road geometry or turn-by-turn navigation.
        </p>

        <UCard
          v-if="recommendedOptionId && options.length"
          class="glass rounded-30"
          :ui="{ root: 'ring-0 rounded-30' }"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-lime-700">PAMANA AI explanation</p>
              <p class="mt-1 text-sm leading-relaxed text-neutral-600">
                {{ recommendationExplanation || 'Ask PAMANA to explain the already calculated recommended route.' }}
              </p>
            </div>
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-sparkles"
              :loading="explainingRecommendation"
              @click="explainRecommendation"
            >
              {{ recommendationExplanation ? 'Explain again' : 'Explain recommendation' }}
            </UButton>
          </div>
          <p class="mt-3 text-xs leading-relaxed text-neutral-400">
            PAMANA calculates the route first. Gemini only explains the displayed route, fare, travel time, and wait estimate; it does not invent transport details.
          </p>
        </UCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.planner-input :deep(input) {
  color: #171717 !important;
  caret-color: #65a30d !important;
}

.planner-input :deep(input::placeholder) {
  color: #737373 !important;
  opacity: 1 !important;
}

.search-button {
  background-color: #84cc16 !important;
  color: #171717 !important;
}

.search-button:hover {
  background-color: #65a30d !important;
  color: #ffffff !important;
}

.search-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
</style>
