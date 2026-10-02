import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as markerData from '../app/services/mapPresentation.ts'
import * as disruptionLabels from '../app/services/disruption.ts'
import { disruptionMapFeatures } from '../app/services/disruptionMapFeatures.ts'
import { createMapPresentation } from '../app/services/mapLibrePresentation.ts'
import { createDisruptionMapPresentation, DISRUPTION_SOURCE_ID } from '../app/services/disruptionMapPresentation.ts'
import { createTransportNodePresentation, TRANSPORT_NODE_SOURCE_ID } from '../app/services/transportNodePresentation.ts'
import { resolveMapConfiguration } from '../app/services/mapConfiguration.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const synthetic = { documentId: 'fixture', title: 'Synthetic advisory', type: 'road_closure', description: 'Test only',
  severity: 'high', starts_at: '2026-01-01T00:00:00Z', disruption_status: 'active', data_mode: 'SIMULATED',
  verification_status: 'SIMULATED_DEMO', planning_enabled: false, effect: 'WARNING_ONLY', geometry_source: 'SIMULATED' }
const vehicle = mode => ({ documentId: `vehicle-${mode}`, vehicle_number: `${mode} fixture`, plate_number: 'TEST-ONLY',
  latitude: 14, longitude: 119, data_mode: mode, route: { route_name: 'Test route' },
  route_variant: { display_name: 'Exact test variant' }, direction: 'OUTBOUND', occupancy_level: 'UNKNOWN', recorded_at: '2026-01-01T00:00:00Z' })
const transform = code => stripTypeScriptTypes(code)
  .replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_, names, quote, name) => `const {${names.replace(/\s+as\s+/g, ': ')}} = require(${JSON.stringify(name)});`)
  .replace('export default', 'exports.default =').replace('export function render', 'function render')
function component(file, overrides = {}, imports = {}) {
  const { descriptor } = parse(read(file))
  const script = compileScript(descriptor, { id: file })
  const template = compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const sandbox = { ...Vue, exports: {}, definePageMeta() {}, useHead() {},
    useApi: () => ({ apiFetch: async () => ({ data: [] }) }), useToast: () => ({ add() {} }),
    useAuth: () => ({ isAdministrator: Vue.ref(false) }), useGeolocation: () => ({ location: Vue.ref(null) }),
    require(name) {
      if (name === 'vue') return Vue
      if (name.endsWith('/mapPresentation')) return markerData
      if (name.endsWith('/disruption')) return disruptionLabels
      if (name.endsWith('/disruptionMapFeatures')) return { disruptionMapFeatures }
      if (name === '~/utils/constants') return { PILOT_CORRIDOR: { name: 'Test corridor' } }
      if (imports[name]) return imports[name]
      throw Error(`Unmocked dependency ${name}`)
    }, ...overrides,
  }
  vm.runInNewContext(`${transform(script.content)}\n${transform(template.code)}\nexports.default.render = render`, sandbox)
  return sandbox.exports.default
}
const shell = { setup: (_, { slots }) => () => Vue.h('div', slots.default?.()) }
async function rendered(component, props = {}, slots = {}) {
  const maps = []
  const app = Vue.createSSRApp({ render: () => Vue.h(component, props, slots) })
  for (const name of ['UCard', 'UButton', 'UIcon', 'USelect', 'PamanaPageHeader', 'PamanaStatCard', 'PamanaInsightCard']) app.component(name, shell)
  for (const name of ['PamanaMapPanel', 'PamanaMapLibreMap', 'PamanaLeafletMap']) app.component(name, {
    inheritAttrs: false, setup: (_, { attrs, slots }) => () => { maps.push({ name, ...attrs }); return Vue.h('div', [slots.overlay?.(), slots.default?.()]) },
  })
  return { html: await renderToString(app), maps }
}

test('all remaining production consumers render MapLibre with preserved map dimensions and overlays', async () => {
  for (const [file, height, text] of [
    ['driver/demand-map.vue', '420px', 'AI-predicted demand'],
    ['lgu/index.vue', '160px', 'Command Center'],
    ['lgu/live-mobility.vue', '460px', 'Live API positions'],
    ['lgu/disruptions.vue', '340px', 'Record a structured disruption'],
  ]) {
    const result = await rendered(component(`app/pages/${file}`))
    assert.equal(result.maps.length, 1, file)
    assert.equal(result.maps[0].provider, 'maplibre', file)
    assert.equal(result.maps[0].height, height, file)
    if (file === 'lgu/index.vue') assert.equal(result.maps[0].compact, '')
    if (file !== 'lgu/index.vue') assert.ok(result.html.includes(text), file)
    if (file === 'driver/demand-map.vue') assert.match(result.html, /simulated demo data/)
  }
})

