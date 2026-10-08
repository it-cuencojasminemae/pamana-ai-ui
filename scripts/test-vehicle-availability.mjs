import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as availability from '../app/services/vehicleAvailability.ts'
import { legacyMarkerFeatures } from '../app/services/mapPresentation.ts'

const NOW = Date.parse('2026-10-08T10:00:00Z')
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const saved = status => ({ status, reportedStatus: status, source: 'DRIVER', confidence: 'REPORTED', reportedAt: new Date(NOW).toISOString(),
  expiresAt: new Date(NOW + 900000).toISOString(), ageSeconds: 0, stale: false, dataMode: 'REAL' })
const transform = code => stripTypeScriptTypes(code)
  .replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_, names, quote, name) => `const {${names.replace(/\s+as\s+/g, ': ')}} = require(${JSON.stringify(name)});`)
  .replace('export default', 'exports.default =').replace('export function render', 'function render')
function component(file, apiFetch = async () => {}, extra = {}) {
  const { descriptor, errors } = parse(read(file)); assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: file })
  const template = compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const sandbox = { ...Vue, exports: {}, Date: { now: () => NOW }, useApi: () => ({ apiFetch }), useAvailabilityClock: () => Vue.ref(NOW),
    require: name => name === 'vue' ? Vue : name.endsWith('/vehicleAvailability') ? availability : assert.fail(`Unmocked ${name}`), ...extra }
  vm.runInNewContext(`${transform(script.content)}\n${transform(template.code)}\nexports.default.render = render`, sandbox)
  return sandbox.exports.default
}

test('truthful labels and colours cover all states, sources, malformed and stale cached data', () => {
  for (const [status, label, colour] of [['AVAILABLE', 'Seats Available', 'emerald'], ['LIMITED', 'Almost Full', 'amber'], ['FULL', 'Full', 'red'], ['UNKNOWN', 'Availability Unknown', 'neutral']]) {
    const result = availability.availabilityPresentation(saved(status), NOW)
    assert.equal(result.label, label); assert.match(result.classes, new RegExp(colour))
    assert.equal(result.detail, 'Driver report · just now')
  }
  assert.equal(availability.availabilityPresentation(saved('UNKNOWN'), NOW, true).label, 'Not Reported')
  for (const value of [null, {}, { ...saved('AVAILABLE'), source: 'PASSENGER' }, { ...saved('FULL'), source: 'SYSTEM_ESTIMATE' }, { ...saved('FULL'), source: 'SIMULATION' },
    { ...saved('AVAILABLE'), reportedAt: 'invalid' }, { ...saved('AVAILABLE'), expiresAt: null }, { ...saved('AVAILABLE'), status: 'bad' }]) {
    assert.equal(availability.availabilityPresentation(value, NOW).status, 'UNKNOWN')
  }
  assert.equal(availability.availabilityPresentation(saved('AVAILABLE'), NOW + 900000).status, 'UNKNOWN')
  assert.match(availability.availabilityPresentation(saved('FULL'), NOW + 900000).detail, /Outdated/)
  assert.equal(availability.availabilityPresentation({ ...saved('FULL'), expiresAt: new Date(NOW + 60000).toISOString() }, NOW + 60000).status, 'UNKNOWN')
  assert.match(availability.availabilityPresentation({ ...saved('FULL'), source: 'SIMULATION', dataMode: 'SIMULATED' }, NOW).detail, /Simulation/)
})

test('one tap submits each state once, blocks overlapping/duplicate writes and shows success', async () => {
  const calls = [], props = Vue.reactive({ tripId: 'trip-test-123', availability: null, disabled: false })
  const control = component('app/components/driver/PamanaAvailabilityControls.vue', (endpoint, options) => new Promise(resolve => calls.push({ endpoint, options, resolve })))
  const scope = Vue.effectScope()
  const setup = scope.run(() => control.setup(props, { expose() {}, emit: (_, value) => { props.availability = value } }))
  for (const { status } of availability.AVAILABILITY_OPTIONS) {
    const previous = calls.length
    const pending = setup.report(status)
    assert.equal(setup.saving.value, true)
    await setup.report(status); await setup.report('FULL')
    assert.equal(calls.length, previous + 1)
    assert.equal(calls.at(-1).endpoint, '/api/driver-trips/trip-test-123/availability')
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).options.body)), { data: { status } })
    calls.at(-1).resolve({ data: saved(status) }); await pending
    assert.equal(setup.saving.value, false)
    assert.equal(props.availability.status, status)
    assert.equal(setup.feedback.value, 'Availability saved.')
    await setup.report(status); assert.equal(calls.length, previous + 1)
  }
  props.disabled = true; await setup.report('FULL'); assert.equal(calls.length, 4)
  scope.stop()
})

