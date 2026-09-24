import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import {
  PASSENGER_TRANSPORT_NODE_QUERY,
  fetchPassengerTransportNodes,
  geographicDistanceKm,
  hasUsableTransportNodeCoordinates,
  normalizePassengerTransportNodes,
  normalizeTransportNode,
  passengerTransportNodeEligible,
  sortTransportNodesByGeographicDistance,
  transportNodeFeatureCollection,
  transportNodeSemantic,
} from '../app/services/transportNodes.ts'
import {
  createTransportNodePresentation,
  TRANSPORT_NODE_LAYER_IDS,
  TRANSPORT_NODE_SOURCE_ID,
} from '../app/services/transportNodePresentation.ts'
import { locationMapFeature } from '../app/services/locationPresentation.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const validRecord = (overrides = {}) => ({
  id: 9,
  documentId: 'verified-node',
  name: 'Verified test stop',
  node_code: 'TEST-VERIFIED-STOP',
  node_type: 'DESIGNATED_STOP',
  latitude: 15.07,
  longitude: 120.67,
  planning_enabled: true,
  verification_status: 'FIELD_VERIFIED',
  data_mode: 'REAL',
  verified_at: '2026-09-01T00:00:00.000Z',
  source_name: 'Test verification record',
  source_reference: 'TEST-REF-1',
  ...overrides,
})

test('Strapi v4 and v5 records normalize to one transport-node contract', () => {
  const flat = normalizeTransportNode(validRecord())
  const nested = normalizeTransportNode({ id: 9, attributes: validRecord({ documentId: undefined }) })
  assert.equal(flat.id, 'verified-node')
  assert.equal(nested.id, '9')
  for (const node of [flat, nested]) {
    assert.equal(node.source, 'PAMANA_TRANSPORT_DB')
    assert.equal(node.type, 'DESIGNATED_STOP')
    assert.deepEqual([node.lng, node.lat], [120.67, 15.07])
  }
  assert.equal(normalizeTransportNode({ broken: true }), null)
})

test('ordinary passenger visibility mirrors Phase 2 trust and planning rules', () => {
  assert.equal(passengerTransportNodeEligible(normalizeTransportNode(validRecord())), true)
  for (const overrides of [
    { planning_enabled: false },
    { verification_status: 'RESEARCH_CANDIDATE' },
    { verification_status: 'CORROBORATED_RESEARCH' },
    { data_mode: 'SIMULATED' },
    { verified_at: null },
    { source_name: null },
    { source_reference: null, source_url: null },
  ]) assert.equal(passengerTransportNodeEligible(normalizeTransportNode(validRecord(overrides))), false)

  const result = normalizePassengerTransportNodes([
    validRecord(),
    validRecord({ documentId: 'research', node_code: 'RCH-NULL', planning_enabled: false, verification_status: 'RESEARCH_CANDIDATE', latitude: null, longitude: null }),
    validRecord({ documentId: 'unmapped', node_code: 'UNMAPPED', latitude: null, longitude: null }),
    validRecord({ documentId: 'zero', node_code: 'ZERO', latitude: 0, longitude: 0 }),
    { malformed: true },
  ])
  assert.deepEqual(result.nodes.map(node => node.id), ['verified-node'])
  assert.deepEqual(result.diagnostics, { received: 5, visible: 1, unmapped: 2, ineligible: 1, malformed: 1 })
})

test('only coordinate-bearing transport nodes become PAMANA GeoJSON points', () => {
  const node = normalizeTransportNode(validRecord())
  assert.equal(hasUsableTransportNodeCoordinates(node), true)
  const collection = transportNodeFeatureCollection([
    node,
    { ...node, id: 'missing', lat: null },
    { ...node, id: 'research', planningEnabled: false, verificationStatus: 'RESEARCH_CANDIDATE' },
  ])
  assert.equal(collection.type, 'FeatureCollection')
  assert.equal(collection.features.length, 1)
  const feature = collection.features[0]
  assert.equal(feature.geometry.type, 'Point')
  assert.deepEqual(feature.geometry.coordinates, [120.67, 15.07])
  assert.equal(feature.properties.source, 'PAMANA_TRANSPORT_DB')
  assert.equal(feature.properties.isTransportNode, true)
  assert.equal(feature.properties.planningEnabled, true)
  assert.equal(feature.properties.verificationLabel, 'Field verified')
  assert.equal(feature.properties.nodeTypeLabel, 'Designated stop')
})

