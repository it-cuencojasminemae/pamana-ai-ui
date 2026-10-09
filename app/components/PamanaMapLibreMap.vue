<script setup lang="ts">
import { useId } from 'vue'
import type { Map as LibreMap, MapMouseEvent } from 'maplibre-gl'
import type { MapPointFeature, MapLineFeature, MapDisruptionFeature } from '../types/map'
import type { PinArea } from '../types/pinArea'
import type { PilotLandmark } from '../types/pilotLandmarks'
import { createLandmarkPresentation, LANDMARK_LAYERS } from '../services/landmarkMapPresentation'
import { validPinBoundary } from '../services/mapPins'
import { resolveMapConfiguration } from '../services/mapConfiguration'
import { MAP_TOKENS, markerOffsets, renderableFeatures, validPosition, createFitPolicy } from '../services/mapPresentation'
import { SAN_JUAN_CENTER, PASSENGER_INITIAL_ZOOM, passengerCameraBounds } from '../services/passengerMapCamera'
import { createMapPresentation, LAYER_IDS } from '../services/mapLibrePresentation'
import { createTransportNodePresentation, TRANSPORT_NODE_LAYER_IDS } from '../services/transportNodePresentation'
import { createDisruptionMapPresentation, DISRUPTION_LAYER_IDS } from '../services/disruptionMapPresentation'

type Status = 'INITIALIZING' | 'READY' | 'MISSING_CONFIG' | 'TILE_ERROR' | 'INITIALIZATION_ERROR'
const props = withDefaults(defineProps<{
  height?: string
  compact?: boolean
  toolsOffset?: string
  center?: [number, number]
  zoom?: number
  passengerFocus?: boolean
  userLocation?: { lat: number; lng: number } | null
  nodes?: MapPointFeature[]
  transportNodes?: MapPointFeature[]
  lines?: MapLineFeature[]
  vehicles?: MapPointFeature[]
  disruptions?: MapDisruptionFeature[]
  selectedFeatureId?: string | null
  fitToFeatures?: boolean
  fitKey?: string | number | null
  pinBoundary?: PinArea['boundary']
  pinSelectionActive?: boolean
  landmarks?: PilotLandmark[]
  selectedLandmarkId?: string
}>(), { height: '420px', compact: false, zoom: 11, userLocation: null, nodes: () => [], transportNodes: () => [], lines: () => [], vehicles: () => [], disruptions: () => [], selectedFeatureId: null, fitToFeatures: true, fitKey: null, pinBoundary: null, pinSelectionActive: false, landmarks: () => [] })
const emit = defineEmits<{
  'feature-selected': [id: string]
  'map-ready': []
  'map-error': [state: Status]
  'coordinate-selected': [point: { lat: number; lng: number }]
  'landmark-selected': [id: string]
}>()
const config = useRuntimeConfig()
const loader = useMapLibre()
const container = ref<HTMLElement | null>(null)
const status = ref<Status>('INITIALIZING')
const hasLoaded = ref(false)
const selection = ref<string | null>(props.selectedFeatureId)
const isFeaturePanelOpen = ref(false)
const featurePanelId = `map-features-${useId()}`
const rawFeatures = computed(() => renderableFeatures(props.nodes, props.lines, props.vehicles, props.userLocation))
const rawTransportFeatures = computed(() => renderableFeatures(props.transportNodes, [], [], null) as MapPointFeature[])
const offsets = computed(() => markerOffsets([...rawFeatures.value.filter((f): f is MapPointFeature => f.geometry.type === 'Point'), ...rawTransportFeatures.value]))
const features = computed(() => rawFeatures.value.map(f => f.geometry.type === 'Point'
  ? { ...f, properties: { ...f.properties, markerOffset: offsets.value.get(f as MapPointFeature) } } : f))
