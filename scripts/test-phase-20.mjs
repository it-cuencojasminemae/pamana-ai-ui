import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { buildJourneyExplanationRequest, fetchJourneyExplanation } from '../app/services/journeyExplanation.ts'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const journey = {
  id: 'internal-journey', transferCount: 0, modes: ['PUJ_TRADITIONAL'],
  legs: [{
    sequence: 1, type: 'TRANSIT', transportMode: 'PUJ_TRADITIONAL',
    route: { id: 'route-id', code: 'RCH-SJ-CSF-SM-ROB' }, variant: { id: 'variant-id', code: 'RCH-SJ-SMROB-OUT' },
    direction: 'OUTBOUND', operatingStatus: 'ACTIVE',
    boardAt: { nodeId: 'node-a', nodeCode: 'A', name: 'PSU Mexico Front', lat: 15.1, lng: 120.7 },
    alightAt: { nodeId: 'node-b', nodeCode: 'B', name: 'SM Pampanga Main Gate', lat: 15.0, lng: 120.6 },
    intermediateNodes: [], signboard: 'SM Pampanga', segmentDistanceMeters: null, durationSeconds: null, geometry: null,
    fare: { status: 'UNKNOWN', currency: 'PHP', regularFare: null, discountedFare: null, payableFare: null, discountType: null, sourceSummary: null, verificationStatus: null, warnings: [] },
    service: { status: 'KNOWN', operatingMode: 'FREQUENCY_BASED', serviceStart: null, serviceEnd: null, headwayMinutes: { minimum: 10, maximum: 20 }, scheduledDepartures: [], leaveWhenFull: false, limitedService: false, windowStatus: 'WITHIN_SERVICE_WINDOW', sourceSummary: 'Field survey', verificationStatus: 'FIELD_VERIFIED', warnings: [] },
    availability: { status: 'SERVICE_EXPECTED', wait: { status: 'SERVICE_INTERVAL_ONLY', lowMinutes: null, highMinutes: null, basis: null }, activeVehicleCount: null, boardableVehicleCount: null, sourceSummary: null, warnings: [] },
  }],
  fareSummary: { totalStatus: 'UNKNOWN', knownSubtotal: null, totalFare: null, currency: 'PHP', warnings: [] },
  availabilitySummary: { status: 'PARTIAL', transitLegsKnown: 1, transitLegsUnknown: 0, warnings: [] },
  durationSummary: { status: 'UNKNOWN', knownWalkingDurationSeconds: null, totalJourneyDurationSeconds: null },
  warnings: [{ type: 'DISRUPTION', code: 'LIMITED_SERVICE', effect: 'LIMITED_SERVICE', disruptionId: 'private-id', message: 'Limited service', severity: 'MEDIUM', startsAt: '2026-09-28T00:00:00Z', endsAt: null, geometry: { type: 'Point', coordinates: [120.7, 15.1] } }],
  dataQuality: { planningEligible: true, verificationStatuses: ['FIELD_VERIFIED'], dataModes: ['REAL'] },
}

test('client payload contains selected factual display fields without coordinates, geometry or internal IDs', () => {
  const payload = buildJourneyExplanationRequest('PSU Mexico', 'SM Pampanga', journey)
  const serialized = JSON.stringify(payload)
  assert.match(serialized, /RCH-SJ-SMROB-OUT/)
  assert.match(serialized, /SERVICE_INTERVAL_ONLY/)
  assert.match(serialized, /Limited service/)
  assert.doesNotMatch(serialized, /internal-journey|route-id|variant-id|node-a|private-id|"lat"|"lng"|geometry|dataQuality/)
  assert.equal(payload.journey.durationSummary.totalJourneyDurationSeconds, null)
})

test('explanation endpoint is authenticated, on-demand, provider-neutral and sanitizes failures', async () => {
  let captured
  const response = await fetchJourneyExplanation(async (endpoint, options) => {
    captured = { endpoint, options }
    return { status: 'AVAILABLE', provider: 'gemini', explanation: 'Board at PSU Mexico Front.', generatedAt: '2026-09-28T00:00:00.000Z' }
  }, buildJourneyExplanationRequest('PSU Mexico', 'SM Pampanga', journey))
  assert.equal(captured.endpoint, '/api/pamana-ai/journey-explanation')
  assert.equal(captured.options.method, 'POST')
  assert.equal(response.status, 'AVAILABLE')
  assert.equal(response.provider, 'gemini')

  const failure = await fetchJourneyExplanation(async () => { throw new Error('provider body') }, buildJourneyExplanationRequest('PSU Mexico', 'SM Pampanga', journey))
  assert.equal(failure.status, 'PROVIDER_UNAVAILABLE')
  assert.equal(failure.explanation, null)
  assert.deepEqual(journey.legs[0].route, { id: 'route-id', code: 'RCH-SJ-CSF-SM-ROB' })
})

test('passenger UI keeps factual journey primary and requests explanation only after the explicit action', () => {
  const page = read('app/pages/passenger/trip-planner.vue')
  const composable = read('app/composables/useJourneyExplanation.ts')
  assert.match(page, /Explain this trip/)
  assert.match(page, /AI explains PAMANA's computed journey; it does not choose or change the route\./)
  assert.match(page, /@click="explainSelectedJourney"/)
  assert.match(page, /<JourneyPamanaJourneyCard[\s\S]*Simple trip guide/)
  assert.match(page, /title="Simple guide unavailable"[\s\S]*border-sky-200 bg-sky-50/)
  assert.match(page, /description: 'text-sky-800'/)
  assert.doesNotMatch(page.match(/async function findJourneys\(\)[\s\S]*?\n}/)?.[0] || '', /journeyExplanation\.explain/)
  assert.match(composable, /controller\?\.abort\(\)/)
  assert.match(composable, /onBeforeUnmount\(reset\)/)
})

test('frontend contains no OpenAI secret or direct OpenAI request', () => {
  const sources = [
    read('app/services/journeyExplanation.ts'), read('app/composables/useJourneyExplanation.ts'),
    read('app/pages/passenger/trip-planner.vue'), read('nuxt.config.ts'),
  ].join('\n')
  assert.doesNotMatch(sources, /OPENAI_API_KEY|api\.openai\.com|from ['"]openai['"]/)
})
