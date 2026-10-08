<script setup lang="ts">
import type { JourneyExplanationResponse } from '../../types/journeyExplanation'
import { guideUnavailableMessage } from '../../services/journeyExplanation'

defineProps<{ loading: boolean; response: JourneyExplanationResponse | null; fallback: string; research?: boolean }>()
defineEmits<{ regenerate: [] }>()
</script>

<template>
  <UCard class="rounded-3xl bg-white/80" :ui="{ root: 'ring-1 ring-neutral-200 rounded-3xl' }">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-display text-sm font-semibold text-neutral-900">{{ research ? 'Research journey guide' : 'PAMANA AI Trip Guide' }}</h2>
      <UButton v-if="!research" color="neutral" variant="ghost" size="sm" icon="i-lucide-sparkles" class="rounded-full" :disabled="loading" @click="$emit('regenerate')">Explain again</UButton>
    </div>
    <div class="mt-2" aria-live="polite" :aria-busy="loading">
      <p v-if="loading" role="status" class="text-sm text-neutral-500">PAMANA AI is preparing your trip guide…</p>
      <template v-else>
        <p v-if="response && response.status !== 'AVAILABLE'" class="mb-2 text-xs leading-relaxed text-neutral-500">{{ guideUnavailableMessage }}</p>
        <p class="text-sm leading-relaxed text-neutral-700">{{ response?.status === 'AVAILABLE' ? response.explanation : fallback }}</p>
      </template>
    </div>
  </UCard>
</template>
