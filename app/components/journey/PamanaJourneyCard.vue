<script setup lang="ts">
import type { JourneyDisruptionWarning, PamanaJourney } from '../../types/tripPlan'
import { routeOptionPresentation } from '../../services/routeOptionsPresentation'
const props = defineProps<{ journey: PamanaJourney; optionNumber: number; selected?: boolean; badges?: string[]; research?: boolean }>()
defineEmits<{ select: [id: string] }>()
const card = computed(() => routeOptionPresentation(props.journey, props.optionNumber))
const advisories = computed(() => props.journey.warnings.filter(
  (warning): warning is JourneyDisruptionWarning => typeof warning === 'object' && warning?.type === 'DISRUPTION',
))
</script>

<template>
  <article class="min-w-0 overflow-hidden rounded-3xl border bg-white/90 transition" :class="selected ? 'border-lime-500 shadow-md shadow-lime-900/5 ring-2 ring-lime-400/25' : 'border-neutral-200 hover:border-lime-300'">
    <button type="button" class="w-full min-w-0 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-600 sm:p-5" :aria-pressed="selected" :aria-label="`Select ${card.option}: ${card.title}`" @click="$emit('select', journey.id)">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-[11px] font-bold tracking-[0.14em] text-neutral-500">{{ card.option }}</span>
        <span v-if="selected" class="inline-flex items-center gap-1 text-xs font-semibold text-lime-800"><UIcon name="i-lucide-circle-check" class="size-4" /> Selected</span>
      </div>
      <div v-if="badges?.length" class="mt-2 flex flex-wrap gap-1.5">
        <UBadge v-for="badge in badges" :key="badge" color="primary" variant="soft" size="sm" class="rounded-full text-[10px] font-bold uppercase tracking-wide">{{ badge }}</UBadge>
      </div>
      <h3 class="mt-3 break-words font-display text-base font-semibold leading-snug text-neutral-900">{{ card.title }}</h3>
      <p v-if="journey.legs.some(leg => leg.type === 'TRANSIT' && leg.availability.evidenceClass === 'SIMULATED')" class="mt-1 text-[11px] text-amber-800">SIMULATED DEMO — waits, vehicle observations, duration and category comparisons</p>
      <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600" aria-label="Transport sequence">
        <template v-for="(mode, index) in card.sequence" :key="index">
          <UIcon v-if="index" name="i-lucide-arrow-right" class="size-3.5 text-neutral-400" />
          <span class="inline-flex items-center gap-1.5"><UIcon :name="mode === 'Tricycle' ? 'i-lucide-bike' : 'i-lucide-bus-front'" class="size-4" />{{ mode }}</span>
        </template>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3">
        <div><p class="text-xs text-neutral-500">Estimated fare</p><p class="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{{ card.fare }}</p></div>
        <div><p class="text-xs text-neutral-500">Transfers</p><p class="mt-1 text-base font-semibold text-neutral-900">{{ card.transfers }}</p></div>
      </div>
      <div v-if="card.wait || card.availability" class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        <span v-if="card.wait">Est. wait: {{ card.wait }}</span>
        <span v-if="card.availability">{{ card.availability }}</span>
      </div>
      <p v-if="card.totalTime" class="mt-2 text-xs text-neutral-600">{{ card.totalTime }} · simulated total journey time</p>
      <p class="mt-2 text-xs text-neutral-600">Walking: {{ Math.round(journey.legs.filter(leg => leg.type === 'WALK').reduce((total, leg) => total + (leg.distanceMeters || 0), 0)) }} m</p>
    </button>
    <div v-if="advisories.length" class="space-y-1 border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900" role="status" aria-label="Active journey disruptions">
      <p v-for="warning in advisories" :key="warning.disruptionId" class="break-words">{{ warning.effect === 'LIMITED_SERVICE' ? 'Limited service' : 'Travel advisory' }}: {{ warning.message }}</p>
    </div>
  </article>
</template>
