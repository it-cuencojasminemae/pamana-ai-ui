import type { FeatureCollection, Geometry } from 'geojson'
import type { GeographicConfig } from './mapConfiguration.ts'
import type { LocationSearchOptions, SelectedLocation } from '../types/location.ts'
import { resolveMapConfiguration } from './mapConfiguration.ts'

export type GeographyError = 'MISSING_API_KEY' | 'INVALID_CONFIGURATION' | 'INVALID_INPUT' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'HTTP_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'ABORTED' | 'TIMEOUT'
export type GeographyResult =
  | { ok: true; source: 'GEOAPIFY'; authority: 'EXTERNAL_GEOGRAPHY'; data: FeatureCollection<Geometry> }
  | { ok: false; error: GeographyError }
export interface GeographicPoint { latitude: number; longitude: number }
export type LocationResult =
  | { ok: true; source: 'GEOAPIFY'; authority: 'EXTERNAL_GEOGRAPHY'; data: SelectedLocation[] }
  | { ok: false; error: GeographyError }
export const PAMPANGA_SEARCH_OPTIONS: Readonly<LocationSearchOptions> = {
  countryCode: 'ph',
  // Ranking bias only. The Philippine country filter remains broad enough for nearby valid results.
  bias: { longitude: 120.69, latitude: 15.09 },
  limit: 6,
  language: 'en',
}
const fail = (error: GeographyError): GeographyResult => ({ ok: false, error })
const pointValid = (point: GeographicPoint) => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
const textValid = (text: string) => typeof text === 'string' && text.trim().length > 0 && text.length <= 500
const coordinate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null

export function normalizeGeoapifyLocations(collection: FeatureCollection<Geometry>): SelectedLocation[] {
  const seen = new Set<string>()
  return collection.features.flatMap((feature, index) => {
    if (feature.geometry?.type !== 'Point') return []
    const [rawLng, rawLat] = feature.geometry.coordinates
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    const lng = coordinate(rawLng) ?? coordinate(properties.lon)
    const lat = coordinate(rawLat) ?? coordinate(properties.lat)
    if (lat === null || lng === null || !pointValid({ latitude: lat, longitude: lng })) return []
    const formatted = typeof properties.formatted === 'string' ? properties.formatted.trim() : ''
    const addressLine1 = typeof properties.address_line1 === 'string' ? properties.address_line1.trim() : ''
    const name = typeof properties.name === 'string' ? properties.name.trim() : ''
    const label = name || addressLine1 || formatted
    if (!label) return []
    const placeId = typeof properties.place_id === 'string' && properties.place_id ? properties.place_id : undefined
    const id = String(placeId ?? feature.id ?? `geoapify-${index}-${lng}-${lat}`)
    if (seen.has(id)) return []
    seen.add(id)
    const category = typeof properties.category === 'string' ? properties.category : undefined
    return [{ id, label, formattedAddress: formatted || undefined, lat, lng, placeId, category, source: 'GEOAPIFY' as const }]
  })
}

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
  const searchParams = (text: string, searchOptions: LocationSearchOptions = {}) => {
    const limit = Math.min(8, Math.max(1, Math.trunc(searchOptions.limit ?? 5)))
    const params: Record<string, string> = { text: text.trim(), format: 'geojson', limit: String(limit) }
    if (searchOptions.countryCode && /^[a-z]{2}$/i.test(searchOptions.countryCode)) params.filter = `countrycode:${searchOptions.countryCode.toLowerCase()}`
    if (searchOptions.bias && pointValid(searchOptions.bias)) params.bias = `proximity:${searchOptions.bias.longitude},${searchOptions.bias.latitude}`
    if (searchOptions.language && /^[a-z]{2}$/i.test(searchOptions.language)) params.lang = searchOptions.language.toLowerCase()
    return params
  }
  const search = (path: string, text: string, signal?: AbortSignal, searchOptions: LocationSearchOptions = {}) => textValid(text)
    ? request(path, searchParams(text, searchOptions), signal)
    : Promise.resolve(fail('INVALID_INPUT'))
  async function normalizedSearch(path: string, text: string, searchOptions: LocationSearchOptions, signal?: AbortSignal): Promise<LocationResult> {
    const result = await search(path, text, signal, searchOptions)
    return result.ok ? { ...result, data: normalizeGeoapifyLocations(result.data) } : result
  }
  return {
    autocomplete: (text: string, signal?: AbortSignal, searchOptions: LocationSearchOptions = {}) => search('/v1/geocode/autocomplete', text, signal, searchOptions),
    forwardGeocode: (text: string, signal?: AbortSignal, searchOptions: LocationSearchOptions = {}) => search('/v1/geocode/search', text, signal, searchOptions),
    autocompleteLocations: (text: string, searchOptions: LocationSearchOptions = PAMPANGA_SEARCH_OPTIONS, signal?: AbortSignal) => normalizedSearch('/v1/geocode/autocomplete', text, searchOptions, signal),
    forwardGeocodeLocations: (text: string, searchOptions: LocationSearchOptions = PAMPANGA_SEARCH_OPTIONS, signal?: AbortSignal) => normalizedSearch('/v1/geocode/search', text, searchOptions, signal),
    reverseGeocode(point: GeographicPoint, signal?: AbortSignal) {
      return pointValid(point) ? request('/v1/geocode/reverse', { lat: String(point.latitude), lon: String(point.longitude), format: 'geojson' }, signal) : Promise.resolve(fail('INVALID_INPUT'))
    },
    async reverseGeocodeLocation(point: GeographicPoint, signal?: AbortSignal): Promise<LocationResult> {
      const result = await (pointValid(point) ? request('/v1/geocode/reverse', { lat: String(point.latitude), lon: String(point.longitude), format: 'geojson', limit: '1' }, signal) : Promise.resolve(fail('INVALID_INPUT')))
      return result.ok ? { ...result, data: normalizeGeoapifyLocations(result.data).slice(0, 1) } : result
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
