import type { MapLineFeature, MapPointFeature } from '../types/map'
import type { ActiveDriverTrip, DriverVariantOption, DriverVariantStop } from '../types/driverTrip'
import { markerSemantic, suppliedLine, validPosition } from './mapPresentation.ts'

export const DRIVER_GPS_PUBLISH_INTERVAL_MS = 15_000

export function routeVariantLabel(variant: DriverVariantOption) {
  const direction = variant.direction === 'INBOUND' ? 'Inbound' : 'Outbound'
  const signboard = variant.signboard ? ` · Signboard: ${variant.signboard}` : ''
  return `${direction} · ${variant.origin} → ${variant.destination}${signboard}`
}

export function normalizedOccupancy(level: string | null | undefined) {
  if (level === 'full') return 'FULL'
  if (level === 'near_full') return 'NEAR_FULL'
  if (['empty', 'low', 'moderate'].includes(level || '')) return 'AVAILABLE'
  return 'UNKNOWN'
}

export function orderedVariantStops(stops: DriverVariantStop[] | null | undefined) {
  return [...(stops || [])].sort((left, right) => left.sequence - right.sequence)
}

export function driverStopFeatures(stops: DriverVariantStop[] | null | undefined): MapPointFeature[] {
  return orderedVariantStops(stops).flatMap((stop) => {
    const node = stop.transport_node
    if (node?.latitude == null || node.longitude == null || String(node.latitude).trim() === '' || String(node.longitude).trim() === '') return []
    const lat = Number(node?.latitude)
    const lng = Number(node?.longitude)
    if (!node || !validPosition([lng, lat]) || (lat === 0 && lng === 0)) return []
    return [{
      type: 'Feature',
      id: node.documentId,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        semantic: markerSemantic(node.node_type),
        label: node.name,
        source: 'PAMANA_TRANSPORT_DB',
        recordId: node.documentId,
        dataMode: node.data_mode,
        verificationStatus: node.verification_status,
        planningEnabled: node.planning_enabled,
        sequence: stop.sequence,
      },
    } as MapPointFeature]
  })
}

export function driverVariantLines(trip: ActiveDriverTrip | null): MapLineFeature[] {
  const geometry = trip?.route_variant?.geometry_geojson
  if (geometry?.coordinates?.some(([lng, lat]) => (lng === 0 && lat === 0))) return []
  return suppliedLine(geometry, trip?.route_variant?.display_name || 'Selected directional route')
}
