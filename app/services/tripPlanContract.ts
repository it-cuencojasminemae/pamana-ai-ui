import { z } from 'zod'

// Validate the fields consumed by the journey cards, map and explanation adapter
// before an incomplete API payload can enter their reactive state.
const text = z.string().nullable()
const number = z.number().finite().nonnegative().nullable()
const strings = z.array(z.string())
const knowledge = z.enum(['KNOWN', 'PARTIAL', 'UNKNOWN', 'NOT_APPLICABLE'])
const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: z.string().optional() })
const node = z.object({ name: text.optional(), nodeId: text.optional(), nodeCode: text.optional(), lat: z.number().optional(), lng: z.number().optional() }).nullable()
const geometry = z.union([
  z.object({ type: z.literal('LineString'), coordinates: z.array(z.array(z.number().finite()).min(2)).min(2) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(z.array(z.number().finite()).min(2)).min(2)) }),
]).nullable()
const fare = z.object({ status: knowledge, currency: z.string().regex(/^[A-Z]{3}$/).nullable(), regularFare: number,
  discountedFare: number, payableFare: number, discountType: text, sourceSummary: text, verificationStatus: text, warnings: strings })
const service = z.object({ status: knowledge, operatingMode: text, serviceStart: text, serviceEnd: text,
  headwayMinutes: z.object({ minimum: z.number().nonnegative(), maximum: z.number().nonnegative() }).nullable(),
  scheduledDepartures: strings, leaveWhenFull: z.boolean().nullable(), limitedService: z.boolean().nullable(),
  windowStatus: z.enum(['WITHIN_SERVICE_WINDOW', 'OUTSIDE_SERVICE_WINDOW', 'UNKNOWN']), sourceSummary: text, verificationStatus: text, warnings: strings })
const availability = z.object({ status: z.enum(['LIVE_ACTIVE', 'SERVICE_EXPECTED', 'LIMITED', 'OUTSIDE_SERVICE', 'UNKNOWN']),
  wait: z.object({ status: z.enum(['SERVICE_INTERVAL_ONLY', 'ESTIMATED_WINDOW', 'UNKNOWN', 'NOT_APPLICABLE']), lowMinutes: number, highMinutes: number, basis: text.optional() }),
  activeVehicleCount: number, boardableVehicleCount: number, sourceSummary: text, warnings: strings })
const base = { sequence: z.number().int().positive(), fare, service, availability }
const leg = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('WALK'), from: point, to: point, distanceMeters: number, durationSeconds: number, geometry,
    instructions: z.array(z.object({ text: z.string(), distanceMeters: number, durationSeconds: number })), source: z.literal('GEOAPIFY'), calculatedAt: text }),
  z.object({ ...base, type: z.literal('TRANSIT'), transportMode: text, route: z.object({ id: text, code: text }), variant: z.object({ id: text, code: text }),
    direction: text, operatingStatus: text, boardAt: node, alightAt: node, intermediateNodes: z.array(node), signboard: text, segmentDistanceMeters: number, durationSeconds: z.null(), geometry }),
  z.object({ ...base, type: z.literal('TRANSFER'), at: node, fromRouteVariantId: text, fromVariantCode: text, toRouteVariantId: text, toVariantCode: text }),
])
const journey = z.object({
  id: z.string().min(1), transferCount: z.number().int().nonnegative(), modes: strings, legs: z.array(leg).min(1),
  fareSummary: z.object({ totalStatus: z.enum(['KNOWN', 'PARTIAL', 'UNKNOWN']), knownSubtotal: number, totalFare: number, currency: z.string().regex(/^[A-Z]{3}$/).nullable(), warnings: strings }),
  availabilitySummary: z.object({ status: z.enum(['AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'UNKNOWN']), transitLegsKnown: z.number().int().nonnegative(), transitLegsUnknown: z.number().int().nonnegative(), warnings: strings }),
  durationSummary: z.object({ status: z.enum(['PARTIAL', 'UNKNOWN']), knownWalkingDurationSeconds: number, totalJourneyDurationSeconds: z.null() }),
  warnings: z.array(z.union([z.string(), z.object({ type: z.literal('DISRUPTION'), code: z.enum(['DISRUPTION_WARNING', 'LIMITED_SERVICE']), effect: z.enum(['WARNING_ONLY', 'LIMITED_SERVICE']), disruptionId: z.string(), message: z.string(), severity: z.string(), startsAt: z.string(), endsAt: text, geometry: z.object({ type: z.enum(['Point', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']), coordinates: z.array(z.unknown()) }).nullable() })])),
  dataQuality: z.object({ planningEligible: z.boolean(), verificationStatuses: strings, dataModes: strings }),
})
const response = z.object({
  status: z.enum(['JOURNEYS_FOUND', 'NO_ELIGIBLE_ACCESS_NODES', 'NO_TRANSPORT_JOURNEY', 'ROUTING_PROVIDER_UNAVAILABLE']),
  journeys: z.array(journey), warnings: strings,
  meta: z.object({ journeyCount: z.number().int().nonnegative(), generatedAt: z.string(), dataMode: z.literal('REAL'), maxJourneys: z.number().int().positive() }),
}).refine(value => value.meta.journeyCount === value.journeys.length
  && (value.status === 'JOURNEYS_FOUND' ? value.journeys.length > 0 : value.journeys.length === 0))

export const validTripPlanResponse = (value: unknown) => response.safeParse(value).success
