import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = path => fs.readFileSync(path, 'utf8')
function compiles(path) {
  const source = read(path)
  const { descriptor, errors } = parse(source, { filename: path })
  assert.deepEqual(errors, [])
  const script = descriptor.scriptSetup ? compileScript(descriptor, { id: path }) : null
  const template = compileTemplate({ source: descriptor.template?.content || '', filename: path, id: path, compilerOptions: { bindingMetadata: script?.bindings } })
  assert.deepEqual(template.errors, [])
}

test('passenger report form is structured, accessible, and requests GPS only after action', () => {
  const page = read('app/pages/passenger/reports.vue')
  compiles('app/pages/passenger/reports.vue')
  for (const category of ['VEHICLE_FULL', 'LONG_WAIT', 'NO_SERVICE_OBSERVED', 'STOP_ISSUE', 'ROUTE_INFORMATION_ISSUE', 'ACCESSIBILITY_ISSUE', 'DISRUPTION', 'OTHER']) assert.match(page, new RegExp(category))
  assert.match(page, /description\.trim\(\)\.length < 10/)
  assert.match(page, /@click="requestLocation"/)
  assert.doesNotMatch(page, /onMounted\([^)]*geolocation\.start/)
  assert.match(page, /pending human review/i)
})

test('selected factual journey prefills exact non-editable transport context', () => {
  const planner = read('app/pages/passenger/trip-planner.vue')
  assert.match(planner, /reportJourneyLink/)
  assert.match(planner, /route: transit\.route\.id/)
  assert.match(planner, /variant: transit\.variant\.id/)
  assert.match(planner, /node: transit\.boardAt\?\.nodeId/)
  assert.match(planner, /Report an issue with this journey/)
  assert.match(read('app/pages/passenger/reports.vue'), /The server will verify these exact records/)
})

test('My Reports shows understandable review states without exact location or reporter identity', () => {
  const page = read('app/pages/passenger/reports.vue')
  for (const copy of ['Pending review', 'Reviewed', 'Report verified', 'Dismissed']) assert.match(page, new RegExp(copy))
  assert.doesNotMatch(page, /report\.latitude|report\.longitude|passenger\.email/)
})

test('LGU and Administrator share an evidence-only review queue', () => {
  const page = read('app/pages/lgu/reports.vue')
  const layout = read('app/layouts/default.vue')
  compiles('app/pages/lgu/reports.vue')
  assert.match(page, /middleware: \['auth', 'lgu'\]/)
  assert.match(page, /VERIFIED means the observation was reviewed/)
  assert.match(page, /Only the report status changed\. Transport truth was not modified/)
  assert.ok((layout.match(/to: '\/lgu\/reports'/g) || []).length === 2)
})

test('shared geolocation no longer requests permission when the app mounts', () => {
  const composable = read('app/composables/useGeolocation.ts')
  const app = read('app/app.vue')
  assert.match(composable, /autoStart = false/)
  assert.match(composable, /if \(autoStart\) onMounted\(start\)/)
  assert.doesNotMatch(app, /useGeolocation/)
})

test('authenticated workspace content waits until hydration completes', () => {
  const layout = read('app/layouts/default.vue')
  assert.match(layout, /const hydrated = ref\(false\)/)
  assert.match(layout, /onMounted\(\(\) => \{\s*hydrated\.value = true/)
  assert.match(layout, /const visibleUser = computed\(\(\) => hydrated\.value \? user\.value : null\)/)
  assert.match(layout, /visibleIsPassenger/)
})

test('frontend report workflow contains no transport, occupancy, or disruption writes', () => {
  const changed = [read('app/pages/passenger/reports.vue'), read('app/pages/lgu/reports.vue')].join('\n')
  assert.doesNotMatch(changed, /api\/(routes|route-variants|transport-nodes|fare-rules|service-patterns|disruptions|vehicles)\b/)
  assert.doesNotMatch(changed, /planning_enabled|current_occupancy|occupancy_level/)
})
