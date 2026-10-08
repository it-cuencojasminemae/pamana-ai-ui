import type { Position } from 'geojson'
import type { MapDisruptionFeature, MapLineFeature, MapPointFeature } from '../types/map.ts'
import type { JourneyDisruptionWarning, JourneyLeg, JourneyNodeReference, JourneyTransitLeg, JourneyWalkLeg, PamanaJourney } from '../types/tripPlan.ts'
import type { SelectedLocation } from '../types/location.ts'
import { locationMapFeature } from './locationPresentation.ts'
import { validPosition } from './mapPresentation.ts'

export interface JourneyMapPresentation {
  nodes: MapPointFeature[]
  lines: MapLineFeature[]
  disruptions: MapDisruptionFeature[]
}

function geometryLines(leg: JourneyWalkLeg | JourneyTransitLeg): Position[][] {
  const geometry = leg.geometry
  if (!geometry) return []
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  return []
}

function pointFeature(id: string, point: JourneyNodeReference & { label?: string }, semantic: 'pickup' | 'dropoff'): MapPointFeature[] {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !validPosition([point.lng, point.lat])) return []
  const roadside = semantic === 'pickup' && point.connector?.temporary && point.connector.role === 'ACCESS'
  return [{
    type: 'Feature', id,
    geometry: { type: 'Point', coordinates: [point.lng as number, point.lat as number] },
    properties: { semantic: roadside ? 'roadside-pickup' : semantic === 'pickup' && point.nodeType === 'TERMINAL' ? 'terminal' : semantic,
      label: point.label || (semantic === 'pickup' ? 'Boarding point' : 'Drop-off point'), source: 'PAMANA',
      ...(roadside ? { temporaryRoadside: true, serviceLabel: point.connector?.serviceLabel,
        evidenceClass: 'USER_REPORTED', details: ['Jeepneys pass this corridor. Confirm a safe boarding position and the correct road side locally.'] } : {}) },
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
  if (!journey) return { nodes, lines: [], disruptions: [] }

  const lines: MapLineFeature[] = []
  const walkLegs = journey.legs.filter((leg): leg is JourneyWalkLeg => leg.type === 'WALK')
  const firstTransit = journey.legs.findIndex(leg => leg.type === 'TRANSIT')
  const lastTransit = journey.legs.findLastIndex(leg => leg.type === 'TRANSIT')
  const firstWalk = walkLegs.find(leg => leg.purpose === 'ACCESS' || (!leg.purpose && journey.legs.indexOf(leg) < firstTransit))
  const lastWalk = walkLegs.find(leg => leg.purpose === 'EGRESS' || (!leg.purpose && journey.legs.indexOf(leg) > lastTransit))
  if (firstWalk && !(journey.legs[firstTransit] as JourneyTransitLeg | undefined)?.boardAt) nodes.push(...pointFeature(`${journey.id}-pickup`, firstWalk.to, 'pickup'))
  if (lastWalk && !(journey.legs[lastTransit] as JourneyTransitLeg | undefined)?.alightAt) nodes.push(...pointFeature(`${journey.id}-dropoff`, lastWalk.from, 'dropoff'))
  journey.legs.filter((leg): leg is JourneyTransitLeg => leg.type === 'TRANSIT').forEach(leg => {
    if (leg.boardAt) nodes.push(...pointFeature(`${journey.id}-board-${leg.sequence}`, { ...leg.boardAt, label: leg.boardAt.name || 'Pickup' }, 'pickup'))
    if (leg.alightAt) nodes.push(...pointFeature(`${journey.id}-alight-${leg.sequence}`, { ...leg.alightAt, label: leg.alightAt.name || 'Drop-off' }, 'dropoff'))
  })

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
          label: leg.type === 'WALK' ? 'Walking connector' : `Ride to ${leg.alightAt?.name || 'the drop-off point'}`,
          source: leg.type === 'WALK' ? 'GEOAPIFY' : 'PAMANA',
          legId: `${leg.sequence}`,
          geometryClassification: leg.type === 'WALK' ? 'WALK' : leg.geometrySource === 'RESEARCH_PREVIEW' ? 'RESEARCH_TRANSIT_GEOMETRY' : 'VERIFIED_TRANSIT_GEOMETRY',
          evidenceClass: leg.type === 'WALK' ? 'PROVIDER_PEDESTRIAN_ROUTING' : leg.evidenceClass,
        },
      })
    })
  }
  const disruptions = journey.warnings
    .filter((warning): warning is JourneyDisruptionWarning => typeof warning === 'object'
      && warning?.type === 'DISRUPTION' && Boolean(warning.geometry))
    .filter((warning, index, values) => values.findIndex(candidate => candidate.disruptionId === warning.disruptionId) === index)
    .map((warning): MapDisruptionFeature => ({
      type: 'Feature',
      id: `disruption-${warning.disruptionId}`,
      geometry: warning.geometry!,
      properties: {
        semantic: 'disruption',
        label: warning.message,
        source: 'PAMANA_TRANSPORT_DB',
        recordId: warning.disruptionId,
        effect: warning.effect,
        severity: warning.severity,
      },
    }))
  return { nodes, lines, disruptions }
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
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export function legTitle(leg: JourneyLeg) {
  if (leg.type === 'WALK') return `Walk to ${leg.to.label || 'the next point'}`
  if (leg.type === 'TRANSFER') return `Transfer at ${leg.at?.name || 'the interchange'}`
  return `Ride ${leg.route.code || leg.variant.code || leg.transportMode || 'public transport'}`
}
