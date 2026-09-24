<script setup lang="ts">
import type { Map as LibreMap, MapMouseEvent } from 'maplibre-gl'
import type { MapPointFeature, MapLineFeature } from '../types/map'
import { resolveMapConfiguration } from '../services/mapConfiguration'
import { MAP_TOKENS, renderableFeatures, validPosition } from '../services/mapPresentation'
import { createMapPresentation, LAYER_IDS } from '../services/mapLibrePresentation'

type Status = 'INITIALIZING' | 'READY' | 'MISSING_CONFIG' | 'TILE_ERROR' | 'INITIALIZATION_ERROR'
const props = withDefaults(defineProps<{
  height?: string
  center?: [number, number]
  zoom?: number
  userLocation?: { lat: number; lng: number } | null
  nodes?: MapPointFeature[]
  lines?: MapLineFeature[]
  vehicles?: MapPointFeature[]
  selectedFeatureId?: string | null
  fitToFeatures?: boolean
  fitKey?: string | number | null
}>(), { height: '420px', zoom: 11, userLocation: null, nodes: () => [], lines: () => [], vehicles: () => [], selectedFeatureId: null, fitToFeatures: true, fitKey: null })
const emit = defineEmits<{
  'feature-selected': [id: string]
  'map-ready': []
  'map-error': [state: Status]
}>()
const config = useRuntimeConfig()
const loader = useMapLibre()
const container = ref<HTMLElement | null>(null)
const status = ref<Status>('INITIALIZING')
const hasLoaded = ref(false)
const selection = ref<string | null>(props.selectedFeatureId)
const features = computed(() => renderableFeatures(props.nodes, props.lines, props.vehicles, props.userLocation))
const choices = computed(() => features.value.filter(f => f.properties.semantic !== 'passenger'))
const selected = computed(() => features.value.find(f => f.id === selection.value))
const userIsValid = computed(() => props.userLocation && validPosition([props.userLocation.lng, props.userLocation.lat]))
const labels: Record<Status, string> = {
  INITIALIZING: 'Preparing your map…', READY: 'Map ready', MISSING_CONFIG: 'Map unavailable — Geoapify configuration is missing or invalid.',
  TILE_ERROR: 'Basemap unavailable. Check your connection or try again.', INITIALIZATION_ERROR: 'The interactive map could not start. Try again or use the compatibility map.',
}
let map: LibreMap | null = null
let presentation: ReturnType<typeof createMapPresentation> | null = null
let resizeObserver: ResizeObserver | null = null
let timeout: ReturnType<typeof setTimeout> | undefined
let generation = 0
let unmounted = false
let detach: (() => void) | null = null

