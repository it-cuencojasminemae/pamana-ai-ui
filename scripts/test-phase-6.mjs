import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolveMapConfiguration } from '../app/services/mapConfiguration.ts'
import { createMapLibreLoader } from '../app/services/mapLibreLoader.ts'
import { createGeoapifyClient } from '../app/services/geoapify.ts'

const require = createRequire(import.meta.url)
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const config = { geoapifyApiKey: 'unit-test-only-not-a-real-key' }
const empty = { type: 'FeatureCollection', features: [] }
// Every successful request uses an injected fetcher; any accidental real call fails.
globalThis.fetch = async () => { throw new Error('Network prohibited in Phase 6 tests') }

test('dependencies, public configuration allowlist, env placeholders and Leaflet compatibility', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(require('maplibre-gl/package.json').version, '6.11.1')
  assert.equal(require('leaflet/package.json').version, '1.9.4')
  assert.ok(pkg.dependencies.leaflet && pkg.dependencies['maplibre-gl'])
  assert.ok(!Object.keys(pkg.dependencies).some(key => /google|mapbox-gl|vue-maplibre/.test(key)))
  const source = read('nuxt.config.ts')
  const runtime = new Function('defineNuxtConfig', source.replace('export default', 'return'))(value => value).runtimeConfig
  assert.deepEqual(Object.keys(runtime.public).sort(), ['apiUrl', 'cartoBasemapKey', 'demoMode', 'geoapifyApiKey', 'geoapifyMapStyle'])
  assert.equal(runtime.public.geoapifyApiKey, '')
  assert.equal(runtime.public.geoapifyMapStyle, '')
  assert.doesNotMatch(source, /GOOGLE|OPENAI|GEMINI|DATABASE_|JWT_|STRAPI_SECRET/)
  const env = read('.env.example')
  for (const key of ['NUXT_PUBLIC_GEOAPIFY_API_KEY', 'NUXT_PUBLIC_GEOAPIFY_MAP_STYLE']) assert.match(env, new RegExp(`^${key}=$`, 'm'))
  assert.match(read('.gitignore'), /^\.env$/m)
  assert.match(read('app/components/PamanaMapPanel.vue'), /<PamanaLeafletMap/)
  assert.match(read('app/components/PamanaLeafletMap.vue'), /onMounted\(async/)
  assert.match(read('app/components/PamanaLeafletMap.vue'), /import\('leaflet'\)/)
  assert.match(read('app/components/PamanaLeafletMap.vue'), /leaflet\/dist\/leaflet.css/)
  for (const file of ['app/components/PamanaMapPanel.vue', 'app/components/PamanaLeafletMap.vue']) {
    const previous = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'show', `1c32d40050aa3993ce38f82d429b345d738788e9:${file}`], { encoding: 'utf8' })
    assert.equal(read(file).replaceAll('\r\n', '\n'), previous.replaceAll('\r\n', '\n'), 'Compatibility renderer must stay unchanged')
  }
})

test('configuration is optional; style identifiers cannot leak a key to arbitrary hosts', () => {
  assert.deepEqual(resolveMapConfiguration({}), { ok: false, error: 'MISSING_API_KEY' })
  for (const geoapifyMapStyle of ['https://example.invalid/style.json', '../style', 'osm?apiKey=x', 42]) {
    assert.equal(resolveMapConfiguration({ ...config, geoapifyMapStyle }).error, 'INVALID_CONFIGURATION')
  }
  assert.equal(resolveMapConfiguration({ geoapifyApiKey: 'YOUR_API_KEY' }).ok, false)
  const resolved = resolveMapConfiguration({ ...config, geoapifyMapStyle: 'positron' })
  assert.equal(new URL(resolved.styleUrl).host, 'maps.geoapify.com')
  assert.equal(resolved.styleId, 'positron')
})

