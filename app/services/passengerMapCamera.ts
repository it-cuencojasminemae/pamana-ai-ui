import type { MapPointFeature, MapLineFeature } from '../types/map.ts'
import type { PinArea } from '../types/pinArea.ts'
import { pinInsideBoundary } from './mapPins.ts'
import { validPosition } from './mapPresentation.ts'

export const SAN_JUAN_CENTER: [number, number] = [120.7024058913807, 15.117429648993976]
export const PASSENGER_INITIAL_ZOOM = 14.5

/** Context catalogs and live observations never determine passenger framing. */
export function passengerCameraBounds(features: (MapPointFeature | MapLineFeature)[], boundary: PinArea['boundary']) {
  const relevant = features.filter(f => !f.properties.contextualReference
    && !['passenger', 'vehicle', 'disruption', 'essential-service'].includes(f.properties.semantic))
  const endpoints = relevant.filter(f => f.geometry.type === 'Point'
    && ['origin-location', 'destination-location'].includes(f.properties.semantic))
  // An empty passenger map stays at the San Juan viewport, regardless of catalogs.
  if (!endpoints.length) return null
  function positions(value: unknown): number[][] {
    return validPosition(value) ? [value] : Array.isArray(value) ? value.flatMap(positions) : []
  }
  const coordinates = relevant.flatMap(f => positions(f.geometry.coordinates))
  if (endpoints.length === 1) {
    const [lng, lat] = endpoints[0]!.geometry.coordinates as number[]
    if (!pinInsideBoundary(boundary?.geometry, { lat: lat!, lng: lng! })) coordinates.push(SAN_JUAN_CENTER)
  }
  if (!coordinates.length) return null
  const lngs = coordinates.map(p => p[0]!), lats = coordinates.map(p => p[1]!)
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]]
}
