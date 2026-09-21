<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'driver']
})

useHead({
  title: 'Driver Dashboard | PAMANA'
})

const { apiFetch } = useApi()
const { user } = useAuth()
const toast = useToast()
const online = ref(true)
const startingTrip = ref(false)
const loadingRoutes = ref(false)
const startDirection = ref<'outbound' | 'inbound'>('outbound')
const selectedRouteId = ref<number | null>(null)

const firstName = computed(() => user.value?.username?.split(/[._\s-]/)[0] || 'Driver')

const quickActions = [
  { label: 'Navigation', icon: 'i-lucide-navigation', classes: 'text-emerald-600', to: '/driver/current-trip' },
  { label: 'Take a Break', icon: 'i-lucide-coffee', classes: 'text-emerald-600' },
  { label: 'Report Issue', icon: 'i-lucide-triangle-alert', classes: 'text-amber-500' },
  { label: 'Emergency', icon: 'i-lucide-phone', classes: 'text-red-500' }
]

interface ActiveTrip {
  documentId: string
  data_mode: 'REAL' | 'SIMULATED'
  route?: { origin: string; destination: string; estimated_travel_time: number | null }
  vehicle?: { capacity: number | null; occupancy_level: string | null }
}

interface AvailableRoute {
  id: number
  documentId: string
  route_code: string
  route_name: string
  origin: string
  destination: string
}

const OCCUPANCY_LEVEL_RATIO: Record<string, number> = {
  empty: 0,
  low: 0.25,
  moderate: 0.5,
  near_full: 0.75,
  full: 1
}

const activeTrip = ref<ActiveTrip | null>(null)
const availableRoutes = ref<AvailableRoute[]>([])

const routeOptions = computed(() =>
  availableRoutes.value.map(route => ({
    label: `${route.route_code} · ${route.origin} → ${route.destination}`,
    value: route.id
  }))
)

const selectedRoute = computed(() =>
  availableRoutes.value.find(route => route.id === selectedRouteId.value) ?? null
)

const outboundLabel = computed(() =>
  selectedRoute.value ? `Outbound · to ${selectedRoute.value.destination}` : 'Outbound'
)

const inboundLabel = computed(() =>
  selectedRoute.value ? `Inbound · to ${selectedRoute.value.origin}` : 'Inbound'
)

const tripOrigin = computed(() => activeTrip.value?.route?.origin ?? '—')
const tripDestination = computed(() => activeTrip.value?.route?.destination ?? '—')
const tripEta = computed(() => {
  const minutes = activeTrip.value?.route?.estimated_travel_time
  return typeof minutes === 'number' ? `${minutes} min` : '—'
})

const vehicleCapacity = computed(() => activeTrip.value?.vehicle?.capacity ?? 0)
const occupancyRatio = computed(() => {
  const level = activeTrip.value?.vehicle?.occupancy_level
  return level ? OCCUPANCY_LEVEL_RATIO[level] ?? 0 : 0
})
const occupancyCount = computed(() => Math.round(vehicleCapacity.value * occupancyRatio.value))
const occupancyPercent = computed(() => Math.round(occupancyRatio.value * 100))

async function loadActiveTrip() {
  try {
    const response = await apiFetch<{ data: ActiveTrip[] }>('/api/trips', {
      query: {
        'filters[trip_status][$eq]': 'active',
        populate: 'vehicle,route'
      }
    })

    activeTrip.value = response.data[0] ?? null
  } catch {
    activeTrip.value = null
  }
}

async function loadAvailableRoutes() {
  loadingRoutes.value = true

  try {
    const response = await apiFetch<{ data: AvailableRoute[] }>('/api/routes', {
      query: {
        'filters[route_status][$eq]': 'active',
        sort: 'route_name:asc',
        'fields[0]': 'route_code',
        'fields[1]': 'route_name',
        'fields[2]': 'origin',
        'fields[3]': 'destination'
      }
    })

    availableRoutes.value = Array.isArray(response.data) ? response.data : []
  } catch {
    availableRoutes.value = []
  } finally {
    loadingRoutes.value = false
  }
}

async function startTrip() {
  if (!selectedRouteId.value) {
    toast.add({
      title: 'Select a route',
      description: 'Choose the route assigned to your shift before starting a trip.',
      color: 'warning'
    })
    return
  }

  startingTrip.value = true

  try {
    await apiFetch('/api/trips', {
      method: 'POST',
      body: { data: { route: selectedRouteId.value, direction: startDirection.value } }
    })

    toast.add({
      title: 'Trip started',
      description: 'Head to Current Trip to send GPS updates and manage occupancy.',
      color: 'success'
    })

    await loadActiveTrip()
  } catch (error: any) {
    toast.add({
      title: 'Unable to start trip',
      description: error?.data?.error?.message || 'Please try again.',
      color: 'error'
    })
  } finally {
    startingTrip.value = false
  }
}

onMounted(() => {
  loadActiveTrip()
  loadAvailableRoutes()
})
</script>

