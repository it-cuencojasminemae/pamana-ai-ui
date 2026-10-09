<script setup lang="ts">
import { AVAILABILITY_OPTIONS, availabilityPresentation } from '../../services/vehicleAvailability'
import type { VehicleAvailability, VehicleAvailabilityStatus } from '../../types/vehicleAvailability'
const props = defineProps<{ tripId: string; availability?: VehicleAvailability | null; disabled?: boolean }>()
const emit = defineEmits<{ updated: [availability: VehicleAvailability] }>()
const { apiFetch } = useApi()
const now = useAvailabilityClock()
const saving = ref(false)
const pendingStatus = ref<VehicleAvailabilityStatus | null>(null)
const feedback = ref('')
const failed = ref(false)
const current = computed(() => availabilityPresentation(props.availability, Math.max(now.value, Date.now()), true))
const sameReport = (status: VehicleAvailabilityStatus) => Boolean(props.availability?.reportedAt && !current.value.stale && current.value.status === status)

async function report(status: VehicleAvailabilityStatus) {
  if (saving.value || props.disabled || sameReport(status)) return
  saving.value = true
  pendingStatus.value = status
  failed.value = false
  feedback.value = 'Saving availability…'
  try {
    const response = await apiFetch<{ data: VehicleAvailability }>(`/api/driver-trips/${props.tripId}/availability`, {
      method: 'PUT', body: { data: { status } }
    })
    emit('updated', response.data)
    feedback.value = 'Availability saved.'
  } catch {
    failed.value = true
    feedback.value = 'Could not save availability. Please try again when safely stopped.'
  } finally {
    saving.value = false
    pendingStatus.value = null
  }
}
</script>

<template>
  <UCard v-pamana-reveal class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-display text-sm font-semibold text-neutral-900">Vehicle Availability</h2>
      <span class="text-xs text-neutral-500">Optional</span>
    </div>
    <PamanaVehicleAvailability class="mt-3" :availability="availability" driver />
    <div class="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Report vehicle availability" :aria-busy="saving">
      <button data-pamana-feedback v-for="option in AVAILABILITY_OPTIONS" :key="option.status" type="button"
        class="flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-default"
        :class="[option.classes, current.status === option.status ? 'ring-2 ring-neutral-700 ring-offset-2' : 'opacity-80', (saving || disabled) ? 'opacity-50' : '']"
        :aria-pressed="current.status === option.status" :disabled="saving || disabled || sameReport(option.status)" @click="report(option.status)">
        <UIcon v-if="pendingStatus === option.status" name="i-lucide-loader-circle" class="size-4 shrink-0 animate-spin" aria-hidden="true" />
        {{ option.label }}
      </button>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-neutral-500">Update only while safely stopped. You can continue your trip without reporting.</p>
    <p v-if="feedback" class="mt-2 text-xs leading-relaxed" :class="failed ? 'text-red-700' : 'text-emerald-700'" role="status" aria-live="polite">{{ feedback }}</p>
  </UCard>
</template>
