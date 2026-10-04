import type { SimulatedLiveVehicle, SimulatedLiveVehicleResponse, SimulatedVehicleFeature } from '../types/liveVehicle'
import { validPosition } from './mapPresentation.ts'

export function validSimulatedSnapshot(value: unknown): value is SimulatedLiveVehicleResponse {
  const result = value as SimulatedLiveVehicleResponse | null
  return Boolean(result?.status === 'SIMULATION_READY' && result.dataMode === 'SIMULATED' && result.simulation === true
    && [result.activeVehicleCount, result.freshActiveVehicleCount, result.staleVehicleCount].every(count => Number.isInteger(count) && count >= 0)
    && Array.isArray(result.vehicles) && result.vehicles.every(vehicle => vehicle?.dataMode === 'SIMULATED' && vehicle.simulation === true
      && typeof vehicle.id === 'string' && typeof vehicle.label === 'string' && typeof vehicle.routeVariantId === 'string'
      && validPosition([vehicle.lng, vehicle.lat]) && ['AVAILABLE', 'NEAR_FULL', 'FULL', 'UNKNOWN'].includes(vehicle.occupancy)
      && ['ACTIVE', 'NOT_STARTED', 'COMPLETED'].includes(vehicle.tripState)
      && ['FRESH', 'STALE', 'UNKNOWN'].includes(vehicle.dataFreshness?.status)))
}

export function simulatedVehicleFeatures(vehicles: SimulatedLiveVehicle[]): SimulatedVehicleFeature[] {
  return (Array.isArray(vehicles) ? vehicles : []).flatMap((vehicle) => {
    if (!vehicle?.simulation || vehicle.dataMode !== 'SIMULATED' || !validPosition([vehicle.lng, vehicle.lat])) return []
    return [{
      type: 'Feature',
      id: vehicle.id,
      geometry: { type: 'Point', coordinates: [vehicle.lng, vehicle.lat] },
      properties: {
        semantic: 'vehicle',
        label: `${vehicle.label} · ${vehicle.occupancy.replace('_', ' ')}`,
        source: 'PAMANA',
        recordId: vehicle.id,
        dataMode: 'SIMULATED',
        simulation: true,
        occupancy: vehicle.occupancy,
        tripState: vehicle.tripState,
        freshnessStatus: vehicle.dataFreshness.status,
        observedAt: vehicle.observedAt,
        details: [`Synthetic variant: ${vehicle.routeVariantId}`, `Occupancy: ${vehicle.occupancy}`, `Freshness: ${vehicle.dataFreshness.status}`, 'SIMULATED DEMO — not real transport data'],
      },
    }]
  })
}

export async function fetchSimulatedLiveVehicles(
  apiFetch: <T>(path: string, options?: Record<string, unknown>) => Promise<T>,
  options: { scenario?: string; elapsedSeconds?: number; signal?: AbortSignal } = {},
) {
  const query: Record<string, string | number> = {}
  if (options.scenario) query.scenario = options.scenario
  if (options.elapsedSeconds !== undefined) query.elapsedSeconds = options.elapsedSeconds
  return apiFetch<SimulatedLiveVehicleResponse>('/api/pamana-demo/live-vehicles', {
    query,
    ...(options.signal ? { signal: options.signal } : {}),
  })
}
