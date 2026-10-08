import type { PamanaJourney, TripPlanRequest } from '../types/tripPlan'
import { validJourneyDetails } from '../services/tripPlanContract'

export function useJourneyDetails() {
  const { apiFetch } = useApi()
  const loading = ref(false)
  const notice = ref('')
  let controller: AbortController | null = null
  let generation = 0
  function reset() { controller?.abort(); generation++; loading.value = false; notice.value = '' }
  async function load(request: TripPlanRequest, journeyId: string, apply: (journey: PamanaJourney) => void) {
    reset()
    const current = generation
    const active = new AbortController()
    controller = active; loading.value = true
    try {
      const value = await apiFetch<{ status: string; journey?: PamanaJourney }>('/api/pamana-ai/journey-details',
        { method: 'POST', body: { request, journeyId }, signal: active.signal, timeout: 20000 })
      if (current !== generation || active.signal.aborted) return
      if (validJourneyDetails(value, journeyId, request.planningMode || 'OPERATIONAL') && value.journey) apply(value.journey)
      else notice.value = 'Additional details are unavailable. Previously calculated directions remain displayed.'
    } catch { if (current === generation) notice.value = 'Additional details are unavailable. Previously calculated directions remain displayed.' }
    finally { if (current === generation) loading.value = false }
  }
  onBeforeUnmount(reset)
  return { loading, notice, load, reset }
}
