<script setup lang="ts">
// @ts-nocheck
import { sortTransportNodesByGeographicDistance, transportNodeFeatureCollection, transportNodeTypeLabel } from '../../services/transportNodes'
import { locationMapFeature } from '../../services/locationPresentation'
import { pinQuery, readPinQuery } from '../../services/mapPins'
import { landmarkQuery, readLandmarkQuery, landmarkLocation } from '../../services/pilotLandmarks'
import type { SelectedLocation } from '../../types/location'
import { researchReferenceFeatures } from '../../services/researchPlanningPresentation'

definePageMeta({
  middleware: ['auth', 'passenger']
})

useHead({
  title: 'Live Map | PAMANA'
})

const { apiFetch } = useApi()
const pins = useMapPins()
const landmarks = usePilotLandmarks()
const planning = usePlanningCapabilities()
const researchMarkers = computed(() => researchReferenceFeatures(planning.referenceLocations.value))
const mapLandmarks = computed(() => landmarks.items.value.filter(item => !item.nodeType))
const pageRoute = useRoute()
const router = useRouter()
const selectedPin = ref<SelectedLocation | null>(null)
const pageReady = ref(false)
let viewActive = true
const pinFeatures = computed(() => selectedPin.value ? [locationMapFeature(selectedPin.value, pins.mode.value || 'origin')] : [])
function selectMapCoordinate(point: { lat: number; lng: number }) {
  if (!pins.mode.value) return
  const pin = pins.choose(point)
  if (!pin) return
  selectedPin.value = pin
  void router.replace({ query: { ...pageRoute.query, ...pinQuery('origin', pin) } })
  void pins.enrich(pin, value => { if (selectedPin.value?.id === pin.id) selectedPin.value = value })
}
function plannerLink(mode: 'origin' | 'destination') {
  return { path: '/passenger/trip-planner', query: { ...pinQuery(mode, selectedPin.value), planningMode: planning.mode.value, accessPreference: 'AUTO' } }
}
function clearPin() {
  selectedPin.value = null
  void router.replace({ query: { ...pageRoute.query, ...pinQuery('origin', null) } })
}
function chooseLandmark(id: string, mode: 'origin' | 'destination') {
  const item = landmarks.items.value.find(i => i.id === id)
  if (item) void navigateTo({ path: '/passenger/trip-planner', query: { ...landmarkQuery(mode, landmarkLocation(item)), planningMode: planning.mode.value, accessPreference: 'AUTO' } })
}
watch(planning.mode, () => {
  pins.mode.value = null
})
const simulation = useDemoVehicleFeed()
const simulatedFeedConfigured = simulation.enabled
const { location: userLocation, error: locationError, loading: locationLoading } = useGeolocation()
const {
  nodes: pamanaTransportNodes,
  diagnostics: transportNodeDiagnostics,
  status: transportNodeStatus,
  load: loadTransportNodes
} = useTransportNodes()

const locationStatusLabel = computed(() => {
  if (userLocation.value) return 'Your location available'
  if (locationError.value) return 'Location unavailable'
  if (locationLoading.value) return 'Locating…'
  return 'Pilot corridor'
})

interface LiveVehicle {
  availability?: import('../../types/vehicleAvailability').VehicleAvailability
  vehicle_id: number
  documentId: string
  vehicle_number: string
  occupancy_level: string | null
  data_mode: 'REAL' | 'SIMULATED'
  direction: string
  latitude?: number | string | null
  longitude?: number | string | null
  last_latitude?: number | string | null
  last_longitude?: number | string | null
  updated_at?: string | null
}