const transportFeatures = computed(() => rawTransportFeatures.value.map(f => ({ ...f, properties: { ...f.properties, markerOffset: offsets.value.get(f) } })))
const disruptionFeatures = computed(() => props.disruptions.map((feature, index) => {
  const id = String(feature.id ?? feature.properties.recordId ?? `disruption-${index}`)
  return { ...feature, id, properties: { ...feature.properties, featureId: id } }
}))
const fittingFeatures = computed(() => [...transportFeatures.value, ...disruptionFeatures.value])
const allFeatures = computed(() => [...features.value, ...transportFeatures.value, ...disruptionFeatures.value])
const choices = computed(() => allFeatures.value.filter(f => f.properties.semantic !== 'passenger'))
const selected = computed(() => allFeatures.value.find(f => f.id === selection.value))
const hasApproximateRoadPath = computed(() => features.value.some(feature => feature.properties.semantic === 'approximate-road-path'))
const legendSemantics = computed(() => {
  const visible = new Set(allFeatures.value.filter(feature => feature.geometry.type === 'Point').map(feature => feature.properties.semantic))
  return ['passenger', 'origin-location', 'destination-location', 'vehicle', 'pickup', 'roadside-pickup', 'stop', 'transfer', 'terminal', 'dropoff', 'destination', 'essential-service', 'disruption']
    .filter(semantic => visible.has(semantic as keyof typeof MAP_TOKENS)) as (keyof typeof MAP_TOKENS)[]
})
const userIsValid = computed(() => props.userLocation && validPosition([props.userLocation.lng, props.userLocation.lat]))
const labels: Record<Status, string> = {
  INITIALIZING: 'Preparing your map…', READY: 'Map ready', MISSING_CONFIG: 'Map unavailable — Geoapify configuration is missing or invalid.',
  TILE_ERROR: 'Basemap unavailable. Check your connection or try again.', INITIALIZATION_ERROR: 'The interactive map could not start. Try again.',
}
let map: LibreMap | null = null
let presentation: ReturnType<typeof createMapPresentation> | null = null
let transportPresentation: ReturnType<typeof createTransportNodePresentation> | null = null
let disruptionPresentation: ReturnType<typeof createDisruptionMapPresentation> | null = null
let landmarkPresentation: ReturnType<typeof createLandmarkPresentation> | null = null
let resizeObserver: ResizeObserver | null = null
let timeout: ReturnType<typeof setTimeout> | undefined
let generation = 0
let unmounted = false
let detach: (() => void) | null = null
let pinAreaAdded = false
let passengerFitPolicy = createFitPolicy()

