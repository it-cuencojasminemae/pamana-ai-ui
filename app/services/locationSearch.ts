import type { GeographicPoint, GeographyError, LocationResult } from './geoapify.ts'
import type { SelectedLocation } from '../types/location.ts'

export interface LocationSearchState {
  status: 'idle' | 'loading' | 'ready' | 'no-results' | 'error'
  suggestions: SelectedLocation[]
  error: GeographyError | null
}

type Searcher = (query: string, signal: AbortSignal) => Promise<LocationResult>

/** Debounce/cancellation/cache policy shared by every location-search field. */
export function createLocationSearchController(
  searcher: Searcher,
  onState: (state: LocationSearchState) => void,
  options: { delayMs?: number; minLength?: number; cacheSize?: number } = {},
) {
  const delayMs = Math.min(1000, Math.max(0, options.delayMs ?? 320))
  const minLength = Math.min(10, Math.max(1, options.minLength ?? 2))
  const cacheSize = Math.min(50, Math.max(1, options.cacheSize ?? 20))
  const cache = new Map<string, SelectedLocation[]>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let active: AbortController | null = null
  let generation = 0
  let pendingKey = ''
  let disposed = false
  const emit = (state: LocationSearchState) => { if (!disposed) onState(state) }

  function schedule(rawQuery: string) {
    const query = rawQuery.trim()
    const key = query.toLocaleLowerCase()
    clearTimeout(timer)
    generation++
    if (query.length < minLength) {
      active?.abort(); active = null; pendingKey = ''
      emit({ status: 'idle', suggestions: [], error: null })
      return
    }
    if (cache.has(key)) {
      const suggestions = cache.get(key)!
      emit({ status: suggestions.length ? 'ready' : 'no-results', suggestions, error: null })
      return
    }
    if (pendingKey === key) return
    active?.abort(); active = null
    const requestGeneration = generation
    emit({ status: 'loading', suggestions: [], error: null })
    timer = setTimeout(async () => {
      if (disposed || requestGeneration !== generation) return
      active = new AbortController()
      pendingKey = key
      let result: LocationResult
      try {
        result = await searcher(query, active.signal)
      } catch {
        result = { ok: false, error: 'NETWORK_ERROR' }
      }
      if (disposed || requestGeneration !== generation) return
      active = null
      pendingKey = ''
      if (!result.ok) {
        if (result.error !== 'ABORTED') emit({ status: 'error', suggestions: [], error: result.error })
        return
      }
      const suggestions = result.data.slice(0, 8)
      cache.set(key, suggestions)
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value!)
      emit({ status: suggestions.length ? 'ready' : 'no-results', suggestions, error: null })
    }, delayMs)
  }

  return {
    schedule,
    clear() {
      clearTimeout(timer); generation++; active?.abort(); active = null; pendingKey = ''
      emit({ status: 'idle', suggestions: [], error: null })
    },
    dispose() {
      disposed = true; clearTimeout(timer); generation++; active?.abort(); active = null; pendingKey = ''
    },
  }
}

export function selectedLocationAfterEdit(selection: SelectedLocation | null, text: string) {
  if (!selection) return null
  return text === selection.label ? selection : null
}

export function gpsLocation(point: GeographicPoint, address?: SelectedLocation): SelectedLocation {
  return {
    id: 'user-gps',
    label: 'Current Location',
    formattedAddress: address?.formattedAddress || address?.label,
    lat: point.latitude,
    lng: point.longitude,
    placeId: address?.placeId,
    category: address?.category,
    source: 'USER_GPS',
  }
}

export async function resolveGpsLocation(
  point: GeographicPoint,
  reverse: (point: GeographicPoint, signal?: AbortSignal) => Promise<LocationResult>,
  signal?: AbortSignal,
) {
  const result = await reverse(point, signal)
  // Reverse-geocoding is display enrichment only. GPS remains valid on every provider failure.
  return gpsLocation(point, result.ok ? result.data[0] : undefined)
}
