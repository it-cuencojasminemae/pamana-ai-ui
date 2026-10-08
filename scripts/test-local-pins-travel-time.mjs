import test from 'node:test'
import { planningRuntimeStubs } from './helpers/planning-runtime-stubs.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { renderToString } from '@vue/server-renderer'
import * as pins from '../app/services/mapPins.ts'
import * as times from '../app/services/travelTime.ts'
import * as guide from '../app/services/journeyExplanation.ts'
import * as trip from '../app/services/tripPlan.ts'
import * as options from '../app/services/routeOptionsPresentation.ts'
import { journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'
import * as landmarks from '../app/services/pilotLandmarks.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const area = JSON.parse(read('scripts/fixtures/san-juan-pin-area.json'))
const fixtures = JSON.parse(read('scripts/fixtures/passenger-route-options.json'))
const plan = fixtures.results.find(r => r.category === 'REGULAR' && r.response.journeys.length === 2).response
const point = { lat: 15.128026422211173, lng: 120.69826461388278 }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const complete = id => ({ journeyId: id, status: 'COMPLETE', walkingSeconds: 120, rideSeconds: 600, movingSeconds: 720,
  walkingComplete: true, ridesComplete: true, knownRideCount: 1, rideCount: 1, calculatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 300000).toISOString(), source: 'GEOAPIFY_ROAD_PROXY', exclusions: ['WAITING', 'BOARDING', 'TRANSFER_DELAYS', 'LIVE_TRAFFIC'] })

function environment(apiFetch, query = {}, reverseGeocodeLocation = async () => ({ ok: false })) {
  const scope = Vue.effectScope(), timers = new Map(), mounted = [], unmounted = []; let timerId = 0
  const route = { query }, calls = []
  const states = new Map()
  const context = { ...Vue, ...pins, ...times, ...guide, ...trip, ...options, ...landmarks, journeyMapPresentation,
    useState: (key, init) => { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key) },
    AbortController, Date, Map, useApi: () => ({ apiFetch: (endpoint, settings) => endpoint.endsWith('/landmarks')
      ? Promise.resolve({ enabled: false, version: '1.0.0', source: { type: 'COMMUTER_TESTIMONY', reportedAt: '2026-10-07', observedAt: null, coordinatePurpose: 'LANDMARK_LOCATION', transportStopVerified: false }, landmarks: [] }) : apiFetch(endpoint, settings) }), useGeoapify: () => ({ reverseGeocodeLocation,
      forwardGeocodeLocations: async label => { calls.push(label); return { ok: true, data: [{ id: 'searched', label, lat: 15.05, lng: 120.69, source: 'GEOAPIFY' }] } } }),
    useRoute: () => route, useRouter: () => ({ replace: async ({ query }) => { route.query = query } }),
    useToast: () => ({ add() {} }), definePageMeta() {}, useHead() {},
    useApproximateJourneyPaths: () => ({ lines: Vue.ref([]) }), onBeforeUnmount: fn => unmounted.push(fn), onMounted: fn => mounted.push(fn),
    setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id),
  }
  Object.assign(context, planningRuntimeStubs())
  vm.createContext(context)
  for (const file of ['useJourneyExplanation', 'useTripPlan', 'useMapPins', 'useTravelTime', 'usePilotLandmarks']) {
    const source = stripTypeScriptTypes(read(`app/composables/${file}.ts`)).replace(/^import .+$/gm, '').replace(/export (function|const)/g, '$1')
    vm.runInContext(source, context)
  }
  function create(name) { return scope.run(() => vm.runInContext(`${name}()`, context)) }
  function page() {
    const source = stripTypeScriptTypes(parse(read('app/pages/passenger/trip-planner.vue')).descriptor.scriptSetup.content).replace(/^import .+$/gm, '')
    scope.run(() => vm.runInContext(`${source}\npageState = {pins,travelTime,tripPlan,originLocation,destinationLocation,form,findJourneys,selectMapCoordinate,swapLocations,loadLocationsFromQuery,updateLocationText,lastTripRequest}`, context))
    return context.pageState
  }
  return { create, page, route, calls, timers, async mount() { for (const fn of mounted) await fn(); await Vue.nextTick() }, stop() { unmounted.forEach(fn => fn()); scope.stop() } }
}