function setError(next: Status) {
  if (unmounted) return
  clearTimeout(timeout)
  status.value = next
  if (next === 'TILE_ERROR' || next === 'INITIALIZATION_ERROR') loader.reportRenderFailure(next === 'TILE_ERROR' ? 'TILE_LOAD_FAILED' : 'MAP_INITIALIZATION_FAILED')
  emit('map-error', next) // No provider error object or key-bearing URLs escape.
}
function updateFeaturePresentation() {
  try {
    presentation?.update(features.value, selection.value)
    return true
  } catch {
    setError('INITIALIZATION_ERROR')
    return false
  }
}
function updateTransportPresentation() {
  try {
    transportPresentation?.update(transportFeatures.value)
    transportPresentation?.select(selection.value)
    return true
  } catch {
    setError('INITIALIZATION_ERROR')
    return false
  }
}
function updateDisruptionPresentation() {
  try {
    disruptionPresentation?.update(disruptionFeatures.value)
    return true
  } catch {
    setError('INITIALIZATION_ERROR')
    return false
  }
}
function select(id: string) {
  selection.value = id || null
  if (id) {
    isFeaturePanelOpen.value = true
    emit('feature-selected', id)
  }
}
function updateLandmarks() {
  // Optional POIs must not turn a usable transport map into an initialization error.
  try { landmarkPresentation?.update(props.landmarks) } catch { /* Retain accessible landmark choices. */ }
}
function recenter() {
  if (map && userIsValid.value && props.userLocation) map.easeTo({ center: [props.userLocation.lng, props.userLocation.lat], zoom: Math.max(map.getZoom(), 15), duration: 500 })
}
function fitAll() { presentation?.fit(fittingFeatures.value, true) }
function fitOnIntent() {
  if (!props.passengerFocus) { presentation?.fitOnIntent(props.fitKey, props.fitToFeatures, fittingFeatures.value); return }
  if (!map || !passengerFitPolicy.shouldFit(props.fitKey, props.fitToFeatures)) return
  const bounds = passengerCameraBounds(features.value, props.pinBoundary ?? null)
  if (bounds) map.fitBounds(bounds, { padding: 65, maxZoom: 16, duration: 500 })
  else map.easeTo({ center: SAN_JUAN_CENTER, zoom: PASSENGER_INITIAL_ZOOM, duration: 500 })
}
function updatePinBoundary(styleReady = false) {
  if (!map || (!props.pinBoundary && !pinAreaAdded) || (!styleReady && !hasLoaded.value && !map.isStyleLoaded())) return
  const data = { type: 'FeatureCollection' as const, features: props.pinBoundary && validPinBoundary(props.pinBoundary.geometry) ? [props.pinBoundary] : [] }
  const source = map.getSource('pamana-pin-area') as import('maplibre-gl').GeoJSONSource | undefined
  if (source) source.setData(data)
  else map.addSource('pamana-pin-area', { type: 'geojson', data })
  pinAreaAdded = true
  // This geography overlay is separate from selectable transport features.
  const before = map.getStyle().layers?.find(layer => layer.id.startsWith('pamana-'))?.id
  if (!map.getLayer('pamana-pin-area-fill')) map.addLayer({ id: 'pamana-pin-area-fill', type: 'fill', source: 'pamana-pin-area', paint: { 'fill-color': '#84cc16', 'fill-opacity': 0.09 } }, before)
  if (!map.getLayer('pamana-pin-area-outline')) map.addLayer({ id: 'pamana-pin-area-outline', type: 'line', source: 'pamana-pin-area', paint: { 'line-color': '#4d7c0f', 'line-width': 2, 'line-dasharray': [3, 2] } }, before)
}
function focusPinArea() {
  if (props.passengerFocus) return
  if (!map || !props.pinSelectionActive || !props.pinBoundary || !validPinBoundary(props.pinBoundary.geometry)) return
  const geometry = props.pinBoundary.geometry
  const positions = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2)
  const lngs = positions.map(p => p[0]!), lats = positions.map(p => p[1]!)
  map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, duration: 500, maxZoom: 15 })
}
function cleanup() {
  clearTimeout(timeout)
  resizeObserver?.disconnect(); resizeObserver = null
  detach?.(); detach = null
  map?.remove(); map = null
  presentation = null
  transportPresentation = null
  disruptionPresentation = null
  landmarkPresentation = null
  pinAreaAdded = false
}
async function initialize() {
  const current = ++generation
  cleanup()
  passengerFitPolicy = createFitPolicy()
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
    const initialCenter: [number, number] = props.passengerFocus ? SAN_JUAN_CENTER : userIsValid.value && props.userLocation ? [props.userLocation.lng, props.userLocation.lat]
      : validPosition(props.center) ? props.center : [120.70, 15.10]
    map = new lib.Map({ container: container.value, style: resolved.styleUrl, center: initialCenter,
      zoom: props.passengerFocus ? PASSENGER_INITIAL_ZOOM : props.zoom, attributionControl: false, cooperativeGestures: false })
    map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new lib.AttributionControl({ compact: true }), 'bottom-right')
    map.getCanvas().setAttribute('aria-label', 'PAMANA transport map. Use zoom controls or arrow keys to explore.')
    presentation = createMapPresentation(map)
    transportPresentation = createTransportNodePresentation(map)
    disruptionPresentation = createDisruptionMapPresentation(map)
    landmarkPresentation = createLandmarkPresentation(map)
    const onLoad = () => {
      try {
        if (!updateFeaturePresentation() || !updateTransportPresentation() || !updateDisruptionPresentation()) return
        updatePinBoundary(true)
        updateLandmarks()
        fitOnIntent()
        clearTimeout(timeout)
        hasLoaded.value = true
        status.value = 'READY'
        emit('map-ready')
        if (props.pinSelectionActive) focusPinArea()
      } catch { setError('INITIALIZATION_ERROR') }
    }
    const onStyle = () => { updateFeaturePresentation(); updateTransportPresentation(); updateDisruptionPresentation(); updatePinBoundary(true); updateLandmarks() }
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
      if (props.pinSelectionActive) {
        emit('coordinate-selected', { lat: event.lngLat.lat, lng: event.lngLat.lng })
        return
      }
      const layers = [...DISRUPTION_LAYER_IDS, ...TRANSPORT_NODE_LAYER_IDS, ...LAYER_IDS].filter(id => map!.getLayer(id))
      if (!layers.length) return
      const hit = map.queryRenderedFeatures(event.point, { layers })[0]
      if (hit?.properties?.featureId) select(String(hit.properties.featureId))
      else {
        const poiLayers = LANDMARK_LAYERS.filter(id => map!.getLayer(id))
        const poi = poiLayers.length ? map.queryRenderedFeatures(event.point, { layers: poiLayers })[0] : null
        if (poi?.properties?.landmarkId) emit('landmark-selected', String(poi.properties.landmarkId))
      }
    }
    map.on('load', onLoad); map.on('style.load', onStyle); map.on('error', onError); map.on('click', onClick); map.on('idle', onIdle)
    const instance = map
    const canvas = instance.getCanvas()
    const onKey = (event: KeyboardEvent) => {
      if (props.pinSelectionActive && event.key === 'Enter') {
        event.preventDefault()
        const center = instance.getCenter()
        emit('coordinate-selected', { lat: center.lat, lng: center.lng })
      }
    }
    canvas.addEventListener('keydown', onKey)
    detach = () => { canvas.removeEventListener('keydown', onKey); instance.off('load', onLoad); instance.off('style.load', onStyle); instance.off('error', onError); instance.off('click', onClick); instance.off('idle', onIdle) }
    resizeObserver = new ResizeObserver(() => { if (!unmounted) map?.resize() })
    resizeObserver.observe(container.value)
  } catch { cleanup(); setError('INITIALIZATION_ERROR') }
}

