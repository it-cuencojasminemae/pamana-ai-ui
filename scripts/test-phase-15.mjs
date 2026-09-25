import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { buildTripPlanRequest, fetchTripPlan } from '../app/services/tripPlan.ts'
import { formatDuration, formatFare, journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const origin = { id: 'gps', label: 'Current Location', lat: 15.1, lng: 120.7, source: 'USER_GPS' }
const destination = { id: 'poi', label: 'Selected place', lat: 15.05, lng: 120.68, source: 'GEOAPIFY' }
const notApplicable = {
  fare: { status: 'NOT_APPLICABLE', currency: null, regularFare: null, discountedFare: null, payableFare: null, discountType: null, sourceSummary: null, verificationStatus: null, warnings: [] },
  service: { status: 'NOT_APPLICABLE', operatingMode: null, serviceStart: null, serviceEnd: null, headwayMinutes: null, scheduledDepartures: [], leaveWhenFull: null, limitedService: null, windowStatus: 'UNKNOWN', sourceSummary: null, verificationStatus: null, warnings: [] },
  availability: { status: 'UNKNOWN', wait: { status: 'NOT_APPLICABLE', lowMinutes: null, highMinutes: null }, activeVehicleCount: null, boardableVehicleCount: null, sourceSummary: null, warnings: [] },
}
const journey = {
  id: 'journey-fixture', transferCount: 0, modes: ['JEEPNEY'], warnings: [],
  dataQuality: { planningEligible: true, verificationStatuses: ['FIELD_VERIFIED'], dataModes: ['REAL'] },
  fareSummary: { totalStatus: 'UNKNOWN', knownSubtotal: null, totalFare: null, currency: 'PHP', warnings: [] },
  availabilitySummary: { status: 'UNKNOWN', transitLegsKnown: 0, transitLegsUnknown: 1, warnings: [] },
  durationSummary: { status: 'PARTIAL', knownWalkingDurationSeconds: 240, totalJourneyDurationSeconds: null },
  legs: [
    { sequence: 1, type: 'WALK', from: origin, to: { lat: 15.09, lng: 120.69, label: 'Verified stop' }, distanceMeters: 280, durationSeconds: 240, geometry: { type: 'LineString', coordinates: [[120.7, 15.1], [120.69, 15.09]] }, instructions: [], source: 'GEOAPIFY', calculatedAt: '2026-09-25T00:00:00.000Z', ...notApplicable },
    { sequence: 2, type: 'TRANSIT', transportMode: 'JEEPNEY', route: { id: 'route', code: 'R-1' }, variant: { id: 'variant', code: 'R-1-OUT' }, direction: 'OUTBOUND', operatingStatus: 'ACTIVE', boardAt: { name: 'Verified stop' }, alightAt: { name: 'Verified drop-off' }, intermediateNodes: [], signboard: 'Town proper', segmentDistanceMeters: null, durationSeconds: null, geometry: null, ...notApplicable },
    { sequence: 3, type: 'WALK', from: { lat: 15.06, lng: 120.681, label: 'Verified drop-off' }, to: destination, distanceMeters: 140, durationSeconds: 120, geometry: null, instructions: [], source: 'GEOAPIFY', calculatedAt: '2026-09-25T00:00:00.000Z', ...notApplicable },
  ],
}

test('request contains only resolved coordinates, departure and passenger category', () => {
  const request = buildTripPlanRequest(origin, destination, '2026-09-25T08:00:00.000Z', 'STUDENT')
  assert.deepEqual(Object.keys(request).sort(), ['departureAt', 'destination', 'origin', 'passengerCategory'])
  assert.deepEqual(request.origin, { lat: 15.1, lng: 120.7, label: 'Current Location', source: 'USER_GPS' })
  assert.equal(request.passengerCategory, 'STUDENT')
  assert.doesNotMatch(JSON.stringify(request), /routeVariant|fare|vehicle|wait|service|demo/i)
})

test('unified API request uses POST, existing authenticated fetcher and cancellation signal', async () => {
  const request = buildTripPlanRequest(origin, destination, '2026-09-25T08:00:00.000Z', 'REGULAR')
  let captured
  const data = { request, status: 'NO_TRANSPORT_JOURNEY', journeys: [], warnings: [], meta: { journeyCount: 0, generatedAt: request.departureAt, dataMode: 'REAL', maxJourneys: 5 } }
  const result = await fetchTripPlan(async (endpoint, options) => { captured = { endpoint, options }; return data }, request, new AbortController().signal)
  assert.equal(result.ok, true)
  assert.equal(captured.endpoint, '/api/pamana-ai/trip-plan')
  assert.equal(captured.options.method, 'POST')
  assert.deepEqual(captured.options.body, request)
})

test('provider and authentication failures are sanitized', async () => {
  const request = buildTripPlanRequest(origin, destination, '2026-09-25T08:00:00.000Z', 'REGULAR')
  const auth = await fetchTripPlan(async () => { throw { response: { status: 401 }, data: { message: 'private token detail' } } }, request)
  const provider = await fetchTripPlan(async () => { throw { response: { status: 503 }, data: { status: 'ROUTING_PROVIDER_UNAVAILABLE', key: 'secret' } } }, request)
  assert.deepEqual(auth, { ok: false, error: 'AUTH_REQUIRED' })
  assert.deepEqual(provider, { ok: false, error: 'PROVIDER_UNAVAILABLE' })
})

test('selected journey adapter renders supplied geometry only', () => {
  const map = journeyMapPresentation(journey, origin, destination)
  assert.equal(map.lines.length, 1)
  assert.equal(map.lines[0].properties.semantic, 'walking-route')
  assert.ok(!map.lines.some(line => line.properties.semantic === 'transport-route'), 'null transit geometry must not become a line')
  assert.deepEqual(map.lines[0].geometry.coordinates, journey.legs[0].geometry.coordinates)
  assert.ok(map.nodes.some(node => node.properties.semantic === 'origin-location'))
  assert.ok(map.nodes.some(node => node.properties.semantic === 'destination-location'))
})

test('unknown values remain explicit and no fake total duration is formatted', () => {
  assert.equal(formatFare(null), 'Fare unavailable')
  assert.equal(formatDuration(null), 'Time unavailable')
  assert.equal(journey.durationSummary.totalJourneyDurationSeconds, null)
})

test('planner and journey component compile and preserve factual UI contract', () => {
  for (const file of ['app/pages/passenger/trip-planner.vue', 'app/pages/dev/trip-planner-preview.vue', 'app/components/journey/PamanaJourneyCard.vue', 'app/components/PamanaMapPanel.vue']) {
    const source = read(file)
    const { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: `phase15-${file}` })
    const template = compileTemplate({ id: `phase15-${file}`, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
  const page = read('app/pages/passenger/trip-planner.vue')
  assert.match(page, /Find Best Route/)
  assert.match(page, /buildTripPlanRequest/)
  assert.match(page, /:lines="mapPresentation\.lines"/)
  assert.match(page, /selectedJourneyId\.value = \$event/)
  assert.doesNotMatch(page, /\/api\/trip-search|Cheapest|Fastest|Most Reliable|Recommended|Gemini|demoMode/)
  assert.doesNotMatch(page, /\bany\b/)
  const card = read('app/components/journey/PamanaJourneyCard.vue')
  assert.match(card, /Typical service interval/)
  assert.match(card, /Arrival time unavailable/)
  assert.match(card, /ETA unavailable/)
  assert.match(card, /Total journey duration is unavailable/)
  assert.doesNotMatch(card, /confidence|reliability/i)
})

test('stale requests are aborted and location edits invalidate selection', () => {
  const composable = read('app/composables/useTripPlan.ts')
  const location = read('app/components/location/PamanaLocationSearch.vue')
  assert.match(composable, /controller\?\.abort\(\)/)
  assert.match(composable, /current !== generation/)
  assert.match(composable, /fingerprint === pendingFingerprint/)
  assert.match(location, /selectedLocationAfterEdit/)
  assert.match(location, /model\.value = null/)
})

test('Phase 15 keeps Leaflet and introduces no Strapi writes or transport mutations', () => {
  const sources = [read('app/services/tripPlan.ts'), read('app/composables/useTripPlan.ts'), read('app/services/tripPlanPresentation.ts'), read('app/pages/passenger/trip-planner.vue')].join('\n')
  assert.doesNotMatch(sources, /\/api\/(?:transport-nodes|route-variants|fare-rules|service-patterns)/)
  assert.doesNotMatch(sources, /method:\s*['"](?:PUT|PATCH|DELETE)['"]/i)
  assert.match(read('app/components/PamanaMapPanel.vue'), /<PamanaLeafletMap/)
  assert.ok(JSON.parse(read('package.json')).dependencies.leaflet)
})
