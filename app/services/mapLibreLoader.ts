import type { GeographicConfig, ConfigurationError } from './mapConfiguration.ts'
import { resolveMapConfiguration } from './mapConfiguration.ts'

type MapLibreModule = typeof import('maplibre-gl')
export type MapLoadError = ConfigurationError | 'MODULE_LOAD_FAILED' | 'MAP_INITIALIZATION_FAILED' | 'TILE_LOAD_FAILED'
export interface MapLoadState {
  status: 'idle' | 'ssr' | 'unconfigured' | 'loading' | 'ready' | 'error' | 'disposed'
  error: MapLoadError | null
}

/** Loads code only. Creating a map/container and registering render events is Phase 7. */
export function createMapLibreLoader(
  getConfig: () => GeographicConfig,
  options: {
    isClient?: () => boolean
    loadModule?: () => Promise<MapLibreModule>
    onState?: (state: MapLoadState) => void
  } = {},
) {
  let state: MapLoadState = { status: 'idle', error: null }
  let disposed = false
  let module: MapLibreModule | null = null
  let pending: Promise<MapLibreModule | null> | null = null
  const update = (status: MapLoadState['status'], error: MapLoadError | null = null) => {
    state = { status, error }
    options.onState?.({ ...state })
  }
  const loadModule = options.loadModule ?? (async () => {
    // No static JS/CSS import, global plugin, map constructor, or network call on SSR.
    const [loaded] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
    return loaded
  })
  async function load(): Promise<MapLibreModule | null> {
    if (disposed) return null
    if (!(options.isClient ?? (() => typeof window !== 'undefined'))()) { update('ssr'); return null }
    const config = resolveMapConfiguration(getConfig())
    if (!config.ok) { update('unconfigured', config.error); return null }
    if (module) { update('ready'); return module }
    if (pending) return pending
    update('loading')
    pending = (async () => {
      try {
        const loaded = await loadModule()
        if (disposed) return null
        module = loaded
        update('ready')
        return loaded
      } catch {
        if (!disposed) update('error', 'MODULE_LOAD_FAILED')
        return null // No raw error/URL/key in UI or logs.
      } finally { pending = null }
    })()
    return pending
  }
  return {
    load,
    getState: () => ({ ...state }),
    // Phase 7 will connect these to constructor failures and map error events.
    reportRenderFailure(error: 'MAP_INITIALIZATION_FAILED' | 'TILE_LOAD_FAILED') {
      if (!disposed) update('error', error)
    },
    dispose() {
      disposed = true
      module = null
      update('disposed')
      // Imports cannot be cancelled; pending completion is ignored. No map exists here.
    },
  }
}
