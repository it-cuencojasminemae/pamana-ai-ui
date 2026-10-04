import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as simulation from '../app/services/simulatedLiveVehicles.ts'
import { previewVehicles } from '../app/services/demoVehiclePreview.ts'
import { editableRecord, serializeWorkbenchForm } from '../app/services/transportWorkbench.ts'

test('workbench review and serialization accept reactive inputs without changing transport facts', () => {
  const record = Vue.reactive({ id: 7, documentId: 'test-node', name: 'Local test node',
    latitude: null, longitude: null, planning_enabled: false, verification_status: 'RESEARCH_CANDIDATE',
    route: { documentId: 'test-route' }, geometry_geojson: null })
  const before = JSON.stringify(record)
  const edited = editableRecord(record)
  assert.equal(edited.route, 'test-route')
  assert.equal(edited.documentId, undefined)
  assert.equal(edited.latitude, null)
  assert.equal(edited.planning_enabled, false)
  edited.name = 'Unsaved edit'
  assert.equal(JSON.stringify(record), before)

  const form = Vue.reactive({ latitude: '', longitude: '', planning_enabled: false })
  assert.deepEqual(serializeWorkbenchForm('transport-nodes', form),
    { latitude: null, longitude: null, planning_enabled: false })
  assert.equal(form.latitude, '')
  const service = Vue.reactive({ days_of_week: 'mon, wed', headway_min_minutes: '', headway_max_minutes: '15' })
  assert.deepEqual(serializeWorkbenchForm('service-patterns', service),
    { days_of_week: ['MON', 'WED'], headway_min_minutes: null, headway_max_minutes: 15 })
  assert.equal(service.days_of_week, 'mon, wed')
  const variant = Vue.reactive({ geometry_geojson: '', planning_enabled: false })
  assert.equal(serializeWorkbenchForm('route-variants', variant).geometry_geojson, null)
  assert.equal(variant.geometry_geojson, '')
})

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
test('development warnings never serialize component state or provider/auth values', () => {
  const warnings = []
  let plugin
  const sandbox = { defineNuxtPlugin: fn => { plugin = fn }, console: { warn: value => warnings.push(value) } }
  const source = stripTypeScriptTypes(read('app/plugins/development-warnings.ts'))
    .replace('export default', '').replace('import.meta.dev', 'true')
  vm.runInNewContext(source, sandbox)
  const app = { vueApp: { config: {} } }
  plugin(app)
  app.vueApp.config.warnHandler('Failed to resolve component: test-secret', { token: 'test-token' }, 'trace-secret')
  app.vueApp.config.warnHandler('Unknown warning with apiKey=test-key')
  assert.equal(warnings.length, 2)
  assert.doesNotMatch(warnings.join(' '), /test-secret|test-token|trace-secret|test-key/)
})
test('workbench tab failure and late responses cannot display records from a different entity', async () => {
  const calls = []
  const sandbox = { ...Vue, useApi: () => ({ apiFetch: () => new Promise((resolve, reject) => calls.push({ resolve, reject })) }) }
  const source = stripTypeScriptTypes(read('app/composables/useTransportWorkbench.ts'))
    .replace(/import[^\n]+\n/g, '').replace('export function', 'function')
  vm.runInNewContext(`${source}\nresult = useTransportWorkbench()`, sandbox)
  const workbench = sandbox.result
  const nodes = workbench.list('transport-nodes')
  calls[0].resolve({ data: [{ documentId: 'test-node' }] }); await nodes
  const stops = workbench.list('route-variant-stops')
  assert.equal(workbench.records.value.length, 0)
  const fares = workbench.list('fare-rules')
  calls[2].reject(Error('synthetic outage')); await assert.rejects(fares)
  calls[1].resolve({ data: [{ documentId: 'test-stop' }] }); await stops
  assert.equal(workbench.records.value.length, 0)
  assert.equal(workbench.error.value, 'Transport data is temporarily unavailable.')
  assert.equal(workbench.loading.value, false)
})
const snapshot = seconds => ({ status: 'SIMULATION_READY', dataMode: 'SIMULATED', simulation: true,
  activeVehicleCount: 3, freshActiveVehicleCount: 3, staleVehicleCount: 0,
  vehicles: previewVehicles(seconds, false, new Date('2026-10-02T00:00:00Z')) })
