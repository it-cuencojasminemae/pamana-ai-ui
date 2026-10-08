export type VehicleAvailabilityStatus = 'AVAILABLE' | 'LIMITED' | 'FULL' | 'UNKNOWN'
export interface VehicleAvailability {
  status: VehicleAvailabilityStatus
  reportedStatus: VehicleAvailabilityStatus
  source: 'DRIVER' | 'PASSENGER' | 'SYSTEM_ESTIMATE' | 'SIMULATION' | null
  confidence: 'REPORTED' | 'SIMULATED' | 'UNKNOWN'
  reportedAt: string | null
  expiresAt: string | null
  ageSeconds: number | null
  stale: boolean
  dataMode: 'REAL' | 'SIMULATED'
}