test('shared panel defaults to MapLibre; named overlays survive either provider and rollback remains available', async () => {
  const panel = component('app/components/PamanaMapPanel.vue')
  const fixture = vehicle('SIMULATED')
  const base = { height: '160px', compact: true, markers: [fixture], compatibilityMarkers: [], nodes: [],
    lines: [], transportNodes: [], vehicles: [], disruptions: [], routeGeometry: null, userLocation: null }
  // Explicit props here exercise both branches; component defaults are checked by the production SSR render below.
  for (const provider of ['maplibre', 'leaflet']) {
    const result = await rendered(panel, { ...base, provider }, { overlay: () => Vue.h('select', { 'aria-label': 'Existing filter' }, Vue.h('option', 'All routes')) })
    assert.match(result.html, /Existing filter/)
    assert.equal(result.maps[0].name, provider === 'maplibre' ? 'PamanaMapLibreMap' : 'PamanaLeafletMap')
    if (provider === 'maplibre') {
      assert.equal(result.maps[0].compact, true)
      assert.equal(result.maps[0].nodes[0].properties.dataMode, 'SIMULATED')
    } else assert.deepEqual(JSON.parse(JSON.stringify(result.maps[0].markers)), [fixture])
  }
  assert.equal((await rendered(panel, base)).maps[0].name, 'PamanaMapLibreMap')
  assert.ok(JSON.parse(read('package.json')).dependencies.leaflet)
  assert.match(read('app/components/PamanaLeafletMap.vue'), /leaflet\/dist\/leaflet.css/)
})

test('vehicle metadata preserves REAL/SIMULATED, exact variant, occupancy and position timestamp without coordinate guesses', () => {
  for (const mode of ['REAL', 'SIMULATED']) {
    const feature = markerData.legacyMarkerFeatures([vehicle(mode)])[0]
    assert.equal(feature.properties.semantic, 'vehicle')
    assert.equal(feature.properties.dataMode, mode)
    assert.ok(feature.properties.details.includes('Exact test variant'))
    assert.ok(feature.properties.details.includes('Occupancy: UNKNOWN'))
    assert.ok(feature.properties.details.some(text => text.includes('2026-01-01')))
  }
  assert.equal(markerData.legacyMarkerFeatures([{ ...vehicle('SIMULATED'), latitude: null, longitude: null }]).length, 0)
  assert.equal(markerData.legacyMarkerFeatures([{ documentId: 'legacy', title: 'Legacy advisory', latitude: 14, longitude: 119 }])[0].properties.label, 'Legacy advisory')
})

