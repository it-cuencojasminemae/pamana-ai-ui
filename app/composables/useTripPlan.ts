import type { PamanaJourney, TripPlanClientError, TripPlanRequest, TripPlanResponse } from '../types/tripPlan'
import { fetchTripPlan, tripPlanFingerprint } from '../services/tripPlan'

export const useTripPlan = () => {
  const { apiFetch } = useApi()
  const journeys = ref<PamanaJourney[]>([])
  const response = ref<TripPlanResponse | null>(null)
  const selectedJourneyId = ref<string | null>(null)
  const error = ref<TripPlanClientError | null>(null)
  const loading = ref(false)
  const searched = ref(false)
  let controller: AbortController | null = null
  let generation = 0
  let pendingFingerprint = ''

  const selectedJourney = computed(() => journeys.value.find(journey => journey.id === selectedJourneyId.value) ?? null)

  async function search(request: TripPlanRequest) {
    const fingerprint = tripPlanFingerprint(request)
    if (loading.value && fingerprint === pendingFingerprint) return response.value
    controller?.abort()
    controller = new AbortController()
    const current = ++generation
    pendingFingerprint = fingerprint
    loading.value = true
    error.value = null
    searched.value = true
    journeys.value = []
    response.value = null
    selectedJourneyId.value = null
    const result = await fetchTripPlan(apiFetch, request, controller.signal)
    if (current !== generation || controller.signal.aborted) return null
    loading.value = false
    if (!result.ok || !result.data) {
      error.value = result.error === 'CANCELLED' ? null : result.error ?? 'SERVICE_UNAVAILABLE'
      return null
    }
    response.value = result.data
    journeys.value = result.data.journeys
    selectedJourneyId.value = result.data.journeys[0]?.id ?? null
    return result.data
  }

  function reset() {
    controller?.abort()
    generation++
    loading.value = false
    journeys.value = []
    response.value = null
    selectedJourneyId.value = null
    error.value = null
    searched.value = false
    pendingFingerprint = ''
  }

  function cancel() {
    controller?.abort()
    generation++
    loading.value = false
    pendingFingerprint = ''
  }

  onBeforeUnmount(cancel)

  return { journeys, response, selectedJourneyId, selectedJourney, error, loading, searched, search, reset, cancel }
}
