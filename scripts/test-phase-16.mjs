import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { previewVehicles, previewLine } from '../app/services/demoVehiclePreview.ts'
import { fetchSimulatedLiveVehicles, simulatedVehicleFeatures } from '../app/services/simulatedLiveVehicles.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('provider-neutral simulated snapshots normalize into existing vehicle GeoJSON', () => {
  const snapshots = previewVehicles(15, false, new Date('2026-09-26T00:00:00Z'))
  const features = simulatedVehicleFeatures(snapshots)
  assert.equal(features.length, 3)
  assert.deepEqual(snapshots.map(vehicle => vehicle.occupancy), ['AVAILABLE', 'NEAR_FULL', 'FULL'])
  assert.ok(features.every(feature => feature.geometry.type === 'Point'))
  assert.ok(features.every(feature => feature.properties.semantic === 'vehicle'))
  assert.ok(features.every(feature => feature.properties.dataMode === 'SIMULATED' && feature.properties.simulation === true))
  assert.match(features[0].properties.label, /AVAILABLE/)
  assert.equal(previewLine.geometry.type, 'LineString')
  assert.ok(previewLine.geometry.coordinates.every(([lng]) => lng > 139), 'preview must use offshore geometry')
})

test('stale preview remains diagnostic and valid', () => {
  const stale = previewVehicles(15, true, new Date('2026-09-26T00:00:00Z'))
  assert.equal(stale[0].dataFreshness.status, 'STALE')
  assert.equal(stale[0].dataFreshness.ageSeconds, 90)
  assert.equal(stale.filter(vehicle => vehicle.tripState === 'ACTIVE' && vehicle.dataFreshness.status === 'FRESH').length, 0)
})

test('dedicated client uses GET semantics and cannot enable the server gate', async () => {
  let captured
  const response = { status: 'SIMULATION_READY', vehicles: [] }
  const result = await fetchSimulatedLiveVehicles(async (path, options) => { captured = { path, options }; return response }, { scenario: 'synthetic-direct-corridor', elapsedSeconds: 15 })
  assert.equal(result, response)
  assert.equal(captured.path, '/api/pamana-demo/live-vehicles')
  assert.deepEqual(captured.options.query, { scenario: 'synthetic-direct-corridor', elapsedSeconds: 15 })
  assert.equal(captured.options.method, undefined)
  assert.doesNotMatch(JSON.stringify(captured), /enabled|demoMode|PAMANA_DEMO_MODE_ENABLED/)
})

test('passenger and preview components compile with explicit simulation labeling', () => {
  for (const file of ['app/pages/passenger/map.vue', 'app/pages/dev/live-vehicle-preview.vue', 'app/components/PamanaMapPanel.vue']) {
    const source = read(file)
    const { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: `phase16-${file}` })
    const template = compileTemplate({ id: `phase16-${file}`, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
  const passenger = read('app/pages/passenger/map.vue')
  assert.match(passenger, /SIMULATED DEMO/)
  assert.match(passenger, /REAL active.*SIMULATED fresh active/)
  assert.match(passenger, /simulatedFeedConfigured/)
  assert.match(read('nuxt.config.ts'), /PAMANA_DEMO_MODE_ENABLED.*false/)
  assert.match(read('.env.example'), /^NUXT_PUBLIC_PAMANA_DEMO_MODE_ENABLED=false$/m)
})

test('vehicle refresh uses setData and never recreates or recenters MapLibre', () => {
  const map = read('app/components/PamanaMapLibreMap.vue')
  const presentation = read('app/services/mapLibrePresentation.ts')
  const panel = read('app/components/PamanaMapPanel.vue')
  assert.match(map, /watch\(features, \(\) => updateFeaturePresentation\(\)/)
  assert.match(presentation, /GeoJSONSource\)\.setData/)
  assert.match(presentation, /semantic !== 'vehicle'/)
  assert.match(panel, /:vehicles="vehicles"/)
  const watcher = map.slice(map.indexOf('// Vehicle/GPS polling'), map.indexOf('// Node refreshes'))
  assert.doesNotMatch(watcher, /fitBounds|easeTo|initialize/)
})

test('preview is development-only, accessible, and contains no transport or database mutation', () => {
  const preview = read('app/pages/dev/live-vehicle-preview.vue')
  assert.match(preview, /!import\.meta\.dev/)
  assert.match(preview, /NOT REAL TRANSPORT DATA/)
  assert.match(preview, /aria-label="Simulation controls"/)
  assert.match(preview, /Advance 15 sec/)
  assert.match(preview, /360px/)
  assert.match(preview, /:user-location="previewUserLocation"/)
  const sources = [preview, read('app/services/demoVehiclePreview.ts'), read('app/services/simulatedLiveVehicles.ts')].join('\n')
  assert.doesNotMatch(sources, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i)
  assert.doesNotMatch(sources, /transport-nodes|route-variants|VehicleLocation|Geoapify|OpenAI|Gemini|San Juan|SM City/i)
  assert.ok(JSON.parse(read('package.json')).dependencies.leaflet)
})
