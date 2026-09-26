import type { MapLineFeature } from '../types/map'
import type { SimulatedLiveVehicle } from '../types/liveVehicle'

export const PREVIEW_GEOMETRY = Object.freeze([
  Object.freeze([140.0000, 5.0000]),
  Object.freeze([140.0180, 5.0120]),
  Object.freeze([140.0430, 4.9980]),
]) as unknown as [number, number][]

export const previewLine: MapLineFeature = {
  type: 'Feature', id: 'synthetic-demo-corridor',
  geometry: { type: 'LineString', coordinates: PREVIEW_GEOMETRY },
  properties: { semantic: 'transport-route', label: 'Synthetic Direct Corridor · not real transport data', source: 'PAMANA', dataMode: 'SIMULATED' },
}

const OCCUPANCY = ['AVAILABLE', 'NEAR_FULL', 'FULL'] as const

function coordinateAt(progress: number): [number, number] {
  const bounded = ((progress % 1) + 1) % 1
  const scaled = bounded * (PREVIEW_GEOMETRY.length - 1)
  const index = Math.min(PREVIEW_GEOMETRY.length - 2, Math.floor(scaled))
  const local = scaled - index
  const from = PREVIEW_GEOMETRY[index]!
  const to = PREVIEW_GEOMETRY[index + 1]!
  return [from[0] + (to[0] - from[0]) * local, from[1] + (to[1] - from[1]) * local]
}

export function previewVehicles(elapsedSeconds: number, stale = false, now = new Date()): SimulatedLiveVehicle[] {
  return [0, 20, 40].map((offset, index) => {
    const progress = Math.max(0, elapsedSeconds - offset) / 60
    const [lng, lat] = coordinateAt(progress)
    const ageSeconds = stale && index === 0 ? 90 : 0
    const observedAt = new Date(now.getTime() - ageSeconds * 1000).toISOString()
    return {
      id: `preview-vehicle-${index + 1}`,
      label: `Demo Vehicle ${String.fromCharCode(65 + index)}`,
      transportMode: 'JEEPNEY', routeVariantId: 'SIM-DEMO-DIRECT-ONLY', lat, lng,
      observedAt,
      occupancy: OCCUPANCY[index]!, tripState: elapsedSeconds < offset ? 'NOT_STARTED' : 'ACTIVE',
      progress, dataFreshness: { status: ageSeconds ? 'STALE' : 'FRESH', latestObservedAt: observedAt, ageSeconds },
      dataMode: 'SIMULATED', simulation: true,
    }
  })
}
