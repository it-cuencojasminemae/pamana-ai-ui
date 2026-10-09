import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { z } from 'zod'
import { validTripPlanResponse, validJourneyDetails } from '../app/services/tripPlanContract.ts'
import { routeCategories, validRouteOptions, journeyNavigationSteps } from '../app/services/routeOptionsPresentation.ts'
import { journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'
import { researchReferenceFeatures } from '../app/services/researchPlanningPresentation.ts'
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const fixture = JSON.parse(read('scripts/fixtures/passenger-route-options.json')).results.find(item => item.response.journeys.length === 2).response
function preview() {
  const response = structuredClone(fixture)
  response.meta.planningMode = 'RESEARCH_PREVIEW'; response.meta.researchPreview = true
  for (const journey of response.journeys) {
    journey.dataQuality.researchPreview = true; journey.dataQuality.verificationStatuses.push('RESEARCH_CANDIDATE')
    journey.legs.filter(leg => leg.type === 'TRANSIT').forEach(leg => { leg.geometrySource = 'RESEARCH_PREVIEW'; leg.availability.evidenceClass = 'SIMULATED' })
  }
  return response
}
test('operational response validation rejects late research and simulated payloads', () => {
  const response = preview(); assert.equal(validTripPlanResponse(response), false)
  assert.equal(validTripPlanResponse(response, 'RESEARCH_PREVIEW'), true)
  assert.equal(validRouteOptions(response.journeys).length, 0)
  assert.equal(validRouteOptions(response.journeys, 'RESEARCH_PREVIEW').length, 2)
  assert.equal(validTripPlanResponse(fixture, 'RESEARCH_PREVIEW'), false)
  const details = { status: 'READY', planningMode: 'OPERATIONAL', journey: response.journeys[0] }
  assert.equal(validJourneyDetails(details, details.journey.id, 'OPERATIONAL'), false)
})
test('research road geometry gets independent classification without inventing missing lines', () => {
  const journey = preview().journeys[0]
  assert.ok(journeyMapPresentation(journey, null, null).lines.filter(line => line.properties.semantic === 'transport-route').every(line => line.properties.geometryClassification === 'RESEARCH_TRANSIT_GEOMETRY'))
  journey.legs.filter(leg => leg.type === 'TRANSIT').forEach(leg => leg.geometry = null)
  assert.equal(journeyMapPresentation(journey, null, null).lines.filter(line => line.properties.semantic === 'transport-route').length, 0)
})
test('research context markers retain source and never change endpoint fit', () => {
  const markers = researchReferenceFeatures([{ id:'research-reference-terminal', name:'Terminal', nodeType:'TERMINAL', lat:15.117429648993976,lng:120.7024058913807 }])
  assert.equal(markers[0].properties.contextualReference,true); assert.equal(markers[0].properties.planningEnabled,false)
  assert.equal(markers[0].properties.evidenceClass,'USER_REPORTED')
})

test('temporary roadside boarding has its own marker and ordered wait/board steps', () => {
  const response = preview(), journey = response.journeys[0]
  const ride = journey.legs.find(leg => leg.type === 'TRANSIT')
  const pin = { lat: 15.126596409675953, lng: 120.69877588559318 }
  ride.boardAt = { ...ride.boardAt, name: 'San Juan main-road roadside pickup', nodeType: 'ROADSIDE_PICKUP', lat: 15.1266256, lng: 120.6988544,
    connector: { temporary: true, role: 'ACCESS', sectionId: 'reviewed-outbound', direction: 'OUTBOUND', evidenceClass: 'LOCAL_RESEARCH', serviceLabel: 'San Juan → Mexico Bayan', fieldBoardingSideVerified: false } }
  ride.boardingInstructions = ['Wait at a safe roadside pickup point for the Mexico Bayan-bound jeepney. Confirm the boarding side and exact roadside position locally.', 'Check the signboard.']
  const geometry = { type: 'LineString', coordinates: [[pin.lng, pin.lat], [ride.boardAt.lng, ride.boardAt.lat]] }
  const walkTemplate = { fare: { ...ride.fare, regularFare:0, discountedFare:0, payableFare:0, sourceType:'FREE_WALK' }, service:ride.service, availability:ride.availability }
  journey.legs.unshift({ ...structuredClone(walkTemplate), type:'WALK', purpose:'ACCESS', sequence:1, from:pin, to:ride.boardAt, distanceMeters:9, durationSeconds:7, source:'GEOAPIFY', calculatedAt:null, geometry, instructions:[{text:'Walk east.', distanceMeters:9, durationSeconds:7}] })
  journey.legs.forEach((leg, index) => leg.sequence = index + 1)
  assert.equal(validTripPlanResponse(response, 'RESEARCH_PREVIEW'), true)
  const before = JSON.stringify(journey), map = journeyMapPresentation(journey, null, null)
  const markers = map.nodes.filter(n => n.properties.semantic === 'roadside-pickup')
  assert.equal(markers.length, 1); assert.equal(markers[0].properties.temporaryRoadside, true)
  assert.match(markers[0].properties.details.join(' '), /Confirm a safe boarding position/)
  assert.deepEqual(map.lines.find(l => l.properties.semantic === 'walking-route').geometry, geometry)
  const steps = journeyNavigationSteps(journey)
  assert.deepEqual(steps.slice(0, 3).map(s => s.type), ['WALK', 'BOARDING', 'TRANSIT'])
  assert.match(steps[1].instruction, /Wait at a safe roadside pickup point/)
  assert.match(steps[2].instruction, /Board the San Juan → Mexico Bayan jeepney/)
  assert.equal(steps[1].fare, ''); assert.equal(steps[2].fare.length > 0, true)
  assert.equal(JSON.stringify(journey), before)
})
test('a category remains unavailable without complete comparable evidence', () => {
  const response = structuredClone(fixture); response.recommendations.mostReliable = { journeyId:null, unavailableReason:'RELIABILITY_EVIDENCE_INSUFFICIENT' }
  assert.equal(routeCategories(response, response.journeys).find(c => c.key === 'mostReliable').unavailable, 'Insufficient evidence')
})
test('capabilities fail closed, reauthorize saved mode, and ignore client-only wishes', async () => {
  const states = new Map(); let payload = { operational:true,researchPreview:true,simulatedObservations:false,
    accessPolicy:{preferredWalkMeters:500,maximumWalkMeters:1500,candidateRadiusMeters:1500},referenceLocations:[] }
  const runtime={ ...Vue,z,AbortController,onBeforeUnmount(){},useState:(key,init)=>{if(!states.has(key))states.set(key,Vue.ref(init()));return states.get(key)},useApi:()=>({apiFetch:async()=>payload}) }
  const code=stripTypeScriptTypes(read('app/composables/usePlanningCapabilities.ts')).replace(/^import .+$/gm,'').replace('export function','function')
  vm.runInNewContext(code+'\nresult=usePlanningCapabilities()',runtime)
  runtime.result.restore('RESEARCH_PREVIEW'); assert.equal(runtime.result.mode.value,'OPERATIONAL')
  await runtime.result.load(); runtime.result.restore('RESEARCH_PREVIEW'); assert.equal(runtime.result.mode.value,'RESEARCH_PREVIEW')
  runtime.result.restore('OPERATIONAL'); assert.equal(runtime.result.mode.value,'RESEARCH_PREVIEW', 'Stale URL choices cannot disable the authorized demo default')
  payload={...payload,researchPreview:false}; await runtime.result.load(); assert.equal(runtime.result.mode.value,'OPERATIONAL')
  payload=null; await runtime.result.load(); assert.equal(runtime.result.mode.value,'OPERATIONAL')
})
test('capability reload cancels a stale grant before it can restore research mode', async () => {
  const states = new Map(), pending = [], cleanup = []
  const runtime = { ...Vue, z, AbortController, onBeforeUnmount: fn => cleanup.push(fn),
    useState: (key, init) => { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key) },
    useApi: () => ({ apiFetch: (_, options) => new Promise(resolve => pending.push({ options, resolve })) }) }
  const code = stripTypeScriptTypes(read('app/composables/usePlanningCapabilities.ts')).replace(/^import .+$/gm, '').replace('export function', 'function')
  vm.runInNewContext(code + '\nresult=usePlanningCapabilities()', runtime)
  const first = runtime.result.load(), second = runtime.result.load()
  assert.equal(pending[0].options.signal.aborted, true)
  const capabilities = { operational: true, researchPreview: false, simulatedObservations: false,
    accessPolicy: { preferredWalkMeters: 500, maximumWalkMeters: 1500, candidateRadiusMeters: 1500 }, referenceLocations: [] }
  pending[1].resolve(capabilities); await second
  pending[0].resolve({ ...capabilities, researchPreview: true }); await first
  assert.equal(runtime.result.mode.value, 'OPERATIONAL')
  cleanup.forEach(fn => fn())
})
test('selected detail requests cancel stale responses across mode changes', async () => {
  const pending=[]; const applied=[]; const scope=Vue.effectScope()
  const runtime={...Vue,validJourneyDetails,AbortController,useApi:()=>({apiFetch:(_,options)=>new Promise(resolve=>pending.push({options,resolve}))}),onBeforeUnmount(){} }
  const code=stripTypeScriptTypes(read('app/composables/useJourneyDetails.ts')).replace(/^import .+$/gm,'').replace('export function','function')
  scope.run(()=>vm.runInNewContext(code+'\nresult=useJourneyDetails()',runtime))
  const research=preview().journeys[0], normal=fixture.journeys[0]
  const first=runtime.result.load({planningMode:'RESEARCH_PREVIEW'},research.id,j=>applied.push(j))
  const second=runtime.result.load({planningMode:'OPERATIONAL'},normal.id,j=>applied.push(j))
  assert.equal(pending[0].options.signal.aborted,true)
  pending[0].resolve({status:'READY',planningMode:'RESEARCH_PREVIEW',journey:research}); await first; assert.equal(applied.length,0)
  pending[1].resolve({status:'READY',planningMode:'OPERATIONAL',journey:normal}); await second; assert.equal(applied.length,1)
  scope.stop()
})

