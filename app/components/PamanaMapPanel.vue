<script setup lang="ts">
import { legacyMarkerFeatures, suppliedLine } from '../services/mapPresentation'
import type { MapDisruptionFeature, MapLineFeature, MapPointFeature } from '../types/map'
const props = withDefaults(defineProps<{
  provider?: 'maplibre'
  icon?: string
  label?: string
  height?: string
  compact?: boolean
  toolsOffset?: string
  tone?: 'lime' | 'emerald' | 'teal' | 'red'
  markers?: Record<string, any>[]
  nodes?: MapPointFeature[]
  lines?: MapLineFeature[]
  transportNodes?: MapPointFeature[]
  vehicles?: MapPointFeature[]
  disruptions?: MapDisruptionFeature[]
  routePoints?: Record<string, any>[]
  userLocation?: { lat: number; lng: number } | null
  routeColor?: string
  routeLabel?: string
  routeDashed?: boolean
  routeGeometry?: { coordinates?: unknown } | null
  fitKey?: string | number | null
}>(), {
  provider: 'maplibre',
  icon: 'i-lucide-map',
  label: 'Map preview',
  height: '360px',
  compact: false,
  tone: 'lime',
  markers: () => [],
  nodes: () => [],
  lines: () => [],
  transportNodes: () => [],
  vehicles: () => [],
  disruptions: () => [],
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
const mapNodes = computed(() => [...legacyMarkerFeatures(props.markers), ...props.nodes])
// Never connect stops to synthesize transit geometry in the new renderer.
const mapLines = computed(() => props.lines.length ? props.lines : suppliedLine(props.routeGeometry, props.routeLabel))
const emit = defineEmits<{ 'feature-selected': [id: string]; 'map-ready': []; 'map-error': [state: string] }>()
</script>

<template>
  <div class="relative overflow-hidden rounded-[24px] border border-neutral-200/80 shadow-xl shadow-neutral-900/10" :style="{ minHeight: height }">
    <PamanaMapLibreMap :height="height" :compact="compact" :tools-offset="toolsOffset" :nodes="mapNodes" :transport-nodes="transportNodes" :vehicles="vehicles" :lines="mapLines" :disruptions="disruptions" :user-location="mapUserLocation" :fit-key="fitKey"
      @feature-selected="emit('feature-selected', $event)"
      @map-error="emit('map-error', $event)" @map-ready="emit('map-ready')" />
    <div class="pointer-events-none absolute inset-x-0 top-0 z-20">
      <slot name="overlay" />
    </div>
    <slot />
  </div>
</template>