function setError(next: Status) {
  if (unmounted) return
  clearTimeout(timeout)
  status.value = next
  if (next === 'TILE_ERROR' || next === 'INITIALIZATION_ERROR') loader.reportRenderFailure(next === 'TILE_ERROR' ? 'TILE_LOAD_FAILED' : 'MAP_INITIALIZATION_FAILED')
  emit('map-error', next) // No provider error object or key-bearing URLs escape.
}
function updatePresentation() {
  try {
    presentation?.update(features.value, selection.value)
    return true
  } catch {
    setError('INITIALIZATION_ERROR')
    return false
  }
}
function select(id: string) {
  selection.value = id || null
  if (id) emit('feature-selected', id)
}
function recenter() {
  if (map && userIsValid.value && props.userLocation) map.easeTo({ center: [props.userLocation.lng, props.userLocation.lat], zoom: Math.max(map.getZoom(), 15), duration: 500 })
}
function cleanup() {
  clearTimeout(timeout)
  resizeObserver?.disconnect(); resizeObserver = null
  detach?.(); detach = null
  map?.remove(); map = null
  presentation = null
}
async function initialize() {
  const current = ++generation
  cleanup()
  status.value = 'INITIALIZING'
  hasLoaded.value = false
  const resolved = resolveMapConfiguration(config.public)
  if (!resolved.ok) { setError('MISSING_CONFIG'); return }
  // Bound module loading too: a stalled chunk must not leave an endless spinner.
  timeout = setTimeout(() => {
    if (!map) generation++ // Ignore a module that arrives after this attempt expired.
    setError(map ? 'TILE_ERROR' : 'INITIALIZATION_ERROR')
  }, 20000)
  const lib = await loader.load()
  if (unmounted || current !== generation) return
  if (!lib || !container.value) { setError('INITIALIZATION_ERROR'); return }
  try {
    // Neutral regional viewport only, never stored as a transport-node coordinate.
    const initialCenter: [number, number] = userIsValid.value && props.userLocation ? [props.userLocation.lng, props.userLocation.lat]
      : validPosition(props.center) ? props.center : [120.70, 15.10]
    map = new lib.Map({ container: container.value, style: resolved.styleUrl, center: initialCenter,
      zoom: props.zoom, attributionControl: false, cooperativeGestures: true })
    map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new lib.AttributionControl({ compact: true }), 'bottom-right')
    map.getCanvas().setAttribute('aria-label', 'PAMANA transport map. Use zoom controls or arrow keys to explore.')
    presentation = createMapPresentation(map)
    const onLoad = () => {
      try {
        if (!updatePresentation()) return
        presentation?.fitOnIntent(props.fitKey, props.fitToFeatures)
        clearTimeout(timeout)
        hasLoaded.value = true
        status.value = 'READY'
        emit('map-ready')
      } catch { setError('INITIALIZATION_ERROR') }
    }
    const onStyle = () => { updatePresentation() }
    const onError = () => { clearTimeout(timeout); setError('TILE_ERROR') }
    const onIdle = () => {
      // Successful subsequent tile loads recover without rebuilding or refitting.
      if (hasLoaded.value && status.value === 'TILE_ERROR' && map?.isStyleLoaded() && map.areTilesLoaded()) {
        status.value = 'READY'
        emit('map-ready')
      }
    }
    const onClick = (event: MapMouseEvent) => {
      if (!map) return
      const layers = LAYER_IDS.filter(id => map!.getLayer(id))
      if (!layers.length) return
      const hit = map.queryRenderedFeatures(event.point, { layers })[0]
      if (hit?.properties?.featureId) select(String(hit.properties.featureId))
    }
    map.on('load', onLoad); map.on('style.load', onStyle); map.on('error', onError); map.on('click', onClick); map.on('idle', onIdle)
    const instance = map
    detach = () => { instance.off('load', onLoad); instance.off('style.load', onStyle); instance.off('error', onError); instance.off('click', onClick); instance.off('idle', onIdle) }
    resizeObserver = new ResizeObserver(() => { if (!unmounted) map?.resize() })
    resizeObserver.observe(container.value)
  } catch { cleanup(); setError('INITIALIZATION_ERROR') }
}

// Polling moves source features only. No fitBounds, jumpTo or map recreation here.
watch(features, () => updatePresentation(), { deep: true })
watch(() => props.selectedFeatureId, value => { selection.value = value })
watch(selection, () => updatePresentation())
watch(() => props.fitKey, () => {
  if (status.value === 'READY') presentation?.fitOnIntent(props.fitKey, props.fitToFeatures)
})
onMounted(initialize)
onBeforeUnmount(() => { unmounted = true; generation++; cleanup() })
</script>