test('loader never imports on SSR or missing config; deduplicates loads, sanitizes failures and disposes', async () => {
  let imports = 0
  const module = { Map: class {} }
  const importer = async () => { imports++; return module }
  const ssr = createMapLibreLoader(() => config, { isClient: () => false, loadModule: importer })
  assert.equal(await ssr.load(), null)
  assert.equal(ssr.getState().status, 'ssr')
  const missing = createMapLibreLoader(() => ({}), { isClient: () => true, loadModule: importer })
  assert.equal(await missing.load(), null)
  assert.equal(missing.getState().error, 'MISSING_API_KEY')
  assert.equal(imports, 0)
  const loader = createMapLibreLoader(() => config, { isClient: () => true, loadModule: importer })
  const pending = loader.load()
  assert.equal(loader.getState().status, 'loading')
  assert.deepEqual(await Promise.all([pending, loader.load()]), [module, module])
  assert.equal(imports, 1)
  assert.equal(loader.getState().status, 'ready')
  loader.reportRenderFailure('TILE_LOAD_FAILED')
  assert.equal(loader.getState().error, 'TILE_LOAD_FAILED')
  loader.reportRenderFailure('MAP_INITIALIZATION_FAILED')
  assert.equal(loader.getState().error, 'MAP_INITIALIZATION_FAILED')
  loader.dispose()
  assert.equal(await loader.load(), null)
  assert.equal(loader.getState().status, 'disposed')
  const failing = createMapLibreLoader(() => config, { isClient: () => true, loadModule: async () => { throw new Error('sensitive-provider-url') } })
  assert.equal(await failing.load(), null)
  assert.deepEqual(failing.getState(), { status: 'error', error: 'MODULE_LOAD_FAILED' })
  let resolve
  const delayed = createMapLibreLoader(() => config, { isClient: () => true, loadModule: () => new Promise(done => { resolve = done }) })
  const late = delayed.load()
  delayed.dispose()
  resolve(module)
  assert.equal(await late, null)
  assert.equal(delayed.getState().status, 'disposed')
})

test('Geoapify endpoints are geographic-only, opt-in, credential-isolated and cancellable', async () => {
  const calls = []
  const fetcher = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(empty)) }
  const missing = createGeoapifyClient(() => ({}), { fetcher })
  assert.deepEqual(await missing.autocomplete('example'), { ok: false, error: 'MISSING_API_KEY' })
  assert.equal(calls.length, 0)
  const client = createGeoapifyClient(() => config, { fetcher })
  assert.equal(calls.length, 0)
  const point = { latitude: 1, longitude: 2 } // synthetic unit input, never PAMANA seed data
  const results = await Promise.all([
    client.autocomplete('example'), client.forwardGeocode('example'), client.reverseGeocode(point),
    client.searchPlaces(['commercial.shopping_mall'], point, 100),
    client.routeGeography([point, { latitude: 3, longitude: 4 }], 'walk'),
  ])
  assert.ok(results.every(result => result.ok && result.authority === 'EXTERNAL_GEOGRAPHY'))
  assert.deepEqual(calls.map(call => call.url.pathname), ['/v1/geocode/autocomplete', '/v1/geocode/search', '/v1/geocode/reverse', '/v2/places', '/v1/routing'])
  assert.equal(calls[4].url.searchParams.get('waypoints'), '1,2|3,4')
  for (const { url, options } of calls) {
    assert.equal(url.origin, 'https://api.geoapify.com')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    assert.deepEqual(options.headers, { Accept: 'application/json' })
  }
  for (const result of [await client.autocomplete(''), await client.reverseGeocode({ latitude: null, longitude: null }), await client.routeGeography([point, point], 'jeepney')]) assert.equal(result.error, 'INVALID_INPUT')
  const abort = new AbortController(); abort.abort()
  assert.equal((await client.autocomplete('example', abort.signal)).error, 'ABORTED')
})

test('provider failures produce redacted typed results, never auth side effects', async () => {
  for (const [status, error] of [[401, 'UNAUTHORIZED'], [403, 'UNAUTHORIZED'], [429, 'RATE_LIMITED'], [500, 'HTTP_ERROR']]) {
    const client = createGeoapifyClient(() => config, { fetcher: async () => new Response('sensitive details', { status }) })
    assert.deepEqual(await client.forwardGeocode('example'), { ok: false, error })
  }
  const client = createGeoapifyClient(() => config, { fetcher: async () => { throw new Error('provider-url-with-key') } })
  assert.deepEqual(await client.autocomplete('example'), { ok: false, error: 'NETWORK_ERROR' })
  for (const body of ['not json', '{}', '{"type":"FeatureCollection","features":[{}]}']) {
    assert.equal((await createGeoapifyClient(() => config, { fetcher: async () => new Response(body) }).forwardGeocode('example')).error, 'INVALID_RESPONSE')
  }
  const hanging = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
  assert.equal((await createGeoapifyClient(() => config, { fetcher: hanging, timeoutMs: 5 }).forwardGeocode('example')).error, 'TIMEOUT')
  const abort = new AbortController()
  const pending = createGeoapifyClient(() => config, { fetcher: hanging }).autocomplete('example', abort.signal)
  abort.abort()
  assert.equal((await pending).error, 'ABORTED')
  assert.doesNotMatch(read('app/services/geoapify.ts'), /console\.|useApi|useAuth|localStorage|nominatim/i)
})