test('transport node types map to stable semantic marker categories', () => {
  assert.deepEqual({
    roadside: transportNodeSemantic('ROADSIDE_PICKUP'),
    bay: transportNodeSemantic('LOADING_BAY'),
    stop: transportNodeSemantic('DESIGNATED_STOP'),
    dropoff: transportNodeSemantic('DROP_OFF'),
    transfer: transportNodeSemantic('TRANSFER_POINT'),
    terminal: transportNodeSemantic('TRANSPORT_HUB'),
    destination: transportNodeSemantic('DESTINATION'),
    service: transportNodeSemantic('ESSENTIAL_SERVICE'),
  }, { roadside: 'pickup', bay: 'pickup', stop: 'stop', dropoff: 'dropoff', transfer: 'transfer', terminal: 'terminal', destination: 'destination', service: 'essential-service' })
})

test('Geoapify places and PAMANA nodes remain visibly and structurally distinct', () => {
  const geographic = locationMapFeature({ id: 'geo-place', label: 'Geographic place', lat: 15.1, lng: 120.7, source: 'GEOAPIFY' }, 'destination')
  const transport = transportNodeFeatureCollection([normalizeTransportNode(validRecord())]).features[0]
  assert.equal(geographic.properties.source, 'GEOAPIFY')
  assert.equal(geographic.properties.semantic, 'destination-location')
  assert.equal(geographic.properties.isTransportNode, false)
  assert.equal(transport.properties.source, 'PAMANA_TRANSPORT_DB')
  assert.equal(transport.properties.semantic, 'stop')
  assert.equal(transport.properties.isTransportNode, true)
})

test('nearby ordering is geographic distance only and exposes no routing claim', () => {
  const first = normalizeTransportNode(validRecord({ documentId: 'near', node_code: 'NEAR', name: 'Near', latitude: 15.001, longitude: 120 }))
  const second = normalizeTransportNode(validRecord({ documentId: 'far', node_code: 'FAR', name: 'Far', latitude: 15.1, longitude: 120 }))
  const sorted = sortTransportNodesByGeographicDistance([second, first], { lat: 15, lng: 120 })
  assert.deepEqual(sorted.map(item => item.node.id), ['near', 'far'])
  assert.ok(sorted[0].distanceKm < sorted[1].distanceKm)
  assert.ok(geographicDistanceKm({ lat: 15, lng: 120 }, { lat: 15.001, lng: 120 }) > 0)
  assert.deepEqual(Object.keys(sorted[0]).sort(), ['distanceKm', 'node'])
})

test('authenticated read uses the existing endpoint with strict filters and sanitizes errors', async () => {
  let request
  const success = await fetchPassengerTransportNodes(async (endpoint, options) => {
    request = { endpoint, options }
    return { data: [validRecord()] }
  })
  assert.equal(success.ok, true)
  assert.equal(request.endpoint, '/api/transport-nodes')
  assert.equal(request.options.query, PASSENGER_TRANSPORT_NODE_QUERY)
  assert.equal(request.options.query['filters[planning_enabled][$eq]'], true)
  assert.equal(request.options.query['filters[data_mode][$eq]'], 'REAL')
  assert.equal(request.options.query['pagination[pageSize]'], 100)
  const forbidden = await fetchPassengerTransportNodes(async () => { throw { response: { status: 403 }, data: { message: 'private server detail' } } })
  assert.deepEqual(forbidden, { ok: false, error: 'UNAUTHORIZED' })
  const malformed = await fetchPassengerTransportNodes(async () => ({ data: { wrong: true } }))
  assert.deepEqual(malformed, { ok: false, error: 'UNAVAILABLE' })
})

