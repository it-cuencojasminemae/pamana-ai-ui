import type { JourneyExplanationRequest, JourneyExplanationResponse } from '../types/journeyExplanation'
import { fetchJourneyExplanation } from '../services/journeyExplanation'

export function useJourneyExplanation() {
  const { apiFetch } = useApi()
  const response = ref<JourneyExplanationResponse | null>(null)
  const loading = ref(false)
  let controller: AbortController | null = null
  let generation = 0
  let fingerprint = ''
  let completedAt = 0

  async function explain(request: JourneyExplanationRequest) {
    const nextFingerprint = JSON.stringify(request)
    if (loading.value && fingerprint === nextFingerprint) return
    // Reuse only the currently displayed successful guide for identical facts.
    if (fingerprint === nextFingerprint && response.value?.status === 'AVAILABLE'
      && Date.now() - completedAt < 60_000) return
    controller?.abort()
    controller = new AbortController()
    const current = ++generation
    fingerprint = nextFingerprint
    loading.value = true
    response.value = null
    try {
      const result = await fetchJourneyExplanation(apiFetch, request, controller.signal)
      if (current === generation && !controller.signal.aborted) {
        response.value = result
        completedAt = Date.now()
      }
    } catch {
      // Selection changes and disposal intentionally cancel stale requests.
    } finally {
      if (current === generation) loading.value = false
    }
  }

  function reset() {
    controller?.abort()
    generation++
    fingerprint = ''
    completedAt = 0
    loading.value = false
    response.value = null
  }

  onBeforeUnmount(reset)
  return { response: readonly(response), loading: readonly(loading), explain, reset }
}
