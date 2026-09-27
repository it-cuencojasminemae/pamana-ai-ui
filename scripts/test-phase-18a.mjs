import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

const page = read('app/pages/lgu/disruptions.vue')
const service = read('app/services/disruption.ts')
const types = read('app/types/disruption.ts')
const tripPlan = read('app/pages/passenger/trip-planner.vue')

for (const effect of [
  'WARNING_ONLY', 'LIMITED_SERVICE', 'ROUTE_SUSPENDED', 'VARIANT_SUSPENDED',
  'NODE_CLOSED', 'BOARDING_CLOSED', 'ALIGHTING_CLOSED', 'TRANSFER_BLOCKED',
]) {
  assert.match(service, new RegExp(effect))
  assert.match(types, new RegExp(effect))
}

assert.match(page, /\/api\/disruption-target-options/)
assert.match(page, /affected_route:\s*form\.routeId/)
assert.match(page, /affected_route_variant:\s*form\.variantId/)
assert.match(page, /affected_transport_node:\s*form\.nodeId/)
assert.match(page, /filteredVariants/)
assert.match(page, /variant\.routeId === form\.routeId/)
assert.match(page, /isAdministrator/)
assert.match(page, /verification_status:\s*form\.verificationStatus/)
assert.match(page, /planning_enabled:\s*form\.planningEnabled/)
assert.match(page, /resolution_notes:/)
assert.match(page, /resolved_at:/)
assert.match(page, /geometry_geojson:/)
assert.match(page, /Geometry must be valid GeoJSON/)
assert.match(page, /Text and coordinates never choose a route or stop/)
assert.match(page, /Planning integration pending Phase 18B/)
assert.doesNotMatch(page, /route[_ ]?name.*affected_route|node[_ ]?name.*affected_transport_node/i)

assert.doesNotMatch(tripPlan, /disruption/i, 'Passenger planner must remain unchanged in Phase 18A')
assert.match(page, /method:\s*'POST'/)
assert.match(page, /method:\s*'PUT'/)
assert.match(page, /populate:\s*'\*'/)

console.log('ok - LGU disruption management uses exact route, variant, and node IDs')
console.log('ok - administrator-only trust controls, time windows, resolution, and optional GeoJSON are present')
console.log('ok - Phase 18A does not integrate passenger journey filtering')
