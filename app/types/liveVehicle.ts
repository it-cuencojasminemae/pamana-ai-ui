import type { MapPointFeature } from './map'

export type SimulatedOccupancy = 'AVAILABLE' | 'NEAR_FULL' | 'FULL' | 'UNKNOWN'
export type SimulatedTripState = 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED'

export interface SimulatedLiveVehicle {
  id: string
  label: string
  transportMode: string
  routeVariantId: string
  lat: number
  lng: number
  observedAt: string
  occupancy: SimulatedOccupancy
  tripState: SimulatedTripState
  progress: number
  dataFreshness: { status: 'FRESH' | 'STALE' | 'UNKNOWN'; latestObservedAt: string | null; ageSeconds: number | null }
  dataMode: 'SIMULATED'
  simulation: true
}

export interface SimulatedLiveVehicleResponse {
  status: 'SIMULATION_READY'
  scenario: {
    scenarioId: string
    name: string
    notice: string
    dataMode: 'SIMULATED'
    loop: boolean
    durationSeconds: number
    routeGeometry: { type: 'LineString'; coordinates: [number, number][] }
  }
  generatedAt: string
  dataMode: 'SIMULATED'
  simulation: true
  activeVehicleCount: number
  freshActiveVehicleCount: number
  staleVehicleCount: number
  vehicles: SimulatedLiveVehicle[]
}

export type SimulatedVehicleFeature = MapPointFeature
