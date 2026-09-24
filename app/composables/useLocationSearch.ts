import { reactive, onScopeDispose } from 'vue'
import { createLocationSearchController, type LocationSearchState } from '../services/locationSearch.ts'
import { PAMPANGA_SEARCH_OPTIONS } from '../services/geoapify.ts'

export function useLocationSearch() {
  const geoapify = useGeoapify()
  const state = reactive<LocationSearchState>({ status: 'idle', suggestions: [], error: null })
  const controller = createLocationSearchController(
    (query, signal) => geoapify.autocompleteLocations(query, PAMPANGA_SEARCH_OPTIONS, signal),
    next => Object.assign(state, next),
  )
  onScopeDispose(controller.dispose)
  return { state, search: controller.schedule, clear: controller.clear }
}
