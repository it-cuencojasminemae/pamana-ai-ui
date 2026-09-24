<script setup lang="ts">
import type { MapPointFeature, MapLineFeature } from '../../types/map'
definePageMeta({ layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })
// Local visual harness only. Synthetic offshore fixtures, not PAMANA route facts.
const fixtures = ref(false)
const narrow = ref(false)
const mounted = ref(true)
const state = ref('INITIALIZING')
const key = ref(0)
const vehicleRefresh = ref(0)
const selection = ref<string | null>(null)
const user = ref<{ lat: number; lng: number } | null>(null)
const transportNodes = computed<MapPointFeature[]>(() => fixtures.value ? ['pickup', 'stop', 'transfer', 'terminal', 'destination', 'essential-service'].map((semantic, index) => ({
  type: 'Feature', id: `synthetic-transport-${index}`, geometry: { type: 'Point', coordinates: [119 + index * .005, 14] }, properties: {
    semantic: semantic as MapPointFeature['properties']['semantic'], label: `Synthetic ${semantic}`, source: 'PAMANA_TRANSPORT_DB',
    dataMode: 'SIMULATED', isTransportNode: true, nodeTypeLabel: `Synthetic ${semantic}`, verificationLabel: 'Simulated fixture',
    planningLabel: 'Development preview only', sourceSummary: 'Local test fixture'
  }
})) : [])
const vehicles = computed<MapPointFeature[]>(() => fixtures.value ? [{ type: 'Feature', id: 'test-vehicle', geometry: { type: 'Point', coordinates: [119.012 + vehicleRefresh.value * .001, 14.003] }, properties: { semantic: 'vehicle', label: `Synthetic vehicle refresh ${vehicleRefresh.value}`, source: 'PAMANA', dataMode: 'SIMULATED' } }] : [])
const lines = computed<MapLineFeature[]>(() => fixtures.value ? [{ type: 'Feature', id: 'test-line', geometry: { type: 'LineString', coordinates: [[119, 14], [119.03, 14.005]] }, properties: { semantic: 'walking-route', label: 'Synthetic walking line — not transport data', source: 'PAMANA', dataMode: 'SIMULATED' } }] : [])
</script>
<template>
  <main class="preview">
    <h1>Phase 9 · Local map preview</h1><p>Development only. Fixtures are synthetic, not San Juan coordinates or route geometry.</p>
    <div class="controls">
      <button @click="fixtures = !fixtures; key++">Toggle synthetic features</button>
      <button @click="vehicleRefresh++">Refresh live vehicles</button>
      <button @click="user = { lat: 14, lng: 119 + key++ * .001 }">Simulate GPS update</button>
      <button @click="narrow = !narrow">Toggle mobile width</button>
      <button @click="mounted = !mounted">Toggle mount</button>
    </div>
    <p role="status">State: {{ state }} · Vehicle refresh: {{ vehicleRefresh }} · Selected: {{ selection || 'none' }}</p>
    <div :style="{ width: narrow ? '360px' : '100%', maxWidth: '100%', borderRadius: '24px' }">
      <PamanaMapLibreMap v-if="mounted" height="520px" :transport-nodes="transportNodes" :vehicles="vehicles" :lines="lines" :user-location="user" :fit-key="fixtures ? 1 : 0"
        @map-ready="state = 'READY'" @map-error="state = $event" @feature-selected="selection = $event" />
    </div>
  </main>
</template>
<style scoped>
.preview { max-width: 1100px; margin: 24px auto; padding: 20px; font-family: system-ui; color: #172b27; }
h1 { font-size: 26px; font-weight: 750; } p { margin: 12px 0; font-size: 14px; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; } button { background: #edf4ef; border: 1px solid #bbcec1; border-radius: 10px; padding: 10px; font-size: 13px; }
</style>
