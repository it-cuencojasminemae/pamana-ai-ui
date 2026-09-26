<script setup lang="ts">
import { legacyMarkerFeatures, suppliedLine } from '../services/mapPresentation'
import type { MapLineFeature, MapPointFeature } from '../types/map'
const props = withDefaults(defineProps<{
  provider?: 'leaflet' | 'maplibre'
  icon?: string
  label?: string
  height?: string
  tone?: 'lime' | 'emerald' | 'teal' | 'red'
  markers?: Record<string, any>[]
  nodes?: MapPointFeature[]
  lines?: MapLineFeature[]
  transportNodes?: MapPointFeature[]
  vehicles?: MapPointFeature[]
  routePoints?: Record<string, any>[]
  userLocation?: { lat: number; lng: number } | null
  routeColor?: string
  routeLabel?: string
  routeDashed?: boolean
  routeGeometry?: { coordinates?: unknown } | null
  fitKey?: string | number | null
}>(), {
  provider: 'leaflet',
  icon: 'i-lucide-map',
  label: 'Map preview',
  height: '360px',
  tone: 'lime',
  markers: () => [],
  nodes: () => [],
  lines: () => [],
  transportNodes: () => [],
  vehicles: () => [],
  routePoints: () => [],
  userLocation: null,
  routeColor: '#65a30d',
  routeLabel: 'Selected route corridor',
  routeDashed: false,
  routeGeometry: null,
  fitKey: null
})

const { location: sharedUserLocation } = useGeolocation()
const mapUserLocation = computed(() => props.userLocation ?? sharedUserLocation.value)
const compatibilityMode = ref(false)
const mapFailed = ref(false)
const activeProvider = computed(() => compatibilityMode.value ? 'leaflet' : props.provider)
const mapNodes = computed(() => [...legacyMarkerFeatures(props.markers), ...props.nodes])
// Never connect stops to synthesize transit geometry in the new renderer.
const mapLines = computed(() => props.lines.length ? props.lines : suppliedLine(props.routeGeometry, props.routeLabel))
const emit = defineEmits<{ 'feature-selected': [id: string]; 'map-ready': []; 'map-error': [state: string] }>()
watch(() => props.provider, () => { compatibilityMode.value = false; mapFailed.value = false })
</script>

<template>
  <div class="relative overflow-hidden rounded-[24px] border border-neutral-200/80 shadow-xl shadow-neutral-900/10" :style="{ minHeight: height }">
    <PamanaLeafletMap
      v-if="activeProvider === 'leaflet'"
      :height="height"
      :markers="markers"
      :route-points="routePoints"
      :user-location="mapUserLocation"
      :route-color="routeColor"
      :route-label="routeLabel"
      :route-dashed="routeDashed"
      :route-geometry="routeGeometry"
      :fit-key="fitKey"
    />
    <PamanaMapLibreMap v-else :height="height" :nodes="mapNodes" :transport-nodes="transportNodes" :vehicles="vehicles" :lines="mapLines" :user-location="mapUserLocation" :fit-key="fitKey"
      @feature-selected="emit('feature-selected', $event)"
      @map-error="mapFailed = true; emit('map-error', $event)" @map-ready="mapFailed = false; emit('map-ready')" />
    <button v-if="provider === 'maplibre' && (mapFailed || compatibilityMode)" type="button"
      class="absolute bottom-2 left-3 z-30 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow"
      @click="compatibilityMode = !compatibilityMode">
      {{ compatibilityMode ? 'Try MapLibre map' : 'Use compatibility map' }}
    </button>
    <div v-if="activeProvider === 'leaflet'" class="pointer-events-none absolute inset-x-0 top-0 z-20">
      <slot name="overlay" />
    </div>
    <slot />
  </div>
</template>
