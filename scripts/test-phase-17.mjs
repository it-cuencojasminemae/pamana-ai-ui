import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import {
  DRIVER_GPS_PUBLISH_INTERVAL_MS,
  driverStopFeatures,
  driverVariantLines,
  normalizedOccupancy,
  orderedVariantStops,
  routeVariantLabel
} from '../app/services/driverTrip.ts'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const stop = (sequence, id, coordinates = [120.7, 15.1]) => ({
  documentId: `stop-${id}`, sequence, pickup_allowed: true, dropoff_allowed: true, transfer_allowed: false,
  transport_node: {
    documentId: id, name: `Node ${id}`, node_code: id, node_type: 'DESIGNATED_STOP',
    longitude: coordinates[0], latitude: coordinates[1], data_mode: 'REAL',
    verification_status: 'FIELD_VERIFIED', planning_enabled: true
  }
})

test('route variant labels show human direction, endpoints and signboard', () => {
  assert.equal(routeVariantLabel({
    documentId: 'variant-out', variantCode: 'TEST-OUT', displayName: 'Test outbound',
    direction: 'OUTBOUND', origin: 'Origin', destination: 'Destination',
    signboard: 'DESTINATION', operatingStatus: 'ACTIVE', dataMode: 'REAL'
  }), 'Outbound · Origin → Destination · Signboard: DESTINATION')
})

test('ordered variant stops preserve stored sequence and never reverse inbound data', () => {
  const ordered = orderedVariantStops([stop(3, 'C'), stop(1, 'A'), stop(2, 'B')])
  assert.deepEqual(ordered.map(item => item.transport_node.node_code), ['A', 'B', 'C'])
  assert.doesNotMatch(read('app/pages/driver/current-trip.vue'), /\.reverse\(/)
  assert.doesNotMatch(read('app/services/driverTrip.ts'), /\.reverse\(/)
})

test('driver map renders only coordinate-bearing variant nodes and supplied geometry', () => {
  const features = driverStopFeatures([stop(1, 'A'), stop(2, 'B', [0, 0]), stop(3, 'C', [null, null]), stop(4, 'D', [120.7, null])])
  assert.equal(features.length, 1)
  assert.equal(features[0].properties.source, 'PAMANA_TRANSPORT_DB')
  const trip = { route_variant: { display_name: 'Exact variant', geometry_geojson: { type: 'LineString', coordinates: [[120.7, 15.1], [120.71, 15.11]] } } }
  const lines = driverVariantLines(trip)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].geometry.type, 'LineString')
  assert.deepEqual(driverVariantLines({ route_variant: { display_name: 'Unknown', geometry_geojson: null } }), [])
})

test('occupancy uses normalized availability vocabulary and a bounded GPS cadence', () => {
  assert.equal(normalizedOccupancy('low'), 'AVAILABLE')
  assert.equal(normalizedOccupancy('near_full'), 'NEAR_FULL')
  assert.equal(normalizedOccupancy('full'), 'FULL')
  assert.equal(normalizedOccupancy(null), 'UNKNOWN')
  assert.equal(DRIVER_GPS_PUBLISH_INTERVAL_MS, 15000)
})

test('driver pages compile and use exact server-provided RouteVariant workflow', () => {
  for (const file of ['app/pages/driver/index.vue', 'app/pages/driver/current-trip.vue']) {
    const source = read(file)
    const { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file })
    const template = compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
  const dashboard = read('app/pages/driver/index.vue')
  assert.match(dashboard, /\/api\/driver-trip-options/)
  assert.match(dashboard, /\/api\/driver-active-trip/)
  assert.match(dashboard, /route_variant: selectedVariantDocumentId\.value/)
  assert.doesNotMatch(dashboard, /startDirection|\/api\/routes/)
  const trip = read('app/pages/driver/current-trip.vue')
  assert.match(trip, /\/api\/driver-active-trip/)
  assert.match(trip, /provider="maplibre"/)
  assert.match(trip, /route_variant_stops/)
  assert.match(trip, /startTracking\(\)/)
  assert.match(trip, /stopTracking/)
  assert.match(trip, /\/api\/vehicle-locations/)
  assert.match(trip, /DriverPamanaAvailabilityControls/)
  assert.doesNotMatch(trip, /changeOccupancy|current_occupancy: next/)
  assert.match(trip, /:fit-key="activeTrip\.documentId"/)
  assert.doesNotMatch(`${dashboard}\n${trip}`, /San Luis|SL-SF|Collected fare|simulated prototype data/i)
})

test('geolocation tracking is shared, disposable and does not log coordinates', () => {
  const source = read('app/composables/useGeolocation.ts')
  assert.match(source, /watchPosition/)
  assert.match(source, /clearWatch/)
  assert.match(source, /activeWatchId/)
  assert.doesNotMatch(source, /console\./)
})

test('Phase 16 simulation stays separate from normal driver workflow and MapLibre is installed', () => {
  const sources = [
    read('app/pages/driver/index.vue'),
    read('app/pages/driver/current-trip.vue'),
    read('app/services/driverTrip.ts')
  ].join('\n')
  assert.doesNotMatch(sources, /pamana-demo|demoVehiclePreview|SIM-DEMO-DIRECT-ONLY/)
  assert.ok(JSON.parse(read('package.json')).dependencies['maplibre-gl'])
})
