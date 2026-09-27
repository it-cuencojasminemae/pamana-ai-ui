<script setup lang="ts">
import type { ActiveDriverTrip } from '../../types/driverTrip'
import {
  DRIVER_GPS_PUBLISH_INTERVAL_MS,
  driverStopFeatures,
  driverVariantLines,
  normalizedOccupancy,
  orderedVariantStops
} from '../../services/driverTrip'

definePageMeta({ middleware: ['auth', 'driver'] })
useHead({ title: 'Current Trip | PAMANA' })

const { apiFetch } = useApi()
const toast = useToast()
const {
  location,
  observedAt,
  speed,
  heading,
  error: geolocationError,
  tracking,
  startTracking,
  stopTracking
} = useGeolocation()

const loading = ref(true)
const ending = ref(false)
const publishingGps = ref(false)
const gpsLastPublishedAt = ref<string | null>(null)
const gpsPublishError = ref<string | null>(null)
const activeTrip = ref<ActiveDriverTrip | null>(null)
const occupancy = ref(0)
let lastPublishStartedAt = 0

const capacity = computed(() => activeTrip.value?.vehicle?.capacity || 0)
const variantStops = computed(() => orderedVariantStops(activeTrip.value?.route_variant?.route_variant_stops))
const mapNodes = computed(() => driverStopFeatures(variantStops.value))
const mapLines = computed(() => driverVariantLines(activeTrip.value))
const occupancyStatus = computed(() => normalizedOccupancy(activeTrip.value?.vehicle?.occupancy_level))
const routeLabel = computed(() => {
  const trip = activeTrip.value
  if (!trip?.route_variant) return 'Directional route unavailable'
  return `${trip.route?.route_code || 'Route'} · ${trip.route_variant.display_name} · ${trip.route_variant.direction}`
})
const gpsStatus = computed(() => {
  if (gpsPublishError.value) return gpsPublishError.value
  if (publishingGps.value) return 'Publishing GPS…'
  if (gpsLastPublishedAt.value) return 'GPS live'
  if (geolocationError.value) return 'Location permission unavailable'
  return tracking.value ? 'Waiting for GPS fix…' : 'GPS inactive'
})

async function loadActiveTrip() {
  loading.value = true
  try {
    const response = await apiFetch<{ data: ActiveDriverTrip | null }>('/api/driver-active-trip')
    activeTrip.value = response.data
    occupancy.value = activeTrip.value?.vehicle?.current_occupancy || 0
    if (activeTrip.value) startTracking()
  } catch {
    activeTrip.value = null
  } finally {
    loading.value = false
  }
}

async function publishGps() {
  if (!activeTrip.value || !location.value || !observedAt.value || publishingGps.value) return
  const now = Date.now()
  if (now - lastPublishStartedAt < DRIVER_GPS_PUBLISH_INTERVAL_MS) return
  lastPublishStartedAt = now
  publishingGps.value = true
  gpsPublishError.value = null
  try {
    await apiFetch('/api/vehicle-locations', {
      method: 'POST',
      body: {
        data: {
          latitude: location.value.lat,
          longitude: location.value.lng,
          recorded_at: observedAt.value,
          speed: speed.value ?? undefined,
          heading: heading.value ?? undefined
        }
      }
    })
    gpsLastPublishedAt.value = new Date().toISOString()
  } catch {
    gpsPublishError.value = 'GPS update could not be published'
  } finally {
    publishingGps.value = false
  }
}

watch(observedAt, () => publishGps())

async function changeOccupancy(amount: number) {
  const vehicle = activeTrip.value?.vehicle
  if (!vehicle || capacity.value < 1) return
  const next = Math.min(capacity.value, Math.max(0, occupancy.value + amount))
  try {
    const response = await apiFetch<{ data: ActiveDriverTrip['vehicle']; meta?: { occupancy?: string } }>(`/api/vehicles/${vehicle.documentId}`, {
      method: 'PUT',
      body: { data: { current_occupancy: next } }
    })
    occupancy.value = next
    if (activeTrip.value?.vehicle && response.data) {
      activeTrip.value.vehicle.current_occupancy = response.data.current_occupancy
      activeTrip.value.vehicle.occupancy_level = response.data.occupancy_level
    }
  } catch (error: any) {
    toast.add({ title: 'Unable to update occupancy', description: error?.data?.error?.message || 'Please try again.', color: 'error' })
  }
}

