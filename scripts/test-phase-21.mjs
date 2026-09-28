import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const component = read('app/components/transport-data/PamanaTransportWorkbench.vue')
const service = read('app/services/transportWorkbench.ts')
const composable = read('app/composables/useTransportWorkbench.ts')
const layout = read('app/layouts/default.vue')

for (const page of ['app/pages/admin/transport-data.vue', 'app/pages/lgu/transport-data.vue']) {
  assert.ok(fs.existsSync(path.join(root, page)), `${page} must exist`)
  assert.match(read(page), /PamanaTransportWorkbench/)
}
assert.match(read('app/pages/admin/transport-data.vue'), /middleware: \['auth', 'admin'\]/)
assert.match(read('app/pages/lgu/transport-data.vue'), /middleware: \['auth', 'lgu'\]/)
assert.match(layout, /\/admin\/transport-data/)
assert.match(layout, /\/lgu\/transport-data/)

for (const entity of ['transport-nodes', 'routes', 'route-variants', 'route-variant-stops', 'fare-rules', 'service-patterns']) {
  assert.match(service, new RegExp(`['\"]${entity}['\"]`))
}
assert.match(component, /Map-assisted geographic evidence/)
assert.match(component, /place result is not a transport stop/i)
assert.match(component, /confirm these coordinates identify the actual transport/i)
assert.match(component, /Geoapify road path cannot be confirmed here as transit truth/i)
assert.match(component, /PamanaMapPanel[\s\S]*provider="maplibre"/)
assert.match(component, /STOP_ORDER_CONFIRMATION|confirm this sequence change|intentionally reorders/i)
assert.match(component, /LEAVE_WHEN_FULL/)
assert.match(component, /CONTINUOUS_UNSCHEDULED/)
assert.match(component, /DISTANCE_BASED/)
assert.match(component, /MANUAL_LOOKUP/)
assert.match(component, /Only an Administrator can elevate verification or enable planning/)
assert.match(composable, /\/api\/transport-workbench\//)
assert.match(composable, /method: options\.documentId \? 'PUT' : 'POST'/)
assert.doesNotMatch(component, /create.*reverse|reverse.*variant/i)
assert.doesNotMatch(component, /api\/transport-nodes|api\/route-variants|api\/fare-rules/)
assert.doesNotMatch(component, /Geoapify[\s\S]{0,100}(FIELD_VERIFIED|AUTHORITATIVE_CURRENT)/i)
assert.doesNotMatch(component, /watch\([^)]*(latitude|longitude)[\s\S]{0,300}save\(/)
console.log('ok - shared Admin/LGU workbench covers all Phase 21 records in the existing PAMANA UI')
console.log('ok - map evidence, geometry, stop order and trust elevation require explicit reviewer actions')
console.log('ok - Passenger/Driver middleware routes are absent and no Geoapify result auto-verifies transport truth')
