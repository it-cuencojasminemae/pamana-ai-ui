import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { fetchTripPlan, tripPlanFingerprint } from '../app/services/tripPlan.ts'
import { validTripPlanResponse } from '../app/services/tripPlanContract.ts'
import { journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'
import { defaultRouteOption, validRouteOptions } from '../app/services/routeOptionsPresentation.ts'

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const code = file => stripTypeScriptTypes(read(file).replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/\bexport default /g, '').replace(/\bexport /g, '').replace(/import\.meta\.client/g, 'true').replace(/import\.meta\.server/g, 'false'))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function authHarness(role = 'Passenger') {
  const states = new Map(), storage = new Map(), calls = [], navigations = []
  let failure = null
  const sandbox = {
    ...Vue, useState: (key, factory) => { if (!states.has(key)) states.set(key, Vue.ref(factory())); return states.get(key) },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    PAMANA_ROLES: { PASSENGER: 'Passenger', DRIVER: 'Driver', LGU: 'LGU', ADMINISTRATOR: 'Administrator' },
    ROLE_HOME_ROUTES: { Passenger: '/passenger', Driver: '/driver', LGU: '/lgu', Administrator: '/admin' },
    navigateTo: async path => { navigations.push(path); return path },
    useApi: () => ({ apiFetch: async (endpoint, options) => {
      calls.push({ endpoint, options })
      if (failure) throw failure
      if (endpoint === '/api/users/me?populate=role') return { id: 1, role: { name: role } }
      return { jwt: 'synthetic-token' }
    } }),
  }
  const auth = vm.runInNewContext(`${code('app/composables/useAuth.ts')}\nuseAuth()`, sandbox)
  return { auth, calls, storage, navigations, sandbox, fail: error => { failure = error } }
}

test('all four roles log in, redirect, restore once and reject other role pages', async () => {
  for (const [role, home] of Object.entries({ Passenger: '/passenger', Driver: '/driver', LGU: '/lgu', Administrator: '/admin' })) {
    const state = authHarness(role)
    await state.auth.login({ identifier: 'synthetic-user', password: 'synthetic-password' })
    assert.equal(state.auth.isAuthenticated.value, true)
    await state.auth.redirectByRole()
    assert.equal(state.navigations.at(-1), home)
    state.auth.user.value = null; state.auth.token.value = null
    await state.auth.restoreSession(); await state.auth.restoreSession()
    assert.equal(state.calls.filter(call => call.endpoint.includes('/users/me')).length, 2)
    assert.equal(state.auth.role.value, role)
    const guard = vm.runInNewContext(`${code('app/middleware/admin.ts')}\n`, {
      ...state.sandbox, useAuth: () => state.auth, defineNuxtRouteMiddleware: fn => fn,
    })
    const destination = await guard()
    assert.equal(destination, role === 'Administrator' ? undefined : home)
  }
})

test('registration creates passenger profile; failed login/restore clears stale credentials', async () => {
  const state = authHarness()
  await state.auth.register({ username: 'synthetic', email: 'synthetic@example.test', password: 'synthetic-password', firstName: 'Test', lastName: 'Only' })
  const profile = state.calls.find(call => call.endpoint === '/api/passenger-profiles')
  assert.equal(profile.options.body.data.first_name, 'Test')
  assert.equal(profile.options.body.data.user, undefined, 'identity is assigned server-side')
  state.fail(new Error('Synthetic network failure'))
  await assert.rejects(state.auth.login({ identifier: 'synthetic', password: 'synthetic-password' }))
  assert.equal(state.storage.size, 0)
  assert.equal(state.auth.isAuthenticated.value, false)
  state.storage.set('pamana_token', 'synthetic-expired')
  await state.auth.restoreSession()
  assert.equal(state.storage.size, 0)
})

test('logout revokes server session before clearing local state, including network failure', async () => {
  for (const unavailable of [false, true]) {
    const state = authHarness()
    await state.auth.login({ identifier: 'synthetic', password: 'synthetic-password' })
    if (unavailable) state.fail(new Error('Synthetic backend outage'))
    await state.auth.logout()
    assert.equal(state.calls.at(-1).endpoint, '/api/auth/logout')
    assert.equal(state.calls.at(-1).options.method, 'POST')
    assert.equal(state.auth.isAuthenticated.value, false)
    assert.equal(state.storage.size, 0)
    assert.equal(state.navigations.at(-1), '/login')
  }
})

test('simultaneous expired API requests share one refresh and retry with the new token', async () => {
  const states = new Map([['auth-token', Vue.ref('synthetic-old')], ['auth-user', Vue.ref({ id: 1 })]])
  const gate = deferred(); let refreshes = 0, retries = 0
  const make = vm.runInNewContext(`${code('app/composables/useApi.ts')}\nuseApi`, {
    useNuxtApp: () => app, useRuntimeConfig: () => ({ public: { apiUrl: 'http://synthetic.test' } }),
    useState: key => states.get(key), localStorage: { setItem() {}, removeItem() {} }, navigateTo() {},
    $fetch: async (url, options) => {
      if (url.endsWith('/auth/refresh')) { refreshes++; await gate.promise; return { jwt: 'synthetic-new' } }
      if (options.headers.Authorization === 'Bearer synthetic-old') throw { statusCode: 401 }
      retries++; return { ok: true }
    },
  })
  const app = {}
  const first = make().apiFetch('/api/synthetic'), second = make().apiFetch('/api/synthetic')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(refreshes, 1)
  gate.resolve(); await Promise.all([first, second])
  assert.equal(retries, 2)
  assert.equal(states.get('auth-token').value, 'synthetic-new')
})