test('applying selected journey details does not repeat details or time requests', async () => {
  const page = read('app/pages/passenger/trip-planner.vue')
  const watchers = page.slice(page.indexOf('watch([() => tripPlan.selectedJourney.value?.id'), page.indexOf('\nwatch(\n', page.indexOf('watch([() => tripPlan.selectedJourney.value?.id')))
  const scope = Vue.effectScope(), journeys = Vue.ref([]), selectedId = Vue.ref(null), request = Vue.shallowRef(null)
  let detailsCalls = 0, timeCalls = 0
  const runtime = { ...Vue, tripPlan: { journeys, selectedJourney: Vue.computed(() => journeys.value.find(j => j.id === selectedId.value)), reset() {} },
    lastTripRequest: request, journeyDetails: { reset() {}, load(_, id, apply) { detailsCalls++; apply({ ...journeys.value.find(j => j.id === id), enriched: true }) } },
    travelTime: { reset() {}, load() { timeCalls++ } }, planning: { mode: Vue.ref('RESEARCH_PREVIEW') }, accessPreference: Vue.ref('WALK_ONLY'),
    journeyExplanation: { reset() {} }, pins: { area: Vue.ref({ travelTimeEnabled: true }), mode: Vue.ref(null) },
    originLocation: Vue.ref(null), destinationLocation: Vue.ref(null), router: { replace() {} }, pageRoute: { query: {} } }
  scope.run(() => vm.runInNewContext(watchers, runtime))
  request.value = { planningMode: 'RESEARCH_PREVIEW' }; journeys.value = [{ id: 'selected' }]; selectedId.value = 'selected'
  await Vue.nextTick(); await Vue.nextTick()
  assert.equal(detailsCalls, 1); assert.equal(timeCalls, 1); assert.equal(journeys.value[0].enriched, true)
  scope.stop()
})