function feed(apiFetch, flag = 'true') {
  let unmount
  const config = Vue.reactive({ public: { pamanaDemoModeEnabled: flag } })
  const source = stripTypeScriptTypes(read('app/composables/useDemoVehicleFeed.ts')).replace(/import[^\n]+\n/g, '').replace('export function', 'function')
  const sandbox = { ...Vue, ...simulation, AbortController, useApi: () => ({ apiFetch }), useRuntimeConfig: () => config,
    onBeforeUnmount: fn => { unmount = fn } }
  vm.runInNewContext(`${source}\nresult = useDemoVehicleFeed()`, sandbox)
  return { ...sandbox.result, config, unmount: () => unmount() }
}

test('explicit demo opt-in and GET sampling never enable the backend or change transport data', async () => {
  const calls = []
  const current = feed(async (path, options) => { calls.push({ path, options }); return snapshot(options.query.elapsedSeconds || 0) }, 'false')
  await current.refresh(); await current.sample(20); assert.equal(calls.length, 0)
  current.config.public.pamanaDemoModeEnabled = 'true'; await Vue.nextTick()
  await current.sample(20)
  assert.equal(calls[0].path, '/api/pamana-demo/live-vehicles')
  assert.deepEqual(calls[0].options.query, { scenario: 'synthetic-direct-corridor', elapsedSeconds: 20 })
  assert.equal(calls[0].options.method, undefined); assert.equal(calls[0].options.body, undefined)
  assert.equal(current.features.value[0].properties.dataMode, 'SIMULATED')
  assert.ok(current.features.value[0].properties.details.includes('SIMULATED DEMO — not real transport data'))
  current.unmount(); assert.equal(calls[0].options.signal.aborted, true)
})

test('stale responses cannot overwrite a later sample, requests deduplicate and reset repeats the original marker', async () => {
  const calls = []
  const current = feed((path, options) => new Promise(resolve => calls.push({ options, resolve })))
  const first = current.sample(0); await current.refresh(); assert.equal(calls.length, 1)
  const second = current.sample(40); assert.equal(calls[0].options.signal.aborted, true)
  calls[1].resolve(snapshot(40)); await second
  const selected = JSON.stringify(current.snapshot.value)
  calls[0].resolve(snapshot(0)); await first; assert.equal(JSON.stringify(current.snapshot.value), selected)
  const reset = current.sample(0); calls[2].resolve(snapshot(0)); await reset
  assert.deepEqual(current.features.value[0].geometry, simulation.simulatedVehicleFeatures(snapshot(0).vehicles)[0].geometry)
  const live = current.sample(null); assert.equal(calls[3].options.query.elapsedSeconds, undefined)
  calls[3].resolve(snapshot(20)); await live
  await current.sample(-1); await current.sample(Number.NaN); await current.sample(3601); assert.equal(calls.length, 4)
  current.unmount()
})

test('403/network/invalid-response states are sanitized and retain the last safe simulation snapshot', async () => {
  let reply = snapshot(0)
  const current = feed(async () => { if (reply instanceof Error) throw reply; return reply })
  await current.refresh(); const previous = current.snapshot.value
  reply = new Error('403 provider-secret-synthetic-only'); await current.refresh()
  assert.equal(current.snapshot.value, previous); assert.match(current.error.value, /unavailable/)
  assert.doesNotMatch(current.error.value, /provider-secret|403/)
  reply = { ...snapshot(20), vehicles: [{ dataMode: 'REAL', simulation: false }] }; await current.refresh()
  assert.equal(current.snapshot.value, previous)
  reply = { ...snapshot(20), vehicles: [{ dataMode: 'SIMULATED', simulation: true }] }; await current.refresh()
  assert.equal(current.snapshot.value, previous)
  current.config.public.pamanaDemoModeEnabled = 'false'; await Vue.nextTick()
  assert.equal(current.snapshot.value, null); assert.equal(current.features.value.length, 0); assert.equal(current.error.value, '')
  current.unmount()
})