const transportNodeFeatures = computed(() => transportNodeFeatureCollection(pamanaTransportNodes.value).features)
const nearbyStops = computed(() => {
  if (!userLocation.value) return []
  return sortTransportNodesByGeographicDistance(pamanaTransportNodes.value, userLocation.value)
    .slice(0, 5)
    .map(({ node, distanceKm }) => ({
      id: node.id,
      name: node.name,
      type: transportNodeTypeLabel(node.type),
      distance: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`
    }))
})

const transportNodeStatusMessage = computed(() => {
  if (transportNodeStatus.value === 'loading') return 'Loading verified transport nodes…'
  if (transportNodeStatus.value === 'unauthorized') return 'Verified transport nodes are unavailable for this account.'
  if (transportNodeStatus.value === 'error') return 'Verified transport nodes are temporarily unavailable.'
  if (transportNodeStatus.value === 'ready' && !pamanaTransportNodes.value.length) return 'Verified nearby stops are not available yet.'
  if (!userLocation.value) return 'Share your location to sort verified stops by geographic distance.'
  return ''
})

const rawVehicles = ref<LiveVehicle[]>([])
const simulatedSnapshot = simulation.snapshot
const loadingSimulation = simulation.loading
const loadingVehicles = ref(false)
const loadError = ref('')
const simulationError = simulation.error
const lastUpdatedAt = ref<Date | null>(null)

let pollTimer:
  | ReturnType<typeof setInterval>
  | undefined

const vehicles = computed(() => {
  const realOrLegacy = rawVehicles.value.map(vehicle => {
    return {
      id:
        vehicle.documentId ||
        `${vehicle.vehicle_id}-${vehicle.vehicle_number}`,
      vehicleNumber:
        vehicle.vehicle_number ||
        `Vehicle ${vehicle.vehicle_id}`,
      availability: vehicle.availability,
      dataMode: vehicle.data_mode === 'REAL' ? 'REAL' : 'SIMULATED',
      direction:
        vehicle.direction === 'inbound'
          ? 'Inbound'
          : vehicle.direction === 'outbound'
            ? 'Outbound'
            : vehicle.direction || 'Direction unavailable'
    }
  })
  const demo = (simulatedSnapshot.value?.vehicles || []).map(vehicle => ({
    id: vehicle.id,
    vehicleNumber: vehicle.label,
    occupancy: vehicle.occupancy.replace('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase()),
    occupancyKey: vehicle.occupancy.toLowerCase(),
    dataMode: 'SIMULATED' as const,
    direction: vehicle.dataFreshness.status === 'STALE'
      ? 'Stale location · diagnostic only'
      : `${vehicle.tripState.replace('_', ' ')} · ${vehicle.transportMode}`
  }))
  return [...realOrLegacy, ...demo]
})

const simulatedMapFeatures = simulation.features
const realActiveVehicleCount = computed(() => rawVehicles.value.filter(vehicle => vehicle.data_mode === 'REAL').length)
const simulatedActiveVehicleCount = computed(() =>
  rawVehicles.value.filter(vehicle => vehicle.data_mode !== 'REAL').length
  + (simulatedSnapshot.value?.freshActiveVehicleCount || 0)
)
const simulatedStaleVehicleCount = computed(() => simulatedSnapshot.value?.staleVehicleCount || 0)
const hasSimulatedVehicles = computed(() => rawVehicles.value.some(vehicle => vehicle.data_mode !== 'REAL') || simulatedMapFeatures.value.length > 0)

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) {
    return 'Waiting for live data'
  }

  return `Updated ${lastUpdatedAt.value.toLocaleTimeString(
    undefined,
    {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    }
  )}`
})

function getOccupancyClasses(level: string) {
  if (level === 'full') {
    return 'bg-red-100 text-red-700'
  }

  if (level === 'near_full') {
    return 'bg-amber-100 text-amber-700'
  }

  if (level === 'moderate') {
    return 'bg-yellow-100 text-yellow-700'
  }

  return 'bg-lime-100 text-lime-700'
}

async function loadNearbyVehicles() {
  // Prevent requests from overlapping.
  if (loadingVehicles.value) {
    return
  }

  loadingVehicles.value = true

  try {
    const response = await apiFetch<{
      data: LiveVehicle[]
    }>('/api/live-vehicles')

    if (Array.isArray(response?.data)) {
      rawVehicles.value = response.data
    }

    loadError.value = ''
    lastUpdatedAt.value = new Date()
  } catch (error: any) {
    // Keep the last successful list during a temporary failure.
    loadError.value =
      error?.data?.error?.message ||
      error?.statusMessage ||
      'Live vehicle data is temporarily unavailable.'
  } finally {
    loadingVehicles.value = false
  }
}

async function loadSimulatedVehicles() {
  await simulation.refresh()
}

async function refreshVehicleFeeds() {
  await Promise.allSettled([loadNearbyVehicles(), loadSimulatedVehicles()])
}

function startPolling() {
  stopPolling()

  // Poll every 15 seconds instead of every 5 seconds.
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      refreshVehicleFeeds()
    }
  }, 15000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    refreshVehicleFeeds()
  } else simulation.cancel()
}

onMounted(async () => {
  refreshVehicleFeeds()
  loadTransportNodes()
  startPolling()

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  )
  await Promise.all([planning.load(), landmarks.load(), pins.load()])
  if (!viewActive) return
  planning.restore()
  await router.replace({ query: { ...pageRoute.query, planningMode: planning.mode.value, accessPreference: 'AUTO' } })
  if (!viewActive) return
  const saved = readPinQuery(pageRoute.query, 'origin')
  if (saved.present && saved.location) selectedPin.value = pins.choose(saved.location)
  pageReady.value = true
})

onBeforeUnmount(() => {
  viewActive = false
  stopPolling()

  document.removeEventListener(
    'visibilitychange',
    handleVisibilityChange
  )
})
</script>

<template>
  <div>
    <PamanaPageHeader
      title="Live Map"
      role="passenger"
    />
    <DemoPamanaDemoVehicleControls v-if="simulatedFeedConfigured" class="mb-4" :snapshot="simulatedSnapshot" :loading="simulation.loading.value" :error="simulationError" :elapsed-seconds="simulation.elapsedSeconds.value" @sample="simulation.sample" />

    <!-- Map status bar -->
    <div
      class="mb-4 flex flex-col gap-3 rounded-2xl border border-neutral-900/10 bg-white/70 p-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="pill normal-case bg-lime-100 text-lime-700"
        >
          <span class="badge-dot bg-lime-500" />
          Available
        </span>

        <span
          class="pill normal-case bg-amber-100 text-amber-700"
        >
          <span class="badge-dot bg-amber-500" />
          Near full
        </span>

        <span
          class="pill normal-case bg-red-100 text-red-700"
        >
          <span class="badge-dot bg-red-500" />
          Full
        </span>

        <span
          v-if="userLocation"
          class="pill normal-case bg-sky-100 text-sky-700"
        >
          <UIcon
            name="i-lucide-map-pin"
            class="size-3.5"
          />

          Your location
        </span>

        <span
          v-if="hasSimulatedVehicles"
          class="pill normal-case bg-amber-100 text-amber-800"
          aria-label="Simulated demonstration vehicles are visible"
        >
          <UIcon name="i-lucide-flask-conical" class="size-3.5" />
          SIMULATED DEMO
        </span>
      </div>

      <div
        class="flex items-center justify-between gap-3 sm:justify-end"
      >
        <p class="text-xs text-neutral-500">
          {{ lastUpdatedText }}
        </p>

        <UButton data-pamana-feedback
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-refresh-cw"
          class="rounded-full"
          :loading="loadingVehicles || loadingSimulation"
          :disabled="loadingVehicles || loadingSimulation"
          @click="refreshVehicleFeeds"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <!-- Live map -->
      <div class="space-y-3 lg:col-span-2">
        <LocationPamanaPinControls :area-label="pins.area.value?.label" :enabled="pageReady && pins.enabled.value" :loading="!pageReady || pins.loading.value" :mode="pins.mode.value" :error="pins.error.value" @choose="pins.start" @retry="pins.load" />
        <div v-if="pageReady && selectedPin" class="flex flex-wrap items-center gap-2 rounded-2xl bg-lime-50 p-3">
          <p class="w-full text-sm text-neutral-700">{{ selectedPin.label }}</p>
          <UButton data-pamana-feedback :to="plannerLink('origin')" size="sm" class="rounded-full">Plan from here</UButton>
          <UButton data-pamana-feedback :to="plannerLink('destination')" size="sm" color="neutral" variant="soft" class="rounded-full">Plan to here</UButton>
          <UButton data-pamana-feedback size="sm" color="neutral" variant="ghost" @click="clearPin">Clear pin</UButton>
        </div>
        <PamanaMapPanel
          provider="maplibre"
          passenger-focus
          icon="i-lucide-map"
          label="Live transport map"
          height="460px"
          tone="lime"
          :markers="rawVehicles"
          :vehicles="simulatedMapFeatures"
          :transport-nodes="transportNodeFeatures"
          :user-location="userLocation"
          :nodes="[...pinFeatures, ...researchMarkers]"
          :fit-key="selectedPin ? `${selectedPin.lat}|${selectedPin.lng}` : ''"
          :pin-boundary="pins.displayBoundary.value"
          :pin-selection-active="Boolean(pins.mode.value)"
          :landmarks="pageReady ? mapLandmarks : []"
          @landmark-chosen="chooseLandmark"
          @coordinate-selected="selectMapCoordinate"
        >
          <div
            v-if="hasSimulatedVehicles"
            class="pointer-events-none absolute right-14 top-3 z-20 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[10px] font-bold tracking-wide text-amber-800 shadow-sm"
          >
            SIMULATED DEMO · NOT REAL TRANSPORT DATA
          </div>
        </PamanaMapPanel>

        <!-- Status is outside the map -->
        <div
          class="flex flex-col gap-2 px-1 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between"
        >
          <span class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-crosshair"
              class="size-3.5 text-lime-600"
            />

            {{ locationStatusLabel }}
          </span>

          <span>{{ realActiveVehicleCount }} REAL active · {{ simulatedActiveVehicleCount }} SIMULATED fresh active<span v-if="simulatedStaleVehicleCount"> · {{ simulatedStaleVehicleCount }} stale</span></span>
        </div>

        <UAlert
          v-if="loadError"
          color="warning"
          variant="soft"
          icon="i-lucide-wifi-off"
          title="Live updates interrupted"
          :description="loadError"
          class="rounded-2xl"
        />

        <UAlert
          v-if="simulationError && simulatedFeedConfigured"
          color="neutral"
          variant="soft"
          icon="i-lucide-flask-conical-off"
          title="Simulation unavailable"
          :description="simulationError"
          class="rounded-2xl"
        />
      </div>

      <!-- Side information -->
      <div class="space-y-3">
        <!-- Nearby stops -->
        <UCard v-pamana-reveal
          class="glass rounded-30"
          :ui="{ root: 'ring-0 rounded-30' }"
        >
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-map-pinned"
              class="size-4 text-lime-600"
            />

            <h2
              class="font-display text-sm font-semibold text-neutral-900"
            >
              Nearby stops
            </h2>
          </div>

          <div
            class="mt-3 divide-y divide-neutral-900/5"
          >
            <div
              v-for="stop in nearbyStops"
              :key="stop.id"
              class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span class="min-w-0 text-sm text-neutral-700">
                <strong class="block truncate font-semibold">{{ stop.name }}</strong>
                <span class="block text-xs text-neutral-500">{{ stop.type }}</span>
              </span>

              <span
                class="pill shrink-0 bg-lime-300/15 normal-case text-lime-700"
              >
                {{ stop.distance }}
              </span>
            </div>

            <p v-if="transportNodeStatusMessage" class="py-3 text-sm text-neutral-500" role="status">
              {{ transportNodeStatusMessage }}
            </p>
          </div>

          <p v-if="nearbyStops.length" class="mt-3 text-xs leading-relaxed text-neutral-500">
            Sorted by geographic distance only. This is not a boarding or route recommendation.
          </p>

          <p v-if="transportNodeDiagnostics.unmapped || transportNodeDiagnostics.malformed" class="mt-2 text-xs leading-relaxed text-amber-700">
            {{ transportNodeDiagnostics.unmapped + transportNodeDiagnostics.malformed }} transport {{ transportNodeDiagnostics.unmapped + transportNodeDiagnostics.malformed === 1 ? 'record is' : 'records are' }} not mapped because verified coordinates are unavailable.
          </p>
        </UCard>

        <!-- Active vehicles -->
        <UCard v-pamana-reveal
          class="glass glow-lime rounded-30"
          :ui="{
            root: 'ring-0 rounded-30',
            body: 'relative z-10'
          }"
        >
          <div class="flex items-center justify-between gap-3">
            <h2
              class="font-display text-sm font-semibold text-neutral-900"
            >
              Active vehicles nearby
            </h2>

            <span
              v-if="vehicles.length"
              class="pill bg-lime-100 text-lime-700"
            >
              {{ vehicles.length }}
            </span>
          </div>

          <div
            v-if="loadingVehicles && !vehicles.length"
            class="flex items-center justify-center py-8"
          >
            <div class="text-center">
              <div
                class="mx-auto size-8 animate-spin rounded-full border-4 border-neutral-900/10 border-t-lime-500"
              />

              <p class="mt-3 text-xs text-neutral-500">
                Loading vehicles...
              </p>
            </div>
          </div>

          <div
            v-else-if="vehicles.length"
            class="mt-3 space-y-3"
          >
            <div
              v-for="vehicle in vehicles"
              :key="vehicle.id"
              class="flex items-center gap-3 rounded-2xl border border-neutral-900/5 bg-white/50 p-3"
            >
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-300/15"
              >
                <UIcon
                  name="i-lucide-bus-front"
                  class="size-4 text-lime-600"
                />
              </span>

              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-semibold text-neutral-800"
                >
                  {{ vehicle.vehicleNumber }}
                </p>

                <p class="text-xs text-neutral-500">
                  {{ vehicle.direction }}
                </p>
              </div>

              <div class="flex shrink-0 flex-col items-end gap-1">
                <span
                  class="pill normal-case"
                  :class="vehicle.dataMode === 'SIMULATED' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'"
                >
                  {{ vehicle.dataMode }}
                </span>
                <PamanaVehicleAvailability v-if="vehicle.dataMode === 'REAL'" :availability="vehicle.availability" />
                <span v-else
                  class="pill normal-case"
                  :class="getOccupancyClasses(vehicle.occupancyKey)"
                >
                  {{ vehicle.occupancy }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-else
            class="flex flex-col items-center py-7 text-center"
          >
            <span
              class="flex size-11 items-center justify-center rounded-2xl bg-neutral-100"
            >
              <UIcon
                name="i-lucide-bus-front"
                class="size-5 text-neutral-400"
              />
            </span>

            <p
              class="mt-3 text-sm font-semibold text-neutral-700"
            >
              No active vehicles
            </p>

            <p class="mt-1 text-xs text-neutral-500">
              Live vehicles will appear here.
            </p>
          </div>
        </UCard>

        <p
          class="px-2 text-xs leading-relaxed text-neutral-500"
        >
          Vehicle positions come from the live API. Updates pause
          when this browser tab is not visible. Simulated vehicles are labeled and counted separately.
        </p>
      </div>
    </div>
  </div>
</template>
