<script setup lang="ts">
import type { SelectedLocation } from '../../types/location'
import { locationMapFeature } from '../../services/locationPresentation'

definePageMeta({ layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

const origin = ref<SelectedLocation | null>(null)
const destination = ref<SelectedLocation | null>(null)
const mapState = ref('INITIALIZING')
const nodes = computed(() => [
  ...(origin.value ? [locationMapFeature(origin.value, 'origin')] : []),
  ...(destination.value ? [locationMapFeature(destination.value, 'destination')] : []),
])
const fitKey = computed(() => `${origin.value?.id ?? ''}|${destination.value?.id ?? ''}`)
</script>

<template>
  <main class="preview">
    <header>
      <p class="eyebrow">Development-only Phase 8 harness</p>
      <h1>Geoapify place selection</h1>
      <p>Search results remain browser-only geographic selections. They are never saved as PAMANA transport nodes.</p>
    </header>
    <section class="search-card">
      <label>From</label>
      <LocationPamanaLocationSearch v-model="origin" mode="origin" allow-current-location placeholder="Current location or search a place" />
      <label>To</label>
      <LocationPamanaLocationSearch v-model="destination" mode="destination" placeholder="Search destination" />
    </section>
    <p class="status" role="status">Map: {{ mapState }} · Origin: {{ origin?.label || 'none' }} · Destination: {{ destination?.label || 'none' }}</p>
    <PamanaMapLibreMap height="min(58vh, 560px)" :nodes="nodes" :fit-key="fitKey" @map-ready="mapState = 'READY'" @map-error="mapState = $event" />
  </main>
</template>

<style scoped>
.preview { max-width: 1040px; margin: 0 auto; padding: 24px; color: #172b27; font-family: system-ui; }
header { margin-bottom: 18px; } h1 { margin: 3px 0 7px; font-size: clamp(24px, 4vw, 38px); font-weight: 780; }
header p { margin: 0; color: #52645f; }.eyebrow { color: #4d7c0f; font-size: 12px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
.search-card { position: relative; z-index: 5; display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 10px; align-items: center; margin-bottom: 12px; padding: 14px; border: 1px solid #dbe4e0; border-radius: 20px; background: #f8faf9; }
label { font-size: 12px; font-weight: 750; text-transform: uppercase; }.status { margin: 9px 2px; color: #52645f; font-size: 12px; }
@media (max-width: 700px) { .preview { padding: 14px; }.search-card { grid-template-columns: 1fr; }.search-card label { margin-top: 4px; } }
</style>
