import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { passengerCameraBounds, SAN_JUAN_CENTER, PASSENGER_INITIAL_ZOOM } from '../app/services/passengerMapCamera.ts'
import { createFitPolicy } from '../app/services/mapPresentation.ts'
import { locationMapFeature } from '../app/services/locationPresentation.ts'
import { researchReferenceFeatures } from '../app/services/researchPlanningPresentation.ts'
const area = JSON.parse(fs.readFileSync(new URL('./fixtures/san-juan-pin-area.json', import.meta.url)))
const selected = (lat, lng, mode = 'origin') => locationMapFeature({ id: 'exact', lat, lng, source: 'MAP_PIN', label: 'Exact pin' }, mode)
const references = researchReferenceFeatures([{ id: 'research-reference-csf', name: 'City Proper', nodeType: 'TERMINAL', lat: 15.029, lng: 120.692 }])

test('empty passenger viewport ignores catalogs and live/device positions', () => {
  const vehicle = { type: 'Feature', geometry: { type: 'Point', coordinates: [121, 16] }, properties: { semantic: 'vehicle' } }
  assert.equal(passengerCameraBounds([...references, vehicle, { ...vehicle, properties: { semantic: 'passenger' } }], area.boundary), null)
  assert.deepEqual(SAN_JUAN_CENTER, [120.7024058913807, 15.117429648993976])
  assert.equal(PASSENGER_INITIAL_ZOOM, 14.5)
})
test('single San Fernando endpoint fits with the San Juan anchor, preserving exact coordinates', () => {
  const endpoint = selected(15.039373960293801, 120.68311389238005)
  assert.deepEqual(passengerCameraBounds([...references, endpoint], area.boundary),
    [[120.68311389238005, 15.039373960293801], SAN_JUAN_CENTER])
})
test('a local pin does not include San Fernando catalog extents', () => {
  const endpoint = selected(15.1178, 120.7029)
  assert.deepEqual(passengerCameraBounds([...references, endpoint], area.boundary), [[120.7029, 15.1178], [120.7029, 15.1178]])
})
test('both endpoints and routed ride/walking geometry determine selected journey framing', () => {
  const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[120.71, 15.09], [120.68, 15.03]] }, properties: { semantic: 'walking-route' } }
  assert.deepEqual(passengerCameraBounds([selected(15.1178, 120.7029), selected(15.04, 120.69, 'destination'), line, ...references], area.boundary),
    [[120.68, 15.03], [120.71, 15.1178]])
})
test('replacement/swapping trigger fits; label, geometry and poll refreshes with the same intent do not', () => {
  const policy = createFitPolicy()
  for (const [intent, fit] of [['', true], ['15.1178|120.7029', true], ['15.1178|120.7029', false],
    ['15.118|120.703', true], ['15.04|120.69|15.118|120.703', true], ['15.118|120.703|15.04|120.69', true], ['', true]])
    assert.equal(policy.shouldFit(intent, true), fit)
})
