<script setup lang="ts">
import type { ActiveDriverTrip } from '../../types/driverTrip'
import {
  DRIVER_GPS_PUBLISH_INTERVAL_MS,
  driverStopFeatures,
  driverVariantLines,
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
const confirmingEnd = ref(false)
let lastPublishStartedAt = 0

const variantStops = computed(() => orderedVariantStops(activeTrip.value?.route_variant?.route_variant_stops))
const mapNodes = computed(() => driverStopFeatures(variantStops.value))
const mapLines = computed(() => driverVariantLines(activeTrip.value))
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

async function endTrip() {
  if (ending.value) return
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
      <UButton data-pamana-feedback to="/driver" class="mt-5 rounded-full" icon="i-lucide-arrow-left">Driver dashboard</UButton>
    </div>

    <div v-else class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <PamanaMapPanel
        provider="maplibre"
        class="driver-trip-map min-w-0 self-start"
        icon="i-lucide-navigation"
        label="Live driver navigation"
        height="var(--driver-trip-map-height)"
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

      <div class="min-w-0 space-y-4">
        <UCard v-pamana-reveal class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex flex-wrap items-center justify-between gap-2">
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

        <DriverPamanaAvailabilityControls :key="activeTrip.documentId" :trip-id="activeTrip.documentId" :availability="activeTrip.availability" :disabled="ending" @updated="activeTrip.availability = $event" />

        <UButton data-pamana-feedback v-if="!confirmingEnd" block size="lg" color="error" icon="i-lucide-square" class="min-h-12 rounded-full font-semibold" @click="confirmingEnd = true">
          End Trip
        </UButton>
        <section v-else class="rounded-2xl border border-red-200 bg-red-50 p-4" aria-label="Confirm ending trip">
          <p class="text-sm font-semibold text-neutral-900">End this trip?</p>
          <p class="mt-1 text-xs text-neutral-600">GPS sharing for this trip will stop.</p>
          <div class="mt-3 flex gap-2">
            <UButton data-pamana-feedback class="min-h-12 flex-1 justify-center rounded-xl" color="neutral" variant="soft" :disabled="ending" @click="confirmingEnd = false">Keep trip</UButton>
            <UButton data-pamana-feedback class="min-h-12 flex-1 justify-center rounded-xl" color="error" :loading="ending" :disabled="ending" @click="endTrip">End Trip</UButton>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.driver-trip-map { --driver-trip-map-height: 340px; }
@media (min-width: 1024px) {
  .driver-trip-map { --driver-trip-map-height: 560px; }
}
</style>
