import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createApproximateRoadPathResolver } from '../app/services/approximateRoadPath.ts'
import { presentationLayers } from '../app/services/mapLibrePresentation.ts'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const node = (nodeCode, lat, lng) => ({ nodeId: `id-${nodeCode}`, nodeCode, name: nodeCode, lat, lng })
const pairs = [
  ['PSU', 'SM'], ['PSU', 'BAYAN'], ['BAYAN', 'SM'], ['ROB', 'PSU'],
]
const coordinates = {
  PSU: node('PSU', 15.1, 120.7), SM: node('SM', 15.05, 120.69),
  BAYAN: node('BAYAN', 15.07, 120.72), ROB: node('ROB', 15.049, 120.688),
}
const info = {
  fare: {}, service: {}, availability: {}, transportMode: 'PUJ_TRADITIONAL', direction: 'OUTBOUND',
  operatingStatus: 'ACTIVE', intermediateNodes: [], signboard: null, segmentDistanceMeters: null, durationSeconds: null,
}
const journey = {
  id: 'pilot-presentation-fixture', transferCount: 0, modes: [], warnings: [], fareSummary: {}, availabilitySummary: {}, durationSummary: {}, dataQuality: {},
  legs: pairs.map(([from, to], index) => ({ ...info, sequence: index + 1, type: 'TRANSIT', route: { id: `route-${index}`, code: `ROUTE-${index}` }, variant: { id: `variant-${index}`, code: `VARIANT-${index}` }, boardAt: coordinates[from], alightAt: coordinates[to], geometry: null })),
}

test('four pilot endpoint pairs resolve to separately classified cached road paths', async () => {
  let calls = 0
  const resolver = createApproximateRoadPathResolver(async (points, mode) => {
    calls++
    assert.equal(mode, 'drive')
    return { ok: true, data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [points.map(point => [point.longitude, point.latitude])] } }] } }
  })
  const first = await resolver.resolveJourney(journey)
  assert.equal(first.length, 4)
  assert.ok(first.every(line => line.properties.geometryClassification === 'APPROXIMATE_ROAD_PATH'))
  assert.ok(first.every(line => line.properties.semantic === 'approximate-road-path' && line.properties.source === 'GEOAPIFY'))
  await resolver.resolveJourney(journey)
  assert.equal(calls, 4, 'second presentation pass must use the in-memory cache')
})

test('verified transit geometry stays authoritative and is never replaced', async () => {
  let calls = 0
  const verified = structuredClone(journey)
  verified.legs = [{ ...verified.legs[0], geometry: { type: 'LineString', coordinates: [[120.7, 15.1], [120.69, 15.05]] } }]
  const resolver = createApproximateRoadPathResolver(async () => { calls++; throw new Error('must not call provider') })
  assert.deepEqual(await resolver.resolveJourney(verified), [])
  assert.equal(calls, 0)
  assert.equal(verified.legs[0].geometry.type, 'LineString')
})

test('provider failure produces no fake straight line and does not throw', async () => {
  const resolver = createApproximateRoadPathResolver(async () => ({ ok: false, error: 'NETWORK_ERROR' }))
  assert.deepEqual(await resolver.resolveJourney({ ...journey, legs: [journey.legs[0]] }), [])
})

test('walking, approximate and verified transit styles remain distinct', () => {
  const layers = presentationLayers()
  const walk = layers.find(layer => layer.id === 'pamana-walking')
  const approximate = layers.find(layer => layer.id === 'pamana-approximate-road-path')
  const verified = layers.find(layer => layer.id === 'pamana-route')
  assert.deepEqual(walk.paint['line-dasharray'], [2, 2])
  assert.equal(approximate.paint['line-dasharray'], undefined)
  assert.equal(verified.paint['line-dasharray'], undefined)
  assert.ok(verified.paint['line-width'] > approximate.paint['line-width'])
})

test('approximate paths stay outside planner facts and update MapLibre without recentering', () => {
  const page = read('app/pages/passenger/trip-planner.vue')
  const planner = read('app/composables/useTripPlan.ts')
  const map = read('app/components/PamanaMapLibreMap.vue')
  assert.match(page, /mapLines/)
  assert.match(map, /Approximate route path — actual public transport path may vary\./)
  assert.doesNotMatch(planner, /APPROXIMATE_ROAD_PATH|approximateRoadPath/)
  assert.match(map, /watch\(features, \(\) => updateFeaturePresentation\(\)/)
  const featureWatcher = map.match(/watch\(features,[^\n]+/)?.[0] || ''
  assert.doesNotMatch(featureWatcher, /fitOnIntent|fitBounds|easeTo/)
})
