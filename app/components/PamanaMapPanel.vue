<script setup lang="ts">
const props = withDefaults(defineProps<{
  icon?: string
  label?: string
  height?: string
  tone?: 'lime' | 'emerald' | 'teal' | 'red'
  markers?: Record<string, any>[]
  routePoints?: Record<string, any>[]
  userLocation?: { lat: number; lng: number } | null
  routeColor?: string
  routeLabel?: string
  routeDashed?: boolean
  routeGeometry?: { coordinates?: unknown } | null
  fitKey?: string | number | null
}>(), {
  icon: 'i-lucide-map',
  label: 'Map preview',
  height: '360px',
  tone: 'lime',
  markers: () => [],
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
</script>

<template>
  <div class="relative overflow-hidden rounded-[24px] border border-neutral-200/80 shadow-xl shadow-neutral-900/10" :style="{ minHeight: height }">
    <PamanaLeafletMap
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
    <div class="pointer-events-none absolute inset-x-0 top-0 z-20">
      <slot name="overlay" />
    </div>
    <slot />
  </div>
</template>
