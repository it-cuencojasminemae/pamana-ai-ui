import type { FeatureCollection, Geometry, LineString, Position } from 'geojson'
import type { MapLineFeature } from '../types/map'
import type { JourneyNodeReference, JourneyTransitLeg, PamanaJourney } from '../types/tripPlan'
import { validPosition } from './mapPresentation.ts'

type RoadResult =
  | { ok: true; data: FeatureCollection<Geometry> }
  | { ok: false; error: string }
type RouteGeography = (points: { latitude: number; longitude: number }[], mode: 'drive', signal?: AbortSignal) => Promise<RoadResult>

export const APPROXIMATE_ROAD_PATH = 'APPROXIMATE_ROAD_PATH' as const

function point(node: JourneyNodeReference | null): { latitude: number; longitude: number } | null {
  if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lng) || !validPosition([node.lng, node.lat])) return null
  return { latitude: node.lat as number, longitude: node.lng as number }
}

export function approximateRoadPathRequest(leg: JourneyTransitLeg) {
  if (leg.geometry) return null
  const nodes = [leg.boardAt, ...leg.intermediateNodes, leg.alightAt]
  const points = nodes.map(point)
  if (points.some(candidate => !candidate)) return null
  const resolved = points.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .filter((candidate, index, values) => index === 0
      || candidate.latitude !== values[index - 1]!.latitude
      || candidate.longitude !== values[index - 1]!.longitude)
  if (resolved.length < 2) return null
  const identity = nodes.map((node, index) => node?.nodeId || node?.nodeCode || `${resolved[index]?.latitude},${resolved[index]?.longitude}`).join('>')
  return {
    key: `${leg.variant.id || leg.variant.code || 'transit'}|${identity}`,
    points: resolved,
    label: `Approximate road path for ${leg.route.code || leg.variant.code || 'transit leg'}`,
    legId: String(leg.sequence),
  }
}

function lineStrings(geometry: Geometry | null): LineString[] {
  if (!geometry) return []
  const lines: Position[][] = geometry.type === 'LineString'
    ? [geometry.coordinates]
    : geometry.type === 'MultiLineString' ? geometry.coordinates : []
  return lines.filter(line => line.length >= 2 && line.every(validPosition))
    .map(coordinates => ({ type: 'LineString', coordinates }))
}

export function normalizeApproximateRoadPath(result: RoadResult, request: NonNullable<ReturnType<typeof approximateRoadPathRequest>>): MapLineFeature[] {
  if (!result.ok) return []
  const feature = result.data.features[0]
  return lineStrings(feature?.geometry ?? null).map((geometry, index) => ({
    type: 'Feature',
    id: `approximate-road-${request.key}-${index}`,
    geometry,
    properties: {
      semantic: 'approximate-road-path',
      label: request.label,
      source: 'GEOAPIFY',
      legId: request.legId,
      geometryClassification: APPROXIMATE_ROAD_PATH,
    },
  }))
}

export function createApproximateRoadPathResolver(routeGeography: RouteGeography, {
  ttlMs = 6 * 60 * 60 * 1000,
  maxEntries = 40,
  now = () => Date.now(),
} = {}) {
  const cache = new Map<string, { storedAt: number; lines: MapLineFeature[] }>()
  const pending = new Map<string, Promise<MapLineFeature[]>>()

  async function resolveLeg(leg: JourneyTransitLeg, signal?: AbortSignal) {
    const request = approximateRoadPathRequest(leg)
    if (!request) return []
    const cached = cache.get(request.key)
    if (cached && now() - cached.storedAt < ttlMs) return structuredClone(cached.lines)
    if (cached) cache.delete(request.key)
    if (pending.has(request.key)) return structuredClone(await pending.get(request.key)!)
    const operation = routeGeography(request.points, 'drive', signal)
      .then(result => normalizeApproximateRoadPath(result, request))
      .catch(() => [])
      .then(lines => {
        if (lines.length) {
          cache.set(request.key, { storedAt: now(), lines: structuredClone(lines) })
          while (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
        }
        return lines
      })
      .finally(() => pending.delete(request.key))
    pending.set(request.key, operation)
    return structuredClone(await operation)
  }

  async function resolveJourney(journey: PamanaJourney | null, signal?: AbortSignal) {
    if (!journey) return []
    const legs = journey.legs.filter((leg): leg is JourneyTransitLeg => leg.type === 'TRANSIT')
    return (await Promise.all(legs.map(leg => resolveLeg(leg, signal)))).flat()
  }

  return { resolveJourney }
}
