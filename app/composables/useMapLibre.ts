import { onScopeDispose, readonly, shallowRef } from 'vue'
import { createMapLibreLoader } from '../services/mapLibreLoader.ts'
import type { MapLoadState } from '../services/mapLibreLoader.ts'

export function useMapLibre() {
  const config = useRuntimeConfig()
  const state = shallowRef<MapLoadState>({ status: 'idle', error: null })
  const loader = createMapLibreLoader(() => config.public, {
    isClient: () => import.meta.client,
    onState: value => { state.value = value },
  })
  onScopeDispose(loader.dispose)
  // Opt-in: only presentation components request loading; no global initialization.
  return { state: readonly(state), load: loader.load, reportRenderFailure: loader.reportRenderFailure }
}
