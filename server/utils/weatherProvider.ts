import type { WeatherPoint, WeatherResponse } from '../../app/types/weather.ts'

export const DEFAULT_WEATHER_POINT: WeatherPoint = { lat: 15.11743, lng: 120.70241, label: 'San Juan, Mexico, Pampanga' }
export const WEATHER_MAX_AGE_MS = 90 * 60_000
export function weatherPoint(lat: unknown, lng: unknown): WeatherPoint | null {
  if (lat === undefined && lng === undefined) return { ...DEFAULT_WEATHER_POINT }
  if (![lat, lng].every(value => (typeof value === 'number' || typeof value === 'string') && String(value).trim())) return null
  const point = { lat: Number(lat), lng: Number(lng) }
  // This public, read-only endpoint serves the demonstration area. Bounding and
  // grid rounding keep arbitrary queries from becoming an unlimited proxy.
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= 14.7 && point.lat <= 15.5 && point.lng >= 120.3 && point.lng <= 121.1 ? point : null
}

export function unavailableWeather(now = Date.now()): WeatherResponse {
  return { status: 'UNAVAILABLE', source: 'OPEN_METEO', evidenceClass: 'WEATHER_MODEL', asOf: null,
    fetchedAt: new Date(now).toISOString(), temperatureC: null, precipitationMm: null,
    windKmh: null, humidityPercent: null, weatherCode: null, isDay: null }
}

export function normalizeWeather(payload: unknown, now = Date.now()): WeatherResponse {
  const data = payload as { current?: Record<string, unknown>; current_units?: Record<string, unknown> } | null
  const current = data?.current, units = data?.current_units
  const range = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
  if (!current || !units || units.temperature_2m !== '\u00b0C' || units.precipitation !== 'mm'
    || units.wind_speed_10m !== 'km/h' || units.relative_humidity_2m !== '%'
    || !range(current.time, 0, 100000000000) || now - Number(current.time) * 1000 > WEATHER_MAX_AGE_MS
    || Number(current.time) * 1000 - now > 10 * 60_000
    || !range(current.temperature_2m, -90, 65) || !range(current.precipitation, 0, 1000)
    || !range(current.wind_speed_10m, 0, 500) || !range(current.relative_humidity_2m, 0, 100)
    || !Number.isInteger(current.weather_code) || !range(current.weather_code, 0, 99)
    || (current.is_day !== 0 && current.is_day !== 1)) return unavailableWeather(now)
  return { status: 'CURRENT', source: 'OPEN_METEO', evidenceClass: 'WEATHER_MODEL',
    asOf: new Date(Number(current.time) * 1000).toISOString(), fetchedAt: new Date(now).toISOString(),
    temperatureC: Number(current.temperature_2m), precipitationMm: Number(current.precipitation),
    windKmh: Number(current.wind_speed_10m), humidityPercent: Number(current.relative_humidity_2m),
    weatherCode: Number(current.weather_code), isDay: current.is_day === 1 }
}

export function createWeatherProvider({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map<string, { until: number; value: WeatherResponse }>()
  const pending = new Map<string, Promise<WeatherResponse>>()
  async function get(point: WeatherPoint): Promise<WeatherResponse> {
    if (!weatherPoint(point.lat, point.lng)) return unavailableWeather(now())
    const lat = Math.round(point.lat * 50) / 50, lng = Math.round(point.lng * 50) / 50
    const key = `${lat},${lng}`, stored = cache.get(key)
    if (stored && stored.until > now()
      && (stored.value.status !== 'CURRENT' || now() - Date.parse(stored.value.asOf!) <= WEATHER_MAX_AGE_MS)) return structuredClone(stored.value)
    let request = pending.get(key)
    if (!request) {
      request = (async () => {
        let value: WeatherResponse
        try {
          const url = new URL('https://api.open-meteo.com/v1/forecast')
          url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lng),
            current: 'temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m',
            timezone: 'Asia/Manila', timeformat: 'unixtime', temperature_unit: 'celsius',
            wind_speed_unit: 'kmh', precipitation_unit: 'mm', forecast_days: '1' }).toString()
          const reply = await fetcher(url, { signal: AbortSignal.timeout(7000), redirect: 'error' })
          value = reply.ok ? normalizeWeather(await reply.json(), now()) : unavailableWeather(now())
        } catch { value = unavailableWeather(now()) }
        if (cache.size >= 100) cache.delete(cache.keys().next().value!)
        cache.set(key, { value, until: now() + (value.status === 'CURRENT' ? 5 * 60_000 : 30_000) })
        return value
      })()
      pending.set(key, request)
    }
    try { return structuredClone(await request) } finally { if (pending.get(key) === request) pending.delete(key) }
  }
  return { get }
}