// Vehicle/GPS polling refreshes badges and shared offsets without moving the camera.
watch(features, () => updateFeaturePresentation(), { deep: true })
// Node refreshes call setData on the dedicated source and never move the camera.
watch(transportFeatures, () => updateTransportPresentation(), { deep: true })
// Disruption polling updates only its GeoJSON source and never changes the camera.
watch(() => props.disruptions, () => updateDisruptionPresentation(), { deep: true })
watch(() => props.landmarks, updateLandmarks, { deep: true })
watch(() => props.selectedLandmarkId, id => {
  const item = props.landmarks.find(i => i.id === id)
  if (map && hasLoaded.value && item) map.easeTo({ center: [item.lng, item.lat], zoom: Math.max(map.getZoom(), 15), duration: 500 })
})
watch(() => props.selectedFeatureId, value => { selection.value = value })
watch(selection, value => { presentation?.select(value); transportPresentation?.select(value) })
watch(() => props.fitKey, () => {
  if (hasLoaded.value) fitOnIntent()
})
watch(() => props.pinBoundary, () => updatePinBoundary(), { deep: true })
watch(() => props.pinSelectionActive, active => {
  if (map) {
    map.getCanvas().style.cursor = active ? 'crosshair' : ''
    map.getCanvas().setAttribute('aria-label', active ? 'Choose a pin inside an enabled pilot area. Pan with arrow keys and press Enter to select the map center.' : 'PAMANA transport map. Use zoom controls or arrow keys to explore.')
  }
  if (active && status.value === 'READY') focusPinArea()
})
onMounted(initialize)
onBeforeUnmount(() => { unmounted = true; generation++; cleanup() })
</script>

