<script setup lang="ts">
import type { SimulatedLiveVehicleResponse } from '../../types/liveVehicle'
defineProps<{ snapshot: SimulatedLiveVehicleResponse | null; loading: boolean; error: string; elapsedSeconds: number | null }>()
const emit = defineEmits<{ sample: [seconds: number | null] }>()
const config = useRuntimeConfig()
const enabled = computed(() => String(config.public.pamanaDemoModeEnabled).trim().toLowerCase() === 'true')
</script>

<template>
  <section v-pamana-reveal v-if="enabled" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900" aria-label="Demo simulation controls">
    <p class="text-xs font-bold">SIMULATED DEMO · NOT REAL TRANSPORT DATA</p>
    <p class="mt-1 text-xs leading-5">Offshore synthetic vehicles, not jeepneys currently traveling in Pampanga. These samples do not change factual journey availability or ETA.</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button data-pamana-feedback v-for="item in [{ label: 'Available', seconds: 0 }, { label: 'Near full', seconds: 20 }, { label: 'Full', seconds: 40 }]" :key="item.seconds" type="button"
        class="min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        :aria-pressed="elapsedSeconds === item.seconds" @click="emit('sample', item.seconds)">{{ item.label }}</button>
      <button data-pamana-feedback type="button" class="min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-amber-700" @click="emit('sample', 0)">Reset simulation</button>
      <button data-pamana-feedback type="button" class="min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-amber-700" :aria-pressed="elapsedSeconds === null" @click="emit('sample', null)">Live simulated clock</button>
    </div>
    <p class="mt-2 text-xs" role="status">{{ loading ? 'Loading simulation…' : error || (snapshot ? `${snapshot.freshActiveVehicleCount} fresh active · ${snapshot.staleVehicleCount} stale · ${elapsedSeconds === null ? 'live simulated clock' : `sample ${elapsedSeconds}s`}` : 'Simulation has not loaded yet.') }}</p>
    <ul v-if="snapshot" class="mt-2 space-y-1 text-xs">
      <li v-for="vehicle in snapshot.vehicles" :key="vehicle.id" class="break-words">{{ vehicle.label }} · {{ vehicle.occupancy }} · {{ vehicle.dataFreshness.status }} · {{ vehicle.tripState }} · {{ vehicle.routeVariantId }}</li>
    </ul>
  </section>
</template>
