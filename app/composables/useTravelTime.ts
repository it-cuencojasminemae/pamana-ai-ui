import type { TripPlanRequest } from '../types/tripPlan'
import type { TravelTimeEstimate } from '../types/travelTime'
import { validTravelTime } from '../services/travelTime'

export function useTravelTime() {
  const { apiFetch } = useApi()
  const response = shallowRef<TravelTimeEstimate | null>(null)
  const loading = ref(false)
  const cache = new Map<string, { value: TravelTimeEstimate; expiresAt: number }>()
  let controller: AbortController | null = null
  let generation = 0
  let selectedKey = ''
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function reset(clearCache = true) {
    controller?.abort(); generation++; clearTimeout(expiryTimer)
    loading.value = false; response.value = null; selectedKey = ''
    if (clearCache) cache.clear()
  }

  function display(value: TravelTimeEstimate, expiresAt: number) {
    response.value = value
    clearTimeout(expiryTimer)
    expiryTimer = setTimeout(() => { response.value = { status: 'UNAVAILABLE', journeyId: value.journeyId, reasons: ['ESTIMATE_EXPIRED'] } }, Math.max(1, expiresAt - Date.now()))
  }

  async function load(request: TripPlanRequest, journeyId: string) {
    const key = `${journeyId}|${JSON.stringify(request)}`
    if (loading.value && selectedKey === key) return
    reset(false); selectedKey = key
    const hit = cache.get(key)
    if (hit && Date.now() < hit.expiresAt) { display(hit.value, hit.expiresAt); return }
    cache.delete(key)
    const active = new AbortController()
    controller = active
    const current = generation
    loading.value = true
    let timer: ReturnType<typeof setTimeout>
    try {
      // Includes replanning/walking plus at most two bounded provider calls.
      const timeout = new Promise<null>(resolve => { timer = setTimeout(() => { active.abort(); resolve(null) }, 20000) })
      const value = await Promise.race([apiFetch<unknown>('/api/pamana-ai/travel-time', { method: 'POST', body: { request, journeyId }, signal: active.signal }), timeout])
      if (current !== generation) return
      const result: TravelTimeEstimate = validTravelTime(value, journeyId) ? value : { status: 'UNAVAILABLE', journeyId }
      const expiresAt = Math.min(Date.now() + 300000, result.expiresAt ? Date.parse(result.expiresAt) : Date.now() + 30000)
      if (expiresAt <= Date.now()) { response.value = { status: 'UNAVAILABLE', journeyId, reasons: ['ESTIMATE_EXPIRED'] }; return }
      cache.set(key, { value: result, expiresAt })
      while (cache.size > 40) cache.delete(cache.keys().next().value!)
      display(result, expiresAt)
    } catch {
      if (current === generation) {
        const value: TravelTimeEstimate = { status: 'UNAVAILABLE', journeyId }
        const expiresAt = Date.now() + 30000
        cache.set(key, { value, expiresAt })
        while (cache.size > 40) cache.delete(cache.keys().next().value!)
        display(value, expiresAt)
      }
    }
    finally { clearTimeout(timer!); if (current === generation) loading.value = false }
  }

  onBeforeUnmount(() => reset())
  return { response, loading, load, reset }
}
