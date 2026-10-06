import type { JourneyExplanationRequest, JourneyExplanationResponse } from '../types/journeyExplanation'
import { fetchJourneyExplanation, unavailableGuide } from '../services/journeyExplanation'

interface GuideEntry {
  response: JourneyExplanationResponse | null
  loading: boolean
  controller: AbortController
  request: Promise<void> | null
}

/** One automatic request per selected journey/facts in this search. No routing or ranking. */
export function useJourneyExplanation() {
  const { apiFetch } = useApi()
  const entries = shallowRef<Record<string, GuideEntry>>({})
  const selectedKey = ref('')
  const response = computed(() => entries.value[selectedKey.value]?.response ?? null)
  const loading = computed(() => entries.value[selectedKey.value]?.loading ?? false)
  let generation = 0

  function explain(journeyId: string, facts: JourneyExplanationRequest, force = false) {
    const key = `${journeyId}|${JSON.stringify(facts)}`
    selectedKey.value = key
    const previous = entries.value[key]
    if (previous && !force) return previous.request ?? Promise.resolve()
    previous?.controller.abort()
    const controller = new AbortController()
    const current = generation
    const entry: GuideEntry = { response: null, loading: true, controller, request: null }
    entries.value = { ...entries.value, [key]: entry }
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<JourneyExplanationResponse>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(unavailableGuide()) }, 25_000)
    })
    entry.request = (async () => {
      let result: JourneyExplanationResponse
      try { result = await Promise.race([fetchJourneyExplanation(apiFetch, facts, controller.signal), timeout]) }
      catch { result = unavailableGuide() }
      finally { clearTimeout(timer) }
      // A late response cannot replace a new search or a forced regeneration.
      // Selection is separate, so an off-screen result only fills its own cache.
      if (current !== generation || entries.value[key] !== entry) return
      entries.value = { ...entries.value, [key]: { ...entry, loading: false, response: result, request: null } }
    })()
    return entry.request
  }

  function reset() {
    Object.values(entries.value).forEach(entry => entry.controller.abort())
    generation++
    selectedKey.value = ''
    entries.value = {}
  }

  onBeforeUnmount(reset)
  return { response: readonly(response), loading: readonly(loading), explain, reset }
}
