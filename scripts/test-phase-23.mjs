import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { createGeoapifyClient } from '../app/services/geoapify.ts'
import { createLocationSearchController } from '../app/services/locationSearch.ts'
import { createLocationRequestCache } from '../app/services/locationRequestCache.ts'
import { createApproximateRoadPathResolver } from '../app/services/approximateRoadPath.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const result = { ok: true, source: 'GEOAPIFY', authority: 'EXTERNAL_GEOGRAPHY', data: [{ id: 'synthetic', label: 'Synthetic place', lat: 14, lng: 119, source: 'GEOAPIFY' }] }
const ref = value => ({ value })

test('identical pending queries retain their response; cache hits abort stale work and TTL expires', async () => {
  let calls = 0, time = 0
  const states = [], requests = []
  const search = createLocationSearchController((query, signal) => {
    calls++
    return new Promise(resolve => requests.push({ query, signal, resolve }))
  }, state => states.push(state), { delayMs: 1, now: () => time, cacheTtlMs: 5 })
  search.schedule('Synthetic  place')
  search.schedule('SYNTHETIC place')
  await wait(8)
  search.schedule('synthetic place')
  assert.equal(calls, 1)
  requests[0].resolve(structuredClone(result))
  await wait(0)
  assert.equal(states.at(-1).status, 'ready')
  search.schedule('Other place')
  await wait(8)
  search.schedule('synthetic place')
  assert.equal(requests[1].signal.aborted, true)
  requests[1].resolve({ ...result, data: [{ ...result.data[0], label: 'Stale result' }] })
  await wait(0)
  assert.equal(states.at(-1).suggestions[0].label, 'Synthetic place')
  time = 6
  search.schedule('synthetic place')
  await wait(8)
  assert.equal(calls, 3)
  search.dispose()
  assert.equal(requests[2].signal.aborted, true)
  requests[2].resolve(result)
})

test('FROM and TO share normalized autocomplete requests without sharing cancellation or filters', async () => {
  let calls = 0, release, providerSignal
  const client = createGeoapifyClient(() => ({ geoapifyApiKey: 'synthetic-search-only' }), {
    fetcher: (_, options) => {
      calls++; providerSignal = options.signal
      return new Promise(resolve => { release = () => resolve(new Response(JSON.stringify({ type: 'FeatureCollection', features: [{
        type: 'Feature', id: 'synthetic', properties: { name: 'Synthetic place' }, geometry: { type: 'Point', coordinates: [119, 14] },
      }] }))) })
    },
  })
  const controller = new AbortController()
  const first = client.autocompleteLocations('Synthetic  place', undefined, controller.signal)
  const second = client.autocompleteLocations(' SYNTHETIC place ')
  await wait(0)
  controller.abort()
  assert.equal((await first).error, 'ABORTED')
  assert.equal(providerSignal.aborted, false)
  release()
  const secondResult = await second
  assert.equal(calls, 1)
  secondResult.data[0].label = 'Caller mutation'
  assert.equal((await client.autocompleteLocations('synthetic place')).data[0].label, 'Synthetic place')
  assert.equal(calls, 1)
  const filtered = client.autocompleteLocations('synthetic place', { countryCode: 'us' })
  await wait(0); release(); await filtered
  const forward = client.forwardGeocodeLocations('synthetic place')
  await wait(0); release(); await forward
  assert.equal(calls, 3, 'endpoint and geographic options must partition the cache')
  assert.match(read('app/composables/useGeoapify.ts'), /WeakMap/)
  assert.match(read('app/composables/useGeoapify.ts'), /useNuxtApp/)
})

test('geography cache bounds, expiration, failure retries and last-subscriber cancellation', async () => {
  let time = 0, calls = 0
  const cache = createLocationRequestCache({ ttlMs: 5, maxEntries: 1, now: () => time })
  const operation = async () => { calls++; return result }
  await cache.resolve('a', operation); await cache.resolve('a', operation)
  assert.equal(calls, 1)
  time = 6
  await cache.resolve('a', operation)
  await cache.resolve('b', operation)
  await cache.resolve('a', operation)
  assert.equal(calls, 4)
  const failing = async () => { calls++; return { ok: false, error: 'RATE_LIMITED' } }
  await cache.resolve('failure', failing); await cache.resolve('failure', failing)
  assert.equal(calls, 6)
  let underlying
  const controller = new AbortController()
  const active = cache.resolve('pending', signal => {
    underlying = signal
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
  }, controller.signal)
  await wait(0)
  controller.abort()
  assert.equal((await active).error, 'ABORTED')
  assert.equal(underlying.aborted, true)
})