test('an unmounted passenger page cannot normalize another page URL after slow capabilities/pin loading', async () => {
  const pending = deferred(), query = { from: 'St. Nicolas', planningMode: 'RESEARCH_PREVIEW', accessPreference: 'FEEDER' }
  const env = environment(() => pending.promise, query)
  env.page(); const mounting = env.mount()
  env.stop(); pending.resolve(area); await mounting
  assert.deepEqual(env.route.query, query)
  assert.deepEqual(env.calls, [], 'Unmounted page must not geocode or restore locations')
})

test('frontend geofence accepts the sourced PSU reference and excludes known external destinations, holes and invalid coordinates', () => {
  const geometry = area.boundary.geometry
  assert.equal(pins.pinInsideBoundary(geometry, point), true)
  assert.equal(pins.pinInsideBoundary(geometry, { lng: 120.698, lat: 15.05 }), false)
  for (const position of geometry.coordinates[0].slice(0, 10)) assert.equal(pins.pinInsideBoundary(geometry, { lng: position[0], lat: position[1] }), true)
  const polygon = { type: 'Polygon', coordinates: [[[120, 15], [121, 15], [121, 16], [120, 16], [120, 15]], [[120.3, 15.3], [120.7, 15.3], [120.7, 15.7], [120.3, 15.7], [120.3, 15.3]]] }
  for (const [p, expected] of [[{ lng: 120, lat: 15.1 }, true], [{ lng: 120.3, lat: 15.5 }, false], [{ lng: 120.5, lat: 15.5 }, false], [{ lng: NaN, lat: 15 }, false]]) {
    assert.equal(pins.pinInsideBoundary(polygon, p), expected)
    assert.equal(pins.pinInsideBoundary({ type: 'MultiPolygon', coordinates: [polygon.coordinates] }, p), expected)
  }
  assert.equal(pins.validPinArea({ ...area, boundary: null }), false)
})

test('numeric pin handoff survives full precision and rejects malformed parameters without geocoding labels', () => {
  const pin = pins.makeMapPin(point), query = pins.pinQuery('origin', pin)
  assert.deepEqual(pins.readPinQuery(query, 'origin').location, pin)
  assert.equal(pins.readPinQuery({ fromPinLat: 'junk', fromPinLng: '120' }, 'origin').location, null)
  assert.equal(pins.readPinQuery({ fromPinLat: '', fromPinLng: '120' }, 'origin').present, true)
  assert.equal(pins.readPinQuery({ fromPinLat: ['15'], fromPinLng: '120' }, 'origin').location, null)
  assert.equal(pins.readPinQuery({}, 'origin').present, false)
  assert.equal(pins.pinQuery('origin', null).fromPinLat, undefined)
})

test('pin selection rejects outside area; enrichment retains coordinates/source and failure retains usable pin', async () => {
  const env = environment(async () => area, {}, async () => ({ ok: true, data: [{ label: 'San Juan street', lat: 0, lng: 0 }] }))
  const state = env.create('useMapPins'); await state.load(); state.start('origin')
  assert.equal(state.enabled.value, true)
  assert.equal(state.choose({ lat: 15.05, lng: 120.69 }), null); assert.match(state.error.value, /inside San Juan/)
  const pin = state.choose(point); let enriched
  await state.enrich(pin, value => { enriched = value })
  assert.equal(enriched.lat, point.lat); assert.equal(enriched.lng, point.lng); assert.equal(enriched.source, 'MAP_PIN')
  state.start('origin'); assert.equal(state.mode.value, null)
  env.stop()
})

