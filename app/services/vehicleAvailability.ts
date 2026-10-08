import type { VehicleAvailability, VehicleAvailabilityStatus } from '../types/vehicleAvailability'

export const AVAILABILITY_OPTIONS: { status: VehicleAvailabilityStatus; label: string; classes: string }[] = [
  { status: 'AVAILABLE', label: 'Seats Available', classes: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { status: 'LIMITED', label: 'Almost Full', classes: 'border-amber-300 bg-amber-50 text-amber-800' },
  { status: 'FULL', label: 'Full', classes: 'border-red-300 bg-red-50 text-red-800' },
  { status: 'UNKNOWN', label: 'Not Reported', classes: 'border-neutral-300 bg-neutral-100 text-neutral-600' }
]

export function availabilityPresentation(value?: VehicleAvailability | null, now = Date.now(), driver = false) {
  const timestamp = value?.reportedAt ? Date.parse(value.reportedAt) : NaN
  const expires = value?.expiresAt ? Date.parse(value.expiresAt) : NaN
  const valid = Number.isFinite(timestamp) && Number.isFinite(expires) && expires > timestamp && timestamp <= now
  const stale = Boolean(value?.stale || (valid && now >= expires))
  const trustedSource = value?.dataMode === 'SIMULATED' ? value?.source === 'SIMULATION' : value?.dataMode === 'REAL' && value?.source === 'DRIVER'
  const status = valid && !stale && trustedSource ? value?.status : 'UNKNOWN'
  const option = AVAILABILITY_OPTIONS.find(item => item.status === status) || AVAILABILITY_OPTIONS[3]!
  const minutes = valid ? Math.floor((now - timestamp) / 60000) : null
  const source = value?.source === 'SIMULATION' ? 'Simulation' : value?.source === 'SYSTEM_ESTIMATE' ? 'System estimate' : value?.source === 'PASSENGER' ? 'Passenger report' : 'Driver report'
  return {
    ...option,
    label: option.status === 'UNKNOWN' && !driver ? 'Availability Unknown' : option.label,
    stale,
    detail: valid ? `${source} · ${minutes === 0 ? 'just now' : `${minutes} min ago`}${stale ? ' · Outdated' : ''}` : 'No current report',
    reportedAt: valid ? value?.reportedAt : null
  }
}
