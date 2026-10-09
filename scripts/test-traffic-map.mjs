import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createTrafficPresentation, trafficProtocol, TRAFFIC_SOURCE_ID, TRAFFIC_LAYER_ID } from '../app/services/trafficMapPresentation.ts'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

function fakeMap() {
  const sources = new Map(), layers = new Map([['pamana-route-halo', {}]]), calls = []
  return { calls, sources, layers,
    getSource: id => sources.get(id), getLayer: id => layers.get(id),
    addSource(id, value) { sources.set(id, { ...value, setTiles(tiles) { calls.push(['setTiles', tiles]) } }); calls.push(['addSource', id, value]) },
    addLayer(layer, before) { layers.set(layer.id, layer); calls.push(['addLayer', layer, before]) },
    setLayoutProperty(...args) { calls.push(['layout', ...args]) },
    fitBounds() { throw new Error('Traffic must not move camera') }, easeTo() { throw new Error('Traffic must not move camera') },
  }
}

test('traffic is opt-in, beneath selected journey, refreshes independently and survives style recreation', () => {
  const map = fakeMap(), traffic = createTrafficPresentation(map, 'pamana-traffic-test')
  traffic.update(false); assert.equal(map.calls.length, 0)
  traffic.update(true)
  assert.equal(map.sources.get(TRAFFIC_SOURCE_ID).tileSize, 256)
  assert.equal(map.layers.get(TRAFFIC_LAYER_ID).type, 'raster')
  assert.equal(map.calls.find(call => call[0] === 'addLayer')[2], 'pamana-route-halo')
  assert.match(map.sources.get(TRAFFIC_SOURCE_ID).attribution, /TomTom/)
  traffic.update(true, true); assert.equal(map.calls.filter(call => call[0] === 'setTiles').length, 1)
  traffic.update(false); assert.deepEqual(map.calls.at(-1), ['layout', TRAFFIC_LAYER_ID, 'visibility', 'none'])
  map.sources.clear(); map.layers.delete(TRAFFIC_LAYER_ID); traffic.update(true)
  assert.ok(map.sources.has(TRAFFIC_SOURCE_ID)); assert.ok(map.layers.has('pamana-route-halo'))
});

test('custom raster protocol uses authenticated API fetch and cancellation without exposing the provider key', async () => {
  const data = new ArrayBuffer(8); let success = 0, failed = 0, requested
  const protocol = trafficProtocol(async (path, options) => { requested = { path, options }; return data }, () => success++, () => failed++)
  const controller = new AbortController()
  const result = await protocol({ url: 'pamana-traffic-test://tiles/14/13685/7495?refresh=1' }, controller)
  assert.equal(result.data, data); assert.equal(result.cacheControl, 'no-store')
  assert.equal(requested.path, '/api/pamana-ai/traffic-tiles/14/13685/7495')
  assert.equal(requested.options.signal, controller.signal); assert.equal(requested.options.responseType, 'arrayBuffer')
  assert.equal(success, 1); assert.equal(failed, 0)
  controller.abort(); await protocol({ url: 'pamana-traffic-test://tiles/14/13685/7495' }, controller)
  assert.equal(success, 1)
  await assert.rejects(protocol({ url: 'https://arbitrary-host/key' }, new AbortController()), /Traffic unavailable/)
});

test('traffic failure remains sanitized and does not affect basemap/route state', async () => {
  let failed = 0
  const protocol = trafficProtocol(async () => { throw new Error('private-key-url') }, () => {}, () => failed++)
  await assert.rejects(protocol({ url: 'pamana-traffic-test://tiles/14/13685/7495' }, new AbortController()), /Traffic unavailable/)
  assert.equal(failed, 1)
  const source = fs.readFileSync(new URL('../app/components/PamanaMapLibreMap.vue', import.meta.url), 'utf8')
  const { descriptor, errors } = parse(source); assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'traffic-map' })
  const template = compileTemplate({ id: 'traffic-map', filename: 'PamanaMapLibreMap.vue', source: descriptor.template.content,
    compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  assert.match(source, /event.sourceId === TRAFFIC_SOURCE_ID/)
  assert.match(source, /lib.removeProtocol\(trafficProtocolName\)/)
  assert.doesNotMatch(source, /TOMTOM_API_KEY|api\.tomtom\.com/)
})
