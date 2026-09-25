<script setup lang="ts">
import type { JourneyTransitLeg, PamanaJourney } from '../../types/tripPlan'
import { formatDistance, formatDuration, formatFare, legTitle } from '../../services/tripPlanPresentation'

const props = defineProps<{ journey: PamanaJourney; optionNumber: number; selected?: boolean }>()
defineEmits<{ select: [id: string] }>()

const transferLabel = computed(() => props.journey.transferCount === 0
  ? 'Direct journey'
  : `${props.journey.transferCount} ${props.journey.transferCount === 1 ? 'transfer' : 'transfers'}`)
const modeLabel = computed(() => props.journey.modes.length ? props.journey.modes.join(' + ') : 'Public transport')

function fareSummary() {
  const summary = props.journey.fareSummary
  if (summary.totalStatus === 'KNOWN') return formatFare(summary.totalFare, summary.currency || 'PHP')
  if (summary.knownSubtotal !== null) return `Known subtotal ${formatFare(summary.knownSubtotal, summary.currency || 'PHP')}`
  return 'Fare unavailable'
}

function availabilityLabel(status: PamanaJourney['availabilitySummary']['status']) {
  return { AVAILABLE: 'Service available', PARTIAL: 'Some service information available', UNAVAILABLE: 'Service unavailable at this time', UNKNOWN: 'Availability unknown' }[status]
}

function serviceLabel(leg: JourneyTransitLeg) {
  if (leg.service.windowStatus === 'OUTSIDE_SERVICE_WINDOW') return 'Outside verified service hours'
  if (leg.service.operatingMode === 'LEAVE_WHEN_FULL') return 'Departs when full'
  if (leg.service.operatingMode === 'CONTINUOUS_UNSCHEDULED') return 'Continuous service; departure time varies'
  if (leg.service.headwayMinutes) {
    const { minimum, maximum } = leg.service.headwayMinutes
    return `Typical service interval: ${minimum === maximum ? minimum : `${minimum}–${maximum}`} min`
  }
  if (leg.service.serviceStart && leg.service.serviceEnd) return `Service hours: ${leg.service.serviceStart}–${leg.service.serviceEnd}`
  return 'Service schedule unavailable'
}

function vehicleLabel(leg: JourneyTransitLeg) {
  const availability = leg.availability
  if (availability.status === 'LIVE_ACTIVE' && availability.activeVehicleCount !== null) {
    return `${availability.activeVehicleCount} active ${availability.activeVehicleCount === 1 ? 'vehicle' : 'vehicles'} detected · ETA unavailable`
  }
  if (availability.status === 'SERVICE_EXPECTED') return 'Service expected within verified hours'
  if (availability.status === 'LIMITED') return 'Limited service'
  if (availability.status === 'OUTSIDE_SERVICE') return 'Outside verified service hours'
  return 'Availability unknown'
}

function waitLabel(leg: JourneyTransitLeg) {
  const wait = leg.availability.wait
  if (wait.status === 'ESTIMATED_WINDOW' && wait.lowMinutes !== null && wait.highMinutes !== null) {
    return `Estimated wait window: ${wait.lowMinutes === wait.highMinutes ? wait.lowMinutes : `${wait.lowMinutes}–${wait.highMinutes}`} min`
  }
  if (wait.status === 'SERVICE_INTERVAL_ONLY') return 'Arrival time unavailable; see typical service interval'
  return 'Wait time unavailable'
}

function evidenceLabel(leg: JourneyTransitLeg) {
  const sources = [leg.fare.sourceSummary, leg.service.sourceSummary, leg.availability.sourceSummary].filter((source): source is string => Boolean(source))
  return [...new Set(sources)].join(' · ')
}
</script>

