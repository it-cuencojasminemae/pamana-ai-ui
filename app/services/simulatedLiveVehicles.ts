import type { SimulatedLiveVehicle, SimulatedLiveVehicleResponse, SimulatedVehicleFeature } from '../types/liveVehicle'
import { validPosition } from './mapPresentation.ts'

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
