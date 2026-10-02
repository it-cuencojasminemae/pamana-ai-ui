<script setup lang="ts">
import { disruptionMapFeatures } from '../../services/disruptionMapFeatures'

definePageMeta({ layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })
// Offshore synthetic presentation fixtures only. No API calls, GPS observations, or database writes.
const scene = ref('Live Mobility')
const narrow = ref(false)
const refresh = ref(0)
const state = ref('INITIALIZING')
watch(scene, () => { state.value = 'INITIALIZING' })
const cooperative = ref('All cooperatives')
const route = ref('All routes')
const vehicles = computed(() => [{ documentId: 'preview-vehicle', vehicle_number: 'SIMULATED preview vehicle',
  plate_number: 'TEST-ONLY', latitude: 14, longitude: 119 + refresh.value * .001,
  data_mode: 'SIMULATED', occupancy_level: 'UNKNOWN', direction: 'OUTBOUND',
  route_variant: { display_name: 'Synthetic preview variant' }, recorded_at: '2026-01-01T00:00:00Z',
}])
const records = computed(() => [{ documentId: 'preview-disruption', type: 'road_closure',
  title: `SIMULATED preview warning ${refresh.value}`, description: 'Local fixture; no operational evidence.',
  severity: 'high', starts_at: '2026-01-01T00:00:00Z', disruption_status: 'active',
  data_mode: 'SIMULATED' as const, verification_status: 'SIMULATED_DEMO' as const,
  effect: 'WARNING_ONLY' as const, planning_enabled: false, geometry_source: 'SIMULATED',
  geometry_geojson: { type: 'Polygon', coordinates: [[[119, 14], [119.02, 14], [119.02, 14.01], [119, 14]]] },
}])
const disruptions = computed(() => disruptionMapFeatures(records.value))
// Workbench map contracts only; no editor save or transport-data endpoint is involved.
const workbenchNodes = [{ type: 'Feature' as const, id: 'fixture-workbench-node', geometry: { type: 'Point' as const, coordinates: [119, 14] as [number, number] },
  properties: { semantic: 'stop' as const, label: 'SIMULATED coordinate candidate' } }]
const workbenchLines = [{ type: 'Feature' as const, id: 'fixture-workbench-line', geometry: { type: 'LineString' as const, coordinates: [[119, 14], [119.01, 14.01]] as [number, number][] },
  properties: { semantic: 'transport-route' as const, label: 'SIMULATED geometry under review' } }]
const scenes = ['Driver demand', 'Dashboard', 'Live Mobility', 'Disruptions', 'Workbench node', 'Workbench geometry']
const height = computed(() => ({ 'Driver demand': '420px', Dashboard: '160px', 'Live Mobility': '460px', Disruptions: '340px', 'Workbench node': '280px', 'Workbench geometry': '280px' })[scene.value])
</script>

<template>
  <main class="mx-auto max-w-5xl p-5 text-neutral-800">
    <h1 class="text-xl font-semibold">Phase 25A · SIMULATED map presentation checks</h1>
    <p class="my-3 text-sm">Development only. These fixtures do not complete real-device Phase 24.5 acceptance.</p>
    <div class="mb-4 flex flex-wrap gap-3">
      <label>Map <select v-model="scene" class="rounded-lg border p-2"><option v-for="name in scenes" :key="name">{{ name }}</option></select></label>
      <button class="rounded-lg border p-2" @click="refresh++">Refresh simulated data</button>
      <button class="rounded-lg border p-2" @click="narrow = !narrow">Toggle mobile width</button>
    </div>
    <p class="mb-3" role="status">{{ scene }} · {{ state }} · Refresh {{ refresh }}</p>
    <div :style="{ width: narrow ? '360px' : '100%', maxWidth: '100%' }">
      <PamanaMapPanel :key="scene" provider="maplibre" :height="height" :compact="scene === 'Dashboard'"
        :tools-offset="scene === 'Live Mobility' ? '104px' : scene === 'Driver demand' ? '64px' : undefined"
        :markers="scene === 'Live Mobility' ? vehicles : []" :disruptions="scene === 'Disruptions' ? disruptions : []"
        :nodes="scene === 'Workbench node' ? workbenchNodes : []" :lines="scene === 'Workbench geometry' ? workbenchLines : []"
        @map-ready="state = 'READY'" @map-error="state = $event">
        <template #overlay>
          <span v-if="scene === 'Driver demand'" class="glass-solid pill absolute left-4 top-4 normal-case">AI-predicted demand · SIMULATED</span>
          <div v-if="scene === 'Live Mobility'" class="pointer-events-auto absolute left-4 top-4 flex max-w-[calc(100%-85px)] flex-wrap gap-2">
            <USelect v-model="cooperative" :items="['All cooperatives']" class="w-48 max-w-full" />
            <USelect v-model="route" :items="['All routes']" class="w-36 max-w-full" />
          </div>
        </template>
        <template v-if="scene === 'Driver demand'">
          <span class="pointer-events-none absolute left-[25%] top-[30%] size-16 rounded-full bg-red-400/25 ring-2 ring-red-400/30" />
          <span class="pointer-events-none absolute right-[30%] top-[52%] size-20 rounded-full bg-amber-400/25 ring-2 ring-amber-400/30" />
        </template>
      </PamanaMapPanel>
    </div>
  </main>
</template>
