import type { FeatureCollection, Geometry } from 'geojson'
import type { GeographicConfig } from './mapConfiguration.ts'
import { resolveMapConfiguration } from './mapConfiguration.ts'

export type GeographyError = 'MISSING_API_KEY' | 'INVALID_CONFIGURATION' | 'INVALID_INPUT' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'ABORTED' | 'TIMEOUT'
export type GeographyResult =
  | { ok: true; source: 'GEOAPIFY'; authority: 'EXTERNAL_GEOGRAPHY'; data: FeatureCollection<Geometry> }
  | { ok: false; error: GeographyError }
export interface GeographicPoint { latitude: number; longitude: number }
const fail = (error: GeographyError): GeographyResult => ({ ok: false, error })
const pointValid = (point: GeographicPoint) => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
const textValid = (text: string) => typeof text === 'string' && text.trim().length > 0 && text.length <= 500

/** External geography only. Never calls PAMANA APIs, auth/session helpers or DB. */
export function createGeoapifyClient(
  getConfig: () => GeographicConfig,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const timeoutMs = Math.min(30000, Math.max(1, options.timeoutMs ?? 10000))
  async function request(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<GeographyResult> {
    const config = resolveMapConfiguration(getConfig())
    if (!config.ok) return fail(config.error)
    if (signal?.aborted) return fail('ABORTED')
    const abort = new AbortController()
    let timedOut = false
    const cancel = () => abort.abort()
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => { timedOut = true; abort.abort() }, timeoutMs)
    try {
      const url = new URL(path, 'https://api.geoapify.com')
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
      url.searchParams.set('apiKey', config.apiKey)
      const response = await (options.fetcher ?? globalThis.fetch)(url, {
        signal: abort.signal, credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' },
      })
      if (!response.ok) return fail(response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR')
      let data: unknown
      try { data = await response.json() } catch { return fail(timedOut ? 'TIMEOUT' : signal?.aborted ? 'ABORTED' : 'INVALID_RESPONSE') }
      if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'FeatureCollection'
        || !('features' in data) || !Array.isArray(data.features)
        || !data.features.every(feature => feature && feature.type === 'Feature' && 'geometry' in feature && 'properties' in feature)) return fail('INVALID_RESPONSE')
      return { ok: true, source: 'GEOAPIFY', authority: 'EXTERNAL_GEOGRAPHY', data: data as FeatureCollection<Geometry> }
    } catch {
      return fail(timedOut ? 'TIMEOUT' : signal?.aborted ? 'ABORTED' : 'NETWORK_ERROR')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
  }
  const search = (path: string, text: string, signal?: AbortSignal) => textValid(text)
    ? request(path, { text: text.trim(), format: 'geojson', limit: '5' }, signal)
    : Promise.resolve(fail('INVALID_INPUT'))
  return {
    autocomplete: (text: string, signal?: AbortSignal) => search('/v1/geocode/autocomplete', text, signal),
    forwardGeocode: (text: string, signal?: AbortSignal) => search('/v1/geocode/search', text, signal),
    reverseGeocode(point: GeographicPoint, signal?: AbortSignal) {
      return pointValid(point) ? request('/v1/geocode/reverse', { lat: String(point.latitude), lon: String(point.longitude), format: 'geojson' }, signal) : Promise.resolve(fail('INVALID_INPUT'))
    },
    searchPlaces(categories: string[], center: GeographicPoint, radiusMeters: number, signal?: AbortSignal) {
      if (!pointValid(center) || !Array.isArray(categories) || !categories.length || categories.some(category => !/^[a-z][a-z0-9_.]+$/.test(category))
        || !Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) return Promise.resolve(fail('INVALID_INPUT'))
      return request('/v2/places', { categories: categories.join(','), filter: `circle:${center.longitude},${center.latitude},${radiusMeters}`, limit: '20' }, signal)
    },
    // Road/walking geography, never a jeepney route recommendation or transport truth.
    routeGeography(points: GeographicPoint[], mode: 'walk' | 'drive', signal?: AbortSignal) {
      if (!Array.isArray(points) || points.length < 2 || points.length > 20 || !points.every(pointValid) || !['walk', 'drive'].includes(mode)) return Promise.resolve(fail('INVALID_INPUT'))
      return request('/v1/routing', { waypoints: points.map(point => `${point.latitude},${point.longitude}`).join('|'), mode, format: 'geojson' }, signal)
    },
  }
}