<template>
  <section class="pamana-libre" :style="{ height }" :data-map-state="status" aria-label="Passenger transport map" :aria-busy="status === 'INITIALIZING'">
    <div ref="container" class="pamana-libre__canvas" />
    <div v-if="status !== 'READY'" class="pamana-libre__state" :class="{ 'pamana-libre__state--notice': hasLoaded && status === 'TILE_ERROR' }" role="status" aria-live="polite">
      <span class="pamana-libre__state-icon" aria-hidden="true">{{ status === 'INITIALIZING' ? '◌' : '!' }}</span>
      <strong>{{ labels[status] }}</strong>
      <span>Transport information remains available outside the map.</span>
      <button v-if="status !== 'INITIALIZING'" type="button" class="pamana-libre__button" @click="initialize">Retry map</button>
    </div>
    <template v-if="hasLoaded">
      <div class="pamana-libre__tools">
        <span class="pamana-libre__eyebrow">PAMANA · EXPLORE</span>
        <label v-if="choices.length" class="pamana-libre__picker">Map features
          <select :value="selection ?? ''" aria-label="Select a map feature" @change="select(($event.target as HTMLSelectElement).value)">
            <option value="">Choose a point or line</option>
            <option v-for="feature in choices" :key="String(feature.id)" :value="feature.id">{{ MAP_TOKENS[feature.properties.semantic].label }} · {{ feature.properties.label }}{{ feature.properties.dataMode === 'SIMULATED' ? ' (simulated)' : '' }}</option>
          </select>
        </label>
        <div v-else class="pamana-libre__empty">No transport features to display.<br>Unverified coordinates stay off the map.</div>
        <div v-if="selected" class="pamana-libre__detail" role="status">
          <strong>{{ selected.properties.label }}</strong>
          <span>{{ MAP_TOKENS[selected.properties.semantic].label }} · {{ selected.properties.isTransportNode === false ? 'Geographic place selection' : selected.properties.dataMode === 'SIMULATED' ? 'Simulated / demo' : selected.properties.verificationStatus || 'Verification not supplied' }}</span>
        </div>
      </div>
      <div class="pamana-libre__actions">
        <button type="button" class="pamana-libre__button" :disabled="!userIsValid" aria-label="Recenter on your location" @click="recenter">◎ My location</button>
        <button v-if="choices.length" type="button" class="pamana-libre__button" aria-label="Fit supplied transport features" @click="presentation?.fit">Fit features</button>
      </div>
      <div class="pamana-libre__legend" aria-label="Map legend">
        <span v-for="semantic in ['passenger', 'origin-location', 'pickup', 'stop', 'transfer', 'destination'] as const" :key="semantic"><i :style="{ background: MAP_TOKENS[semantic].color }" />{{ MAP_TOKENS[semantic].label }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.pamana-libre { position: relative; min-height: 320px; width: 100%; isolation: isolate; overflow: hidden; border-radius: inherit; background: #edf2f0; color: #172b27; }
.pamana-libre__canvas { position: absolute; inset: 0; }
.pamana-libre__state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; padding: 32px; text-align: center; background: linear-gradient(135deg, #f3f8f5, #e7eeed); font-size: 14px; }
.pamana-libre__state > span:last-of-type { color: #475569; font-size: 12px; }
.pamana-libre__state--notice { inset: auto 12px 145px; z-index: 2; border: 1px solid #a4bcb0; border-radius: 12px; padding: 12px; gap: 6px; }
.pamana-libre__state--notice .pamana-libre__state-icon { display: none; }
.pamana-libre__state-icon { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid #a4bcb0; border-radius: 50%; font-size: 28px; }
.pamana-libre__tools { position: absolute; top: 16px; left: 16px; width: min(260px, calc(100% - 85px)); padding: 12px; border: 1px solid #ffffff; border-radius: 16px; background: #fffffff2; box-shadow: 0 5px 24px #172b2717; }
.pamana-libre__eyebrow { display: block; color: #166534; font: 750 10px/1.4 system-ui; letter-spacing: .14em; margin-bottom: 7px; }
.pamana-libre__picker { display: grid; gap: 4px; font-size: 11px; font-weight: 600; }
.pamana-libre__picker select { min-height: 40px; width: 100%; border-radius: 9px; border: 1px solid #cbd5e1; padding: 5px; color: #172b27; background: white; font-size: 12px; }
.pamana-libre__empty, .pamana-libre__detail { font-size: 12px; line-height: 1.5; }
.pamana-libre__detail { display: grid; gap: 3px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #dbe4e0; }
.pamana-libre__detail span { font-size: 11px; color: #475569; }
.pamana-libre__actions { position: absolute; right: 12px; bottom: 76px; display: grid; justify-items: end; gap: 6px; }
.pamana-libre__button { min-height: 42px; padding: 8px 12px; border-radius: 12px; background: #fff; border: 1px solid #cbd5e1; box-shadow: 0 3px 12px #172b2712; font: 650 12px/1.3 system-ui; cursor: pointer; }
.pamana-libre__button:disabled { opacity: .55; cursor: not-allowed; }
.pamana-libre__button:focus-visible, select:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
.pamana-libre__legend { position: absolute; bottom: 34px; left: 12px; right: 12px; display: flex; flex-wrap: wrap; width: fit-content; gap: 7px 12px; padding: 8px 10px; border: 1px solid #fff; border-radius: 12px; background: #fffffff2; font: 600 10px/1.4 system-ui; pointer-events: none; }
.pamana-libre__legend span { display: inline-flex; gap: 5px; align-items: center; }
.pamana-libre__legend i { width: 7px; height: 7px; border-radius: 50%; }
:deep(.maplibregl-ctrl-group) { border-radius: 12px; overflow: hidden; box-shadow: 0 3px 16px #172b2720; }
:deep(.maplibregl-ctrl-group button) { width: 42px; height: 42px; }
@media (max-width: 480px) { .pamana-libre__tools { top: 10px; left: 10px; padding: 10px; } .pamana-libre__actions { bottom: 120px; } .pamana-libre__legend { bottom: 62px; font-size: 9px; gap: 5px 9px; } }
</style>
