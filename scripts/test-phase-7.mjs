import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { resolveMapConfiguration } from '../app/services/mapConfiguration.ts'
import * as presentationData from '../app/services/mapPresentation.ts'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { legacyMarkerFeatures, suppliedLine, renderableFeatures, markerSemantic, createFitPolicy, MAP_TOKENS } from '../app/services/mapPresentation.ts'
import { createMapPresentation, presentationLayers, SOURCE_ID } from '../app/services/mapLibrePresentation.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
// Synthetic test coordinates only; never stored or labeled as San Juan transport facts.
const point = (id, semantic = 'pickup') => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [2, 1] }, properties: { semantic, label: 'Synthetic unit fixture', source: 'PAMANA', featureId: id } })
test('null research coordinates excluded; categories mapped without location inference', () => {
  assert.deepEqual(legacyMarkerFeatures([{ node_code: 'RCH-PSU-MEXICO-FRONT', latitude: null, longitude: null }]), [])
  for (const value of [undefined, '', ' ', NaN, false]) assert.deepEqual(legacyMarkerFeatures([{ latitude: value, longitude: value }]), [])
  assert.deepEqual(legacyMarkerFeatures([{ latitude: '1', longitude: '2', node_type: 'TRANSFER_POINT' }])[0].geometry.coordinates, [2, 1])
  for (const [type, expected] of Object.entries({ PICKUP: 'pickup', DESIGNATED_STOP: 'stop', STOP: 'stop', DROP_OFF: 'dropoff', TRANSFER_POINT: 'transfer', TERMINAL: 'terminal', DESTINATION: 'destination', ESSENTIAL_SERVICE: 'essential-service' })) assert.equal(markerSemantic(type), expected)
  assert.equal(MAP_TOKENS.passenger.color, '#2563eb')
  assert.notEqual(MAP_TOKENS.terminal.glyph, MAP_TOKENS.vehicle.glyph)
})
test('GeoJSON contract renders supplied LineStrings only, never stop-order geometry', () => {
  assert.deepEqual(suppliedLine(null, 'Missing geometry'), [])
  assert.deepEqual(suppliedLine({ coordinates: [[null, null], [2, 1]] }, 'Invalid'), [])
  const lines = suppliedLine({ coordinates: [[2, 1], [3, 2]] }, 'Synthetic test line')
  assert.equal(lines[0].geometry.type, 'LineString')
  const features = renderableFeatures([point('node')], lines, [point('vehicle', 'vehicle')], { lat: 1, lng: 2 })
  assert.equal(features.length, 4)
  assert.equal(features.at(-1).properties.source, 'DEVICE')
  assert.deepEqual(renderableFeatures([{ ...point('invalid'), geometry: { type: 'Point', coordinates: [null, null] } }], [], [], null), [])
  const layers = presentationLayers()
  assert.ok(layers.some(layer => layer.type === 'line' && layer.paint['line-dasharray']))
  assert.ok(layers.some(layer => layer.type === 'symbol'))
})
test('source updates and style reloads reuse layers; only explicit camera intent fits', () => {
  const sources = new Map(), layers = new Map(), images = new Set()
  let dataUpdates = 0, fits = 0
  const map = {
    isStyleLoaded: () => true,
    hasImage: id => images.has(id), addImage: id => images.add(id),
    getSource: id => sources.get(id), addSource: id => sources.set(id, { setData: () => dataUpdates++ }),
    getLayer: id => layers.get(id), addLayer: layer => layers.set(layer.id, layer),
    setFilter() {}, setPaintProperty() {}, fitBounds() { fits++ },
  }
  const renderer = createMapPresentation(map, () => ({}))
  renderer.update([point('node')], null)
  renderer.fitOnIntent('journey-a', true)
  assert.equal(fits, 1)
  for (let i = 0; i < 10; i++) {
    renderer.update([point('node'), point('vehicle', 'vehicle'), point('user', 'passenger')], null)
    renderer.fitOnIntent('journey-a', true)
  }
  assert.equal(fits, 1, 'Polling must not reset camera')
  assert.equal(sources.size, 1); assert.ok(sources.has(SOURCE_ID)); assert.equal(layers.size, 6)
  assert.equal(dataUpdates, 10)
  renderer.fitOnIntent('journey-b', true); assert.equal(fits, 2)
  sources.clear(); layers.clear(); images.clear(); renderer.sync()
  assert.equal(layers.size, 6); assert.equal(fits, 2, 'Style reload does not fit again')
  const policy = createFitPolicy()
  assert.equal(policy.shouldFit('a', false), false)
  assert.equal(policy.shouldFit('a', true), false)
})
test('component compiles with client lifecycle, redacted states, cleanup and responsive controls', () => {
  const source = read('app/components/PamanaMapLibreMap.vue')
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'phase7-test' })
  const template = compileTemplate({ id: 'phase7-test', source: descriptor.template.content, filename: 'PamanaMapLibreMap.vue', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  assert.match(source, /import type .*from 'maplibre-gl'/)
  assert.match(source, /onMounted\(initialize\)/)
  assert.match(source, /await loader.load\(\)/)
  assert.match(read('app/services/mapLibreLoader.ts'), /maplibre-gl-worker\.mjs\?worker&url/)
  assert.match(read('app/services/mapLibreLoader.ts'), /loaded.setWorkerUrl\(worker.default\)/)
  for (const state of ['INITIALIZING', 'READY', 'MISSING_CONFIG', 'TILE_ERROR', 'INITIALIZATION_ERROR']) assert.ok(source.includes(state))
  for (const cleanup of ['onBeforeUnmount', 'resizeObserver?.disconnect()', 'map?.remove()', "instance.off('load'", "instance.off('style.load'", "instance.off('error'", "instance.off('click'"]) assert.ok(source.includes(cleanup))
  assert.match(source, /ResizeObserver/)
  assert.match(source, /aria-label="Recenter on your location"/)
  assert.match(source, /aria-label="Select a map feature"/)
  assert.doesNotMatch(source, /navigator.geolocation|useGeoapify|routeGeography|console\.|new lib.GeolocateControl/)
  const pollingWatch = source.match(/watch\(features,[^\n]+/)[0]
  assert.doesNotMatch(pollingWatch, /fit|easeTo|initialize|jumpTo/)
  const panel = read('app/components/PamanaMapPanel.vue')
  assert.match(panel, /suppliedLine\(props.routeGeometry/)
  assert.doesNotMatch(panel, /suppliedLine\(props.routePoints/)
  assert.match(panel, /provider: 'leaflet'/)
  for (const page of ['trip-planner', 'map']) assert.match(read(`app/pages/passenger/${page}.vue`), /provider="maplibre"/)
  const preview = read('app/pages/dev/map-preview.vue')
  assert.match(preview, /Refresh live vehicles/)
  assert.match(preview, /:vehicles="vehicles"/)
  assert.ok(JSON.parse(read('package.json')).dependencies.leaflet)
})

test('actual SFC setup is SSR safe, handles failures, late imports and removes listeners/map on unmount', async () => {
  const { descriptor } = parse(read('app/components/PamanaMapLibreMap.vue'))
  const compiled = stripTypeScriptTypes(compileScript(descriptor, { id: 'lifecycle' }).content)
    .replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_match, names, _quote, source) => `const {${names.replace(/\s+as\s+/g, ': ')}} = require(${JSON.stringify(source)});`)
    .replace('export default', 'exports.default =')
  async function harness({ configured = true, failLoad = false, deferred = false, stalled = false, failConstructor = false, failRender = false } = {}) {
    let mounted, unmount, resolveImport, instances = 0, removed = 0, disconnected = 0
    const events = new Map(), emitted = [], fitTokens = []
    const timers = new Set()
    class FakeMap {
      constructor() { if (failConstructor) throw new Error('sensitive constructor URL'); instances++ }
      addControl() {} getCanvas() { return { setAttribute() {} } }
      on(name, handler) { events.set(name, handler) } off(name) { events.delete(name) }
      remove() { removed++ } resize() {} getZoom() { return 11 } easeTo() {}
      isStyleLoaded() { return true } areTilesLoaded() { return true }
    }
    const module = { Map: FakeMap, NavigationControl: class {}, AttributionControl: class {} }
    const context = {
      exports: {}, setTimeout: fn => { timers.add(fn); return fn }, clearTimeout: fn => timers.delete(fn),
      require(name) {
        if (name === 'vue') return Vue
        if (name.endsWith('/mapConfiguration')) return { resolveMapConfiguration }
        if (name.endsWith('/mapPresentation')) return presentationData
        if (name.endsWith('/mapLibrePresentation')) return { LAYER_IDS: [], createMapPresentation: () => ({ update() { if (failRender) throw new Error('private-render-error') }, fitOnIntent: token => fitTokens.push(token) }) }
        throw Error(`Unexpected import: ${name}`)
      },
      ref: Vue.ref, computed: Vue.computed, watch: Vue.watch,
      onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
      useRuntimeConfig: () => ({ public: configured ? { geoapifyApiKey: 'unit-test-only-key' } : {} }),
      useMapLibre: () => ({ reportRenderFailure() {}, load: () => deferred || stalled ? new Promise(resolve => { resolveImport = resolve }) : Promise.resolve(failLoad ? null : module) }),
      ResizeObserver: class { observe() {} disconnect() { disconnected++ } },
    }
    vm.runInNewContext(compiled, context)
    const scope = Vue.effectScope()
    const props = Vue.reactive({ height: '420px', zoom: 11, userLocation: null, nodes: [], lines: [], vehicles: [], selectedFeatureId: null, fitToFeatures: true, fitKey: null })
    const setup = scope.run(() => context.exports.default.setup(props, { emit: (...args) => emitted.push(args), expose() {} }))
    assert.equal(instances, 0, 'SSR setup must not initialize map')
    setup.container.value = {}
    const pending = mounted()
    if (deferred) { unmount(); resolveImport(module) }
    if (stalled) {
      for (const timer of [...timers]) timer()
      assert.equal(setup.status.value, 'INITIALIZATION_ERROR')
      resolveImport(module)
    }
    await pending
    return { setup, props, events, emitted, fitTokens, counts: () => ({ instances, removed, disconnected }), close() { unmount(); scope.stop() } }
  }
  const missing = await harness({ configured: false })
  assert.equal(missing.setup.status.value, 'MISSING_CONFIG'); missing.close()
  for (const options of [{ failLoad: true }, { failConstructor: true }]) {
    const failed = await harness(options)
    assert.equal(failed.setup.status.value, 'INITIALIZATION_ERROR'); failed.close()
  }
  const late = await harness({ deferred: true })
  assert.equal(late.counts().instances, 0); late.close()
  const stalled = await harness({ stalled: true })
  assert.equal(stalled.counts().instances, 0, 'Expired imports must not resurrect a failed map'); stalled.close()
  for (const event of ['load', 'style.load']) {
    const failed = await harness({ failRender: true })
    failed.events.get(event)()
    assert.equal(failed.setup.status.value, 'INITIALIZATION_ERROR', 'Render exceptions must not leave a permanent loading overlay')
    assert.equal(JSON.stringify(failed.emitted).includes('private-render-error'), false)
    failed.close()
  }
  const live = await harness()
  assert.equal(live.setup.status.value, 'INITIALIZING')
  live.events.get('load')()
  assert.equal(live.setup.status.value, 'READY')
  assert.deepEqual(live.fitTokens, [null])
  live.props.userLocation = { lat: 1, lng: 2 }; await Vue.nextTick()
  live.props.vehicles = [point('moving', 'vehicle')]; await Vue.nextTick()
  assert.deepEqual(live.fitTokens, [null], 'GPS/vehicle updates must not fit camera')
  live.props.fitKey = 'explicit-journey'; await Vue.nextTick()
  assert.deepEqual(live.fitTokens, [null, 'explicit-journey'])
  live.events.get('error')({ error: new Error('key-bearing-provider-url') })
  assert.equal(live.setup.status.value, 'TILE_ERROR')
  assert.equal(live.setup.hasLoaded.value, true, 'A tile failure must not hide a rendered map')
  assert.equal(JSON.stringify(live.emitted).includes('key-bearing'), false)
  live.events.get('idle')()
  assert.equal(live.setup.status.value, 'READY', 'Recovered tiles clear the error without rebuilding')
  assert.deepEqual(live.fitTokens, [null, 'explicit-journey'], 'Recovery must preserve the camera')
  live.close()
  assert.deepEqual(live.counts(), { instances: 1, removed: 1, disconnected: 1 })
  assert.equal(live.events.size, 0)
})