test('hiding a page/unmounting cancels an in-flight simulation without a late UI update', async () => {
  let resolve, signal
  const current = feed(async (_, options) => { signal = options.signal; return new Promise(done => { resolve = done }) })
  const pending = current.refresh(); current.cancel(); assert.equal(signal.aborted, true)
  resolve(snapshot(0)); await pending; assert.equal(current.snapshot.value, null); assert.equal(current.loading.value, false)
  current.unmount()
})

test('simulation controls render accessible reset/occupancy states only in explicit demo mode', async () => {
  const file = 'app/components/demo/PamanaDemoVehicleControls.vue'
  const { descriptor } = parse(read(file))
  const script = compileScript(descriptor, { id: 'phase26' })
  const template = compileTemplate({ id: 'phase26', filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const transform = code => stripTypeScriptTypes(code)
    .replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_, names) => `const {${names.replace(/\s+as\s+/g, ': ')}} = Vue;`)
    .replace('export default', 'component =').replace('export function render', 'function render')
  for (const enabled of ['false', 'true']) {
    const sandbox = { ...Vue, Vue, useRuntimeConfig: () => ({ public: { pamanaDemoModeEnabled: enabled } }) }
    vm.runInNewContext(`${transform(script.content)}\n${transform(template.code)}\ncomponent.render = render`, sandbox)
    const html = await renderToString(Vue.createSSRApp({ render: () => Vue.h(sandbox.component, { snapshot: snapshot(20), error: '', loading: false, elapsedSeconds: 20 }) }))
    if (enabled === 'false') { assert.doesNotMatch(html, /SIMULATED|button/); continue }
    assert.match(html, /SIMULATED DEMO/); assert.match(html, /NOT REAL TRANSPORT DATA/)
    assert.match(html, /Reset simulation/); assert.match(html, /Live simulated clock/)
    assert.match(html, /aria-pressed="true"/); assert.match(html, /NEAR_FULL/); assert.match(html, /FRESH/)
    assert.match(html, /aria-label="Demo simulation controls"/)
  }
})

test('actual Passenger/LGU pages preserve visible 15-second polling and render the shared MapLibre simulation', () => {
  for (const file of ['app/pages/passenger/map.vue', 'app/pages/lgu/live-mobility.vue']) {
    const source = read(file), { descriptor } = parse(source)
    const script = compileScript(descriptor, { id: file })
    assert.deepEqual(compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
    assert.match(source, /useDemoVehicleFeed\(\)/); assert.match(source, /<DemoPamanaDemoVehicleControls/)
    assert.match(source, /simulation\.cancel\(\)/); assert.match(source, /15_?000/)
    assert.match(source, /:vehicles="(?:simulation\.features\.value|simulatedMapFeatures)"/)
    assert.doesNotMatch(source, /fitBounds|easeTo|new Map\(/)
  }
})

test('demo preparation does not add provider clients, journey answers, geometry or transport writes', () => {
  const sources = [read('app/composables/useDemoVehicleFeed.ts'), read('app/components/demo/PamanaDemoVehicleControls.vue')].join('\n')
  assert.doesNotMatch(sources, /method:\s*['"](?:POST|PUT|PATCH|DELETE)|fetch\(|new Map\(|routeVariantId\s*:|regular_base_fare|geometry\s*:/)
  assert.doesNotMatch(sources, /GEMINI_API_KEY|OPENAI_API_KEY|FIELD_VERIFIED/)
  assert.equal(JSON.parse(read('package.json')).dependencies.leaflet, undefined)
})
