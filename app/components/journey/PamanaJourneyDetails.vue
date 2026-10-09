<script setup lang="ts">
import type { PamanaJourney } from '../../types/tripPlan'
import { routeOptionPresentation, journeyNavigationSteps } from '../../services/routeOptionsPresentation'
const props = defineProps<{ journey: PamanaJourney }>()
const details = computed(() => routeOptionPresentation(props.journey, 1))
const steps = computed(() => journeyNavigationSteps(props.journey))
</script>

<template>
  <UCard v-pamana-reveal class="min-w-0 rounded-3xl bg-white/90" :ui="{ root: 'ring-1 ring-neutral-200 rounded-3xl' }">
    <div class="flex items-center gap-2"><UIcon name="i-lucide-signpost" class="size-5 text-lime-700" /><h2 class="font-display text-base font-semibold text-neutral-900">Route details</h2></div>
    <p class="mt-3 text-xs font-semibold text-neutral-500">Pickup</p>
    <p class="mt-1 break-words text-sm text-neutral-900">{{ details.pickup }}</p>
    <ol class="mt-4 space-y-4" aria-label="Steps for the selected route">
      <li v-for="(step, index) in steps" :key="index" class="flex min-w-0 gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-lime-100 text-xs font-bold text-lime-800">{{ index + 1 }}</span>
        <div class="min-w-0 flex-1">
          <p class="break-words text-sm font-medium leading-relaxed text-neutral-800">{{ step.instruction }}</p>
          <p v-if="journey.dataQuality.researchPreview && step.instruction.startsWith('Transfer walk')" class="mt-1 text-xs text-amber-800">Research walking connection: confirm safe pedestrian access and the terminal entrance. Exact gate and crossing rules are not field verified.</p>
          <ul v-if="step.walkingInstructions.length" class="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-neutral-600" aria-label="Walking directions">
            <li v-for="(instruction, instructionIndex) in step.walkingInstructions" :key="instructionIndex" class="break-words">{{ instruction }}</li>
          </ul>
          <p v-else-if="step.type === 'WALK'" class="mt-1 text-xs text-neutral-500">Walking directions are unavailable for this connection. Check a safe pedestrian route before setting off.</p>
          <p v-if="step.signboard" class="mt-1 break-words text-xs text-neutral-500">Look for: <span class="font-medium text-neutral-700">{{ step.signboard }}</span></p>
          <ul v-if="step.boardingInstructions.length" class="mt-2 space-y-1 rounded-xl bg-amber-50 p-2 text-xs leading-relaxed text-amber-900" aria-label="Before boarding">
            <li v-for="instruction in step.boardingInstructions" :key="instruction" class="break-words">{{ instruction }}</li>
          </ul>
          <p v-if="step.type === 'TRANSIT'" class="mt-1 text-xs text-neutral-600">{{ step.estimated ? 'Estimated fare' : 'Fare' }}: <strong>{{ step.fare }}</strong></p>
        </div>
      </li>
    </ol>
    <div class="mt-4 border-t border-neutral-100 pt-3"><p class="text-xs font-semibold text-neutral-500">Drop-off</p><p class="mt-1 break-words text-sm text-neutral-900">{{ details.dropoff }}</p></div>
  </UCard>
</template>