test('trip page restores exact pins, never geocodes them, and keeps outside searched destinations', async () => {
  const env = environment(async () => area, { ...pins.pinQuery('origin', pins.makeMapPin(point)), from: 'Misleading pin label', to: 'SM Pampanga' })
  const state = env.page(); await env.mount(); await Vue.nextTick()
  assert.equal(state.originLocation.value.source, 'MAP_PIN'); assert.equal(state.originLocation.value.lat, point.lat)
  assert.deepEqual(env.calls, ['SM Pampanga'])
  assert.equal(state.destinationLocation.value.source, 'GEOAPIFY')
  state.swapLocations(); await Vue.nextTick()
  assert.equal(state.destinationLocation.value.source, 'MAP_PIN'); assert.equal(env.route.query.toPinLng, String(point.lng))
  state.destinationLocation.value = null; state.updateLocationText('destination', ''); await Vue.nextTick()
  assert.equal(env.route.query.toPinLat, undefined)
  state.travelTime.reset(); env.stop()
})

test('invalid or disabled saved pins fail closed without being reinterpreted as search text', async () => {
  for (const query of [{ fromPinLat: 'bad', fromPinLng: '120', from: 'PSU Mexico' }, { ...pins.pinQuery('origin', pins.makeMapPin(point)), from: 'PSU Mexico' }]) {
    const env = environment(async () => ({ ...area, enabled: false }), query)
    const state = env.page(); await env.mount()
    assert.equal(state.originLocation.value, null); assert.deepEqual(env.calls, [])
    state.travelTime.reset(); env.stop()
  }
})

test('selection, replacement and swap reset stale routes and pass MAP_PIN into the existing request', async () => {
  const calls = []
  const env = environment(async (endpoint, settings) => {
    calls.push({ endpoint, settings })
    if (endpoint.endsWith('pin-area')) return { ...area, travelTimeEnabled: false }
    if (endpoint.endsWith('trip-plan')) return structuredClone(plan)
    return { status: 'UNAVAILABLE', explanation: null }
  })
  const state = env.page(); await env.mount(); state.pins.start('origin'); state.selectMapCoordinate(point)
  state.destinationLocation.value = { ...plan.request.destination, id: 'destination' }; await Vue.nextTick()
  await state.findJourneys(); await Vue.nextTick()
  assert.equal(calls.find(call => call.endpoint.endsWith('trip-plan')).settings.body.origin.source, 'MAP_PIN')
  assert.equal(state.tripPlan.journeys.value.length, 2)
  assert.equal(state.pins.mode.value, null, 'Searching ends pin-edit mode so normal feature clicks stay usable')
  state.pins.start('origin')
  const second = { lat: point.lat - 0.00005, lng: point.lng }; state.selectMapCoordinate(second); await Vue.nextTick()
  assert.equal(state.originLocation.value.lat, second.lat); assert.equal(state.tripPlan.journeys.value.length, 0)
  state.journeyExplanation?.reset?.(); state.travelTime.reset(); state.tripPlan.cancel(); env.stop()
})

test('late road estimate cannot overwrite a new selected journey and selection cache avoids duplicate requests', async () => {
  const first = deferred(), second = deferred(), calls = []
  const env = environment(async (_, settings) => { calls.push(settings); return settings.body.journeyId === 'A' ? first.promise : second.promise })
  const state = env.create('useTravelTime')
  const a = state.load(plan.request, 'A'), b = state.load(plan.request, 'B')
  second.resolve(complete('B')); await b
  first.resolve(complete('A')); await a
  assert.equal(state.response.value.journeyId, 'B'); assert.equal(calls[0].signal.aborted, true)
  await state.load(plan.request, 'B'); assert.equal(calls.length, 2)
  state.reset(); assert.equal(state.response.value, null); env.stop()
})