test('AI guides reuse exact facts for the current search, and failures retry only explicitly', async () => {
  let calls = 0, time = 1000, nextStatus = 'AVAILABLE'
  const source = stripTypeScriptTypes(read('app/composables/useJourneyExplanation.ts').replace(/^import .*\n/gm, '').replace('export function', 'function'))
  const make = vm.runInNewContext(`${source}\nuseJourneyExplanation`, {
    ref, shallowRef: ref, computed: fn => ({ get value() { return fn() } }), readonly: value => value, onBeforeUnmount() {}, AbortController, setTimeout, clearTimeout,
    unavailableGuide: () => ({ status: 'PROVIDER_UNAVAILABLE', explanation: null }),
    Date: { now: () => time }, useApi: () => ({ apiFetch: null }),
    fetchJourneyExplanation: async () => { calls++; return { status: nextStatus, explanation: nextStatus === 'AVAILABLE' ? 'Synthetic factual guide' : null } },
  })
  const guide = make(), input = { originLabel: 'Synthetic origin', journey: { fare: 20 } }
  assert.equal(calls, 0)
  await guide.explain('A', input); await guide.explain('A', input)
  assert.equal(calls, 1)
  await guide.explain('A', { ...input, journey: { fare: 30 } })
  assert.equal(calls, 2, 'changed facts must request a new explanation')
  time += 60_000
  await guide.explain('A', { ...input, journey: { fare: 30 } })
  assert.equal(calls, 2, 'current search cache does not expire into repeated automatic calls')
  guide.reset(); await guide.explain('A', input)
  assert.equal(calls, 3)
  guide.reset(); nextStatus = 'PROVIDER_UNAVAILABLE'
  await guide.explain('A', input); await guide.explain('A', input)
  assert.equal(calls, 4, 'a failed result is automatically attempted only once')
  await guide.explain('A', input, true)
  assert.equal(calls, 5, 'Explain again explicitly retries the selected guide')
})

test('LGU polling pauses when hidden, prevents overlaps and aborts on disposal', async () => {
  const file = 'app/pages/lgu/live-mobility.vue'
  const { descriptor } = parse(read(file))
  const compiled = compileScript(descriptor, { id: 'phase23-lgu' })
  assert.deepEqual(compileTemplate({ id: 'phase23-lgu', filename: file, source: descriptor.template.content,
    compilerOptions: { bindingMetadata: compiled.bindings } }).errors, [])
  const source = stripTypeScriptTypes(descriptor.scriptSetup.content)
  const mounted = [], disposed = [], listeners = new Map(), requests = [], timers = []
  const document = { visibilityState: 'visible', addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: event => listeners.delete(event) }
  const state = vm.runInNewContext(`${source}\n;({ rawVehicles, loadLiveVehicles })`, {
    ref, computed: fn => ({ get value() { return fn() } }), AbortController, document,
    definePageMeta() {}, useHead() {}, useGeolocation: () => ({ location: ref(null) }),
    useDemoVehicleFeed: () => ({ refresh: async () => {}, cancel() {} }),
    useApi: () => ({ apiFetch: (_, options) => new Promise(resolve => requests.push({ options, resolve })) }),
    onMounted: fn => mounted.push(fn), onUnmounted: fn => disposed.push(fn),
    setInterval: (fn, ms) => { timers.push({ fn, ms }); return 1 }, clearInterval() {},
  })
  mounted[0]()
  assert.equal(timers[0].ms, 15_000)
  timers[0].fn(); assert.equal(requests.length, 1)
  document.visibilityState = 'hidden'; listeners.get('visibilitychange')()
  assert.equal(requests[0].options.signal.aborted, true)
  requests[0].resolve({ data: [{ plate_number: 'Stale response' }] }); await wait(0)
  assert.equal(state.rawVehicles.value.length, 0)
  timers[0].fn(); assert.equal(requests.length, 1)
  document.visibilityState = 'visible'; listeners.get('visibilitychange')()
  assert.equal(requests.length, 2)
  requests[1].resolve({ data: [{ plate_number: 'Current response' }] }); await wait(0)
  assert.equal(state.rawVehicles.value[0].plate_number, 'Current response')
  timers[0].fn(); disposed[0]()
  assert.equal(requests[2].options.signal.aborted, true)
  assert.equal(listeners.size, 0)
  requests[2].resolve({ data: [] })
  const passenger = read('app/pages/passenger/map.vue')
  const refresh = passenger.match(/async function refreshVehicleFeeds\(\)[\s\S]*?\n}/)[0]
  assert.doesNotMatch(refresh, /loadTransportNodes|fitBounds|easeTo/)
  assert.match(passenger, /15000/)
})

test('presentation cache uses endpoint coordinates and preserves null verified geometry and camera', async () => {
  let calls = 0
  const leg = { sequence: 1, type: 'TRANSIT', route: { code: 'SYNTHETIC' }, variant: { id: 'synthetic' }, geometry: null,
    boardAt: { nodeId: 'synthetic-a', lat: 14, lng: 119 }, alightAt: { nodeId: 'synthetic-b', lat: 14.1, lng: 119.1 }, intermediateNodes: [] }
  const resolver = createApproximateRoadPathResolver(async points => {
    calls++
    return { ok: true, data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: {
      type: 'LineString', coordinates: points.map(point => [point.longitude, point.latitude]),
    } }] } }
  })
  await resolver.resolveJourney({ legs: [leg] }); await resolver.resolveJourney({ legs: [leg] })
  await resolver.resolveJourney({ legs: [{ ...leg, boardAt: { ...leg.boardAt, lat: 14.01 } }] })
  assert.equal(calls, 2)
  assert.equal(leg.geometry, null)
  const map = read('app/components/PamanaMapLibreMap.vue')
  assert.match(map, /watch\(features, \(\) => updateFeaturePresentation\(\)/)
  assert.doesNotMatch(map.match(/watch\(features,[^\n]+/)[0], /fitBounds|easeTo|initialize/)
  assert.ok(JSON.parse(read('package.json')).dependencies['maplibre-gl'])
})
