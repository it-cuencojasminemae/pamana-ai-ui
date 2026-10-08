import type { PilotLandmarkCatalog } from '../types/pilotLandmarks'
import { parseLandmarkCatalog } from '../services/pilotLandmarks'

export function usePilotLandmarks() {
  const { apiFetch } = useApi()
  const planning = usePlanningCapabilities()
  const catalog = useState<PilotLandmarkCatalog | null>('pilot-landmarks-catalog', () => null)
  const loading = useState('pilot-landmarks-loading', () => false)
  const error = useState('pilot-landmarks-error', () => '')
  async function load() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      const value = parseLandmarkCatalog(await apiFetch('/api/pamana-ai/landmarks'))
      if (!value) throw new Error('Invalid catalog')
      catalog.value = value
    } catch { catalog.value = null; error.value = 'Pilot landmarks are temporarily unavailable.' }
    finally { loading.value = false }
  }
  return { catalog, loading, error, load, enabled: computed(() => catalog.value?.enabled === true), items: computed(() => [...(catalog.value?.enabled ? catalog.value.landmarks : []), ...planning.referenceLocations.value]) }
}
