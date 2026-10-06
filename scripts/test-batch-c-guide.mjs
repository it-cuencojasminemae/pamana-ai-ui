import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as guide from '../app/services/journeyExplanation.ts'
import * as options from '../app/services/routeOptionsPresentation.ts'
import * as trip from '../app/services/tripPlan.ts'
import { journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const payloads = JSON.parse(fs.readFileSync(new URL('./fixtures/passenger-route-options.json', import.meta.url), 'utf8'))
const regular = payloads.results.find(r => r.category === 'REGULAR' && r.response.journeys.length === 2).response
const [direct, transfer] = regular.journeys
const request = journey => guide.buildJourneyExplanationRequest('PSU Mexico', 'SM City Pampanga', journey)
const response = journey => ({ status: 'AVAILABLE', provider: 'openai', explanation: guide.deterministicTripGuide(journey), generatedAt: new Date().toISOString() })
const finishSelected = app => {
  const journey = app.state.tripPlan.selectedJourney.value
  return app.state.journeyExplanation.explain(journey.id, guide.buildJourneyExplanationRequest(app.state.originLocation.value.label, app.state.destinationLocation.value.label, journey))
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

function runtime(apiFetch) {
  const timers = new Map(); let id = 0
  const context = { ...Vue, ...guide, ...options, ...trip, journeyMapPresentation, AbortController,
    useApi: () => ({ apiFetch }), onBeforeUnmount: () => {},
    setTimeout: fn => { timers.set(++id, fn); return id }, clearTimeout: key => timers.delete(key),
  }
  vm.createContext(context)
  for (const file of ['app/composables/useJourneyExplanation.ts', 'app/composables/useTripPlan.ts']) {
    const source = stripTypeScriptTypes(read(file)).replace(/^import .+$/gm, '').replace(/export (function|const)/g, '$1')
    vm.runInContext(source, context)
  }
  return { context, timers, create: () => vm.runInContext('useJourneyExplanation()', context) }
}

function page(apiFetch) {
  const env = runtime(apiFetch), scope = Vue.effectScope()
  Object.assign(env.context, {
    definePageMeta: () => {}, useHead: () => {}, useToast: () => ({ add() {} }), useRoute: () => ({ query: {} }),
    useRouter: () => ({ async replace() {} }), useGeoapify: () => ({}),
    useApproximateJourneyPaths: () => ({ lines: Vue.ref([]) }), onMounted: () => {},
  })
  const source = stripTypeScriptTypes(parse(read('app/pages/passenger/trip-planner.vue')).descriptor.scriptSetup.content).replace(/^import .+$/gm, '')
  scope.run(() => vm.runInContext(`${source}\npageState = {findJourneys,explainSelectedJourney,form,originLocation,destinationLocation,tripPlan,journeyExplanation,mapPresentation,fallbackGuide,resultState}`, env.context))
  const state = env.context.pageState
  state.originLocation.value = { ...regular.request.origin, id: 'origin' }
  state.destinationLocation.value = { ...regular.request.destination, id: 'destination' }
  return { ...env, state, stop() { scope.stop(); state.journeyExplanation.reset(); state.tripPlan.cancel() } }
}

function guideComponent() {
  const { descriptor } = parse(read('app/components/journey/PamanaTripGuide.vue'))
  const script = compileScript(descriptor, { id: 'guide' })
  const template = compileTemplate({ id: 'guide', filename: 'PamanaTripGuide.vue', source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const transform = code => stripTypeScriptTypes(code).replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_, names, quote, source) => `const {${names.replace(/\s+as\s+/g, ': ')}} = ${source === 'vue' ? 'Vue' : 'guide'};`).replace('export default', 'component =').replace('export function render', 'function render')
  const sandbox = { Vue, guide }
  vm.runInNewContext(`${transform(script.content)}\n${transform(template.code)}\ncomponent.render=render`,sandbox)
  return sandbox.component
}
const Guide = guideComponent()
const renderGuide = props => {
  const app=Vue.createSSRApp(Guide,props)
  app.component('UCard',{render(){return Vue.h('section',this.$slots.default?.())}})
  app.component('UButton',{render(){return Vue.h('button',{disabled:this.$attrs.disabled},this.$slots.default?.())}})
  return renderToString(app)
}

test('real pilot payloads contain only passenger facts and fallback keeps returned regular/discounted totals', () => {
  for(const result of payloads.results) for(const journey of result.response.journeys){
    const before=JSON.stringify(journey), body=request(journey), fallback=guide.deterministicTripGuide(journey)
    assert.doesNotMatch(JSON.stringify(body),/RCH-|PILOT-|FIELD_VERIFIED|MANUAL_VERIFIED|DEMO_ESTIMATE|sourceType|headway|geometry|"lat"|"lng"|nodeId|routeId|variantId|duration|"wait"/)
    assert.equal(body.journey.fareSummary.totalFare,journey.fareSummary.totalFare)
    assert.ok(fallback.includes(`₱${journey.fareSummary.totalFare}`))
    assert.equal(guide.safeJourneyGuide(fallback,body),true,fallback)
    assert.equal(JSON.stringify(journey),before)
  }
  assert.match(guide.deterministicTripGuide(direct),/₱27.*No transfer/)
  assert.match(guide.deterministicTripGuide(transfer),/₱114.*1 transfer/)
  const discounted=payloads.results.find(r=>r.category==='STUDENT'&&r.response.journeys.length===2).response.journeys
  assert.match(guide.deterministicTripGuide(discounted[0]),/₱22/); assert.match(guide.deterministicTripGuide(discounted[1]),/₱111/)
})

test('actual Find Best Route selects Recommended and starts only its guide without waiting for AI', async () => {
  const pending=deferred(),calls=[]
  const app=page(async(endpoint,settings)=>{calls.push({endpoint,settings});return endpoint.endsWith('trip-plan')?structuredClone(regular):pending.promise})
  await app.state.findJourneys(); await Vue.nextTick()
  assert.equal(app.state.tripPlan.selectedJourneyId.value,direct.id)
  assert.equal(app.state.tripPlan.loading.value,false); assert.equal(app.state.tripPlan.journeys.value.length,2)
  assert.ok(app.state.mapPresentation.value.lines.some(line=>line.properties.semantic==='transport-route'))
  assert.equal(app.state.journeyExplanation.loading.value,true)
  assert.equal(calls.filter(call=>call.endpoint.endsWith('journey-explanation')).length,1)
  assert.equal(calls.at(-1).settings.body.journey.fareSummary.totalFare,27)
  pending.resolve(response(direct)); await finishSelected(app)
  app.stop()
})

test('only the compact guide area renders loading, valid text or friendly fallback', async () => {
  const loading=await renderGuide({loading:true,response:null,fallback:guide.deterministicTripGuide(direct)})
  assert.match(loading,/PAMANA AI Trip Guide|PAMANA AI is preparing your trip guide/)
  assert.doesNotMatch(loading,/₱27|MapLibre|OPTION A/)
  const available=await renderGuide({loading:false,response:response(direct),fallback:'Fallback'})
  assert.match(available,/₱27|No transfer is needed|Explain again/)
  const failed=await renderGuide({loading:false,response:{status:'PROVIDER_UNAVAILABLE',explanation:null},fallback:guide.deterministicTripGuide(transfer)})
  assert.match(failed,/Trip guide is temporarily unavailable|₱114|1 transfer/)
  assert.doesNotMatch(failed,/HTTP|stack|provider|DEMO_ESTIMATE|RCH-/)
})

test('selecting an unexplained option invokes once, back-and-forth uses current-search cache', async () => {
  const calls=[];const app=page(async(endpoint,settings)=>{if(endpoint.endsWith('trip-plan'))return structuredClone(regular);calls.push(settings.body);return response(settings.body.journey.transferCount?transfer:direct)})
  await app.state.findJourneys();await Vue.nextTick();await finishSelected(app)
  app.state.tripPlan.selectedJourneyId.value=transfer.id;await Vue.nextTick();await finishSelected(app)
  assert.equal(app.state.tripPlan.selectedJourney.value.id,transfer.id);assert.match(app.state.journeyExplanation.response.value.explanation,/₱114/)
  const lines=JSON.stringify(app.state.mapPresentation.value.lines)
  app.state.tripPlan.selectedJourneyId.value=direct.id;await Vue.nextTick()
  assert.match(app.state.journeyExplanation.response.value.explanation,/₱27/)
  app.state.tripPlan.selectedJourneyId.value=transfer.id;await Vue.nextTick()
  assert.equal(JSON.stringify(app.state.mapPresentation.value.lines),lines);assert.equal(calls.length,2)
  await app.state.explainSelectedJourney();assert.equal(calls.length,3);assert.equal(calls.at(-1).journey.transferCount,1)
  app.stop()
})

test('late Option A fills only its cache and cannot replace selected Option B', async () => {
  const a=deferred(),b=deferred(),runtimeEnv=runtime(async(_endpoint,settings)=>settings.body.journey.transferCount?b.promise:a.promise),state=runtimeEnv.create()
  const one=state.explain(direct.id,request(direct)),two=state.explain(transfer.id,request(transfer))
  a.resolve(response(direct));await one;assert.equal(state.response.value,null);assert.equal(state.loading.value,true)
  b.resolve(response(transfer));await two;assert.match(state.response.value.explanation,/₱114/)
  await state.explain(direct.id,request(direct));assert.match(state.response.value.explanation,/₱27/)
  state.reset()
})

test('new Find Best Route invalidates cache; old search guide cannot overwrite the new selection', async () => {
  const a=deferred(),b=deferred();let aiCalls=0
  const app=page(async endpoint=>endpoint.endsWith('trip-plan')?structuredClone(regular):(++aiCalls===1?a.promise:b.promise))
  await app.state.findJourneys();await Vue.nextTick()
  await app.state.findJourneys();await Vue.nextTick();assert.equal(aiCalls,2)
  a.resolve(response(transfer));await Vue.nextTick();await Vue.nextTick()
  assert.equal(app.state.journeyExplanation.response.value,null)
  b.resolve(response(direct));await finishSelected(app)
  assert.match(app.state.journeyExplanation.response.value.explanation,/₱27/)
  app.stop()
})

test('explicit regeneration discards older in-flight response and regenerates only selected journey', async () => {
  const a=deferred(),b=deferred();let calls=0;const state=runtime(async()=>++calls===1?a.promise:b.promise).create()
  const initial=state.explain(direct.id,request(direct)),forced=state.explain(direct.id,request(direct),true)
  a.resolve(response(direct));await initial;assert.equal(state.response.value,null)
  b.resolve(response(direct));await forced;assert.equal(state.loading.value,false);assert.equal(calls,2)
  await state.explain(direct.id,request(direct));assert.equal(calls,2);state.reset()
})

test('failure is cached once; route cards, map and deterministic details remain usable', async () => {
  let calls=0;const app=page(async endpoint=>{if(endpoint.endsWith('trip-plan'))return structuredClone(regular);calls++;throw Error('HTTP 429 raw provider body secret')})
  await app.state.findJourneys();await Vue.nextTick();await Vue.nextTick()
  assert.equal(app.state.journeyExplanation.response.value.status,'PROVIDER_UNAVAILABLE')
  assert.equal(app.state.tripPlan.journeys.value.length,2);assert.ok(app.state.mapPresentation.value.lines.length)
  assert.match(app.state.fallbackGuide.value,/₱27/)
  app.state.tripPlan.selectedJourneyId.value=transfer.id;await Vue.nextTick();await Vue.nextTick()
  app.state.tripPlan.selectedJourneyId.value=direct.id;await Vue.nextTick();assert.equal(calls,2)
  await app.state.explainSelectedJourney();assert.equal(calls,3);app.stop()
})

test('timeout bounds a hung network request, clears guide loading and ignores late output', async () => {
  const pending=deferred(),env=runtime(async()=>pending.promise),state=env.create()
  const task=state.explain(direct.id,request(direct));for(const callback of env.timers.values())callback()
  await task;assert.equal(state.loading.value,false);assert.equal(state.response.value.status,'PROVIDER_UNAVAILABLE')
  pending.resolve(response(direct));await Vue.nextTick();assert.equal(state.response.value.status,'PROVIDER_UNAVAILABLE');state.reset()
})

test('technical leakage, invented facts, fare mismatch and malformed API results never display', async () => {
  const body=request(direct),text=response(direct).explanation
  for(const bad of [text+' FIELD_VERIFIED',text+' RCH-SJ-SMROB-OUT',text+' 1234567890abcdef12345678',text+' The trip takes 35 minutes.',text+' High availability.',text.replace('₱27','₱28'),text.replace('₱27','₱27.00'),text.replace('No transfer','1 transfer'),'<script>secret</script>']){
    assert.equal(guide.safeJourneyGuide(bad,body),false,bad)
    const output=await guide.fetchJourneyExplanation(async()=>({...response(direct),explanation:bad}),body)
    assert.equal(output.status,'PROVIDER_UNAVAILABLE');assert.equal(output.explanation,null)
  }
  assert.equal((await guide.fetchJourneyExplanation(async()=>({status:'AVAILABLE',explanation:'unsafe'}),body)).status,'PROVIDER_UNAVAILABLE')
})

test('empty/failed searches never invoke AI and ordinary rendering does not create request loops', async () => {
  for(const result of ['empty','error']){
    let calls=0;const empty={...structuredClone(regular),status:'NO_TRANSPORT_JOURNEY',journeys:[],meta:{...regular.meta,journeyCount:0},recommendations:undefined}
    const app=page(async endpoint=>{if(endpoint.endsWith('journey-explanation')){calls++;return response(direct)}if(result==='error')throw Error('offline');return empty})
    await app.state.findJourneys();for(let i=0;i<5;i++)await Vue.nextTick()
    assert.equal(calls,0);assert.equal(app.state.journeyExplanation.loading.value,false);app.stop()
  }
})

test('disrupted empty search renders its specific message without starting an AI guide', async () => {
  let calls = 0
  const empty = { ...structuredClone(regular), status: 'NO_TRANSPORT_JOURNEY', journeys: [],
    warnings: ['NO_JOURNEY_DUE_TO_ACTIVE_DISRUPTION'], recommendations: undefined,
    meta: { ...regular.meta, journeyCount: 0 } }
  const app = page(async endpoint => {
    if (endpoint.endsWith('journey-explanation')) { calls++; return response(direct) }
    return empty
  })
  await app.state.findJourneys(); await Vue.nextTick()
  assert.match(app.state.resultState.value.title, /active disruption/i)
  assert.equal(app.state.tripPlan.selectedJourney.value, null)
  assert.equal(calls, 0)
  app.state.tripPlan.response.value = { ...empty, warnings: [] }
  assert.doesNotMatch(app.state.resultState.value.title, /disruption/i)
  app.stop()
})

test('phone guide remains a compact supporting card; API access is backend-only', () => {
  const component=read('app/components/journey/PamanaTripGuide.vue'),pageSource=read('app/pages/passenger/trip-planner.vue')
  assert.match(component,/flex-wrap|leading-relaxed/);assert.doesNotMatch(component,/table|min-w-\[/)
  assert.match(pageSource,/flush: 'post'/);assert.match(pageSource,/journeyExplanation\.reset\(\)/)
  assert.doesNotMatch(pageSource,/AI explains PAMANA's computed journey|Explain this trip/)
  assert.doesNotMatch([component,pageSource,read('app/services/journeyExplanation.ts'),read('nuxt.config.ts')].join('\n'),/OPENAI_API_KEY|api\.openai\.com|from ['"]openai['"]/)
})
