import assert from 'node:assert/strict'
import test from 'node:test'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { markerOffsets, MAP_TOKENS } from '../app/services/mapPresentation.ts'
import { presentationLayers, createMapPresentation, SOURCE_ID } from '../app/services/mapLibrePresentation.ts'
import { transportNodeLayers, createTransportNodePresentation, TRANSPORT_NODE_SOURCE_ID } from '../app/services/transportNodePresentation.ts'

const point = (id, semantic, coordinates = [119, 14]) => ({ type: 'Feature', id,
  geometry: { type: 'Point', coordinates }, properties: { featureId: id, semantic, label: id, source: 'PAMANA' } })

test('colocated places, transport nodes and GPS retain geometry and have separated, stable badge offsets', () => {
  for (const count of [1, 2, 3, 8, 30]) {
    const points = Array.from({ length: count }, (_, i) => point(`point-${i}`, i % 2 ? 'dropoff' : 'destination-location'))
    const original = JSON.stringify(points)
    const offsets = markerOffsets(points)
    const reversed = markerOffsets([...points].reverse())
    assert.equal(JSON.stringify(points), original)
    for (const [index, p] of points.entries()) {
      assert.deepEqual(offsets.get(p), reversed.get(p))
      for (const other of points.slice(index + 1)) {
        const a = offsets.get(p), b = offsets.get(other)
        assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= 52, '48px badges plus collision padding must fit')
      }
    }
    if (count === 1) assert.deepEqual(offsets.get(points[0]), [0, 0])
  }
  const separate = point('other', 'pickup', [119.01, 14])
  assert.deepEqual(markerOffsets([point('origin', 'origin-location'), separate]).get(separate), [0, 0])
  assert.notEqual(MAP_TOKENS.dropoff.glyph, MAP_TOKENS['destination-location'].glyph)
})

test('complete badges and selection share valid collision-managed layout across map sources', () => {
  const layers = [...presentationLayers(), ...transportNodeLayers()]
  assert.deepEqual(validateStyleMin({ version: 8, sources: {
    [SOURCE_ID]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    [TRANSPORT_NODE_SOURCE_ID]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  }, layers }), [])
  for (const layer of layers.filter(l => l.type === 'symbol')) {
    assert.equal(layer.layout['icon-allow-overlap'], false)
    assert.equal(layer.layout['icon-ignore-placement'], false)
    assert.equal(layer.layout['icon-size'], 1)
    assert.equal(layer.layout['icon-padding'], 2)
    assert.ok(layer.layout['icon-offset'])
  }
  assert.ok(layers.filter(l => l.type === 'circle').every(l => l.paint['circle-radius'] === 3), 'no independent badge or selection circles can overlap glyphs')
})

test('selected badge replaces regular badge, takes priority and survives refresh/style reload', () => {
  const sources = new Map(), layers = new Map(), images = new Set(), moves = []
  const map = { getStyle: () => ({}), getSource: id => sources.get(id),
    addSource: (id, source) => sources.set(id, { ...source, setData(data) { this.data = data } }),
    getLayer: id => layers.get(id), addLayer: l => layers.set(l.id, l),
    hasImage: id => images.has(id), addImage: id => images.add(id),
    setFilter: (id, filter) => { layers.get(id).filter = filter }, setPaintProperty() {}, moveLayer: id => moves.push(id),
  }
  const general = createMapPresentation(map, () => ({}))
  const transport = createTransportNodePresentation(map, () => ({}))
  const origin = point('origin', 'origin-location'), pickup = point('pickup', 'pickup')
  general.update([origin], null); transport.update([pickup])
  general.select('origin')
  assert.equal(moves.at(-1), 'pamana-selection')
  assert.deepEqual(layers.get('pamana-icons').filter.at(-1), ['!=', ['get', 'featureId'], 'origin'])
  transport.select('pickup')
  assert.equal(moves.at(-1), 'pamana-transport-node-selection')
  assert.deepEqual(layers.get('pamana-transport-node-icons').filter, ['!=', ['get', 'featureId'], 'pickup'])
  sources.clear(); layers.clear(); images.clear()
  general.sync(); transport.sync()
  assert.ok(images.has('pamana-pickup-selected'))
  assert.ok(images.has('pamana-origin-location-selected'))
  assert.deepEqual(layers.get('pamana-selection').filter.at(-1), ['==', ['get', 'featureId'], 'origin'])
  assert.deepEqual(layers.get('pamana-transport-node-selection').filter, ['==', ['get', 'featureId'], 'pickup'])
  general.select(null); transport.select(null)
  assert.deepEqual(layers.get('pamana-icons').filter.at(-1), ['!=', ['get', 'featureId'], ''])
})
