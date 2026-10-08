<script setup lang="ts">
import type { ActiveDriverTrip, DriverTripOptions } from '../../types/driverTrip'
import { normalizedOccupancy, routeVariantLabel } from '../../services/driverTrip'

definePageMeta({ middleware: ['auth', 'driver'] })
useHead({ title: 'Driver Dashboard | PAMANA' })

const { apiFetch } = useApi()
const { user } = useAuth()
const toast = useToast()
const online = ref(true)
const loadingOptions = ref(false)
const startingTrip = ref(false)
const activeTrip = ref<ActiveDriverTrip | null>(null)
const tripOptions = ref<DriverTripOptions | null>(null)
const selectedRouteDocumentId = ref<string | null>(null)
const selectedVariantDocumentId = ref<string | null>(null)

const firstName = computed(() => user.value?.username?.split(/[._\s-]/)[0] || 'Driver')
const quickActions = [
  { label: 'Navigation', icon: 'i-lucide-navigation', classes: 'text-emerald-600', to: '/driver/current-trip' },
  { label: 'Take a Break', icon: 'i-lucide-coffee', classes: 'text-emerald-600' },
  { label: 'Report Issue', icon: 'i-lucide-triangle-alert', classes: 'text-amber-500' },
  { label: 'Emergency', icon: 'i-lucide-phone', classes: 'text-red-500' }
]

const availableRoutes = computed(() => tripOptions.value?.routes || [])
const selectedRoute = computed(() => availableRoutes.value.find(route => route.documentId === selectedRouteDocumentId.value) || null)
const selectedVariant = computed(() => selectedRoute.value?.variants.find(variant => variant.documentId === selectedVariantDocumentId.value) || null)
const routeItems = computed(() => availableRoutes.value.map(route => ({
  label: `${route.routeName} · ${route.origin} → ${route.destination}`,
  value: route.documentId
})))
const variantItems = computed(() => (selectedRoute.value?.variants || []).map(variant => ({
  label: routeVariantLabel(variant),
  value: variant.documentId
})))
const vehicleCapacity = computed(() => activeTrip.value?.vehicle?.capacity ?? tripOptions.value?.vehicle?.capacity ?? 0)
const occupancyCount = computed(() => activeTrip.value?.vehicle?.current_occupancy ?? 0)
const occupancyPercent = computed(() => vehicleCapacity.value ? Math.round(occupancyCount.value / vehicleCapacity.value * 100) : 0)
const occupancyStatus = computed(() => normalizedOccupancy(activeTrip.value?.vehicle?.occupancy_level))
const emptyMessage = computed(() => {
  if (tripOptions.value?.emptyReason === 'NO_ASSIGNED_VEHICLE') return 'No vehicle is assigned to this driver account.'
  if (tripOptions.value?.emptyReason === 'NO_ASSIGNED_ROUTE') return 'The assigned vehicle has no route.'
  return 'No eligible directional variants are available. Research-only and inactive variants remain unavailable.'
})

watch(selectedRouteDocumentId, () => {
  if (!selectedRoute.value?.variants.some(variant => variant.documentId === selectedVariantDocumentId.value)) {
    selectedVariantDocumentId.value = selectedRoute.value?.variants[0]?.documentId || null
  }
})

async function loadActiveTrip() {
  try {
    const response = await apiFetch<{ data: ActiveDriverTrip | null }>('/api/driver-active-trip')
    activeTrip.value = response.data
  } catch {
    activeTrip.value = null
  }
}

async function loadOptions() {
  loadingOptions.value = true
  try {
    const response = await apiFetch<{ data: DriverTripOptions }>('/api/driver-trip-options')
    tripOptions.value = response.data
    selectedRouteDocumentId.value = response.data.routes[0]?.documentId || null
    selectedVariantDocumentId.value = response.data.routes[0]?.variants[0]?.documentId || null
  } catch {
    tripOptions.value = { vehicle: null, routes: [], activeTripDocumentId: null, emptyReason: 'NO_ELIGIBLE_VARIANTS' }
  } finally {
    loadingOptions.value = false
  }
}

async function startTrip() {
  if (!selectedVariantDocumentId.value) {
    toast.add({ title: 'Select a direction', description: 'Choose an eligible directional route variant first.', color: 'warning' })
    return
  }
  startingTrip.value = true
  try {
    await apiFetch('/api/trips', {
      method: 'POST',
      body: { data: { route_variant: selectedVariantDocumentId.value } }
    })
    toast.add({ title: 'Trip started', description: 'GPS and occupancy updates are now available in Current Trip.', color: 'success' })
    await loadActiveTrip()
  } catch (error: any) {
    toast.add({ title: 'Unable to start trip', description: error?.data?.error?.message || 'Please try again.', color: 'error' })
  } finally {
    startingTrip.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadActiveTrip(), loadOptions()])
})
</script>

