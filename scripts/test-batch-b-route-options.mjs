import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as presentation from '../app/services/routeOptionsPresentation.ts'
import { journeyMapPresentation, formatFare } from '../app/services/tripPlanPresentation.ts'
import { fetchTripPlan, tripPlanFingerprint } from '../app/services/tripPlan.ts'
import { validTripPlanResponse } from '../app/services/tripPlanContract.ts'

const payloads = JSON.parse(fs.readFileSync(new URL('./fixtures/passenger-route-options.json', import.meta.url), 'utf8'))
const emptyRecommendations = JSON.parse(fs.readFileSync(new URL('./fixtures/empty-recommendations.json', import.meta.url), 'utf8'))
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const regular = payloads.results.find(r => r.category === 'REGULAR' && r.response.journeys.length === 2)
const student = payloads.results.find(r => r.category === 'STUDENT' && r.response.journeys.length === 2)
const responseFor = result => structuredClone(result.response)
const direct = regular.response.journeys[0], transfer = regular.response.journeys[1]

function component(file) {
  const { descriptor, errors } = parse(read(file))
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: file })
  const template = compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const transform = code => stripTypeScriptTypes(code)
    .replace(/import\s+\{([^}]+)\}\s+from\s+(['"])(.*?)\2;?/g, (_, names, quote, source) => `const {${names.replace(/\s+as\s+/g, ': ')}} = ${source === 'vue' ? 'Vue' : 'presentation'};`)
    .replace('export default', 'component =').replace('export function render', 'function render')
  const sandbox = { ...Vue, Vue, presentation }
  vm.runInNewContext(`${transform(script.content)}\n${transform(template.code)}\ncomponent.render = render`, sandbox)
  return sandbox.component
}
const Card = component('app/components/journey/PamanaJourneyCard.vue')
const Details = component('app/components/journey/PamanaJourneyDetails.vue')
const shell = tag => ({ render() { return Vue.h(tag, this.$slots.default?.()) } })
function registerUi(app) {
  app.component('UIcon', { render() { return Vue.h('span', { 'aria-hidden': true }) } })
  app.component('UBadge', shell('span')); app.component('UCard', shell('section'))
  return app
}
const renderCard = (journey, props = {}) => renderToString(registerUi(Vue.createSSRApp(Card, { journey, optionNumber: 1, ...props })))
const renderDetails = journey => renderToString(registerUi(Vue.createSSRApp(Details, { journey })))

test('walking instructions surround the existing ride steps in planner order without AI or extra fare', async () => {
  const journey = structuredClone(direct)
  const walk = (sequence, label, text) => ({ type: 'WALK', sequence, from: { label: 'Pinned location' }, to: { label },
    distanceMeters: 200, durationSeconds: 180, instructions: [{ text }] })
  journey.legs = [walk(0, 'the verified pickup', 'Turn left onto the pedestrian path.'), ...journey.legs, walk(2, 'your destination', 'Walk east along the sidewalk.')]
  const before = JSON.stringify(journey)
  const html = await renderDetails(journey)
  assert.ok(html.indexOf('Turn left onto the pedestrian path.') < html.indexOf('Take a jeep'))
  assert.ok(html.indexOf('Walk east along the sidewalk.') > html.indexOf('Take a jeep'))
  assert.equal((html.match(/<strong>₱27<\/strong>/g) || []).length, 1)
  assert.equal(JSON.stringify(journey), before)
  journey.legs[0].instructions = []
  assert.match(await renderDetails(journey), /Walking directions are unavailable/)
})

function planner(apiFetch) {
  const source = stripTypeScriptTypes(read('app/composables/useTripPlan.ts'))
    .replace(/^import .+$/gm, '').replace('export const useTripPlan', 'const useTripPlan')
  const sandbox = { ...Vue, ...presentation, AbortController, fetchTripPlan, tripPlanFingerprint,
    useApi: () => ({ apiFetch }), onBeforeUnmount: () => {} }
  vm.runInNewContext(`${source}\nresult = useTripPlan()`, sandbox)
  return sandbox.result
}

test('actual regular Passenger DTOs render readable cards with payable integer fares and correct transfers', async () => {
  for (const result of payloads.results.filter(r => r.category === 'REGULAR')) {
    assert.equal(validTripPlanResponse(responseFor(result)), true)
    for (const journey of result.response.journeys) {
      const before = JSON.stringify(journey), html = await renderCard(journey)
      assert.ok(html.includes(formatFare(journey.fareSummary.totalFare)))
      assert.ok(html.includes(`${journey.transferCount} ${journey.transferCount === 1 ? 'Transfer' : 'Transfers'}`))
      assert.match(html, /OPTION A/); assert.doesNotMatch(html, /₱\d+\.\d/)
      assert.equal(JSON.stringify(journey), before)
    }
  }
  assert.match(await renderCard(direct), /₱27/)
  assert.match(await renderCard(transfer), /₱114/)
  assert.match(await renderCard(transfer), /Tricycle/)
  assert.match(await renderCard(transfer), /Jeep/)
})

test('explicit discount context displays backend payable totals and keeps the tricycle at 100', async () => {
  for (const result of payloads.results.filter(r => r.category === 'STUDENT')) {
    for (const journey of result.response.journeys) {
      const html = await renderCard(journey)
      assert.ok(html.includes(formatFare(journey.fareSummary.totalFare)))
      assert.doesNotMatch(html, /₱\d+\.\d/)
    }
  }
  assert.match(await renderCard(student.response.journeys[0]), /₱22/)
  assert.match(await renderCard(student.response.journeys[1]), /₱111/)
  assert.match(await renderDetails(student.response.journeys[1]), /Estimated fare.*₱100/s)
  assert.equal(payloads.results.find(r => r.category === 'REGULAR' && r.response.journeys[0].fareSummary.totalFare === 28).response.journeys[0].fareSummary.totalFare, 28)
})

test('cards, details and route-map labels do not expose backend identifiers or fare provenance', async () => {
  for (const journey of regular.response.journeys) {
    const html = `${await renderCard(journey)}${await renderDetails(journey)}`
    assert.doesNotMatch(html, /RCH-|PILOT-|FIELD_VERIFIED|MANUAL_VERIFIED|DEMO_ESTIMATE|SYSTEM_CALCULATED|STORED_ROUTE_STOP_DISTANCE|PUJ_TRADITIONAL|geometry_source|sourceType/)
    for (const leg of journey.legs.filter(l => l.type === 'TRANSIT')) {
      assert.ok(!html.includes(leg.variant.id)); assert.ok(!html.includes(leg.route.id))
    }
    const map = journeyMapPresentation(journey, null, null)
    assert.doesNotMatch(map.lines.map(l => l.properties.label).join(' '), /RCH-|PILOT-/)
  }
})

test('null time/wait/availability are hidden, walking minutes never become a journey ETA', async () => {
  const card = presentation.routeOptionPresentation(direct, 1)
  assert.equal(card.totalTime, null); assert.equal(card.wait, null); assert.equal(card.availability, null)
  const html = await renderCard(direct)
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /Est\. wait|\d+ min|\bETA\b|High availability|undefined|null|UNKNOWN/)
  const known = structuredClone(direct)
  known.legs.find(l => l.type === 'TRANSIT').availability.wait = { status: 'ESTIMATED_WINDOW', lowMinutes: 5, highMinutes: 9 }
  assert.match(await renderCard(known), /Est\. wait: 5–9 min/)
  known.legs.find(l => l.type === 'TRANSIT').availability.wait.status = 'SERVICE_INTERVAL_ONLY'
  assert.doesNotMatch(await renderCard(known), /Est\. wait/)
})

