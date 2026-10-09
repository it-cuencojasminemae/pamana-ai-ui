import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { createWeatherProvider, normalizeWeather, weatherPoint, DEFAULT_WEATHER_POINT } from '../server/utils/weatherProvider.ts'
import { validCurrentWeather, weatherCondition } from '../app/services/weatherPresentation.ts'

const timestamp = Date.parse('2026-10-09T05:00:00Z')
const fixture = (time = timestamp) => ({ current_units: { temperature_2m: '°C', precipitation: 'mm', wind_speed_10m: 'km/h', relative_humidity_2m: '%' },
  current: { time: time / 1000, temperature_2m: 29.4, precipitation: 0.5, wind_speed_10m: 8.4, relative_humidity_2m: 80, weather_code: 61, is_day: 1 } })

test('current weather keeps provider timestamp, units and model provenance', () => {
  const result = normalizeWeather(fixture(), timestamp)
  assert.equal(result.status, 'CURRENT'); assert.equal(result.asOf, '2026-10-09T05:00:00.000Z')
  assert.equal(result.temperatureC, 29.4); assert.equal(result.evidenceClass, 'WEATHER_MODEL')
  assert.equal(validCurrentWeather(result, timestamp), true)
  assert.equal(weatherCondition(result.weatherCode).label, 'Rain')
})

test('nulls, malformed values, wrong units and stale/future data never become live weather', () => {
  for (const mutate of [data => { data.current.temperature_2m = null }, data => { data.current.is_day = null },
    data => { data.current.wind_speed_10m = -1 }, data => { data.current.relative_humidity_2m = 101 },
    data => { data.current_units.temperature_2m = '°F' }, data => { data.current.time -= 7200 },
    data => { data.current.time += 3600 }]) {
    const data = fixture(); mutate(data)
    const result = normalizeWeather(data, timestamp)
    assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.temperatureC, null)
    assert.equal(validCurrentWeather(result, timestamp), false)
  }
  assert.equal(normalizeWeather(null, timestamp).status, 'UNAVAILABLE')
})

test('coordinates default to San Juan and reject unbounded/malformed provider queries', () => {
  assert.deepEqual(weatherPoint(undefined, undefined), DEFAULT_WEATHER_POINT)
  assert.deepEqual(weatherPoint('15.12', '120.70'), { lat: 15.12, lng: 120.70 })
  for (const [lat, lng] of [[null, null], ['', '120.7'], ['NaN', 120.7], [[15.12], 120.7], [15.12, undefined], [0, 0], [90, 180]])
    assert.equal(weatherPoint(lat, lng), null)
})

test('provider uses only fixed weather endpoint and coalesces requests with bounded caching', async () => {
  let calls = 0, now = timestamp, release, requested
  const provider = createWeatherProvider({ now: () => now, fetcher: async (url, options) => {
    calls++; requested = new URL(url); assert.ok(options.signal); assert.equal(options.redirect, 'error')
    await new Promise(resolve => { release = resolve }); return { ok: true, json: async () => fixture(now) }
  } })
  const first = provider.get({ lat: 15.121, lng: 120.701 }), second = provider.get({ lat: 15.12, lng: 120.70 })
  assert.equal(calls, 1); release()
  const values = await Promise.all([first, second]); values[0].temperatureC = 999
  assert.equal(values[1].temperatureC, 29.4)
  assert.equal(requested.origin, 'https://api.open-meteo.com')
  assert.equal(requested.searchParams.get('timeformat'), 'unixtime')
  assert.equal(requested.searchParams.get('timezone'), 'Asia/Manila')
  assert.equal((await provider.get(DEFAULT_WEATHER_POINT)).temperatureC, 29.4); assert.equal(calls, 1)
  now += 300001
  const refreshed = provider.get(DEFAULT_WEATHER_POINT); assert.equal(calls, 2); release(); await refreshed
})

