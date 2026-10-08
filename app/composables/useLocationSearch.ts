import { reactive, onScopeDispose } from 'vue'
import { createLocationSearchController, type LocationSearchState } from '../services/locationSearch.ts'
import { PAMPANGA_SEARCH_OPTIONS } from '../services/geoapify.ts'
import { searchLandmarks } from '../services/pilotLandmarks'

export function useLocationSearch() {
  const geoapify = useGeoapify()
  const landmarks = usePilotLandmarks()
  const state = reactive<LocationSearchState>({ status: 'idle', suggestions: [], error: null })
  const controller = createLocationSearchController(
    async (query, signal) => {
      const local = searchLandmarks(landmarks.items.value, query)
      // Canonical pilot choices must stay immediately selectable without a
      // remote geocoder delaying them or replacing their exact coordinates.
      if (local.length) return { ok: true, data: local }
      const result = await geoapify.autocompleteLocations(query, PAMPANGA_SEARCH_OPTIONS, signal)
      if (signal.aborted) return { ok: false, error: 'ABORTED' }
      if (!result.ok) return local.length ? { ok: true, data: local } : result
      const seen = new Set(local.map(p => p.label.toLowerCase()))
      return { ok: true, data: [...local, ...result.data.filter(p => !seen.has(p.label.toLowerCase()) && !local.some(l => Math.abs(l.lat - p.lat) < 0.0001 && Math.abs(l.lng - p.lng) < 0.0001))] }
    },
    next => Object.assign(state, next),
  )
  onScopeDispose(controller.dispose)
  watch(landmarks.catalog, () => controller.clear())
  watch(landmarks.items, () => controller.clear())
  return { state, search: controller.schedule, clear: controller.clear }
}