test('actual selected journey starts road estimates after rendering without waiting for the AI guide', async () => {
  const ai = deferred(), road = deferred(), calls = []
  const env = environment(async (endpoint, settings) => {
    calls.push(endpoint)
    if (endpoint.endsWith('pin-area')) return area
    if (endpoint.endsWith('trip-plan')) return structuredClone(plan)
    if (endpoint.endsWith('travel-time')) return road.promise
    return ai.promise
  })
  const state = env.page(); await env.mount()
  state.originLocation.value = { ...plan.request.origin, id: 'origin' }
  state.destinationLocation.value = { ...plan.request.destination, id: 'destination' }
  await Vue.nextTick(); await state.findJourneys(); await Vue.nextTick()
  assert.equal(state.tripPlan.loading.value, false); assert.equal(state.tripPlan.journeys.value.length, 2)
  assert.ok(calls.some(endpoint => endpoint.endsWith('travel-time')))
  assert.equal(state.travelTime.loading.value, true)
  road.resolve(complete(state.tripPlan.selectedJourneyId.value)); await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.travelTime.response.value.status, 'COMPLETE')
  assert.equal(state.tripPlan.response.value.recommendations.fastest.journeyId, null)
  state.travelTime.reset(); state.tripPlan.cancel(); ai.resolve({ status: 'UNAVAILABLE', explanation: null }); env.stop()
})

test('hung, expired or malformed time responses cannot show a fabricated total', async () => {
  const env = environment(() => new Promise(() => {})), state = env.create('useTravelTime')
  const pending = state.load(plan.request, 'A'); [...env.timers.values()][0](); await pending
  assert.equal(state.loading.value, false); assert.equal(state.response.value.status, 'UNAVAILABLE'); state.reset(); env.stop()
  for (const value of [{ ...complete('A'), movingSeconds: 1 }, { ...complete('A'), exclusions: [] }, { ...complete('A'), walkingSeconds: -1 }, { ...complete('A'), status: 'PARTIAL', movingSeconds: 720 }]) assert.equal(times.validTravelTime(value, 'A'), false)
  const expired = environment(async () => ({ ...complete('A'), expiresAt: '2000-01-01T00:00:00Z' })), time = expired.create('useTravelTime')
  await time.load(plan.request, 'A'); assert.equal(time.response.value.status, 'UNAVAILABLE'); time.reset(); expired.stop()
})

function timeComponent() {
  const { descriptor } = parse(read('app/components/journey/PamanaTravelTime.vue'))
  const script = compileScript(descriptor, { id: 'time' })
  const template = compileTemplate({ id: 'time', filename: 'PamanaTravelTime.vue', source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const transform = code => stripTypeScriptTypes(code).replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_, names, quote, source) => `const {${names.replace(/\s+as\s+/g, ': ')}} = ${source === 'vue' ? 'Vue' : 'times'};`).replace('export default', 'component =').replace('export function render', 'function render')
  const sandbox = { Vue, times }; vm.runInNewContext(`${transform(script.content)}\n${transform(template.code)}\ncomponent.render=render`, sandbox)
  return sandbox.component
}

test('actual time panel displays partial components and exclusions without inventing an arrival clock', async () => {
  const component = timeComponent()
  const html = await renderToString(Vue.createSSRApp(component, { loading: false, estimate: complete('A') }))
  assert.match(html, /Approximate travel time/); assert.match(html, /About 12 min/)
  assert.match(html, /Waiting, boarding, and transfer delays not included/); assert.match(html, /not live conditions/)
  const partial = await renderToString(Vue.createSSRApp(component, { loading: false, estimate: { ...complete('A'), status: 'PARTIAL', rideSeconds: null, movingSeconds: null, ridesComplete: false, knownRideCount: 0 } }))
  assert.match(partial, /Only part/); assert.match(partial, /Unavailable/); assert.doesNotMatch(partial, /About 12 min/)
})
