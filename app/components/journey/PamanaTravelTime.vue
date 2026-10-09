<script setup lang="ts">
import type { TravelTimeEstimate } from '../../types/travelTime'
import { travelMinutes } from '../../services/travelTime'
defineProps<{ loading: boolean; estimate: TravelTimeEstimate | null }>()
</script>

<template>
  <section v-pamana-reveal class="space-y-2 rounded-2xl border border-neutral-200 bg-white/90 p-4" aria-label="Approximate travel time" aria-live="polite" :aria-busy="loading">
    <h3 class="text-sm font-semibold text-neutral-900">Approximate travel time</h3>
    <p v-if="loading" class="text-sm text-neutral-600" role="status">Estimating road travel time…</p>
    <template v-else-if="estimate && ['COMPLETE', 'PARTIAL'].includes(estimate.status)">
      <p v-if="estimate.status === 'COMPLETE'" class="text-lg font-semibold text-neutral-900">About {{ travelMinutes(estimate.movingSeconds) }} of walking and road travel</p>
      <p v-else class="text-sm text-neutral-600">Only part of this journey can be estimated.</p>
      <dl class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <div v-if="estimate.walkingSeconds !== null"><dt class="text-xs text-neutral-500">{{ estimate.walkingComplete ? 'Walking' : 'Known walking sections' }}</dt><dd>{{ travelMinutes(estimate.walkingSeconds) }}</dd></div>
        <div><dt class="text-xs text-neutral-500">{{ estimate.ridesComplete ? 'Approximate road travel' : 'Known road travel sections' }}</dt><dd>{{ travelMinutes(estimate.rideSeconds) }}<span v-if="!estimate.ridesComplete && estimate.knownRideCount"> · {{ estimate.knownRideCount }} of {{ estimate.rideCount }} rides</span></dd></div>
      </dl>
      <p class="text-xs font-medium text-amber-800">Waiting, boarding, and transfer delays not included.</p>
      <p class="text-xs text-neutral-500">Geoapify road estimate. Frequent jeepney stops may add time. Uses approximated traffic, not live conditions or a jeepney arrival prediction.</p>
    </template>
    <p v-else class="text-sm text-neutral-600">Travel time is currently unavailable. Your route instructions and fares remain available.</p>
  </section>
</template>
