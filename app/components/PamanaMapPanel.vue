<script setup lang="ts">
import { legacyMarkerFeatures, suppliedLine } from '../services/mapPresentation'
import type { MapDisruptionFeature, MapLineFeature, MapPointFeature } from '../types/map'
import type { PinArea } from '../types/pinArea'
import type { PilotLandmark } from '../types/pilotLandmarks'
import { LANDMARK_CATEGORIES } from '../services/landmarkMapPresentation'
const props = withDefaults(defineProps<{
  provider?: 'maplibre'
  icon?: string
  label?: string
  height?: string
  compact?: boolean
  passengerFocus?: boolean
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
  pinBoundary?: PinArea['boundary']
  pinSelectionActive?: boolean
  landmarks?: PilotLandmark[]
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
  fitKey: null,
  pinBoundary: null,
  pinSelectionActive: false,
  landmarks: () => []
})

const { location: sharedUserLocation } = useGeolocation()
const mapUserLocation = computed(() => props.userLocation ?? sharedUserLocation.value)
const mapNodes = computed(() => [...legacyMarkerFeatures(props.markers), ...props.nodes])
// Never connect stops to synthesize transit geometry in the new renderer.
const mapLines = computed(() => props.lines.length ? props.lines : suppliedLine(props.routeGeometry, props.routeLabel))
const emit = defineEmits<{ 'feature-selected': [id: string]; 'map-ready': []; 'map-error': [state: string]; 'coordinate-selected': [point: { lat: number; lng: number }]; 'landmark-chosen': [id: string, mode: 'origin' | 'destination'] }>()
const selectedLandmarkId = ref('')
const selectedLandmark = computed(() => props.landmarks.find(item => item.id === selectedLandmarkId.value))
watch(() => props.pinSelectionActive, active => { if (active) selectedLandmarkId.value = '' })
watch(() => props.landmarks, items => { if (!items.some(i => i.id === selectedLandmarkId.value)) selectedLandmarkId.value = '' })
</script>

<template>
  <div class="relative overflow-hidden rounded-[24px] border border-neutral-200/80 shadow-xl shadow-neutral-900/10" :style="{ minHeight: height }">
    <PamanaMapLibreMap :height="height" :compact="compact" :passenger-focus="passengerFocus" :tools-offset="toolsOffset" :nodes="mapNodes" :transport-nodes="transportNodes" :vehicles="vehicles" :lines="mapLines" :disruptions="disruptions" :user-location="mapUserLocation" :fit-key="fitKey" :pin-boundary="pinBoundary" :pin-selection-active="pinSelectionActive" :landmarks="landmarks" :selected-landmark-id="selectedLandmarkId"
      @landmark-selected="selectedLandmarkId = $event"
      @coordinate-selected="emit('coordinate-selected', $event)"
      @feature-selected="emit('feature-selected', $event)"
      @map-error="emit('map-error', $event)" @map-ready="emit('map-ready')" />
    <div class="pointer-events-none absolute inset-x-0 top-0 z-20">
      <slot name="overlay" />
    </div>
    <slot />
    <section v-if="landmarks.length && (!passengerFocus || selectedLandmark)" class="relative border-t border-neutral-200 bg-white/95 p-3" aria-label="Selected landmark">
      <label v-if="!passengerFocus" class="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-600">
        Pilot landmarks
        <select v-model="selectedLandmarkId" aria-label="Choose a pilot landmark" class="min-h-10 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-2 text-sm font-normal text-neutral-800">
          <option value="">Choose a landmark or tap its map icon</option>
          <option v-for="item in landmarks" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <div v-if="selectedLandmark" class="mt-3 space-y-2" aria-live="polite">
        <p class="text-sm font-semibold text-neutral-900">{{ selectedLandmark.name }} <span class="ml-1 text-xs font-normal text-neutral-500">{{ LANDMARK_CATEGORIES[selectedLandmark.category].label }}</span></p>
        <p v-if="selectedLandmark.connectionNote" class="text-xs leading-relaxed text-neutral-600">{{ selectedLandmark.connectionNote }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton size="sm" class="rounded-full" @click="emit('landmark-chosen', selectedLandmark.id, 'origin')">Plan from here</UButton>
          <UButton size="sm" color="neutral" variant="soft" class="rounded-full" @click="emit('landmark-chosen', selectedLandmark.id, 'destination')">Plan to here</UButton>
        </div>
      </div>
    </section>
  </div>
</template>