test('LGU live page retains authenticated read-only polling, latest coordinates, filters, visibility cancellation and cleanup', async () => {
  let mounted, unmount, tick, cleared = 0, refresh = 0
  const listeners = new Map(), calls = [], document = { visibilityState: 'visible',
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const page = component('app/pages/lgu/live-mobility.vue', {
    document, AbortController, onMounted: fn => { mounted = fn }, onUnmounted: fn => { unmount = fn },
    setInterval: (fn, duration) => { tick = fn; assert.equal(duration, 15000); return 1 }, clearInterval: () => { cleared++ },
    useApi: () => ({ apiFetch: async (endpoint, options) => {
      calls.push({ endpoint, options })
      return { data: [{ ...vehicle('SIMULATED'), longitude: 119 + refresh++ / 100 }] }
    } }),
  })
  const scope = Vue.effectScope()
  const setup = scope.run(() => page.setup({}, { expose() {} }))
  mounted(); await new Promise(resolve => setImmediate(resolve))
  const first = markerData.legacyMarkerFeatures(setup.rawVehicles.value)[0]
  setup.cooperative.value = 'All cooperatives'; setup.route.value = 'All routes'
  await tick(); await Vue.nextTick()
  const next = markerData.legacyMarkerFeatures(setup.rawVehicles.value)[0]
  assert.equal(next.id, first.id); assert.notDeepEqual(next.geometry.coordinates, first.geometry.coordinates)
  assert.equal(next.properties.dataMode, 'SIMULATED')
  assert.equal(setup.route.value, 'All routes')
  assert.ok(calls.every(call => call.endpoint === '/api/live-vehicles' && !call.options.method && !call.options.body))
  document.visibilityState = 'hidden'; listeners.get('visibilitychange')()
  assert.equal(calls.at(-1).options.signal.aborted, true)
  await tick(); assert.equal(calls.length, 2)
  unmount(); scope.stop(); assert.equal(cleared, 1); assert.equal(listeners.size, 0)
})

test('disruption overlays use supplied Point/line/area geometry, exclude missing or malformed coordinates and never infer target geometry', () => {
  const geometries = [
    { type: 'Point', coordinates: [119, 14] },
    { type: 'LineString', coordinates: [[119, 14], [119.01, 14]] },
    { type: 'MultiLineString', coordinates: [[[119, 14], [119.01, 14]]] },
    { type: 'Polygon', coordinates: [[[119, 14], [119.01, 14], [119.01, 14.01], [119, 14]]] },
    { type: 'MultiPolygon', coordinates: [[[[119, 14], [119.01, 14], [119.01, 14.01], [119, 14]]]] },
  ]
  for (const geometry of geometries) {
    const record = { ...synthetic, geometry_geojson: geometry }
    const original = JSON.stringify(record)
    const feature = disruptionMapFeatures([record])[0]
    assert.deepEqual(feature.geometry, geometry)
    assert.equal(feature.properties.dataMode, 'SIMULATED')
    assert.equal(feature.properties.planningEnabled, false)
    assert.ok(feature.properties.details.includes('Status: active'))
    assert.equal(JSON.stringify(record), original)
  }
  const unresolved = { ...synthetic, latitude: null, longitude: null, affected_transport_node: { name: 'Unresolved research target' } }
  assert.deepEqual(disruptionMapFeatures([unresolved]), [])
  for (const geometry of [{ type: 'Point', coordinates: [null, null] }, { type: 'LineString', coordinates: [[119, 14]] }, { type: 'Polygon', coordinates: [[[119, 14], [119.01, 14], [119.01, 14.01]]] }, { type: 'constructor', coordinates: [119, 14] }]) {
    assert.deepEqual(disruptionMapFeatures([{ ...synthetic, geometry_geojson: geometry, latitude: 14, longitude: 119 }]), [])
  }
  assert.deepEqual(disruptionMapFeatures([{ ...synthetic, latitude: '14', longitude: '119' }])[0].geometry.coordinates, [119, 14])
})

test('vehicle/disruption refreshes use setData, preserve camera, reuse layers and allow explicit Fit features', () => {
  const sources = new Map(), layers = new Map(), images = new Set(), fits = []
  let updates = 0
  const map = { isStyleLoaded: () => false, getStyle: () => ({ version: 8 }), getSource: id => sources.get(id),
    addSource: (id, source) => sources.set(id, { data: source.data, setData(data) { this.data = data; updates++ } }),
    getLayer: id => layers.get(id), addLayer: layer => layers.set(layer.id, layer),
    hasImage: id => images.has(id), addImage: id => images.add(id), setFilter() {}, setPaintProperty() {},
    fitBounds: bounds => fits.push(bounds),
  }
  const presentation = createMapPresentation(map, () => ({}))
  const infrastructure = createTransportNodePresentation(map, () => ({}))
  const disruptions = createDisruptionMapPresentation(map)
  const geometry = { type: 'Polygon', coordinates: [[[119, 14], [119.02, 14], [119.02, 14.01], [119, 14]]] }
  const overlay = disruptionMapFeatures([{ ...synthetic, geometry_geojson: geometry }])
  presentation.update(markerData.legacyMarkerFeatures([vehicle('SIMULATED')]), null)
  infrastructure.update([])
  disruptions.update(overlay)
  assert.equal(sources.size, 3, 'all sources must initialize even while another source is loading')
  assert.ok(sources.has(TRANSPORT_NODE_SOURCE_ID))
  presentation.fitOnIntent(null, true, overlay)
  assert.deepEqual(fits[0], [[119, 14], [119.02, 14.01]])
  const layerCount = layers.size
  for (let index = 0; index < 10; index++) {
    presentation.update(markerData.legacyMarkerFeatures([{ ...vehicle('SIMULATED'), longitude: 119.1 + index / 100 }]), null)
    disruptions.update(overlay)
  }
  assert.equal(fits.length, 1)
  assert.equal(layers.size, layerCount)
  assert.equal(updates, 20)
  assert.equal(sources.get(DISRUPTION_SOURCE_ID).data.features[0].properties.dataMode, 'SIMULATED')
  presentation.fit(overlay, true)
  assert.equal(fits.length, 2)
  assert.deepEqual(fits[1], [[119, 14], [119.19, 14.01]])
})

test('actual MapLibre lifecycle preserves polling camera, disruption selection, resize and disposal; failure permits explicit rollback', async () => {
  let mounted, unmount, observer, removed = 0, resized = 0, instances = 0, fits = 0, recentered = 0, disconnected = 0
  const events = new Map(), updates = [], emitted = []
  class FakeMap {
    constructor() { instances++ }
    addControl() {} getCanvas() { return { setAttribute() {} } }
    on(name, fn) { events.set(name, fn) } off(name) { events.delete(name) }
    getLayer() { return true } queryRenderedFeatures() { return [{ properties: { featureId: 'disruption-fixture' } }] }
    remove() { removed++ } resize() { resized++ } getZoom() { return 12 } easeTo() { recentered++ }
  }
  const map = component('app/components/PamanaMapLibreMap.vue', {
    onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
    useRuntimeConfig: () => ({ public: { geoapifyApiKey: 'synthetic-test-only' } }),
    useMapLibre: () => ({ load: async () => ({ Map: FakeMap, NavigationControl: class {}, AttributionControl: class {} }), reportRenderFailure() {} }),
    ResizeObserver: class { constructor(fn) { observer = fn } observe() {} disconnect() { disconnected++ } }, setTimeout, clearTimeout,
  }, {
    '../services/mapConfiguration': { resolveMapConfiguration },
    '../services/mapLibrePresentation': { LAYER_IDS: [], createMapPresentation: () => ({ update() {}, select() {}, fitOnIntent() { fits++ }, fit() { fits++ } }) },
    '../services/transportNodePresentation': { TRANSPORT_NODE_LAYER_IDS: [], createTransportNodePresentation: () => ({ update() {}, select() {} }) },
    '../services/disruptionMapPresentation': { DISRUPTION_LAYER_IDS: ['pamana-disruption-fill'], createDisruptionMapPresentation: () => ({ update: features => updates.push(features) }) },
  })
  const scope = Vue.effectScope()
  const props = Vue.reactive({ height: '340px', nodes: [], transportNodes: [], lines: [], vehicles: [], disruptions: [], zoom: 11, fitToFeatures: true, fitKey: null, selectedFeatureId: null })
  const setup = scope.run(() => map.setup(props, { emit: (...args) => emitted.push(args), expose() {} }))
  assert.equal(instances, 0, 'SSR does not instantiate a renderer')
  setup.container.value = {}; await mounted(); events.get('load')()
  assert.equal(setup.status.value, 'READY')
  props.disruptions = disruptionMapFeatures([{ ...synthetic, geometry_geojson: { type: 'Point', coordinates: [119, 14] } }])
  props.vehicles = markerData.legacyMarkerFeatures([vehicle('SIMULATED')]); props.userLocation = { lat: 14, lng: 119 }
  await Vue.nextTick(); observer(); events.get('click')({ point: {} })
  assert.equal(fits, 1); assert.equal(instances, 1); assert.equal(recentered, 0); assert.equal(resized, 1)
  assert.equal(updates.at(-1)[0].properties.featureId, 'disruption-fixture')
  assert.ok(emitted.some(([name, id]) => name === 'feature-selected' && id === 'disruption-fixture'))
  setup.fitAll(); setup.recenter(); assert.equal(fits, 2); assert.equal(recentered, 1)
  events.get('error')({ error: new Error('sensitive-provider-url') })
  assert.equal(setup.status.value, 'TILE_ERROR'); assert.doesNotMatch(JSON.stringify(emitted), /sensitive-provider/)
  unmount(); scope.stop(); assert.equal(removed, 1); assert.equal(disconnected, 1); assert.equal(events.size, 0)
  const panel = component('app/components/PamanaMapPanel.vue')
  const panelScope = Vue.effectScope()
  const panelSetup = panelScope.run(() => panel.setup(Vue.reactive({ provider: 'maplibre', markers: [], nodes: [], lines: [], userLocation: null }), { emit() {}, expose() {} }))
  panelSetup.mapFailed.value = true; assert.equal(panelSetup.activeProvider.value, 'maplibre', 'errors do not silently switch provider')
  panelSetup.compatibilityMode.value = true; assert.equal(panelSetup.activeProvider.value, 'leaflet')
  panelScope.stop()
})
