import type { MapPointFeature, MapLineFeature, MapSemantic } from '../types/map.ts'

export const MAP_TOKENS = {
  passenger: { color: '#2563eb', label: 'Your location', glyph: 'person' },
  pickup: { color: '#15803d', label: 'Pickup', glyph: 'up' },
  stop: { color: '#7c3aed', label: 'Stop', glyph: 'dot' },
  dropoff: { color: '#0f766e', label: 'Drop-off', glyph: 'down' },
  transfer: { color: '#c2410c', label: 'Transfer', glyph: 'transfer' },
  terminal: { color: '#334155', label: 'Terminal', glyph: 'terminal' },
  vehicle: { color: '#0369a1', label: 'Vehicle', glyph: 'vehicle' },
  destination: { color: '#dc2626', label: 'Destination', glyph: 'flag' },
  'essential-service': { color: '#be123c', label: 'Essential service', glyph: 'cross' },
  'walking-route': { color: '#64748b', label: 'Walking', glyph: 'dot' },
  'transport-route': { color: '#15803d', label: 'Transport route', glyph: 'dot' },
  disruption: { color: '#b45309', label: 'Disruption', glyph: 'warning' },
} as const

export function markerSemantic(type: unknown): MapSemantic {
  const mapping: Record<string, MapSemantic> = {
    PICKUP: 'pickup', ROADSIDE_PICKUP: 'pickup', LOADING_BAY: 'pickup', origin: 'pickup', pickup: 'pickup',
    STOP: 'stop', DESIGNATED_STOP: 'stop', LANDMARK: 'stop', intermediate: 'stop', stop: 'stop',
    DROP_OFF: 'dropoff', dropoff: 'dropoff', TRANSFER: 'transfer', TRANSFER_POINT: 'transfer', transfer: 'transfer',
    TERMINAL: 'terminal', TRANSPORT_HUB: 'terminal', terminal: 'terminal',
    DESTINATION: 'destination', destination: 'destination', ESSENTIAL_SERVICE: 'essential-service',
    EMERGENCY_PICKUP: 'pickup', vehicle: 'vehicle', passenger: 'passenger', disruption: 'disruption',
  }
  return mapping[String(type)] ?? 'stop'
}

export function validPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number'
    && Number.isFinite(value[0]) && Number.isFinite(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}
const numberOrNull = (value: unknown) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null

/** Adapts legacy plain-data props without geocoding or interpreting stop order. */
export function legacyMarkerFeatures(markers: Record<string, any>[]): MapPointFeature[] {
  return markers.flatMap((item, index) => {
    const lat = numberOrNull(item.latitude ?? item.lat ?? item.location?.latitude ?? item.location?.lat)
    const lng = numberOrNull(item.longitude ?? item.lng ?? item.lon ?? item.location?.longitude ?? item.location?.lng)
    if (lat === null || lng === null || !validPosition([lng, lat])) return []
    const id = String(item.documentId ?? item.node_code ?? item.id ?? `legacy-${index}`)
    const semantic = markerSemantic(item.kind ?? item.node_type ?? (item.vehicle_number || item.vehicle ? 'vehicle' : item.stop_type))
    return [{ type: 'Feature', id, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {
      semantic, label: String(item.label ?? item.name ?? item.vehicle_number ?? 'Transport point'), source: 'PAMANA', recordId: id,
      dataMode: item.data_mode ?? (['simulation', 'SIMULATED'].includes(item.source) ? 'SIMULATED' : undefined),
      verificationStatus: item.verification_status, planningEnabled: item.planning_enabled,
    } } as MapPointFeature]
  })
}

export function suppliedLine(geometry: { coordinates?: unknown } | null | undefined, label: string, walking = false): MapLineFeature[] {
  if (!Array.isArray(geometry?.coordinates) || geometry.coordinates.length < 2 || !geometry.coordinates.every(validPosition)) return []
  return [{ type: 'Feature', id: 'selected-route-geometry', geometry: { type: 'LineString', coordinates: geometry.coordinates },
    properties: { semantic: walking ? 'walking-route' : 'transport-route', label, source: 'PAMANA' } }]
}

export function renderableFeatures(nodes: MapPointFeature[], lines: MapLineFeature[], vehicles: MapPointFeature[], user: { lat: number; lng: number } | null) {
  const points = [...nodes, ...vehicles].filter(feature => feature?.type === 'Feature' && feature.geometry?.type === 'Point' && validPosition(feature.geometry.coordinates) && feature.properties?.semantic in MAP_TOKENS)
  const paths = lines.filter(feature => feature?.type === 'Feature' && feature.geometry?.type === 'LineString' && feature.geometry.coordinates.length >= 2 && feature.geometry.coordinates.every(validPosition) && feature.properties?.semantic in MAP_TOKENS)
  const features: (MapPointFeature | MapLineFeature)[] = [...points, ...paths]
  if (user && validPosition([user.lng, user.lat])) features.push({ type: 'Feature', id: 'pamana-user-location', geometry: { type: 'Point', coordinates: [user.lng, user.lat] }, properties: { semantic: 'passenger', label: 'Your location', source: 'DEVICE' } })
  return features.map((feature, index) => ({ ...feature, id: String(feature.id ?? feature.properties.recordId ?? `feature-${index}`), properties: { ...feature.properties, featureId: String(feature.id ?? feature.properties.recordId ?? `feature-${index}`) } }))
}

/** Poll updates never request a fit; only first ready and explicit selection token changes do. */
export function createFitPolicy() {
  let initialized = false
  let previous: unknown
  return { shouldFit(token: unknown, enabled: boolean) {
    const fit = enabled && (!initialized || token !== previous)
    initialized = true
    previous = token
    return fit
  } }
}
