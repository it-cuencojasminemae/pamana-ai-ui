<script setup lang="ts">
import { previewLine, previewVehicles } from '../../services/demoVehiclePreview'
import { simulatedVehicleFeatures } from '../../services/simulatedLiveVehicles'
import type { SimulatedOccupancy } from '../../types/liveVehicle'

definePageMeta({ layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

const elapsedSeconds = ref(15)
const running = ref(false)
const narrow = ref(false)
const stale = ref(false)
const occupancy = ref<SimulatedOccupancy>('AVAILABLE')
const mapState = ref('INITIALIZING')
const previewUserLocation = Object.freeze({ lat: 5, lng: 140 })
let timer: ReturnType<typeof setInterval> | undefined

const snapshots = computed(() => previewVehicles(elapsedSeconds.value, stale.value).map((vehicle, index) => (
  index === 0 ? { ...vehicle, occupancy: occupancy.value } : vehicle
)))
const vehicleFeatures = computed(() => simulatedVehicleFeatures(snapshots.value))
const freshActiveCount = computed(() => snapshots.value.filter(vehicle => vehicle.tripState === 'ACTIVE' && vehicle.dataFreshness.status === 'FRESH').length)
const staleCount = computed(() => snapshots.value.filter(vehicle => vehicle.dataFreshness.status === 'STALE').length)

function stop() {
  running.value = false
  if (timer) clearInterval(timer)
  timer = undefined
}

function start() {
  if (running.value) return
  running.value = true
  timer = setInterval(() => { elapsedSeconds.value += 1 }, 1000)
}

function reset() {
  stop()
  elapsedSeconds.value = 0
  occupancy.value = 'AVAILABLE'
  stale.value = false
}

onBeforeUnmount(stop)
</script>

<template>
  <main class="min-h-screen bg-[#eef3ef] px-4 py-6 text-neutral-900 sm:px-6">
    <div class="mx-auto max-w-6xl space-y-4">
      <header class="glass rounded-30 p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span class="pill bg-amber-100 text-amber-800">SIMULATED DEMO</span>
            <h1 class="mt-3 font-display text-2xl font-semibold">Live vehicle preview</h1>
            <p class="mt-1 text-sm text-neutral-500">Synthetic Direct Corridor · NOT REAL TRANSPORT DATA</p>
          </div>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Simulation controls">
            <UButton color="success" variant="soft" icon="i-lucide-play" :disabled="running" @click="start">Start</UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-pause" :disabled="!running" @click="stop">Pause</UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" @click="reset">Reset</UButton>
            <UButton color="neutral" variant="soft" icon="i-lucide-fast-forward" @click="elapsedSeconds += 15">Advance 15 sec</UButton>
          </div>
        </div>
      </header>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section class="space-y-3">
          <div :style="{ width: narrow ? '360px' : '100%', maxWidth: '100%' }">
            <PamanaMapLibreMap
              height="520px"
              :vehicles="vehicleFeatures"
              :lines="[previewLine]"
              :user-location="previewUserLocation"
              :fit-key="'synthetic-preview-initial'"
              @map-ready="mapState = 'READY'"
              @map-error="mapState = $event"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-neutral-500">
            <span>Map: {{ mapState }} · Clock: {{ elapsedSeconds }} sec</span>
            <span>{{ freshActiveCount }} fresh active · {{ staleCount }} stale</span>
          </div>
        </section>

        <UCard class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <h2 class="font-display text-sm font-semibold">Preview controls</h2>
          <div class="mt-4 space-y-4">
            <label class="grid gap-1 text-xs font-semibold text-neutral-600">
              Vehicle A occupancy
              <select v-model="occupancy" class="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 font-normal focus:outline-3 focus:outline-lime-500">
                <option>AVAILABLE</option><option>NEAR_FULL</option><option>FULL</option><option>UNKNOWN</option>
              </select>
            </label>
            <label class="flex items-center justify-between gap-3 text-sm text-neutral-700">
              Stale diagnostic vehicle
              <input v-model="stale" type="checkbox" class="size-4 accent-lime-600">
            </label>
            <UButton block color="neutral" variant="soft" icon="i-lucide-smartphone" @click="narrow = !narrow">
              {{ narrow ? 'Use wide viewport' : 'Use 360px viewport' }}
            </UButton>
          </div>

          <div class="mt-5 space-y-2" aria-live="polite">
            <div v-for="vehicle in snapshots" :key="vehicle.id" class="rounded-2xl border border-neutral-900/5 bg-white/60 p-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <strong>{{ vehicle.label }}</strong>
                <span class="pill normal-case" :class="vehicle.dataFreshness.status === 'STALE' ? 'bg-red-100 text-red-700' : 'bg-lime-100 text-lime-700'">{{ vehicle.dataFreshness.status }}</span>
              </div>
              <p class="mt-1 text-neutral-500">{{ vehicle.occupancy }} · {{ vehicle.tripState }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <p class="text-xs leading-relaxed text-neutral-500">
        Pan or zoom the map, then advance the clock or change occupancy. Vehicle source updates must leave the camera exactly where you placed it. My Location uses an offshore synthetic preview point.
      </p>
    </div>
  </main>
</template>
