<script setup lang="ts">
import { availabilityPresentation } from '../services/vehicleAvailability'
import type { VehicleAvailability } from '../types/vehicleAvailability'
const props = defineProps<{ availability?: VehicleAvailability | null; driver?: boolean }>()
const now = useAvailabilityClock()
const presentation = computed(() => availabilityPresentation(props.availability, Math.max(now.value, Date.now()), props.driver))
</script>

<template>
  <div class="min-w-0">
    <span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold" :class="presentation.classes">{{ presentation.label }}</span>
    <p class="mt-1 break-words text-xs leading-relaxed text-neutral-500">
      <time v-if="presentation.reportedAt" :datetime="presentation.reportedAt">{{ presentation.detail }}</time>
      <span v-else>{{ presentation.detail }}</span>
    </p>
  </div>
</template>
