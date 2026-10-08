import { z } from 'zod'
import type { PlanningMode } from '../types/tripPlan.ts'

// Validate the fields consumed by the journey cards, map and explanation adapter
// before an incomplete API payload can enter their reactive state.
const text = z.string().nullable()
const number = z.number().finite().nonnegative().nullable()
const strings = z.array(z.string())
const knowledge = z.enum(['KNOWN', 'PARTIAL', 'UNKNOWN', 'NOT_APPLICABLE'])
const fareStatus = z.enum(['KNOWN', 'PARTIAL', 'UNKNOWN', 'NOT_APPLICABLE', 'FARE_DISTANCE_UNAVAILABLE'])
const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: z.string().optional() })
const node = z.object({ name: text.optional(), nodeId: text.optional(), nodeCode: text.optional(), nodeType: text.optional(), lat: z.number().optional(), lng: z.number().optional(),
  connector: z.object({ temporary: z.boolean(), role: z.enum(['ACCESS', 'EGRESS']), sectionId: z.string(), evidenceClass: z.string(), direction: z.string(),
    serviceLabel: z.string().nullable().optional(), fieldBoardingSideVerified: z.boolean().optional() }).optional() }).nullable()
const geometry = z.union([
  z.object({ type: z.literal('LineString'), coordinates: z.array(z.array(z.number().finite()).min(2)).min(2) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(z.array(z.number().finite()).min(2)).min(2)) }),
]).nullable()
const fare = z.object({ status: fareStatus, currency: z.string().regex(/^[A-Z]{3}$/).nullable(), regularFare: number,
  discountedFare: number, payableFare: number, discountType: text, sourceSummary: text, verificationStatus: text, warnings: strings,
  sourceType: z.enum(['SYSTEM_CALCULATED', 'DEMO_ESTIMATE', 'VERIFIED_RULE', 'FREE_WALK']).nullable().optional(),
  isCalculated: z.boolean().optional(), isDemoEstimate: z.boolean().optional() })
const service = z.object({ status: knowledge, operatingMode: text, serviceStart: text, serviceEnd: text,
  headwayMinutes: z.object({ minimum: z.number().nonnegative(), maximum: z.number().nonnegative() }).nullable(),
  scheduledDepartures: strings, leaveWhenFull: z.boolean().nullable(), limitedService: z.boolean().nullable(),
  windowStatus: z.enum(['WITHIN_SERVICE_WINDOW', 'OUTSIDE_SERVICE_WINDOW', 'UNKNOWN']), sourceSummary: text, verificationStatus: text, warnings: strings })
const availability = z.object({ status: z.enum(['LIVE_ACTIVE', 'SERVICE_EXPECTED', 'LIMITED', 'OUTSIDE_SERVICE', 'UNKNOWN']),
  evidenceClass: z.literal('SIMULATED').optional(),
  wait: z.object({ status: z.enum(['SERVICE_INTERVAL_ONLY', 'ESTIMATED_WINDOW', 'UNKNOWN', 'NOT_APPLICABLE']), lowMinutes: number, highMinutes: number, basis: text.optional() }),
  activeVehicleCount: number, boardableVehicleCount: number, sourceSummary: text, warnings: strings })
