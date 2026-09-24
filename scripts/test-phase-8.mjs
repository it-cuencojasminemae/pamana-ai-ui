import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { createGeoapifyClient, normalizeGeoapifyLocations, PAMPANGA_SEARCH_OPTIONS } from '../app/services/geoapify.ts'
import { createLocationSearchController, gpsLocation, resolveGpsLocation, selectedLocationAfterEdit } from '../app/services/locationSearch.ts'
import { locationMapFeature } from '../app/services/locationPresentation.ts'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const config = { geoapifyApiKey: 'unit-test-only-not-a-real-key' }
const fixture = (name = 'SM City Pampanga') => ({ type: 'FeatureCollection', features: [{
  type: 'Feature', id: 'fixture-feature', geometry: { type: 'Point', coordinates: [120.6, 15.05] }, properties: {
    place_id: 'fixture-place', name, formatted: `${name}, Pampanga, Philippines`, category: 'commercial.shopping_mall', lat: 15.05, lon: 120.6,
  },
}] })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

test('autocomplete uses the official endpoint with a broad Philippine filter and Pampanga ranking bias', async () => {
  let request
  const client = createGeoapifyClient(() => config, { fetcher: async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify(fixture()), { headers: { 'content-type': 'application/json' } })
  } })
  const result = await client.autocompleteLocations('SM City Pampanga')
  assert.equal(result.ok, true)
  assert.equal(request.url.pathname, '/v1/geocode/autocomplete')
  assert.equal(request.url.searchParams.get('filter'), 'countrycode:ph')
  assert.equal(request.url.searchParams.get('bias'), 'proximity:120.69,15.09')
  assert.equal(request.url.searchParams.get('limit'), '6')
  assert.equal(request.url.searchParams.get('lang'), 'en')
  assert.equal(request.options.credentials, 'omit')
  assert.deepEqual(PAMPANGA_SEARCH_OPTIONS, { countryCode: 'ph', bias: { longitude: 120.69, latitude: 15.09 }, limit: 6, language: 'en' })
})

test('Geoapify features normalize to the provider-neutral resolved-location contract', () => {
  const [location] = normalizeGeoapifyLocations(fixture())
  assert.deepEqual(location, {
    id: 'fixture-place', label: 'SM City Pampanga', formattedAddress: 'SM City Pampanga, Pampanga, Philippines',
    lat: 15.05, lng: 120.6, placeId: 'fixture-place', category: 'commercial.shopping_mall', source: 'GEOAPIFY',
  })
  const invalid = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] }, properties: {} }] }
  assert.deepEqual(normalizeGeoapifyLocations(invalid), [])
})

test('search controller debounces, cancels stale work, caps results and caches exact queries', async () => {
  const calls = [], resolvers = new Map(), states = []
  const searcher = (query, signal) => {
    calls.push({ query, signal })
    return new Promise(resolve => resolvers.set(query, resolve))
  }
  const controller = createLocationSearchController(searcher, state => states.push(state), { delayMs: 5, minLength: 2 })
  controller.schedule('S')
  controller.schedule('SM')
  controller.schedule('SM C')
  await wait(12)
  assert.deepEqual(calls.map(call => call.query), ['SM C'])
  controller.schedule('Robinsons')
  assert.equal(calls[0].signal.aborted, true)
  await wait(12)
  assert.deepEqual(calls.map(call => call.query), ['SM C', 'Robinsons'])
  resolvers.get('SM C')({ ok: true, source: 'GEOAPIFY', authority: 'EXTERNAL_GEOGRAPHY', data: [{ id: 'stale', label: 'Stale', lat: 1, lng: 2, source: 'GEOAPIFY' }] })
  const suggestions = Array.from({ length: 10 }, (_, index) => ({ id: String(index), label: `Place ${index}`, lat: 1, lng: 2, source: 'GEOAPIFY' }))
  resolvers.get('Robinsons')({ ok: true, source: 'GEOAPIFY', authority: 'EXTERNAL_GEOGRAPHY', data: suggestions })
  await wait(0)
  assert.equal(states.at(-1).status, 'ready')
  assert.equal(states.at(-1).suggestions.length, 8)
  controller.schedule('ROBINSONS')
  assert.equal(states.at(-1).suggestions.length, 8)
  assert.equal(calls.length, 2, 'case-insensitive cache prevents duplicate quota use')
  controller.dispose()
})

