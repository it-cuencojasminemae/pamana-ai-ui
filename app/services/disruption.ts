import type { DisruptionEffect, StructuredDisruption } from '../types/disruption'

export const DISRUPTION_EFFECT_OPTIONS: ReadonlyArray<{ value: DisruptionEffect, label: string }> = [
  { value: 'WARNING_ONLY', label: 'Warning only' },
  { value: 'LIMITED_SERVICE', label: 'Limited service' },
  { value: 'ROUTE_SUSPENDED', label: 'Route suspended' },
  { value: 'VARIANT_SUSPENDED', label: 'Route variant suspended' },
  { value: 'NODE_CLOSED', label: 'Transport node closed' },
  { value: 'BOARDING_CLOSED', label: 'Boarding closed' },
  { value: 'ALIGHTING_CLOSED', label: 'Alighting closed' },
  { value: 'TRANSFER_BLOCKED', label: 'Transfer blocked' },
]

export const effectLabel = (effect?: DisruptionEffect | null) =>
  DISRUPTION_EFFECT_OPTIONS.find(option => option.value === effect)?.label ?? 'Legacy disruption'

export function targetLabel(disruption: StructuredDisruption) {
  const targets = [
    disruption.affected_route?.route_name || disruption.affected_route?.route_code,
    disruption.affected_route_variant?.display_name || disruption.affected_route_variant?.variant_code,
    disruption.affected_transport_node?.name || disruption.affected_transport_node?.node_code,
  ].filter((value): value is string => Boolean(value))
  return targets.length ? targets.join(' · ') : 'General advisory'
}