const base = { sequence: z.number().int().positive(), fare, service, availability }
const leg = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('WALK'), purpose: z.enum(['ACCESS', 'TRANSFER', 'EGRESS']).optional(), connectionId: z.string().optional(), from: point, to: point, distanceMeters: number, durationSeconds: number, geometry,
    instructions: z.array(z.object({ text: z.string(), distanceMeters: number, durationSeconds: number })), source: z.literal('GEOAPIFY'), calculatedAt: text }),
  z.object({ ...base, type: z.literal('TRANSIT'), transportMode: text, route: z.object({ id: text, code: text }), variant: z.object({ id: text, code: text }),
    direction: text, operatingStatus: text, boardAt: node, alightAt: node, intermediateNodes: z.array(node), signboard: text, signboardAliases: strings.optional(), boardingInstructions: strings.optional(), segmentDistanceMeters: number,
    roadDistanceSource: z.enum(['STORED_ROUTE_STOP_DISTANCE', 'STORED_ROAD_GEOMETRY', 'RESEARCH_DERIVED_GEOMETRY']).nullable().optional(), durationSeconds: number,
    evidenceClass: z.enum(['USER_REPORTED', 'VERIFIED_OPERATIONAL']).optional(), geometrySource: z.literal('RESEARCH_PREVIEW').optional(), geometry }),
  z.object({ ...base, type: z.literal('TRANSFER'), at: node, to: node.optional(), connectionId: z.string().optional(), fromRouteVariantId: text, fromVariantCode: text, toRouteVariantId: text, toVariantCode: text }),
])
const journey = z.object({
  id: z.string().min(1), transferCount: z.number().int().nonnegative(), modes: strings, legs: z.array(leg).min(1),
  fareSummary: z.object({ totalStatus: z.enum(['KNOWN', 'PARTIAL', 'UNKNOWN']), knownSubtotal: number, totalFare: number, currency: z.string().regex(/^[A-Z]{3}$/).nullable(), warnings: strings }),
  availabilitySummary: z.object({ status: z.enum(['AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'UNKNOWN']), transitLegsKnown: z.number().int().nonnegative(), transitLegsUnknown: z.number().int().nonnegative(), warnings: strings }),
  durationSummary: z.object({ status: z.enum(['KNOWN', 'PARTIAL', 'UNKNOWN']), knownWalkingDurationSeconds: number, totalJourneyDurationSeconds: number, evidenceClass: z.literal('SIMULATED').optional() }),
  warnings: z.array(z.union([z.string(), z.object({ type: z.literal('DISRUPTION'), code: z.enum(['DISRUPTION_WARNING', 'LIMITED_SERVICE']), effect: z.enum(['WARNING_ONLY', 'LIMITED_SERVICE']), disruptionId: z.string(), message: z.string(), severity: z.string(), startsAt: z.string(), endsAt: text, geometry: z.object({ type: z.enum(['Point', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']), coordinates: z.array(z.unknown()) }).nullable() })])),
  dataQuality: z.object({ planningEligible: z.boolean(), verificationStatuses: strings, dataModes: strings, researchPreview: z.boolean().optional(), evidenceClass: z.string().optional() }),
})
const response = z.object({
  status: z.enum(['JOURNEYS_FOUND', 'NO_ELIGIBLE_ACCESS_NODES', 'NO_TRANSPORT_JOURNEY', 'ROUTING_PROVIDER_UNAVAILABLE']),
  journeys: z.array(journey), warnings: strings,
  recommendations: z.object({
    recommended: recommendation(), cheapest: recommendation(), fastest: recommendation(), fewestTransfers: recommendation(),
    mostReliable: recommendation().optional(),
  }).optional(),
  meta: z.object({ journeyCount: z.number().int().nonnegative(), generatedAt: z.string(), dataMode: z.literal('REAL'), maxJourneys: z.number().int().positive(),
    planningMode: z.enum(['OPERATIONAL', 'RESEARCH_PREVIEW']).optional(), researchPreview: z.boolean().optional() }),
}).refine(value => value.meta.journeyCount === value.journeys.length
  && (value.status === 'JOURNEYS_FOUND' ? value.journeys.length > 0 : value.journeys.length === 0))

export function validTripPlanResponse(value: unknown, expectedMode: PlanningMode = 'OPERATIONAL') {
  const checked = response.safeParse(value)
  if (!checked.success) return false
  const data = checked.data
  if (expectedMode === 'RESEARCH_PREVIEW') return data.meta.planningMode === expectedMode && data.meta.researchPreview === true
    && data.journeys.every(j => j.dataQuality.dataModes.every(mode => mode === 'REAL'))
  return data.meta.planningMode !== 'RESEARCH_PREVIEW' && data.meta.researchPreview !== true
    && data.journeys.every(j => !j.dataQuality.researchPreview && j.dataQuality.dataModes.every(mode => mode === 'REAL')
      && !j.dataQuality.verificationStatuses.includes('RESEARCH_CANDIDATE') && j.durationSummary.totalJourneyDurationSeconds === null)
}

export const validJourneyDetails = (value: unknown, id: string, expectedMode: PlanningMode) => {
  const checked = z.object({ status: z.literal('READY'), planningMode: z.enum(['OPERATIONAL', 'RESEARCH_PREVIEW']), journey }).safeParse(value)
  return checked.success && checked.data.planningMode === expectedMode && checked.data.journey.id === id
    && checked.data.journey.dataQuality.planningEligible && checked.data.journey.dataQuality.dataModes.every(mode => mode === 'REAL')
    && (expectedMode === 'RESEARCH_PREVIEW' || (!checked.data.journey.dataQuality.researchPreview
      && !checked.data.journey.dataQuality.verificationStatuses.includes('RESEARCH_CANDIDATE')
      && checked.data.journey.durationSummary.totalJourneyDurationSeconds === null
      && checked.data.journey.legs.every(leg => leg.availability.evidenceClass !== 'SIMULATED')))
}

function recommendation() {
  return z.object({ journeyId: text, unavailableReason: z.enum(['NO_VALID_JOURNEY', 'FARE_DATA_UNAVAILABLE', 'TIME_DATA_UNAVAILABLE', 'RELIABILITY_EVIDENCE_INSUFFICIENT']).nullable() })
}
