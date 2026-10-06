import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validTripPlanResponse } from '../app/services/tripPlanContract.ts'
import { journeyMapPresentation, formatFare } from '../app/services/tripPlanPresentation.ts'
import { renderableFeatures } from '../app/services/mapPresentation.ts'
import { createMapPresentation, SOURCE_ID } from '../app/services/mapLibrePresentation.ts'
import { normalizePassengerTransportNodes, transportNodeFeatureCollection } from '../app/services/transportNodes.ts'
const payloads = JSON.parse(fs.readFileSync(new URL('./fixtures/passenger-route-options.json', import.meta.url), 'utf8'))
const expectations = JSON.parse(fs.readFileSync(new URL('./fixtures/pilot-map-expectations.json', import.meta.url), 'utf8'))
const expectedGeometry = code => expectations.geometry[code]

test('actual Passenger API responses accept approved geometry, known integer fares and complete totals', () => {
  assert.equal(payloads.results.length, 8)
  for (const { response, category } of payloads.results) {
    assert.equal(validTripPlanResponse(response), true)
    for (const journey of response.journeys) {
      const legs = journey.legs.filter(l => l.type === 'TRANSIT')
      assert.equal(journey.transferCount, legs.length - 1)
      assert.equal(journey.fareSummary.totalStatus, 'KNOWN')
      assert.equal(journey.fareSummary.totalFare, legs.reduce((sum, l) => sum + l.fare.payableFare, 0))
      for (const leg of legs) {
        assert.equal(leg.fare.status, 'KNOWN'); assert.ok(Number.isInteger(leg.fare.payableFare))
        assert.equal(leg.roadDistanceSource, 'STORED_ROUTE_STOP_DISTANCE')
        assert.deepEqual(leg.geometry, expectedGeometry(leg.variant.code))
        assert.ok(!formatFare(leg.fare.payableFare).includes('.'))
        if (leg.transportMode === 'TRICYCLE') { assert.equal(leg.fare.payableFare, 100); assert.equal(leg.fare.sourceType, 'DEMO_ESTIMATE') }
        else if (category === 'STUDENT') assert.equal(leg.fare.payableFare, leg.fare.discountedFare)
      }
    }
  }
})
test('existing MapLibre adapter consumes all approved road coordinates and preserves current location/camera', () => {
  let fits = 0, currentData
  const sources = new Map(), layers = new Map(), images = new Set()
  const map = {
    getStyle: () => ({ version: 8 }), hasImage: id => images.has(id), addImage: id => images.add(id),
    getSource: id => sources.get(id), addSource: (id, source) => { currentData = source.data; sources.set(id, { setData: data => { currentData = data } }) },
    getLayer: id => layers.get(id), addLayer: layer => layers.set(layer.id, layer),
    setFilter() {}, setPaintProperty() {}, fitBounds() { fits++ },
  }
  const renderer = createMapPresentation(map, () => ({}))
  for (const { response } of payloads.results) for (const journey of response.journeys) {
    const presentation = journeyMapPresentation(journey, response.request.origin, response.request.destination)
    const transitLines = presentation.lines.filter(line => line.properties.semantic === 'transport-route')
    const expected = journey.legs.filter(l => l.type === 'TRANSIT').flatMap(l => l.geometry.type === 'MultiLineString' ? l.geometry.coordinates : [l.geometry.coordinates])
    assert.deepEqual(transitLines.map(l => l.geometry.coordinates), expected)
    const location = { lat: response.request.origin.lat, lng: response.request.origin.lng }
    const features = renderableFeatures(presentation.nodes, presentation.lines, [], location)
    assert.ok(features.some(f => f.properties.source === 'DEVICE' && f.properties.semantic === 'passenger'))
    renderer.update(features, null)
    const intent = `${response.request.origin.lat}>${response.request.destination.lat}:${journey.id}`
    renderer.fitOnIntent(intent, true); const before = fits
    renderer.update(features, null); renderer.fitOnIntent(intent, true)
    assert.equal(fits, before, 'Geometry/source refresh does not reset the camera')
    assert.ok(sources.has(SOURCE_ID)); assert.ok(currentData.features.some(f => f.properties.semantic === 'transport-route'))
  }
})
test('existing transport node adapter renders real pilot endpoints and keeps simulated nodes excluded', () => {
  const raw = expectations.nodes
  const { nodes } = normalizePassengerTransportNodes(raw)
  assert.equal(nodes.length, 4)
  const collection = transportNodeFeatureCollection(nodes)
  assert.equal(collection.features.length, 4)
  assert.ok(collection.features.every(f => f.properties.dataMode === 'REAL'))
  assert.deepEqual(normalizePassengerTransportNodes(raw.map(n => ({ ...n, data_mode: 'SIMULATED' }))).nodes, [])
})
