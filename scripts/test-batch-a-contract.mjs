import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validTripPlanResponse } from '../app/services/tripPlanContract.ts'
import { fetchTripPlan } from '../app/services/tripPlan.ts'
import { formatFare, journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'
import { buildJourneyExplanationRequest } from '../app/services/journeyExplanation.ts'

// Deliberate backend DTO checkpoints. Live implementation validation remains
// available in test-integration-batch-a.mjs. See fixtures/README.md.
const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/batch-a-fares.json', import.meta.url), 'utf8'))

test('backend journey with missing fare distance is accepted instead of INVALID_RESPONSE', async () => {
  const response = structuredClone(fixtures.missing)
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
  const response = structuredClone(fixtures.known)
  assert.equal(validTripPlanResponse(response), true)
  const leg = response.journeys[0].legs.find(leg => leg.type === 'TRANSIT')
  assert.equal(leg.fare.payableFare, 22)
  assert.equal(leg.roadDistanceSource, 'STORED_ROUTE_STOP_DISTANCE')
  assert.equal(formatFare(leg.fare.payableFare), '₱22')
})

test('demo tricycle plus unavailable jeep keeps the PHP 100 subtotal and provenance', async () => {
  const response = structuredClone(fixtures.transfer)
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
  assert.equal(paidLegs[0].fare.isDemoEstimate, true)
  assert.equal(payload.journey.fareSummary.totalFare, null)
  assert.doesNotMatch(JSON.stringify(payload), /DEMO_ESTIMATE|sourceType|verificationStatus/)
  assert.doesNotMatch(JSON.stringify(payload), /perKm|baseFare|"lat"|"lng"|geometry/)
})

test('fare-only status support keeps malformed responses and invalid service statuses rejected', async () => {
  const response = structuredClone(fixtures.missing)
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
