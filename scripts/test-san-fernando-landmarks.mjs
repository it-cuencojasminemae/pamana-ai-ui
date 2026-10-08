import test from 'node:test'
import { planningRuntimeStubs } from './helpers/planning-runtime-stubs.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import * as pilot from '../app/services/pilotLandmarks.ts'
import { landmarkLayers, createLandmarkPresentation, LANDMARK_SOURCE } from '../app/services/landmarkMapPresentation.ts'
import * as pins from '../app/services/mapPins.ts'
import * as trip from '../app/services/tripPlan.ts'
import * as guide from '../app/services/journeyExplanation.ts'
import * as options from '../app/services/routeOptionsPresentation.ts'
import * as time from '../app/services/travelTime.ts'
import { journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'
import { createLocationSearchController } from '../app/services/locationSearch.ts'
import { PAMPANGA_SEARCH_OPTIONS } from '../app/services/geoapify.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const raw = JSON.parse(fs.readFileSync(new URL('../../pamana-backend/src/services/pamana-journey/data/san-fernando-landmarks.json', import.meta.url), 'utf8'))
const catalog = { ...raw, enabled: true }
const area = { ...JSON.parse(read('scripts/fixtures/san-juan-pin-area.json')), travelTimeEnabled: false }
const payloads = JSON.parse(read('scripts/fixtures/passenger-route-options.json'))
const plan = payloads.results.find(r => r.response.journeys.length === 2).response
function page(query = {}, { data = catalog, forward } = {}) {
  const scope = Vue.effectScope(), state = new Map(), mounted = [], calls = [], geocodes = [], timers = new Map(); let timerId = 0
  const route = { query }
  const context = { ...Vue, ...pilot, ...pins, ...trip, ...guide, ...options, ...time, journeyMapPresentation, createLocationSearchController: (search, onState) => createLocationSearchController(search, onState, { delayMs: 0 }), PAMPANGA_SEARCH_OPTIONS, AbortController,
    useState: (key, init) => { if (!state.has(key)) state.set(key, Vue.ref(init())); return state.get(key) },
    useApi: () => ({ apiFetch: async (endpoint, settings) => {
      calls.push({ endpoint, settings })
      if (endpoint.endsWith('/landmarks')) return data
      if (endpoint.endsWith('/pin-area')) return area
      if (endpoint.endsWith('/trip-plan')) return structuredClone(plan)
      return { status: 'NOT_CONFIGURED', explanation: null, generatedAt: new Date().toISOString() }
    } }),
    useGeoapify: () => ({ forwardGeocodeLocations: async (text, _, signal) => { geocodes.push(text); return forward ? forward(text, signal) : { ok: true, data: [{ id: 'external', label: text, lat: 15.05, lng: 120.7, source: 'GEOAPIFY' }] } },
      reverseGeocodeLocation: async () => ({ ok: false }), autocompleteLocations: async () => ({ ok: false, error: 'NETWORK_ERROR' }) }),
    useRoute: () => route, useRouter: () => ({ replace: async ({ query }) => { route.query = query } }),
    useToast: () => ({ add() {} }), definePageMeta() {}, useHead() {}, onBeforeUnmount() {}, onMounted: fn => mounted.push(fn),
    useApproximateJourneyPaths: () => ({ lines: Vue.ref([]) }),
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id }, clearTimeout: id => timers.delete(id),
  }
  Object.assign(context, planningRuntimeStubs())
  vm.createContext(context)
  for (const name of ['usePilotLandmarks', 'useMapPins', 'useTripPlan', 'useJourneyExplanation', 'useTravelTime', 'useLocationSearch']) {
    const source = stripTypeScriptTypes(read(`app/composables/${name}.ts`)).replace(/^import .+$/gm, '').replace(/export (function|const)/g, '$1')
    vm.runInContext(source, context)
  }
  const source = stripTypeScriptTypes(parse(read('app/pages/passenger/trip-planner.vue')).descriptor.scriptSetup.content).replace(/^import .+$/gm, '')
  scope.run(() => vm.runInContext(`${source}\npageState = { landmarks, chooseLandmark, originLocation, destinationLocation, swapLocations, updateSearchQuery, updateLocationText, findJourneys, tripPlan, journeyExplanation, travelTime, form }`, context))
  return { state: context.pageState, calls, geocodes, route, context, timers,
    async mount() { for (const f of mounted) await f(); await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick() },
    stop() { context.pageState.tripPlan.cancel(); context.pageState.journeyExplanation.reset(); context.pageState.travelTime.reset(); scope.stop() },
    search() { return scope.run(() => vm.runInContext('useLocationSearch()', context)) } }
}