test('malformed trip responses never reach journey rendering; failures stay sanitized', async () => {
  const request = { origin: { lat: 14, lng: 119 }, destination: { lat: 14.01, lng: 119.01 }, departureAt: new Date().toISOString(), passengerCategory: 'REGULAR' }
  for (const body of [null, {}, { status: 'NO_TRANSPORT_JOURNEY', journeys: [], meta: {} },
    { status: 'JOURNEYS_FOUND', journeys: [{ id: 'broken', legs: [], fareSummary: {}, availabilitySummary: {}, durationSummary: {} }], warnings: [], meta: {} }]) {
    assert.deepEqual(await fetchTripPlan(async () => body, request), { ok: false, error: 'INVALID_RESPONSE' })
  }
  for (const [failure, expected] of [[new Error('secret provider detail'), 'SERVICE_UNAVAILABLE'], [{ statusCode: 401 }, 'AUTH_REQUIRED'], [{ statusCode: 429 }, 'SERVICE_UNAVAILABLE']]) {
    assert.deepEqual(await fetchTripPlan(async () => { throw failure }, request), { ok: false, error: expected })
  }
})

test('captured missing-geometry contracts never invent transit lines', () => {
  const results = JSON.parse(read('scripts/fixtures/missing-transit-geometry.json'))
  assert.equal(results.length, 5)
  for (const result of results) {
    assert.equal(validTripPlanResponse(result), true)
    for (const journey of result.journeys) {
      const map = journeyMapPresentation(journey, null, null)
      assert.ok(map.lines.every(line => line.properties.geometryClassification === 'WALK'))
      const broken = structuredClone(result)
      delete broken.journeys[0].legs[0].availability.wait
      assert.equal(validTripPlanResponse(broken), false)
    }
  }
})

test('new search, reset and disposal cancel old plans; late responses cannot replace selection', async () => {
  const requests = [], dispose = []
  const make = vm.runInNewContext(`${code('app/composables/useTripPlan.ts')}\nuseTripPlan`, {
    ...Vue, AbortController, tripPlanFingerprint, defaultRouteOption, validRouteOptions, useApi: () => ({ apiFetch: null }), onBeforeUnmount: fn => dispose.push(fn),
    fetchTripPlan: (_, request, signal) => { const pending = deferred(); requests.push({ ...pending, request, signal }); return pending.promise },
  })
  const state = make()
  const first = state.search({ id: 'a' }), second = state.search({ id: 'b' })
  assert.equal(requests[0].signal.aborted, true)
  requests[1].resolve({ ok: true, data: { status: 'NO_TRANSPORT_JOURNEY', journeys: [] } }); await second
  requests[0].resolve({ ok: true, data: { journeys: [{ id: 'stale' }] } }); await first
  assert.equal(state.journeys.value.length, 0)
  const third = state.search({ id: 'c' }); state.reset()
  requests[2].resolve({ ok: true, data: { journeys: [{ id: 'stale' }] } }); await third
  assert.equal(state.searched.value, false)
  const fourth = state.search({ id: 'd' }); dispose[0]()
  assert.equal(requests[3].signal.aborted, true)
  requests[3].resolve({ ok: false, error: 'CANCELLED' }); await fourth
})

test('GPS denial stays readable, prompts only once and watch disposal is safe', () => {
  const states = new Map(), callbacks = []; let prompts = 0, cleared = 0
  const make = vm.runInNewContext(`${code('app/composables/useGeolocation.ts')}\nuseGeolocation`, {
    useState: (key, factory) => { if (!states.has(key)) states.set(key, Vue.ref(factory())); return states.get(key) },
    navigator: { geolocation: { getCurrentPosition: (_, fail) => { prompts++; fail({ message: 'Location permission denied.' }) }, watchPosition: (success, fail) => { callbacks.push({ success, fail }); return 7 }, clearWatch: () => cleared++ } },
  })
  const gps = make(); gps.start(); make().start()
  assert.equal(prompts, 1); assert.equal(gps.loading.value, false); assert.match(gps.error.value, /denied/)
  gps.startTracking(); gps.stopTracking(); gps.stopTracking(); assert.equal(cleared, 1)
})

test('every production page and shared component compiles without template errors', () => {
  const files = fs.readdirSync(new URL('../app/', import.meta.url), { recursive: true }).filter(file => file.endsWith('.vue'))
  for (const file of files) {
    const { descriptor, errors } = parse(read(`app/${file}`))
    assert.deepEqual(errors, [], file)
    const script = descriptor.script || descriptor.scriptSetup ? compileScript(descriptor, { id: file }) : null
    if (descriptor.template) assert.deepEqual(compileTemplate({ id: file, filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script?.bindings } }).errors, [], file)
  }
})

test('production custom component references exist in the actual Nuxt component registry', { skip: !fs.existsSync(new URL('../.nuxt/components.d.ts', import.meta.url)) }, () => {
  const registry = read('.nuxt/components.d.ts')
  const files = fs.readdirSync(new URL('../app/pages/', import.meta.url), { recursive: true }).filter(file => file.endsWith('.vue'))
  for (const file of files) {
    const { descriptor } = parse(read(`app/pages/${file}`))
    for (const match of descriptor.template.content.matchAll(/<([A-Z][a-zA-Z]*Pamana[a-zA-Z]*|Pamana[a-zA-Z]+)\b/g)) {
      assert.ok(registry.includes(`export const ${match[1]}:`) || descriptor.scriptSetup?.content.includes(`import ${match[1]}`), `${file}: ${match[1]} must actually resolve in Nuxt`)
    }
  }
})