test('dedicated MapLibre node source updates with setData and never changes camera', () => {
  const sources = new Map(), layers = new Map(), images = new Set()
  let updates = 0, cameraCalls = 0
  const map = {
    isStyleLoaded: () => true,
    hasImage: id => images.has(id), addImage: id => images.add(id),
    getSource: id => sources.get(id), addSource: (id, source) => sources.set(id, { ...source, setData: () => updates++ }),
    getLayer: id => layers.get(id), addLayer: layer => layers.set(layer.id, layer), setFilter() {},
    fitBounds: () => cameraCalls++, easeTo: () => cameraCalls++, jumpTo: () => cameraCalls++,
  }
  const renderer = createTransportNodePresentation(map, () => ({}))
  const feature = transportNodeFeatureCollection([normalizeTransportNode(validRecord())]).features[0]
  renderer.update([{ ...feature, properties: { ...feature.properties, featureId: String(feature.id) } }])
  renderer.update([{ ...feature, properties: { ...feature.properties, featureId: String(feature.id) } }])
  renderer.select(String(feature.id))
  assert.ok(sources.has(TRANSPORT_NODE_SOURCE_ID))
  assert.equal(sources.size, 1)
  assert.equal(layers.size, TRANSPORT_NODE_LAYER_IDS.length)
  assert.equal(updates, 1)
  assert.equal(cameraCalls, 0)
})

test('component and passenger page compile with truthful independent transport-node integration', () => {
  for (const file of ['app/components/PamanaMapLibreMap.vue', 'app/components/PamanaMapPanel.vue', 'app/pages/passenger/map.vue']) {
    const source = read(file)
    const { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: `phase9-${file}` })
    const template = compileTemplate({ id: `phase9-${file}`, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
  const component = read('app/components/PamanaMapLibreMap.vue')
  const nodeWatcher = component.match(/watch\(transportFeatures,[^\n]+/)[0]
  assert.doesNotMatch(nodeWatcher, /fit|easeTo|jumpTo|initialize/)
  assert.match(component, /createTransportNodePresentation/)
  assert.match(component, /Geographic place selection/)
  assert.match(component, /sourceSummary/)
  const page = read('app/pages/passenger/map.vue')
  assert.match(page, /useTransportNodes\(\)/)
  assert.match(page, /:transport-nodes="transportNodeFeatures"/)
  assert.match(page, /Sorted by geographic distance only/)
  assert.match(page, /loadTransportNodes\(\)/)
})

test('Phase 9 adds no writes, routing, inferred geometry, or public transport-node permission', () => {
  const sources = [
    read('app/services/transportNodes.ts'), read('app/composables/useTransportNodes.ts'),
    read('app/services/transportNodePresentation.ts'), read('app/pages/passenger/map.vue'),
  ].join('\n')
  assert.doesNotMatch(sources, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i)
  assert.doesNotMatch(sources, /Geoapify|geocode|\/routing|nearest pickup|transfer calculation/i)
  assert.doesNotMatch(sources, /LineString|RouteVariant|FareRule|ServicePattern/)
  const backendIndex = fs.readFileSync(new URL('../../pamana-backend/src/index.js', import.meta.url), 'utf8')
  assert.match(backendIndex, /'transport-node\.transport-node'/)
  assert.match(backendIndex, /Passenger:\s*\[[\s\S]*?TRANSPORT_KNOWLEDGE_READ_ACTIONS/)
  assert.doesNotMatch(backendIndex, /Public:\s*\[/)
  assert.match(read('app/components/PamanaMapPanel.vue'), /<PamanaLeafletMap/)
  assert.ok(JSON.parse(read('package.json')).dependencies.leaflet)
})