test('selection, edited-text invalidation and current-location fallback preserve resolved coordinates', async () => {
  const selected = { id: 'place', label: 'Selected place', formattedAddress: 'Selected place, Pampanga', lat: 15, lng: 120, source: 'GEOAPIFY' }
  assert.equal(selectedLocationAfterEdit(selected, 'Selected place'), selected)
  assert.equal(selectedLocationAfterEdit(selected, 'Selected place, Pampanga'), null)
  assert.equal(selectedLocationAfterEdit(selected, 'Selected'), null)
  const point = { latitude: 15.1, longitude: 120.7 }
  assert.deepEqual(gpsLocation(point), { id: 'user-gps', label: 'Current Location', formattedAddress: undefined, lat: 15.1, lng: 120.7, placeId: undefined, category: undefined, source: 'USER_GPS' })
  const afterFailure = await resolveGpsLocation(point, async () => ({ ok: false, error: 'NETWORK_ERROR' }))
  assert.equal(afterFailure.source, 'USER_GPS')
  assert.deepEqual([afterFailure.lat, afterFailure.lng], [15.1, 120.7])
})

test('missing config, no results and provider failures are typed and sanitized', async () => {
  let calls = 0
  const missing = createGeoapifyClient(() => ({}), { fetcher: async () => { calls++; return new Response() } })
  assert.deepEqual(await missing.autocompleteLocations('example'), { ok: false, error: 'MISSING_API_KEY' })
  assert.equal(calls, 0)
  const empty = createGeoapifyClient(() => config, { fetcher: async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] })) })
  assert.deepEqual((await empty.autocompleteLocations('example')).data, [])
  const failing = createGeoapifyClient(() => config, { fetcher: async () => { throw new Error('secret provider detail') } })
  assert.deepEqual(await failing.autocompleteLocations('example'), { ok: false, error: 'NETWORK_ERROR' })
})

test('origin and destination are external geographic map markers, never transport nodes', () => {
  const base = { id: 'place', label: 'Resolved place', lat: 15, lng: 120, source: 'GEOAPIFY' }
  const origin = locationMapFeature(base, 'origin')
  const destination = locationMapFeature(base, 'destination')
  assert.equal(origin.properties.semantic, 'origin-location')
  assert.equal(destination.properties.semantic, 'destination-location')
  for (const marker of [origin, destination]) {
    assert.deepEqual(marker.geometry.coordinates, [120, 15])
    assert.equal(marker.properties.source, 'GEOAPIFY')
    assert.equal(marker.properties.isTransportNode, false)
  }
})

test('reusable component compiles with accessible keyboard interaction and current-location support', () => {
  const source = read('app/components/location/PamanaLocationSearch.vue')
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'phase8' })
  const template = compileTemplate({ id: 'phase8', filename: 'PamanaLocationSearch.vue', source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  for (const token of ['role="combobox"', 'role="listbox"', 'role="option"', "event.key === 'ArrowDown'", "event.key === 'ArrowUp'", "event.key === 'Enter'", "event.key === 'Escape'", 'Current Location']) assert.ok(source.includes(token))
  assert.match(source, /selectedLocationAfterEdit/)
  assert.match(source, /resolveGpsLocation/)
  assert.doesNotMatch(source, /raw provider|apiKey|console\./)
})

test('passenger integration requires resolved coordinates, maps selections and performs no Phase 9-11 work', () => {
  const planner = read('app/pages/passenger/trip-planner.vue')
  assert.equal((planner.match(/<LocationPamanaLocationSearch/g) ?? []).length, 2)
  assert.match(planner, /!originLocation\.value \|\| !destinationLocation\.value/)
  assert.match(planner, /:nodes="geographicLocationMarkers"/)
  assert.match(planner, /forwardGeocodeLocations/)
  assert.doesNotMatch(planner, /routeGeography|searchPlaces|nearest pickup|transfer calculation/i)
  const geoapify = read('app/services/geoapify.ts')
  const search = read('app/services/locationSearch.ts')
  const component = read('app/components/location/PamanaLocationSearch.vue')
  for (const source of [geoapify, search, component]) assert.doesNotMatch(source, /\/api\/(transport|routes?|stops?)|strapi|createTransport|method:\s*['"](?:POST|PUT|PATCH|DELETE)/i)
  assert.match(read('app/components/PamanaMapPanel.vue'), /<PamanaLeafletMap/)
  assert.ok(JSON.parse(read('package.json')).dependencies.leaflet)
})
