<script setup lang="ts">
import type { PamanaJourney } from '../../types/tripPlan'
import type { SelectedLocation } from '../../types/location'
import { journeyMapPresentation } from '../../services/tripPlanPresentation'

definePageMeta({ layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

const origin = ref<SelectedLocation | null>({ id: 'synthetic-origin', label: 'Synthetic origin', formattedAddress: 'Development fixture only', lat: 14, lng: 119, source: 'GEOAPIFY' })
const destination = ref<SelectedLocation | null>({ id: 'synthetic-destination', label: 'Synthetic destination', formattedAddress: 'Development fixture only', lat: 14.01, lng: 119.04, source: 'GEOAPIFY' })
const selectedId = ref('synthetic-direct')
const narrow = ref(false)

const unavailable = {
  fare: { status: 'UNKNOWN', currency: 'PHP', regularFare: null, discountedFare: null, payableFare: null, discountType: null, sourceSummary: null, verificationStatus: null, warnings: [] },
  service: { status: 'UNKNOWN', operatingMode: null, serviceStart: null, serviceEnd: null, headwayMinutes: null, scheduledDepartures: [], leaveWhenFull: null, limitedService: null, windowStatus: 'UNKNOWN', sourceSummary: null, verificationStatus: null, warnings: [] },
  availability: { status: 'UNKNOWN', wait: { status: 'UNKNOWN', lowMinutes: null, highMinutes: null }, activeVehicleCount: null, boardableVehicleCount: null, sourceSummary: null, warnings: [] },
} as const

const journeys: PamanaJourney[] = [
  {
    id: 'synthetic-direct', transferCount: 0, modes: ['JEEPNEY'], warnings: [],
    fareSummary: { totalStatus: 'KNOWN', knownSubtotal: 18, totalFare: 18, currency: 'PHP', warnings: [] },
    availabilitySummary: { status: 'AVAILABLE', transitLegsKnown: 1, transitLegsUnknown: 0, warnings: [] },
    durationSummary: { status: 'PARTIAL', knownWalkingDurationSeconds: 420, totalJourneyDurationSeconds: null },
    dataQuality: { planningEligible: true, verificationStatuses: ['FIELD_VERIFIED'], dataModes: ['SIMULATED'] },
    legs: [
      { sequence: 1, type: 'WALK', from: { lat: 14, lng: 119, label: 'Synthetic origin' }, to: { lat: 14.003, lng: 119.008, label: 'Synthetic boarding point' }, distanceMeters: 520, durationSeconds: 360, geometry: { type: 'LineString', coordinates: [[119, 14], [119.008, 14.003]] }, instructions: [], source: 'GEOAPIFY', calculatedAt: '2026-09-25T00:00:00.000Z', ...unavailable },
      { sequence: 2, type: 'TRANSIT', transportMode: 'JEEPNEY', route: { id: 'synthetic-route', code: 'TEST-01' }, variant: { id: 'synthetic-variant', code: 'TEST-01-OUT' }, direction: 'OUTBOUND', operatingStatus: 'ACTIVE', boardAt: { name: 'Synthetic boarding point' }, alightAt: { name: 'Synthetic drop-off point' }, intermediateNodes: [], signboard: 'Synthetic preview', segmentDistanceMeters: 2800, durationSeconds: null, geometry: { type: 'LineString', coordinates: [[119.008, 14.003], [119.036, 14.009]] }, fare: { ...unavailable.fare, status: 'KNOWN', regularFare: 18, payableFare: 18, sourceSummary: 'Synthetic UI fixture' }, service: { ...unavailable.service, status: 'KNOWN', operatingMode: 'FREQUENCY_BASED', serviceStart: '06:00', serviceEnd: '20:00', headwayMinutes: { minimum: 10, maximum: 15 }, windowStatus: 'WITHIN_SERVICE_WINDOW', sourceSummary: 'Synthetic UI fixture' }, availability: { ...unavailable.availability, status: 'LIVE_ACTIVE', wait: { status: 'SERVICE_INTERVAL_ONLY', lowMinutes: 10, highMinutes: 15 }, activeVehicleCount: 2, boardableVehicleCount: 1, sourceSummary: 'Synthetic UI fixture' } },
      { sequence: 3, type: 'WALK', from: { lat: 14.009, lng: 119.036, label: 'Synthetic drop-off point' }, to: { lat: 14.01, lng: 119.04, label: 'Synthetic destination' }, distanceMeters: 90, durationSeconds: 60, geometry: { type: 'LineString', coordinates: [[119.036, 14.009], [119.04, 14.01]] }, instructions: [], source: 'GEOAPIFY', calculatedAt: '2026-09-25T00:00:00.000Z', ...unavailable },
    ],
  },
  {
    id: 'synthetic-transfer', transferCount: 1, modes: ['JEEPNEY', 'UV EXPRESS'], warnings: [],
    fareSummary: { totalStatus: 'PARTIAL', knownSubtotal: 15, totalFare: null, currency: 'PHP', warnings: [] },
    availabilitySummary: { status: 'PARTIAL', transitLegsKnown: 1, transitLegsUnknown: 1, warnings: [] },
    durationSummary: { status: 'PARTIAL', knownWalkingDurationSeconds: 540, totalJourneyDurationSeconds: null },
    dataQuality: { planningEligible: true, verificationStatuses: ['FIELD_VERIFIED'], dataModes: ['SIMULATED'] },
    legs: [
      { sequence: 1, type: 'WALK', from: { lat: 14, lng: 119, label: 'Synthetic origin' }, to: { lat: 14.004, lng: 119.006, label: 'Synthetic pickup' }, distanceMeters: 650, durationSeconds: 480, geometry: { type: 'LineString', coordinates: [[119, 14], [119.006, 14.004]] }, instructions: [], source: 'GEOAPIFY', calculatedAt: '2026-09-25T00:00:00.000Z', ...unavailable },
      { sequence: 2, type: 'TRANSIT', transportMode: 'JEEPNEY', route: { id: 'route-a', code: 'TEST-A' }, variant: { id: 'variant-a', code: 'TEST-A-OUT' }, direction: 'OUTBOUND', operatingStatus: 'LIMITED', boardAt: { name: 'Synthetic pickup' }, alightAt: { name: 'Synthetic transfer' }, intermediateNodes: [], signboard: null, segmentDistanceMeters: null, durationSeconds: null, geometry: null, ...unavailable },
      { sequence: 3, type: 'TRANSFER', at: { name: 'Synthetic transfer' }, fromRouteVariantId: 'variant-a', fromVariantCode: 'TEST-A-OUT', toRouteVariantId: 'variant-b', toVariantCode: 'TEST-B-OUT', ...unavailable },
      { sequence: 4, type: 'TRANSIT', transportMode: 'UV EXPRESS', route: { id: 'route-b', code: 'TEST-B' }, variant: { id: 'variant-b', code: 'TEST-B-OUT' }, direction: 'OUTBOUND', operatingStatus: 'ACTIVE', boardAt: { name: 'Synthetic transfer' }, alightAt: { name: 'Synthetic drop-off' }, intermediateNodes: [], signboard: 'Synthetic preview', segmentDistanceMeters: null, durationSeconds: null, geometry: null, ...unavailable },
      { sequence: 5, type: 'WALK', from: { lat: 14.009, lng: 119.037, label: 'Synthetic drop-off' }, to: { lat: 14.01, lng: 119.04, label: 'Synthetic destination' }, distanceMeters: 80, durationSeconds: 60, geometry: null, instructions: [], source: 'GEOAPIFY', calculatedAt: '2026-09-25T00:00:00.000Z', ...unavailable },
    ],
  },
]
const selected = computed(() => journeys.find(journey => journey.id === selectedId.value) || journeys[0])
const map = computed(() => journeyMapPresentation(selected.value, origin.value, destination.value))
</script>

<template>
  <main class="min-h-screen bg-[#eef2ef] px-4 py-6 text-neutral-900 sm:px-7">
    <div class="mx-auto" :class="narrow ? 'max-w-[390px]' : 'max-w-6xl'">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p class="text-xs font-semibold uppercase tracking-[0.16em] text-lime-700">Development only · synthetic data</p><h1 class="font-display text-2xl font-bold">Phase 15 passenger planner</h1></div>
        <button class="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold" @click="narrow = !narrow">Toggle mobile width</button>
      </div>
      <div class="grid gap-5 lg:grid-cols-5">
        <div class="space-y-4 lg:col-span-2">
          <UCard class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
            <div class="flex items-center justify-between"><h2 class="font-display text-sm font-semibold">Where to?</h2><UIcon name="i-lucide-navigation" class="size-4 text-lime-600" /></div>
            <div class="mt-4 space-y-3">
              <LocationPamanaLocationSearch v-model="origin" mode="origin" allow-current-location />
              <div class="flex justify-center"><button aria-label="Swap origin and destination" class="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white"><UIcon name="i-lucide-arrow-down-up" /></button></div>
              <LocationPamanaLocationSearch v-model="destination" mode="destination" />
              <div class="grid grid-cols-2 gap-2"><USelect model-value="Depart now" :items="['Depart now']" /><USelect model-value="Regular fare" :items="['Regular fare']" /></div>
              <UButton block size="lg" icon="i-lucide-search" class="rounded-full font-semibold text-neutral-950">Find Best Route</UButton>
            </div>
          </UCard>
          <UCard class="glass glow-lime rounded-30" :ui="{ root: 'ring-0 rounded-30' }"><p class="font-display text-sm font-semibold">Selected journey fare</p><p class="mt-2 text-lg font-semibold">{{ selected?.fareSummary.totalFare ? `₱${selected.fareSummary.totalFare}` : 'Known subtotal ₱15' }}</p><p class="mt-2 text-xs text-neutral-500">Synthetic fixture for layout review only.</p></UCard>
        </div>
        <div class="space-y-3 lg:col-span-3">
          <JourneyPamanaJourneyCard v-for="(journey, index) in journeys" :key="journey.id" :journey="journey" :option-number="index + 1" :selected="selectedId === journey.id" @select="selectedId = $event" />
          <PamanaMapPanel provider="maplibre" height="clamp(320px, 48vw, 480px)" :nodes="map.nodes" :lines="map.lines" :fit-key="selectedId" />
          <p class="text-xs text-neutral-500">Synthetic offshore fixture. No PAMANA transport coordinates or database records are represented here.</p>
        </div>
      </div>
    </div>
  </main>
</template>