<template>
  <div>
    <PamanaPageHeader title="Dashboard" role="driver" />

    <UCard class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
      <div class="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center">
        <div class="min-w-0">
          <h2 class="font-display text-xl font-bold capitalize text-neutral-900">Good morning, {{ firstName }}!</h2>
          <p class="mt-1 text-sm text-neutral-500">Have a safe and productive day.</p>
        </div>
        <label
          class="pill flex w-full items-center justify-between normal-case ring-1 sm:w-52"
          :class="online
            ? 'bg-emerald-100 text-emerald-800 ring-emerald-300/50'
            : 'bg-neutral-100 text-neutral-700 ring-neutral-300/70'"
        >
          <span class="flex min-w-0 items-center gap-2 whitespace-nowrap">
            <span class="badge-dot shrink-0" :class="online ? 'bg-emerald-500' : 'bg-neutral-400'" />
            {{ online ? 'Online · Available' : 'Offline' }}
          </span>
          <USwitch v-model="online" size="xs" color="success" aria-label="Driver availability" />
        </label>
      </div>
    </UCard>

    <div class="mt-5 grid gap-5 lg:grid-cols-3">
      <UCard class="glass rounded-30 lg:col-span-2" :ui="{ root: 'ring-0 rounded-30' }">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-sm font-semibold text-neutral-900">Current Trip</h2>
          <div class="flex items-center gap-2">
            <span v-if="activeTrip" class="pill" :class="activeTrip.data_mode === 'SIMULATED' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'">
              {{ activeTrip.data_mode }}
            </span>
            <span class="pill" :class="activeTrip ? 'bg-teal-100 text-teal-700' : 'bg-neutral-100 text-neutral-500'">
              {{ activeTrip ? 'Ongoing' : 'No active trip' }}
            </span>
          </div>
        </div>

        <template v-if="activeTrip">
          <div class="mt-4 grid items-center gap-4 text-sm sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <p class="text-[11px] text-neutral-400">Directional variant</p>
              <p class="font-medium text-neutral-900">{{ activeTrip.route_variant?.display_name || 'Unavailable' }}</p>
              <p class="mt-1 text-xs text-neutral-500">{{ activeTrip.route_variant?.direction || activeTrip.direction }}</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="hidden size-4 text-neutral-300 sm:block" />
            <div class="sm:text-right">
              <p class="text-[11px] text-neutral-400">Route</p>
              <p class="font-medium text-neutral-900">{{ activeTrip.route?.route_name || 'Unavailable' }}</p>
              <p v-if="activeTrip.route_variant?.signboard_text" class="mt-1 text-xs text-neutral-500">Signboard: {{ activeTrip.route_variant.signboard_text }}</p>
            </div>
          </div>
          <NuxtLink to="/driver/current-trip" class="mt-5 flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white">
            <UIcon name="i-lucide-navigation" class="size-4" />
            Go to Current Trip
          </NuxtLink>
        </template>

        <template v-else>
          <p class="mt-4 text-sm text-neutral-500">Select the route assigned to your vehicle, then choose its exact direction.</p>
          <div v-if="tripOptions?.vehicle" class="mt-4 rounded-2xl bg-neutral-900/[0.035] px-4 py-3 text-sm">
            <p class="text-[11px] text-neutral-400">Assigned vehicle</p>
            <p class="font-semibold text-neutral-900">{{ tripOptions.vehicle.vehicleNumber }} · {{ tripOptions.vehicle.plateNumber }}</p>
          </div>
          <USelect v-model="selectedRouteDocumentId" :items="routeItems" placeholder="Select assigned route" class="mt-4 w-full" :loading="loadingOptions" aria-label="Assigned route" />
          <USelect v-model="selectedVariantDocumentId" :items="variantItems" placeholder="Select directional variant" class="mt-3 w-full" :disabled="!selectedRouteDocumentId || variantItems.length === 0" aria-label="Directional route variant" />
          <div v-if="selectedVariant" class="mt-3 rounded-2xl border border-lime-300/50 bg-lime-50/70 px-4 py-3 text-sm text-neutral-700">
            <p class="font-semibold text-neutral-900">{{ selectedVariant.origin }} → {{ selectedVariant.destination }}</p>
            <p class="mt-1 text-xs">{{ selectedVariant.direction }} · {{ selectedVariant.operatingStatus }}</p>
            <p v-if="selectedVariant.signboard" class="mt-1 text-xs">Verified signboard: {{ selectedVariant.signboard }}</p>
          </div>
          <p v-if="!loadingOptions && variantItems.length === 0" class="mt-3 text-xs text-amber-700">{{ emptyMessage }}</p>
          <UButton block size="lg" icon="i-lucide-play" class="mt-3 rounded-full font-semibold" :loading="startingTrip" :disabled="startingTrip || !selectedVariantDocumentId" @click="startTrip">
            Start Trip
          </UButton>
        </template>
      </UCard>

      <UCard class="glass glow-lime rounded-30" :ui="{ root: 'ring-0 rounded-30', body: 'relative z-10' }">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-display text-sm font-semibold text-neutral-900">Vehicle Occupancy</h2>
          <span class="pill bg-neutral-100 text-neutral-600">{{ occupancyStatus }}</span>
        </div>
        <p class="stat-num mt-3 text-3xl text-neutral-900">{{ occupancyCount }}<span class="text-base font-medium text-neutral-400"> / {{ vehicleCapacity }} seats</span></p>
        <p class="mt-1 text-xs text-neutral-400">{{ occupancyPercent }}% occupied</p>
        <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-900/[0.06]">
          <div class="h-full bg-gradient-to-r from-lime-400 to-amber-500" :style="{ width: `${occupancyPercent}%` }" />
        </div>
      </UCard>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NuxtLink v-for="action in quickActions" :key="action.label" :to="action.to || '/driver'" class="glass card-lift flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-center text-xs font-semibold text-neutral-800 sm:p-4">
        <UIcon :name="action.icon" class="size-5" :class="action.classes" />
        <span class="leading-tight">{{ action.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