test('deterministic route details show pickup, drop-off, signboard and transfer instructions', async () => {
  const html = await renderDetails(transfer)
  const legs = transfer.legs.filter(l => l.type === 'TRANSIT')
  assert.match(html, /Route details|Pickup|Drop-off/)
  assert.ok(html.includes(legs[0].boardAt.name)); assert.ok(html.includes(legs.at(-1).alightAt.name))
  assert.match(html, /Take a tricycle/); assert.match(html, /Transfer to a jeep/)
  assert.doesNotMatch(read('app/components/journey/PamanaJourneyDetails.vue'), /OpenAI|journeyExplanation|fetch\(/)
})

test('recommended selection uses explicit backend ID then deterministic first valid option', () => {
  const data = responseFor(regular)
  assert.equal(presentation.defaultRouteOption(data), direct.id)
  data.recommendations.recommended.journeyId = transfer.id
  assert.equal(presentation.defaultRouteOption(data), transfer.id)
  delete data.recommendations
  assert.equal(presentation.defaultRouteOption(data), direct.id)
  data.journeys[0].dataQuality.planningEligible = false
  assert.equal(presentation.defaultRouteOption(data), transfer.id)
  data.journeys[1].dataQuality.dataModes = ['SIMULATED']
  assert.equal(presentation.defaultRouteOption(data), null)
})

test('frontend reads category IDs without sorting fares or inventing fastest', () => {
  const data = responseFor(regular), categories = presentation.routeCategories(data, data.journeys)
  assert.equal(categories.find(c => c.key === 'cheapest').journeyId, direct.id)
  assert.equal(categories.find(c => c.key === 'fewestTransfers').journeyId, direct.id)
  assert.deepEqual(categories.find(c => c.key === 'fastest'), { key: 'fastest', label: 'Fastest', journeyId: null, unavailable: 'Time data unavailable' })
  data.recommendations.cheapest.journeyId = transfer.id
  assert.equal(presentation.routeCategories(data, data.journeys).find(c => c.key === 'cheapest').journeyId, transfer.id)
  delete data.recommendations
  assert.equal(presentation.routeCategories(data, data.journeys).find(c => c.key === 'cheapest').journeyId, null)
  assert.doesNotMatch(read('app/services/routeOptionsPresentation.ts'), /\.sort\(|Math\.min|totalFare\s*[+-]/)
})

test('a single returned journey renders one card with all five applicable badges and its own geometry', async () => {
  const data = responseFor(regular)
  data.journeys = [data.journeys[0]]; data.meta.journeyCount = 1
  for (const key of ['recommended', 'cheapest', 'fastest', 'fewestTransfers', 'mostReliable'])
    data.recommendations[key] = { journeyId: direct.id, unavailableReason: null }
  const current = planner(async () => data)
  await current.search(data.request)
  assert.equal(current.journeys.value.length, 1)
  assert.equal(current.selectedJourney.value.id, direct.id)
  const badges = presentation.routeCategories(data, current.journeys.value)
    .filter(category => category.journeyId === direct.id).map(category => category.label)
  assert.equal(badges.length, 5)
  const html = await renderCard(current.selectedJourney.value, { badges })
  for (const badge of badges) assert.ok(html.includes(badge))
  assert.deepEqual(journeyMapPresentation(current.selectedJourney.value, null, null), journeyMapPresentation(direct, null, null))
})

test('actual composable auto-selects Recommended, synchronizes selected map and clears loading', async () => {
  const data = responseFor(regular); data.recommendations.recommended.journeyId = transfer.id
  const current = planner(async () => data)
  await current.search(regular.response.request)
  assert.equal(current.loading.value, false); assert.equal(current.selectedJourneyId.value, transfer.id)
  const map = Vue.computed(() => journeyMapPresentation(current.selectedJourney.value, null, null))
  const transferCoordinates = map.value.lines.filter(l => l.properties.semantic === 'transport-route').map(l => l.geometry.coordinates)
  current.selectedJourneyId.value = direct.id
  assert.equal(current.selectedJourney.value.id, direct.id)
  assert.notDeepEqual(map.value.lines.filter(l => l.properties.semantic === 'transport-route').map(l => l.geometry.coordinates), transferCoordinates)
})

test('loading blocks duplicate submissions; error and empty responses have safe states', async () => {
  let release, calls = 0
  const current = planner(() => { calls++; return new Promise(resolve => { release = resolve }) })
  const pending = current.search(regular.response.request)
  assert.equal(current.loading.value, true)
  assert.equal(presentation.routeResultState(true, null, true, []).kind, 'loading')
  await current.search(regular.response.request); assert.equal(calls, 1)
  release(responseFor(regular)); await pending; assert.equal(current.loading.value, false)
  const failure = planner(async () => { throw new Error('private-provider-details') })
  await failure.search(regular.response.request)
  assert.equal(failure.loading.value, false)
  const state = presentation.routeResultState(false, failure.error.value, true, [])
  assert.equal(state.kind, 'error'); assert.doesNotMatch(JSON.stringify(state), /private|SERVICE_UNAVAILABLE|403/)
  const empty = planner(async () => ({ ...responseFor(regular), status: 'NO_TRANSPORT_JOURNEY', journeys: [], recommendations: structuredClone(emptyRecommendations), meta: { ...regular.response.meta, journeyCount: 0 } }))
  await empty.search(regular.response.request)
  assert.equal(empty.selectedJourney.value, null)
  assert.equal(presentation.routeResultState(false, null, true, []).kind, 'empty')
  assert.equal(presentation.routeResultState(false, null, false, []).kind, 'idle')
})

test('actual card click emits selection, updates selected style and selected map geometry', async () => {
  const node = type => ({ type, children: [], props: {}, parent: null, text: '' })
  const renderer = Vue.createRenderer({
    createElement: node, createText: text => ({ ...node('#text'), text }), createComment: text => ({ ...node('#comment'), text }),
    insert(child, parent, anchor) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = parent; const index = parent.children.indexOf(anchor); parent.children.splice(index < 0 ? parent.children.length : index, 0, child) },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1) },
    setText(el, text) { el.text = text }, setElementText(el, text) { el.text = text; el.children = [] },
    parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] || null,
    patchProp(el, key, previous, next) { el.props[key] = next },
  })
  const selected = Vue.ref(direct.id), selectedJourney = Vue.computed(() => regular.response.journeys.find(j => j.id === selected.value))
  const map = Vue.computed(() => journeyMapPresentation(selectedJourney.value, null, null))
  const root = node('root')
  const app = renderer.createApp({ render: () => Vue.h(Card, { journey: transfer, optionNumber: 2, selected: selected.value === transfer.id, onSelect: id => { selected.value = id } }) })
  registerUi(app).mount(root)
  const find = (el, type) => el.type === type ? el : el.children.map(child => find(child, type)).find(Boolean)
  const button = find(root, 'button'), before = JSON.stringify(map.value.lines)
  assert.equal(button.props['aria-pressed'], false)
  button.props.onClick(); await Vue.nextTick()
  assert.equal(selected.value, transfer.id); assert.equal(button.props['aria-pressed'], true)
  assert.notEqual(JSON.stringify(map.value.lines), before)
  app.unmount()
})

test('responsive structure retains tap targets, wrapping cards and existing map fit intent', () => {
  const card = read('app/components/journey/PamanaJourneyCard.vue'), page = read('app/pages/passenger/trip-planner.vue')
  assert.match(card, /w-full min-w-0 p-4/); assert.match(card, /grid-cols-2/); assert.match(card, /break-words/)
  assert.match(page, /lg:grid-cols-5/); assert.match(page, /min-h-12 min-w-0/)
  assert.match(page, /:fit-key="mapFitKey"/); assert.match(page, /:nodes="\[\.\.\.mapPresentation.nodes, \.\.\.researchMarkers\]"/)
  assert.match(page, /if \(!pageReady.value \|\| tripPlan.loading.value\) return/)
  assert.match(page, /passengerCategory: 'Regular fare'/)
  assert.doesNotMatch(page.match(/async function findJourneys\(\)[\s\S]*?\n}/)?.[0] || '', /journeyExplanation\.explain/)
})
