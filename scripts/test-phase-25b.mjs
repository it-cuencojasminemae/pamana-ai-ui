import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as workbenchData from '../app/services/transportWorkbench.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)])

test('production and development source has no executable legacy renderer, APIs or CSS', () => {
  assert.equal(fs.existsSync(path.join(root, 'app/components/PamanaLeafletMap.vue')), false)
  for (const file of files(path.join(root, 'app'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /leaflet|\bL\.(?:map|marker|polyline|tileLayer|layerGroup|latLng)\s*\(/i, file)
  }
  const preview = read('app/pages/dev/map-migration-preview.vue')
  assert.match(preview, /provider="maplibre"/)
  assert.doesNotMatch(preview, /compatibility|rollback/i)
})

test('Leaflet and its type/plugin packages are absent from manifest, lockfile and installed tree', () => {
  const manifest = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    assert.doesNotMatch(name, /leaflet/i)
  }
  for (const name of Object.keys(lock.packages)) assert.doesNotMatch(name, /leaflet/i)
  assert.equal(fs.existsSync(path.join(root, 'node_modules/leaflet')), false)
  assert.equal(manifest.dependencies['maplibre-gl'], '^6.11.1')
  assert.equal(lock.packages['node_modules/maplibre-gl'].version, '6.11.1')
  assert.ok(lock.packages['node_modules/@types/geojson'])
})

test('all required consumers compile with MapLibre and the shared panel retains events, layers and slots', () => {
  for (const file of [
    'app/pages/passenger/trip-planner.vue', 'app/pages/passenger/map.vue',
    'app/pages/driver/current-trip.vue', 'app/pages/driver/demand-map.vue',
    'app/pages/lgu/index.vue', 'app/pages/lgu/live-mobility.vue', 'app/pages/lgu/disruptions.vue',
    'app/components/transport-data/PamanaTransportWorkbench.vue',
  ]) {
    const source = read(file)
    assert.match(source, /<PamanaMapPanel\b[^>]*provider="maplibre"/, file)
    const { descriptor } = parse(source)
    const script = compileScript(descriptor, { id: file })
    const template = compileTemplate({ id: file, filename: file, source: descriptor.template.content,
      compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [], file)
  }
  const panel = read('app/components/PamanaMapPanel.vue')
  assert.equal((panel.match(/<PamanaMapLibreMap\b/g) || []).length, 1)
  assert.doesNotMatch(panel, /compatibilityMode|activeProvider|PamanaLeafletMap|mapFailed/)
  for (const value of ['transport-nodes', 'vehicles', 'disruptions', 'user-location', 'fit-key', 'feature-selected', 'map-ready', 'map-error']) assert.ok(panel.includes(value), value)
  assert.match(panel, /<slot name="overlay"/)
  assert.match(panel, /<slot\s*\/>/)
  assert.match(panel, /suppliedLine\(props\.routeGeometry/)
  assert.doesNotMatch(panel, /suppliedLine\(props\.routePoints/)
})

test('actual workbench setup previews candidate coordinates and supplied geometry without writing or confirming', async () => {
  const file = 'app/components/transport-data/PamanaTransportWorkbench.vue'
  const { descriptor } = parse(read(file))
  const compiled = compileScript(descriptor, { id: file })
  const code = stripTypeScriptTypes(compiled.content)
    .replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g,
      (_, names, quote, name) => `const {${names.replace(/\s+as\s+/g, ': ')}} = require(${JSON.stringify(name)});`)
    .replace('export default', 'exports.default =')
  let saves = 0
  const sandbox = { ...Vue, structuredClone, exports: {}, onMounted() {},
    useAuth: () => ({ role: Vue.ref('LGU') }), useToast: () => ({ add() {} }),
    useTransportWorkbench: () => ({ list: async () => {}, save: async () => { saves++ } }),
    useApi: () => ({ apiFetch: async () => ({ data: [] }) }),
    require: name => { if (name === 'vue') return Vue; assert.match(name, /services\/transportWorkbench$/); return workbenchData },
  }
  vm.runInNewContext(code, sandbox)
  const scope = Vue.effectScope()
  const setup = scope.run(() => sandbox.exports.default.setup({}, { expose() {} }))
  setup.openEditor()
  setup.form.data_mode = 'SIMULATED'
  setup.form.latitude = 14; setup.form.longitude = 119
  await Vue.nextTick()
  assert.deepEqual(JSON.parse(JSON.stringify(setup.mapNodes.value[0].geometry.coordinates)), [119, 14])
  assert.equal(setup.confirmations.coordinate, false)
  setup.candidateLocation.value = { id: 'synthetic', label: 'Synthetic geography', lat: 14.02, lng: 119.02, source: 'GEOAPIFY' }
  setup.useGeographicEvidence()
  assert.equal(setup.form.latitude, 14.02)
  assert.equal(setup.confirmations.coordinate, false)
  setup.activeEntity.value = 'route-variants'; await Vue.nextTick(); setup.openEditor()
  assert.equal(setup.mapLines.value.length, 0, 'unresolved geometry is never invented')
  setup.form.geometry_geojson = JSON.stringify({ type: 'LineString', coordinates: [[119, 14], [119.01, 14.01]] })
  assert.equal(setup.mapLines.value[0].properties.geometryClassification, 'VERIFIED_TRANSIT_GEOMETRY')
  assert.equal(setup.confirmations.geometry, false)
  assert.equal(setup.isAdministrator.value, false)
  assert.equal(saves, 0, 'preview and candidate edits never automatically persist')
  scope.stop()
})

test('cleanup keeps presentation and geographic services unchanged and the operational limitation open', () => {
  const map = read('app/components/PamanaMapLibreMap.vue')
  assert.match(map, /ResizeObserver/)
  assert.match(map, /onBeforeUnmount/)
  assert.match(map, /map\?\.remove\(\)/)
  assert.match(map, /MISSING_CONFIG/)
  const presentation = read('app/services/mapLibrePresentation.ts')
  assert.match(presentation, /setData\(/)
  assert.match(presentation, /approximate-road-path/)
  assert.match(presentation, /line-dasharray/)
  const limitation = read('documentation/phase-24-5-manual-operational-acceptance.md')
  assert.match(limitation, /Phase 24\.5 does not pass yet/)
})