<template>
  <article
    class="glass card-lift rounded-30 border p-4 transition"
    :class="selected ? 'border-lime-400/70 ring-2 ring-lime-300/25' : 'border-transparent'"
  >
    <button
      type="button"
      class="w-full text-left"
      :aria-pressed="selected"
      :aria-label="`Select journey option ${optionNumber}`"
      @click="$emit('select', journey.id)"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-700">Journey option {{ optionNumber }}</p>
          <h2 class="mt-1 font-display text-base font-semibold text-neutral-900">{{ modeLabel }}</h2>
        </div>
        <span class="pill bg-lime-100 text-lime-700">{{ transferLabel }}</span>
      </div>

      <div class="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div class="rounded-2xl bg-neutral-900/[0.035] p-3">
          <p class="text-[10px] uppercase tracking-wide text-neutral-400">Fare</p>
          <p class="mt-1 font-semibold text-neutral-900">{{ fareSummary() }}</p>
        </div>
        <div class="rounded-2xl bg-neutral-900/[0.035] p-3">
          <p class="text-[10px] uppercase tracking-wide text-neutral-400">Known time</p>
          <p class="mt-1 font-semibold text-neutral-900">
            {{ journey.durationSummary.knownWalkingDurationSeconds === null ? 'Total duration unavailable' : `${formatDuration(journey.durationSummary.knownWalkingDurationSeconds)} walking` }}
          </p>
        </div>
        <div class="rounded-2xl bg-neutral-900/[0.035] p-3">
          <p class="text-[10px] uppercase tracking-wide text-neutral-400">Availability</p>
          <p class="mt-1 font-semibold text-neutral-900">{{ availabilityLabel(journey.availabilitySummary.status) }}</p>
        </div>
      </div>
    </button>

    <div v-if="selected" class="mt-4 border-t border-neutral-900/10 pt-4">
      <ol class="space-y-3" :aria-label="`Steps for journey option ${optionNumber}`">
        <li v-for="leg in journey.legs" :key="`${journey.id}-${leg.sequence}`" class="flex gap-3">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
            <UIcon :name="leg.type === 'WALK' ? 'i-lucide-person-standing' : leg.type === 'TRANSFER' ? 'i-lucide-repeat-2' : 'i-lucide-bus-front'" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-neutral-900">{{ legTitle(leg) }}</p>
            <template v-if="leg.type === 'WALK'">
              <p class="mt-0.5 text-xs text-neutral-500">{{ formatDistance(leg.distanceMeters) }} · {{ formatDuration(leg.durationSeconds) }}</p>
              <p class="mt-1 text-[10px] text-neutral-400">Walking connector from Geoapify</p>
            </template>
            <template v-else-if="leg.type === 'TRANSFER'">
              <p class="mt-0.5 text-xs text-neutral-500">Leave {{ leg.fromVariantCode || 'the first service' }} and board {{ leg.toVariantCode || 'the next service' }}.</p>
            </template>
            <template v-else>
              <p class="mt-0.5 text-xs text-neutral-500">{{ leg.boardAt?.name || 'Boarding point unavailable' }} → {{ leg.alightAt?.name || 'Drop-off point unavailable' }}</p>
              <p v-if="leg.signboard" class="mt-1 text-xs text-neutral-600">Look for: <strong>{{ leg.signboard }}</strong></p>
              <div class="mt-2 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2">
                <p><strong class="text-neutral-700">Fare:</strong> {{ leg.fare.status === 'KNOWN' ? formatFare(leg.fare.payableFare, leg.fare.currency || 'PHP') : 'Unavailable' }}</p>
                <p><strong class="text-neutral-700">Service:</strong> {{ serviceLabel(leg) }}</p>
                <p class="sm:col-span-2"><strong class="text-neutral-700">Vehicles:</strong> {{ vehicleLabel(leg) }}</p>
                <p class="sm:col-span-2"><strong class="text-neutral-700">Wait:</strong> {{ waitLabel(leg) }}</p>
              </div>
              <p v-if="evidenceLabel(leg)" class="mt-1 text-[10px] text-neutral-400">Evidence: {{ evidenceLabel(leg) }}</p>
            </template>
          </div>
        </li>
      </ol>
      <p class="mt-4 rounded-2xl bg-neutral-900/[0.035] px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
        Total journey duration is unavailable until verified transit travel times are available. Times shown above cover known walking legs only.
      </p>
    </div>
  </article>
</template>