test('catalog validation keeps exact coordinates and rejects duplicates, malformed locations and disabled data', () => {
  assert.equal(pilot.parseLandmarkCatalog(catalog).landmarks.length, 13)
  assert.equal(pilot.landmarkLocation(catalog.landmarks[4]).lat, 15.03462448939258)
  for (const bad of [{ ...catalog, landmarks: [...catalog.landmarks, catalog.landmarks[0]] }, { ...catalog, enabled: false }, { ...catalog, landmarks: [{ ...catalog.landmarks[0], lng: NaN }] }]) assert.equal(pilot.parseLandmarkCatalog(bad), null)
})
test('ambiguous Palengke/City Proper searches return named buildings, not a district centroid', () => {
  for (const q of ['Palengke', 'City Proper']) {
    const results = pilot.searchLandmarks(catalog.landmarks, q)
    assert.ok(results.some(l => l.label === 'San Fernando Wet Market'))
    assert.ok(results.some(l => l.label === 'City Market Plaza'))
    assert.ok(results.every(l => l.source === 'PILOT_LANDMARK' && l.landmarkId))
  }
  assert.equal(pilot.searchLandmarks(catalog.landmarks, 'JBL')[0].landmarkId, 'csf-jbl')
  assert.equal(pilot.searchLandmarks(catalog.landmarks, 'PHS')[0].landmarkId, 'csf-phs')
})
test('ID handoff resolves full precision on refresh and invalid IDs never fall back to geocoding labels', async () => {
  const env = page({ toLandmark: 'csf-jbl', to: 'Wrong label', from: 'PSU Mexico' }); await env.mount()
  assert.equal(env.state.destinationLocation.value.source, 'PILOT_LANDMARK')
  assert.equal(env.state.destinationLocation.value.lng, 120.6846559254486)
  assert.deepEqual(env.geocodes, ['PSU Mexico']); env.stop()
  for (const settings of [{ data: { ...catalog, enabled: false, landmarks: [] } }, {}]) {
    const env = page({ toLandmark: settings.data ? 'csf-jbl' : 'unknown', to: 'JBL' }, settings); await env.mount()
    assert.equal(env.state.destinationLocation.value, null); assert.deepEqual(env.geocodes, []); env.stop()
  }
})
test('map selection, replacement, swap, clearing and request assembly retain canonical landmark IDs', async () => {
  const env = page(); await env.mount()
  env.state.chooseLandmark('csf-jbl', 'destination')
  env.state.originLocation.value = pins.makeMapPin({ lat: 15.128026422211173, lng: 120.69826461388278 })
  await Vue.nextTick(); await env.state.findJourneys(); await Vue.nextTick()
  const body = env.calls.find(c => c.endpoint.endsWith('/trip-plan')).settings.body
  assert.equal(body.destination.landmarkId, 'csf-jbl'); assert.equal(body.origin.source, 'MAP_PIN')
  env.state.chooseLandmark('csf-phs', 'destination'); await Vue.nextTick()
  assert.equal(env.state.tripPlan.journeys.value.length, 0)
  env.state.swapLocations(); await Vue.nextTick()
  assert.equal(env.route.query.fromLandmark, 'csf-phs'); assert.equal(env.route.query.toLandmark, undefined)
  assert.equal(env.route.query.toPinLat, '15.128026422211173')
  env.state.originLocation.value = null; env.state.updateLocationText('origin', ''); await Vue.nextTick()
  assert.equal(env.route.query.fromLandmark, undefined); env.stop()
})
test('explicit selection cancels pending query geocoding so late text resolution cannot replace a landmark', async () => {
  let resolve
  const waiting = new Promise(r => { resolve = r })
  const env = page({ to: 'External place' }, { forward: () => waiting }); await env.mount()
  env.state.chooseLandmark('csf-jbl', 'destination')
  resolve({ ok: true, data: [{ id: 'late', label: 'External place', lat: 15, lng: 120, source: 'GEOAPIFY' }] })
  await Vue.nextTick(); await Vue.nextTick()
  assert.equal(env.state.destinationLocation.value.landmarkId, 'csf-jbl'); env.stop()
})
test('curated autocomplete remains usable during provider failure and clears cached entries when disabled', async () => {
  const env = page(); await env.mount(); const search = env.search()
  search.search('JBL'); await new Promise(resolve => setTimeout(resolve, 15)); await Vue.nextTick()
  assert.equal(search.state.status, 'ready'); assert.equal(search.state.suggestions[0].landmarkId, 'csf-jbl')
  env.state.landmarks.catalog.value = { ...catalog, enabled: false, landmarks: [] }; await Vue.nextTick()
  assert.equal(search.state.suggestions.length, 0); env.stop()
})
test('dedicated icon/text layers have valid glyphs and collision rules without changing the basemap', () => {
  const layers = landmarkLayers()
  assert.deepEqual(validateStyleMin({ version: 8, glyphs: 'https://maps.geoapify.com/fonts/{fontstack}/{range}.pbf', sources: { [LANDMARK_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }, layers }), [])
  assert.equal(layers[0].layout['icon-allow-overlap'], false)
  assert.equal(layers[1].layout['text-allow-overlap'], false)
  assert.equal(landmarkLayers(false).length, 1)
})
test('POI refresh and style reload restore their own source/images/layers and never move the camera', () => {
  const sources = new Map(), layers = new Map(), images = new Set(); let updates = 0
  const map = { getStyle: () => ({ glyphs: 'fonts' }), getSource: id => sources.get(id), addSource: (id, source) => sources.set(id, { ...source, setData(data) { this.data = data; updates++ } }),
    hasImage: id => images.has(id), addImage: id => images.add(id), getLayer: id => layers.get(id), addLayer: layer => layers.set(layer.id, layer) }
  const renderer = createLandmarkPresentation(map, () => ({}))
  renderer.update(catalog.landmarks); renderer.update(catalog.landmarks.slice(0, 2)); assert.equal(updates, 1)
  assert.equal(sources.get(LANDMARK_SOURCE).data.features[0].geometry.coordinates[0], catalog.landmarks[0].lng)
  sources.clear(); layers.clear(); images.clear(); renderer.sync()
  assert.equal(sources.get(LANDMARK_SOURCE).data.features.length, 2); assert.equal(layers.size, 2); assert.equal(images.size, 5)
})
test('intermediate WALK never becomes the overall pickup/dropoff marker, and boarding checks render independently of AI', () => {
  const j = structuredClone(plan.journeys.find(j => j.transferCount === 1))
  j.legs = j.legs.filter(l => l.type === 'TRANSIT')
  j.legs[1].boardingInstructions = ['Ask the driver about your landmark and final drop-off.']
  const transfer = { type: 'WALK', sequence: 2, purpose: 'TRANSFER', distanceMeters: 200, durationSeconds: 120, geometry: null,
    from: { lat: 15.05, lng: 120.698, label: 'SM drop-off' }, to: { lat: 15.051, lng: 120.697, label: 'SM Terminal' }, instructions: [{ text: 'Walk to the terminal.' }] }
  j.legs.splice(1, 0, transfer)
  const map = journeyMapPresentation(j, null, null)
  assert.ok(!map.nodes.some(n => n.id === `${j.id}-pickup` || n.id === `${j.id}-dropoff`))
  const steps = options.journeyNavigationSteps(j)
  assert.deepEqual(steps.map(s => s.type), ['TRANSIT', 'WALK', 'TRANSIT'])
  assert.match(steps.at(-1).boardingInstructions[0], /driver/)
})
test('three-ride client guide and time contract retain unknown components and reject invented ETA', () => {
  const request = { originLabel: 'San Juan', destinationLabel: 'City Proper', journey: { transferCount: 2, legs: Array.from({ length: 3 }, () => ({ type: 'TRANSIT', transportMode: 'Jeep', signboard: '' })), fareSummary: { totalStatus: 'UNKNOWN', totalFare: null, currency: 'PHP' } } }
  const text = 'Take a Jeep. Transfer to a Jeep. Transfer to a Jeep. Walk to your destination. This trip has two transfers.'
  assert.equal(guide.safeJourneyGuide(text, request), true)
  assert.equal(guide.safeJourneyGuide(text + ' ETA is soon.', request), false)
  const partial = { journeyId: 'three', status: 'PARTIAL', walkingSeconds: 120, rideSeconds: 300, movingSeconds: null, walkingComplete: true, ridesComplete: false, knownRideCount: 2, rideCount: 3,
    source: 'GEOAPIFY_ROAD_PROXY', exclusions: ['WAITING', 'BOARDING', 'TRANSFER_DELAYS', 'LIVE_TRAFFIC'], calculatedAt: '2026-10-07T00:00:00Z', expiresAt: '2026-10-07T00:05:00Z' }
  assert.equal(time.validTravelTime(partial, 'three'), true)
  assert.equal(time.validTravelTime({ ...partial, movingSeconds: 420 }, 'three'), false)
})
test('both passenger map templates expose landmarks, accessible choices and origin/destination actions', () => {
  for (const file of ['app/components/PamanaMapPanel.vue', 'app/pages/passenger/trip-planner.vue', 'app/pages/passenger/map.vue']) {
    const descriptor = parse(read(file)).descriptor
    assert.deepEqual(compileTemplate({ id: file, filename: file, source: descriptor.template.content }).errors, [])
    assert.match(descriptor.template.content, /landmark/)
  }
  const panel = read('app/components/PamanaMapPanel.vue')
  assert.match(panel, /Choose a pilot landmark/); assert.match(panel, /Plan from here/); assert.match(panel, /Plan to here/)
})
