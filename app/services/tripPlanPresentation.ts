import type { Position } from 'geojson'
import type { MapLineFeature, MapPointFeature } from '../types/map.ts'
import type { JourneyLeg, JourneyTransitLeg, JourneyWalkLeg, PamanaJourney } from '../types/tripPlan.ts'
import type { SelectedLocation } from '../types/location.ts'
import { locationMapFeature } from './locationPresentation.ts'
import { validPosition } from './mapPresentation.ts'

export interface JourneyMapPresentation {
  nodes: MapPointFeature[]
  lines: MapLineFeature[]
}

function geometryLines(leg: JourneyWalkLeg | JourneyTransitLeg): Position[][] {
  const geometry = leg.geometry
  if (!geometry) return []
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  return []
}

function pointFeature(id: string, point: { lat?: number; lng?: number; label?: string }, semantic: 'pickup' | 'dropoff'): MapPointFeature[] {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !validPosition([point.lng, point.lat])) return []
  return [{
    type: 'Feature', id,
    geometry: { type: 'Point', coordinates: [point.lng as number, point.lat as number] },
    properties: { semantic, label: point.label || (semantic === 'pickup' ? 'Boarding point' : 'Drop-off point'), source: 'PAMANA' },
  }]
}

export function journeyMapPresentation(
  journey: PamanaJourney | null,
  origin: SelectedLocation | null,
  destination: SelectedLocation | null,
): JourneyMapPresentation {
  const nodes: MapPointFeature[] = [
    ...(origin ? [locationMapFeature(origin, 'origin')] : []),
    ...(destination ? [locationMapFeature(destination, 'destination')] : []),
  ]
  if (!journey) return { nodes, lines: [] }

  const lines: MapLineFeature[] = []
  const walkLegs = journey.legs.filter((leg): leg is JourneyWalkLeg => leg.type === 'WALK')
  const firstWalk = walkLegs[0]
  const lastWalk = walkLegs[walkLegs.length - 1]
  if (firstWalk) nodes.push(...pointFeature(`${journey.id}-pickup`, firstWalk.to, 'pickup'))
  if (lastWalk) nodes.push(...pointFeature(`${journey.id}-dropoff`, lastWalk.from, 'dropoff'))

  for (const leg of journey.legs) {
    if (leg.type === 'TRANSFER') continue
    geometryLines(leg).forEach((coordinates, index) => {
      if (coordinates.length < 2 || !coordinates.every(validPosition)) return
      lines.push({
        type: 'Feature',
        id: `${journey.id}-leg-${leg.sequence}-${index}`,
        geometry: { type: 'LineString', coordinates },
        properties: {
          semantic: leg.type === 'WALK' ? 'walking-route' : 'transport-route',
          label: leg.type === 'WALK' ? 'Walking connector' : `Transit ${leg.route.code || leg.variant.code || 'leg'}`,
          source: leg.type === 'WALK' ? 'GEOAPIFY' : 'PAMANA',
          legId: `${leg.sequence}`,
        },
      })
    })
  }
  return { nodes, lines }
}

export function formatDistance(meters: number | null) {
  if (meters === null || !Number.isFinite(meters)) return 'Distance unavailable'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return 'Time unavailable'
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `${minutes} min`
}

export function formatFare(value: number | null, currency = 'PHP') {
  if (value === null || !Number.isFinite(value)) return 'Fare unavailable'
  if (value === 0) return 'No fare charged'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

export function legTitle(leg: JourneyLeg) {
  if (leg.type === 'WALK') return `Walk to ${leg.to.label || 'the next point'}`
  if (leg.type === 'TRANSFER') return `Transfer at ${leg.at?.name || 'the interchange'}`
  return `Ride ${leg.route.code || leg.variant.code || leg.transportMode || 'public transport'}`
}