test('network, quota, timeout, HTTP and JSON failures return sanitized unavailable values', async () => {
  for (const fetcher of [async () => { throw new Error('private-provider-url?key=secret') },
    async () => ({ ok: false, status: 429 }), async () => ({ ok: true, json: async () => { throw new Error('bad-json') } })]) {
    let calls = 0
    const provider = createWeatherProvider({ now: () => timestamp, fetcher: async (...args) => { calls++; return fetcher(...args) } })
    const result = await provider.get(DEFAULT_WEATHER_POINT)
    assert.equal(result.status, 'UNAVAILABLE'); assert.doesNotMatch(JSON.stringify(result), /secret|private|bad-json/)
    await provider.get(DEFAULT_WEATHER_POINT); assert.equal(calls, 1, 'failure retry is throttled')
  }
})

test('an expired provider sample is not served as current from the cache', async () => {
  let now = timestamp, calls = 0
  const provider = createWeatherProvider({ now: () => now, fetcher: async () => { calls++; return { ok: true, json: async () => fixture(timestamp - 89 * 60000) } } })
  assert.equal((await provider.get(DEFAULT_WEATHER_POINT)).status, 'CURRENT')
  now += 2 * 60000
  assert.equal((await provider.get(DEFAULT_WEATHER_POINT)).status, 'UNAVAILABLE')
  assert.equal(calls, 2)
})

test('weather component compiles and labels unavailable/model estimates without inventing transport effects', () => {
  const source = fs.readFileSync(new URL('../app/components/PamanaWeather.vue', import.meta.url), 'utf8')
  const { descriptor, errors } = parse(source); assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'weather' })
  const template = compileTemplate({ id: 'weather', filename: 'PamanaWeather.vue', source: descriptor.template.content,
    compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  assert.match(source, /Current weather unavailable/); assert.match(source, /model estimate/)
  assert.doesNotMatch(source, /route\.sort|fareSummary|tripPlan\.search|delayMinutes/)
})

test('location changes cancel stale weather and failures/unmount clear pending state safely', async () => {
  let mounted, unmounted
  const calls = [], point = Vue.ref({ lat: 15.12, lng: 120.70 })
  const source = stripTypeScriptTypes(fs.readFileSync(new URL('../app/composables/useCurrentWeather.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n'))
    .replace(/^import .+$/gm, '').replace('export function useCurrentWeather', 'function useCurrentWeather')
  const sandbox = { ...Vue, point, AbortController, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => {},
    validCurrentWeather: value => validCurrentWeather(value, timestamp), onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmounted = fn },
    $fetch: (_, options) => new Promise((resolve, reject) => { calls.push({ options, resolve, reject }) }) }
  vm.runInNewContext(`${source}\nresult = useCurrentWeather(point)`, sandbox)
  mounted(); assert.equal(calls.length, 1)
  point.value = { lat: 15.05, lng: 120.69 }; await Vue.nextTick()
  assert.equal(calls[0].options.signal.aborted, true); assert.equal(calls.length, 2)
  calls[1].resolve(normalizeWeather(fixture(), timestamp)); await new Promise(resolve => setImmediate(resolve))
  assert.equal(sandbox.result.current.value.status, 'CURRENT')
  calls[0].resolve({ status: 'UNAVAILABLE' }); await new Promise(resolve => setImmediate(resolve))
  assert.equal(sandbox.result.current.value.status, 'CURRENT', 'late prior location must not replace current weather')
  const retry = sandbox.result.refresh(); calls[2].reject(new Error('offline')); await retry
  assert.equal(sandbox.result.current.value, null); assert.equal(sandbox.result.loading.value, false)
  const pending = sandbox.result.refresh(); unmounted(); calls[3].resolve(normalizeWeather(fixture(), timestamp)); await pending
  assert.equal(calls[3].options.signal.aborted, true); assert.equal(sandbox.result.current.value, null)
})