<template>
  <section class="pamana-libre" :class="{ 'pamana-libre--compact': compact, 'pamana-libre--roadside': selected?.properties.temporaryRoadside === true }" :style="{ height, '--map-tools-top': toolsOffset }" :data-map-state="status" aria-label="PAMANA transport map" :aria-busy="status === 'INITIALIZING'">
    <div ref="container" class="pamana-libre__canvas" />
    <div v-if="pinSelectionActive" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true"><span class="flex size-6 items-center justify-center rounded-full border-2 border-lime-800 bg-white/70 text-lime-900">+</span></div>
    <div v-if="status !== 'READY'" class="pamana-libre__state" :class="{ 'pamana-libre__state--notice': hasLoaded && status === 'TILE_ERROR' }" role="status" aria-live="polite">
      <span class="pamana-libre__state-icon" aria-hidden="true">{{ status === 'INITIALIZING' ? '◌' : '!' }}</span>
      <strong>{{ labels[status] }}</strong>
      <span>Transport information remains available outside the map.</span>
      <button data-pamana-feedback v-if="status !== 'INITIALIZING'" type="button" class="pamana-libre__button" @click="initialize">Retry map</button>
    </div>
    <template v-if="hasLoaded">
      <template v-if="choices.length">
        <button data-pamana-feedback
          type="button"
          class="pamana-libre__feature-toggle"
          :aria-expanded="isFeaturePanelOpen"
          aria-label="Toggle map feature details"
          :aria-controls="featurePanelId"
          @click="isFeaturePanelOpen = !isFeaturePanelOpen"
        >
          <span aria-hidden="true">☷</span>
          Map features
          <span class="pamana-libre__feature-count">{{ choices.length }}</span>
        </button>
        <div v-pamana-reveal="{ preset: 'panel' }" v-if="isFeaturePanelOpen" :id="featurePanelId" class="pamana-libre__tools">
          <span class="pamana-libre__eyebrow">PAMANA · EXPLORE</span>
          <label class="pamana-libre__picker">Select a feature
            <select :value="selection ?? ''" aria-label="Select a map feature" @change="select(($event.target as HTMLSelectElement).value)">
              <option value="">Choose a point or line</option>
              <option v-for="feature in choices" :key="String(feature.id)" :value="feature.id">{{ MAP_TOKENS[feature.properties.semantic].label }} · {{ feature.properties.label }}{{ feature.properties.dataMode === 'SIMULATED' ? ' (simulated)' : '' }}</option>
            </select>
          </label>
        <div v-pamana-reveal="{ preset: 'panel' }" v-if="selected" class="pamana-libre__detail" role="status">
          <strong>{{ selected.properties.label }}</strong>
          <PamanaVehicleAvailability v-if="selected.properties.semantic === 'vehicle' && selected.properties.availability" :availability="selected.properties.availability" />
          <template v-if="selected.properties.temporaryRoadside === true">
            <span>Temporary roadside pickup</span>
            <span v-if="selected.properties.serviceLabel">Service: {{ selected.properties.serviceLabel }}</span>
          </template>
          <template v-else-if="selected.properties.isTransportNode === true">
            <span>{{ selected.properties.nodeTypeLabel }}</span>
            <span>{{ selected.properties.verificationLabel }} · {{ selected.properties.dataMode }}</span>
            <span>{{ selected.properties.planningLabel }}</span>
            <span v-if="selected.properties.sourceSummary">Source: {{ selected.properties.sourceSummary }}</span>
          </template>
          <span v-else>{{ MAP_TOKENS[selected.properties.semantic].label }} · {{ selected.properties.isTransportNode === false ? 'Geographic place selection' : selected.properties.dataMode === 'SIMULATED' ? 'Simulated / demo' : selected.properties.verificationStatus || 'Verification not supplied' }}</span>
          <span v-for="(detail, index) in (selected.properties.details as string[] || [])" :key="index">{{ detail }}</span>
        </div>
        </div>
      </template>
      <div class="pamana-libre__actions">
        <button data-pamana-feedback v-if="!compact || userIsValid" type="button" class="pamana-libre__button" :disabled="!userIsValid" aria-label="Recenter on your location" @click="recenter">◎ My location</button>
        <button data-pamana-feedback v-if="choices.length" type="button" class="pamana-libre__button" aria-label="Fit supplied transport features" @click="fitAll">Fit features</button>
      </div>
      <div v-if="hasApproximateRoadPath" class="pamana-libre__route-notice" role="note">
        <i aria-hidden="true" />
        <span>Approximate route path — actual public transport path may vary.</span>
      </div>
      <div v-if="legendSemantics.length" class="pamana-libre__legend" aria-label="Map legend">
        <span v-for="semantic in legendSemantics" :key="semantic"><i :style="{ background: MAP_TOKENS[semantic].color }" />{{ MAP_TOKENS[semantic].label }}</span>
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
.pamana-libre__feature-toggle { position: absolute; top: var(--map-tools-top, 16px); left: 16px; z-index: 4; display: inline-flex; min-height: 40px; align-items: center; gap: 7px; border: 1px solid #dbe4e0; border-radius: 12px; background: rgb(255 255 255 / 0.97); padding: 8px 11px; color: #172b27; box-shadow: 0 3px 14px #172b2720; font: 650 12px/1.3 system-ui; cursor: pointer; }
.pamana-libre__feature-toggle:hover { background: #f8faf9; }
.pamana-libre__feature-count { display: inline-grid; min-width: 20px; height: 20px; place-items: center; border-radius: 999px; background: #ecfccb; color: #365314; font-size: 10px; }
.pamana-libre__tools { position: absolute; top: calc(var(--map-tools-top, 16px) + 48px); left: 16px; z-index: 3; width: min(240px, calc(100% - 80px)); max-height: min(58%, 320px); overflow: auto; overscroll-behavior: contain; padding: 11px; border: 1px solid #ffffff; border-radius: 16px; background: rgb(255 255 255 / 0.96); box-shadow: 0 5px 24px #172b2720; }
.pamana-libre__eyebrow { display: block; color: #166534; font: 750 10px/1.4 system-ui; letter-spacing: .14em; margin-bottom: 7px; }
.pamana-libre__picker { display: grid; gap: 4px; font-size: 11px; font-weight: 600; }
.pamana-libre__picker select { min-height: 40px; width: 100%; border-radius: 9px; border: 1px solid #cbd5e1; padding: 5px; color: #172b27; background: white; font-size: 12px; }
.pamana-libre__empty, .pamana-libre__detail { font-size: 12px; line-height: 1.5; }
.pamana-libre__detail { display: grid; gap: 3px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #dbe4e0; }
.pamana-libre__detail span { font-size: 11px; color: #475569; }
.pamana-libre__actions { position: absolute; right: 12px; bottom: 72px; z-index: 3; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: calc(100% - 24px); }
.pamana-libre__route-notice { position: absolute; right: 12px; bottom: 30px; z-index: 2; display: flex; max-width: min(360px, calc(100% - 24px)); align-items: center; gap: 7px; border: 1px solid #fff; border-radius: 12px; background: rgb(255 255 255 / 0.96); padding: 8px 10px; color: #334155; font: 650 10px/1.4 system-ui; pointer-events: none; }
.pamana-libre__route-notice i { width: 22px; height: 4px; flex: 0 0 auto; border-radius: 999px; background: #2563eb; }
.pamana-libre__button { min-height: 40px; padding: 8px 11px; border-radius: 12px; background: #fff; border: 1px solid #cbd5e1; color: #172b27; box-shadow: 0 3px 12px #172b2712; font: 650 12px/1.3 system-ui; white-space: nowrap; cursor: pointer; }
.pamana-libre__button:disabled { opacity: .55; cursor: not-allowed; }
.pamana-libre__feature-toggle:focus-visible, .pamana-libre__button:focus-visible, select:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
.pamana-libre__legend { position: absolute; bottom: 30px; left: 12px; z-index: 2; display: flex; flex-wrap: wrap; width: fit-content; max-width: calc(100% - 24px); gap: 7px 12px; padding: 8px 10px; border: 1px solid #fff; border-radius: 12px; background: rgb(255 255 255 / 0.96); color: #334155; font: 600 10px/1.4 system-ui; pointer-events: none; }
.pamana-libre__legend span { display: inline-flex; gap: 5px; align-items: center; }
.pamana-libre__legend i { width: 7px; height: 7px; border-radius: 50%; }
:deep(.maplibregl-ctrl-top-right) { top: 12px; right: 12px; }
:deep(.maplibregl-ctrl-bottom-right) { right: 12px; bottom: 8px; }
:deep(.maplibregl-ctrl-group) { border: 1px solid #dbe4e0; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 3px 16px #172b2720; }
:deep(.maplibregl-ctrl-group button) { width: 40px; height: 40px; }
:deep(.maplibregl-ctrl-attrib) { border-radius: 8px 0 0; background: rgb(255 255 255 / 0.9); color: #334155; font-size: 9px; }
.pamana-libre--compact { min-height: 0; }
.pamana-libre--compact .pamana-libre__state { padding: 10px; gap: 5px; font-size: 12px; }
.pamana-libre--compact .pamana-libre__state-icon { display: none; }
.pamana-libre--compact .pamana-libre__feature-toggle { top: 8px; left: 8px; min-height: 34px; padding: 6px 9px; font-size: 11px; }
.pamana-libre--compact .pamana-libre__tools { top: 48px; left: 8px; width: min(205px, calc(100% - 68px)); max-height: calc(100% - 56px); padding: 8px; border-radius: 12px; }
.pamana-libre--compact .pamana-libre__eyebrow { margin-bottom: 4px; font-size: 9px; }
.pamana-libre--compact .pamana-libre__picker select { min-height: 34px; }
.pamana-libre--compact .pamana-libre__detail { font-size: 11px; }
.pamana-libre--compact .pamana-libre__actions { right: 8px; bottom: 48px; max-width: calc(100% - 16px); }
.pamana-libre--compact .pamana-libre__button { min-height: 34px; padding: 6px 9px; font-size: 11px; }
@media (max-width: 480px) {
  .pamana-libre__feature-toggle { top: var(--map-tools-top, 10px); left: 10px; min-height: 36px; padding: 7px 9px; font-size: 11px; }
  .pamana-libre__tools { top: calc(var(--map-tools-top, 10px) + 44px); left: 10px; width: min(220px, calc(100% - 76px)); max-height: min(50%, calc(100% - var(--map-tools-top, 10px) - 174px)); padding: 9px; }
  .pamana-libre__actions { right: 8px; bottom: 78px; gap: 5px; }
  .pamana-libre__button { min-height: 36px; padding: 7px 9px; font-size: 11px; }
  .pamana-libre__route-notice { right: 8px; bottom: 32px; max-width: calc(55% - 12px); padding: 6px 8px; font-size: 9px; }
  .pamana-libre__legend { bottom: 32px; left: 8px; max-width: calc(45% - 12px); gap: 5px 8px; padding: 6px 8px; font-size: 9px; }
  :deep(.maplibregl-ctrl-top-right) { top: 8px; right: 8px; }
  :deep(.maplibregl-ctrl-bottom-right) { right: 8px; bottom: 4px; }
  :deep(.maplibregl-ctrl-group button) { width: 36px; height: 36px; }
}

@media (max-width: 480px) {
  .pamana-libre--roadside { min-height: 480px; }
  .pamana-libre--roadside .pamana-libre__legend { bottom: 34px; }
  .pamana-libre--roadside .pamana-libre__actions { bottom: 100px; }
}
</style>