async function endTrip() {
  if (!activeTrip.value) {
    toast.add({ title: 'No active trip found', description: 'Start a trip before trying to end one.', color: 'warning' })
    return
  }
  ending.value = true
  try {
    await apiFetch(`/api/trips/${activeTrip.value.documentId}`, {
      method: 'PUT',
      body: { data: { trip_status: 'completed' } }
    })
    stopTracking()
    toast.add({ title: 'Trip ended', description: 'The directional trip has been marked completed.', color: 'success' })
    await navigateTo('/driver')
  } catch (error: any) {
    toast.add({ title: 'Unable to end trip', description: error?.data?.error?.message || 'Please try again.', color: 'error' })
  } finally {
    ending.value = false
  }
}

onMounted(loadActiveTrip)
onBeforeUnmount(stopTracking)
</script>

<template>
  <div>
    <PamanaPageHeader title="Current Trip" role="driver" />

    <div v-if="loading" class="glass rounded-30 p-8 text-center text-sm text-neutral-500" role="status">
      Loading active trip…
    </div>

    <div v-else-if="!activeTrip" class="glass rounded-30 p-8 text-center">
      <UIcon name="i-lucide-route-off" class="mx-auto size-8 text-neutral-400" />
      <h2 class="mt-3 font-display text-lg font-semibold text-neutral-900">No active trip</h2>
      <p class="mt-1 text-sm text-neutral-500">Choose an eligible directional route variant from the Driver dashboard.</p>
      <UButton to="/driver" class="mt-5 rounded-full" icon="i-lucide-arrow-left">Driver dashboard</UButton>
    </div>

    <div v-else class="grid gap-5 lg:grid-cols-3">
      <PamanaMapPanel
        provider="maplibre"
        class="lg:col-span-2"
        icon="i-lucide-navigation"
        label="Live driver navigation"
        height="380px"
        tone="emerald"
        :transport-nodes="mapNodes"
        :lines="mapLines"
        :user-location="location"
        :fit-key="activeTrip.documentId"
      >
        <div class="pointer-events-none absolute right-4 bottom-4 z-20 glass-solid pill normal-case text-neutral-700">
          <span class="badge-dot" :class="gpsPublishError ? 'bg-amber-500' : gpsLastPublishedAt ? 'bg-emerald-500' : 'bg-neutral-400'" />
          {{ gpsStatus }}
        </div>
      </PamanaMapPanel>

      <div class="space-y-4">
        <UCard class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display text-sm font-semibold text-neutral-900">{{ activeTrip.route_variant?.display_name || 'Directional trip' }}</h2>
            <div class="flex items-center gap-2">
              <span class="pill" :class="activeTrip.data_mode === 'SIMULATED' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'">{{ activeTrip.data_mode }}</span>
              <span class="pill bg-teal-100 text-teal-700">In progress</span>
            </div>
          </div>
          <p class="mt-1 text-xs text-neutral-400">{{ routeLabel }}</p>
          <p v-if="activeTrip.route_variant?.signboard_text" class="mt-2 text-xs font-medium text-neutral-600">Signboard: {{ activeTrip.route_variant.signboard_text }}</p>

          <div v-if="variantStops.length" class="mt-4 space-y-3">
            <div v-for="(stop, index) in variantStops" :key="stop.documentId" class="flex items-start gap-2 text-sm">
              <span class="badge-dot mt-1.5 shrink-0" :class="index === 0 ? 'bg-amber-500' : 'bg-neutral-300'" />
              <span class="text-neutral-700">{{ stop.transport_node?.name || 'Unnamed verified node' }}</span>
              <span class="ml-auto text-right text-xs text-neutral-400">Stop {{ stop.sequence }}</span>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-neutral-500">No ordered stop sequence is available for this exact variant.</p>
        </UCard>

        <UCard class="glass glow-lime rounded-30" :ui="{ root: 'ring-0 rounded-30', body: 'relative z-10' }">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-display text-sm font-semibold text-neutral-900">Update occupancy</h2>
            <span class="pill bg-neutral-100 text-neutral-600">{{ occupancyStatus }}</span>
          </div>
          <div class="mt-4 flex items-center justify-between gap-4">
            <button type="button" class="btn-soft" aria-label="Remove one passenger" @click="changeOccupancy(-1)">− 1</button>
            <p class="stat-num text-2xl text-neutral-900">{{ occupancy }} / {{ capacity }}</p>
            <button type="button" class="btn-soft" aria-label="Add one passenger" @click="changeOccupancy(1)">+ 1</button>
          </div>
        </UCard>

        <UButton block size="lg" color="error" icon="i-lucide-square" class="rounded-full font-semibold" :loading="ending" @click="endTrip">
          End Trip
        </UButton>
      </div>
    </div>
  </div>
</template>
