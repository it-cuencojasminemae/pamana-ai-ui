<script setup lang="ts">
defineProps<{ enabled: boolean; loading: boolean; mode: 'origin' | 'destination' | null; error: string; areaLabel?: string }>()
const emit = defineEmits<{ choose: [mode: 'origin' | 'destination']; retry: [] }>()
</script>

<template>
  <div class="space-y-2 rounded-2xl border border-neutral-200 bg-white/90 p-3" aria-label="Choose a location on the map">
    <div class="flex flex-wrap gap-2">
      <UButton color="neutral" :variant="mode === 'origin' ? 'solid' : 'soft'" size="sm" icon="i-lucide-map-pin" :disabled="!enabled || loading" :aria-pressed="mode === 'origin'" @click="emit('choose', 'origin')">Pin starting point</UButton>
      <UButton color="neutral" :variant="mode === 'destination' ? 'solid' : 'soft'" size="sm" icon="i-lucide-map-pin" :disabled="!enabled || loading" :aria-pressed="mode === 'destination'" @click="emit('choose', 'destination')">Pin destination</UButton>
    </div>
    <p class="text-xs text-neutral-600" role="status" aria-live="polite">
      {{ loading ? 'Loading the pilot pin area…' : error || (enabled ? mode ? `Tap a location within ${areaLabel || 'San Juan, Mexico, Pampanga'} to place your pin. Tap again to replace it, or tap the active button to finish.` : `Map pins are available within ${areaLabel || 'San Juan, Mexico, Pampanga'}. Existing destinations remain searchable.` : 'Map pin selection is currently unavailable. Search for places to plan your trip.') }}
    </p>
    <UButton v-if="error && !enabled" color="neutral" variant="link" size="xs" :disabled="loading" @click="emit('retry')">Retry pin area</UButton>
    <p v-if="enabled" class="text-[11px] text-neutral-500">Boundary: PSA indicative barangay map.</p>
  </div>
</template>