<template>
  <div>
    <PamanaPageHeader title="Dashboard" role="driver" />

    <UCard class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-display text-xl font-bold capitalize text-neutral-900">
            Good morning, {{ firstName }}!
          </h2>
          <p class="mt-1 text-sm text-neutral-500">Have a safe and productive day.</p>
        </div>

        <label class="pill normal-case bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/40">
          <span class="badge-dot" :class="online ? 'bg-emerald-500' : 'bg-neutral-400'" />
          {{ online ? 'Online · Available' : 'Offline' }}
          <USwitch v-model="online" size="xs" color="success" />
        </label>
      </div>
    </UCard>

    <div class="mt-5 grid gap-5 lg:grid-cols-3">
      <UCard class="glass rounded-30 lg:col-span-2" :ui="{ root: 'ring-0 rounded-30' }">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-sm font-semibold text-neutral-900">Current Trip</h2>
          <div class="flex items-center gap-2">
            <span
              v-if="activeTrip"
              class="pill"
              :class="activeTrip.data_mode === 'SIMULATED' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'"
            >{{ activeTrip.data_mode }}</span>
            <span
              class="pill"
              :class="activeTrip ? 'bg-teal-100 text-teal-700' : 'bg-neutral-100 text-neutral-500'"
            >{{ activeTrip ? 'Ongoing' : 'No active trip' }}</span>
          </div>
        </div>

        <template v-if="activeTrip">
          <div class="mt-4 grid items-center gap-4 text-sm sm:grid-cols-[1fr_auto_1fr_auto]">
            <div>
              <p class="text-[11px] text-neutral-400">From</p>
              <p class="font-medium text-neutral-900">{{ tripOrigin }}</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="hidden size-4 text-neutral-300 sm:block" />
            <div class="sm:text-right">
              <p class="text-[11px] text-neutral-400">To</p>
              <p class="font-medium text-neutral-900">{{ tripDestination }}</p>
            </div>
            <div class="border-neutral-900/10 sm:border-l sm:pl-4 sm:text-right">
              <p class="text-[11px] text-neutral-400">ETA</p>
              <p class="font-medium text-neutral-900">{{ tripEta }}</p>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-3 gap-2">
            <div class="rounded-xl bg-neutral-900/[0.035] px-3 py-2 text-center">
              <p class="text-[10px] text-neutral-400">Passengers</p>
              <p class="stat-num text-sm">{{ occupancyCount }}</p>
            </div>
            <div class="rounded-xl bg-neutral-900/[0.035] px-3 py-2 text-center">
              <p class="text-[10px] text-neutral-400">Trip time</p>
              <p class="stat-num text-sm">{{ tripEta }}</p>
            </div>
            <div class="rounded-xl bg-lime-300/10 px-3 py-2 text-center">
              <p class="text-[10px] text-neutral-400">Collected fare</p>
              <p class="stat-num text-sm text-lime-700">₱420</p>
            </div>
          </div>

          <NuxtLink
            to="/driver/current-trip"
            class="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <UIcon name="i-lucide-navigation" class="size-4" />
            Go to Current Trip
          </NuxtLink>
        </template>

        <template v-else>
          <p class="mt-4 text-sm text-neutral-500">
            No trip in progress. Select your assigned route and direction to start a shift.
          </p>

          <USelect
            v-model="selectedRouteId"
            :items="routeOptions"
            placeholder="Select an active route"
            class="mt-4 w-full"
            :loading="loadingRoutes"
            aria-label="Route for this trip"
          />

          <p v-if="!loadingRoutes && routeOptions.length === 0" class="mt-2 text-xs text-amber-700">
            No active routes are available. Ask an administrator to configure one.
          </p>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-full border px-4 py-2 text-sm font-semibold transition"
              :class="startDirection === 'outbound' ? 'border-lime-500 bg-lime-100 text-lime-700' : 'border-neutral-900/10 text-neutral-500'"
              @click="startDirection = 'outbound'"
            >
              {{ outboundLabel }}
            </button>
            <button
              type="button"
              class="rounded-full border px-4 py-2 text-sm font-semibold transition"
              :class="startDirection === 'inbound' ? 'border-lime-500 bg-lime-100 text-lime-700' : 'border-neutral-900/10 text-neutral-500'"
              @click="startDirection = 'inbound'"
            >
              {{ inboundLabel }}
            </button>
          </div>

          <UButton
            block
            size="lg"
            icon="i-lucide-play"
            class="mt-3 rounded-full font-semibold"
            :loading="startingTrip"
            :disabled="startingTrip || !selectedRouteId"
            @click="startTrip"
          >
            Start Trip
          </UButton>
        </template>
      </UCard>

      <UCard class="glass glow-lime rounded-30" :ui="{ root: 'ring-0 rounded-30', body: 'relative z-10' }">
        <h2 class="font-display text-sm font-semibold text-neutral-900">Vehicle Occupancy</h2>
        <p class="stat-num mt-3 text-3xl text-neutral-900">
          {{ occupancyCount }}<span class="text-base font-medium text-neutral-400"> / {{ vehicleCapacity }} seats</span>
        </p>
        <p class="mt-1 text-xs text-neutral-400">{{ occupancyPercent }}% occupied</p>
        <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-900/[0.06]">
          <div class="h-full bg-gradient-to-r from-lime-400 to-amber-500" :style="{ width: `${occupancyPercent}%` }" />
        </div>
      </UCard>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NuxtLink
        v-for="action in quickActions"
        :key="action.label"
        :to="action.to || '/driver'"
        class="glass card-lift flex flex-col items-center gap-1.5 rounded-2xl p-4 text-xs font-semibold text-neutral-800"
      >
        <UIcon :name="action.icon" class="size-5" :class="action.classes" />
        {{ action.label }}
      </NuxtLink>
    </div>

    <p class="mt-4 text-xs text-neutral-400">Trip route, ETA, and occupancy are live. Collected fare is simulated prototype data.</p>
  </div>
</template>
