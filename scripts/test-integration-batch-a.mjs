import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { validTripPlanResponse } from '../app/services/tripPlanContract.ts'
import { fetchTripPlan } from '../app/services/tripPlan.ts'
import { formatFare, journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'
import { buildJourneyExplanationRequest } from '../app/services/journeyExplanation.ts'

// Exercise the backend implementation directly, without a saved fixture that
// can go stale, database writes, network routing or an AI-provider request.
const require = createRequire(import.meta.url)
const { orchestrateTripPlan } = require('../../pamana-backend/src/services/pamana-journey/trip-plan-orchestrator')
const { directWalkingFixture, transferWalkingFixture } = require('../../pamana-backend/scripts/fixtures/phase11-synthetic-network')
const { DEMO_TRICYCLE } = require('../../pamana-backend/src/services/pamana-journey/fare-policy')
const { sanitizeJourneyExplanationRequest } = require('../../pamana-backend/src/services/pamana-ai/journey-explanation')
const departureAt = '2026-10-04T08:00:00+08:00'

async function plan(fixture) {
  const request = { origin: fixture.origin, destination: fixture.destination, departureAt, passengerCategory: 'REGULAR' }
  return orchestrateTripPlan(request, {
    now: () => new Date(departureAt),
    walkingConfig: { initialCandidateRadiusMeters: 300, maximumCandidateRadiusMeters: 300 },
    router: { routeWalk: async ({ from, to }) => ({ ok: true, value: {
      type: 'WALK', from, to, distanceMeters: 120, durationSeconds: 90,
      geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
      instructions: [], source: 'GEOAPIFY', calculatedAt: departureAt,
    } }) },
    services: {
      loadEligibleCoordinateNodes: async () => Object.values(fixture.nodes),
      loadEligibleTransportGraphData: async () => ({ variants: fixture.variants }),
      loadEligibleDisruptions: async () => [],
      loadFareAndServiceData: async () => ({ fareRules: [], servicePatterns: [] }),
      loadOperationalData: async () => ({ operationalRecords: [] }),
    },
  })
}

test('backend journey with missing fare distance is accepted instead of INVALID_RESPONSE', async () => {
  const response = await plan(directWalkingFixture())
  const transit = response.journeys[0].legs.find(leg => leg.type === 'TRANSIT')
  assert.equal(transit.fare.status, 'FARE_DISTANCE_UNAVAILABLE')
  assert.equal(transit.fare.payableFare, null)
  assert.equal(response.journeys[0].transferCount, 0)
  assert.equal(validTripPlanResponse(response), true)
  const fetched = await fetchTripPlan(async () => response, response.request)
  assert.equal(fetched.ok, true)
  assert.equal(fetched.data.journeys[0].fareSummary.totalFare, null)
  assert.equal(fetched.data.journeys[0].legs.find(leg => leg.type === 'TRANSIT').fare.sourceType, 'SYSTEM_CALCULATED')
  const map = journeyMapPresentation(response.journeys[0], response.request.origin, response.request.destination)
  assert.ok(!map.lines.some(line => line.properties.semantic === 'transport-route'), 'missing transit geometry remains missing')
})

test('backend calculated whole-peso fares and stored distance provenance remain valid', async () => {
  const fixture = directWalkingFixture()
  fixture.variants[0].route.transport_mode = 'PUJ_MODERN'
  fixture.variants[0].route_variant_stops[0].distance_from_variant_start_m = 0
  fixture.variants[0].route_variant_stops[1].distance_from_variant_start_m = 6000
  const response = await plan(fixture)
  assert.equal(validTripPlanResponse(response), true)
  const leg = response.journeys[0].legs.find(leg => leg.type === 'TRANSIT')
  assert.equal(leg.fare.payableFare, 22)
  assert.equal(leg.roadDistanceSource, 'STORED_ROUTE_STOP_DISTANCE')
  assert.equal(formatFare(leg.fare.payableFare), '₱22')
})

test('demo tricycle plus unavailable jeep keeps the PHP 100 subtotal and provenance', async () => {
  const fixture = transferWalkingFixture()
  fixture.nodes.A.node_code = DEMO_TRICYCLE.from
  fixture.nodes.T.node_code = DEMO_TRICYCLE.to
  fixture.variants[0].variant_code = DEMO_TRICYCLE.variantCode
  fixture.variants[0].route.route_code = DEMO_TRICYCLE.routeCode
  const response = await plan(fixture)
  const journey = response.journeys[0]
  assert.equal(validTripPlanResponse(response), true)
  assert.equal(journey.transferCount, 1)
  assert.equal(journey.fareSummary.knownSubtotal, 100)
  assert.equal(journey.fareSummary.totalFare, null)
  const paidLegs = journey.legs.filter(leg => leg.type === 'TRANSIT')
  assert.equal(paidLegs[0].fare.sourceType, 'DEMO_ESTIMATE')
  assert.equal(paidLegs[0].fare.verificationStatus, null)
  assert.equal(formatFare(paidLegs[0].fare.payableFare), '₱100')
  assert.equal(paidLegs[1].fare.status, 'FARE_DISTANCE_UNAVAILABLE')
  assert.ok(journey.legs.filter(leg => leg.type === 'WALK').every(leg => leg.fare.payableFare === 0))
  const payload = buildJourneyExplanationRequest('PSU Mexico', 'SM Pampanga', journey)
  const validation = sanitizeJourneyExplanationRequest(payload)
  assert.equal(validation.ok, true)
  assert.equal(paidLegs[0].fare.isDemoEstimate, true)
  assert.equal(validation.value.fareSummary.totalFare, null)
  assert.doesNotMatch(JSON.stringify(payload), /DEMO_ESTIMATE|sourceType|verificationStatus/)
  assert.doesNotMatch(JSON.stringify(payload), /perKm|baseFare|"lat"|"lng"|geometry/)
})

test('fare-only status support keeps malformed responses and invalid service statuses rejected', async () => {
  const response = await plan(directWalkingFixture())
  for (const mutate of [
    value => { value.journeys[0].legs[1].fare.status = 'UNRECOGNIZED_FARE_STATUS' },
    value => { value.journeys[0].legs[1].service.status = 'FARE_DISTANCE_UNAVAILABLE' },
    value => { value.journeys[0].legs[1].fare.sourceType = 'LTFRB_VERIFIED' },
    value => { delete value.journeys[0].legs[1].fare.payableFare },
    value => { delete value.journeys[0].legs[0].geometry },
    value => { value.meta.journeyCount += 1 },
  ]) {
    const invalid = structuredClone(response)
    mutate(invalid)
    assert.equal(validTripPlanResponse(invalid), false)
    assert.deepEqual(await fetchTripPlan(async () => invalid, invalid.request), { ok: false, error: 'INVALID_RESPONSE' })
  }
})