test('failed writes preserve the saved status, show sanitized feedback and allow retry', async () => {
  const props = Vue.reactive({ tripId: 'trip-test-123', availability: saved('AVAILABLE') })
  const control = component('app/components/driver/PamanaAvailabilityControls.vue', async () => { throw Error('private-provider-token') })
  const scope = Vue.effectScope()
  const setup = scope.run(() => control.setup(props, { expose() {}, emit() { assert.fail('Failed write must not change saved status') } }))
  await setup.report('FULL')
  assert.equal(props.availability.status, 'AVAILABLE')
  assert.equal(setup.failed.value, true); assert.equal(setup.saving.value, false)
  assert.match(setup.feedback.value, /Could not save/); assert.doesNotMatch(setup.feedback.value, /private-provider-token/)
  scope.stop()
})

test('controls render four accessible mobile touch targets and the stopped reminder without counts', async () => {
  const app = Vue.createSSRApp(component('app/components/driver/PamanaAvailabilityControls.vue'), { tripId: 'trip-test-123', availability: saved('LIMITED') })
  app.component('UCard', { setup: (_, { slots }) => () => Vue.h('section', slots.default?.()) })
  app.component('UIcon', { render: () => Vue.h('span') })
  app.component('PamanaVehicleAvailability', component('app/components/PamanaVehicleAvailability.vue'))
  const html = await renderToString(app)
  assert.equal((html.match(/<button/g) || []).length, 4)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  assert.match(html, /min-h-12/); assert.match(html, /grid-cols-2/); assert.match(html, /safely stopped/)
  assert.match(html, /Driver report/); assert.doesNotMatch(html, /current_occupancy|passenger count|0\s*\/\s*20/)
})

test('driver, passenger and LGU templates compile and consume the shared availability component', () => {
  for (const file of ['app/pages/driver/current-trip.vue', 'app/pages/driver/index.vue', 'app/pages/passenger/map.vue', 'app/pages/lgu/live-mobility.vue', 'app/components/PamanaMapLibreMap.vue']) {
    const source = read(file), { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file })
    assert.deepEqual(compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
    assert.match(source, /Availability/)
  }
  const trip = read('app/pages/driver/current-trip.vue')
  assert.match(trip, /End this trip\?/); assert.match(trip, /Keep trip/)
  assert.doesNotMatch(trip, /changeOccupancy|Add one passenger|Remove one passenger/)
})

test('map metadata carries timestamped availability for the live badge and ignores old real counts', () => {
  const feature = legacyMarkerFeatures([{ documentId: 'vehicle-test', vehicle_number: 'Test vehicle', latitude: 15, longitude: 120,
    data_mode: 'REAL', current_occupancy: 20, occupancy_level: 'full', availability: saved('AVAILABLE') }])[0]
  assert.equal(feature.properties.availability.status, 'AVAILABLE')
  assert.ok(!feature.properties.details.some(detail => /Occupancy|20/.test(detail)))
})

test('the shared clock expires cached reports without polling and stops after the last consumer unmounts', () => {
  const mounts = [], unmounts = [], state = Vue.ref(NOW)
  let ticks, timers = 0, cleared = 0, clock = NOW
  const sandbox = { useState: () => state, onMounted: fn => mounts.push(fn), onBeforeUnmount: fn => unmounts.push(fn), Date: { now: () => clock },
    setInterval(fn, ms) { ticks = fn; timers++; assert.equal(ms, 15000); return 1 }, clearInterval() { cleared++ } }
  const source = stripTypeScriptTypes(read('app/composables/useAvailabilityClock.ts')).replace('export function', 'function')
  vm.runInNewContext(`${source}\nuseAvailabilityClock(); useAvailabilityClock();`, sandbox)
  mounts.forEach(fn => fn())
  assert.equal(timers, 1)
  clock = NOW + 900000; ticks()
  assert.equal(availability.availabilityPresentation(saved('FULL'), state.value).status, 'UNKNOWN')
  unmounts[0](); assert.equal(cleared, 0)
  unmounts[1](); assert.equal(cleared, 1)
})
