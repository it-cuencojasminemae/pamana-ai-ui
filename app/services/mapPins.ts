import type { Polygon, MultiPolygon } from 'geojson'
import type { PinArea } from '../types/pinArea.ts'
import type { SelectedLocation } from '../types/location.ts'

const validPosition = (p: unknown): p is number[] => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90

export function validPinBoundary(geometry: Polygon | MultiPolygon | null | undefined) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(polygon =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring =>
      Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition)
      && ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1]))
}

function ringContains(position: number[], ring: number[][]) {
  const [x, y] = position as [number, number]
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j] as [number, number], [bx, by] = ring[i] as [number, number]
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
    if (Math.abs(cross) <= 1e-12 && x >= Math.min(ax, bx) - 1e-12 && x <= Math.max(ax, bx) + 1e-12
      && y >= Math.min(ay, by) - 1e-12 && y <= Math.max(ay, by) + 1e-12) return true
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}

export function pinInsideBoundary(geometry: Polygon | MultiPolygon | null | undefined, point: { lat: number; lng: number }) {
  const position = [point.lng, point.lat]
  if (!validPosition(position) || !validPinBoundary(geometry)) return false
  const polygons = geometry!.type === 'Polygon' ? [geometry!.coordinates] : geometry!.coordinates
  return polygons.some(rings => ringContains(position, rings[0]!) && !rings.slice(1).some(ring => ringContains(position, ring)))
}

export function validPinArea(value: unknown): value is PinArea {
  if (!value || typeof value !== 'object') return false
  const area = value as PinArea
  return area.id === 'san-juan-mexico-pampanga' && typeof area.enabled === 'boolean'
    && typeof area.verified === 'boolean' && typeof area.travelTimeEnabled === 'boolean'
    && (!area.enabled || area.verified)
    && (!area.verified || (area.boundary?.type === 'Feature' && validPinBoundary(area.boundary.geometry)))
}

export function makeMapPin(point: { lat: number; lng: number }): SelectedLocation {
  return { id: `pin-${point.lat}-${point.lng}`, lat: point.lat, lng: point.lng,
    label: `Pinned location (${point.lat.toFixed(6)}, ${point.lng.toFixed(6)})`, source: 'MAP_PIN' }
}

// Store numeric coordinates and source explicitly. Labels never resolve a pin's coordinates.
export function pinQuery(mode: 'origin' | 'destination', location: SelectedLocation | null) {
  const prefix = mode === 'origin' ? 'from' : 'to'
  return { [`${prefix}PinLat`]: location?.source === 'MAP_PIN' ? String(location.lat) : undefined,
    [`${prefix}PinLng`]: location?.source === 'MAP_PIN' ? String(location.lng) : undefined }
}

export function readPinQuery(query: Record<string, unknown>, mode: 'origin' | 'destination') {
  const prefix = mode === 'origin' ? 'from' : 'to'
  const lat = query[`${prefix}PinLat`], lng = query[`${prefix}PinLng`]
  if (lat === undefined && lng === undefined) return { present: false, location: null }
  if (typeof lat !== 'string' || typeof lng !== 'string' || !lat.trim() || !lng.trim()
    || !validPosition([Number(lng), Number(lat)])) return { present: true, location: null }
  return { present: true, location: makeMapPin({ lat: Number(lat), lng: Number(lng) }) }
}
