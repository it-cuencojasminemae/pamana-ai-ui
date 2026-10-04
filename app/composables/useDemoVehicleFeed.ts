import type { SimulatedLiveVehicleResponse } from '../types/liveVehicle'
import { fetchSimulatedLiveVehicles, simulatedVehicleFeatures, validSimulatedSnapshot } from '../services/simulatedLiveVehicles'

/** Phase 16 feed only. Sampling its clock never writes an operational record. */
export function useDemoVehicleFeed() {
  const { apiFetch } = useApi()
  const config = useRuntimeConfig()
  const enabled = computed(() => String(config.public.pamanaDemoModeEnabled).trim().toLowerCase() === 'true')
  const snapshot = shallowRef<SimulatedLiveVehicleResponse | null>(null)
  const loading = ref(false)
  const error = ref('')
  const elapsedSeconds = ref<number | null>(null)
  const features = computed(() => simulatedVehicleFeatures(snapshot.value?.vehicles || []))
  let controller: AbortController | null = null
  let generation = 0

  function cancel() { generation++; controller?.abort(); controller = null; loading.value = false }
  async function refresh() {
    if (!enabled.value || loading.value) return
    const active = new AbortController()
    controller = active
    const current = ++generation
    loading.value = true
    try {
      const result = await fetchSimulatedLiveVehicles(apiFetch, {
        scenario: 'synthetic-direct-corridor', signal: active.signal,
        ...(elapsedSeconds.value === null ? {} : { elapsedSeconds: elapsedSeconds.value }),
      })
      if (active.signal.aborted || generation !== current) return
      if (!validSimulatedSnapshot(result)) {
        throw new Error('Invalid simulation response')
      }
      snapshot.value = result
      error.value = ''
    } catch {
      if (generation === current && !active.signal.aborted) error.value = 'Simulation feed is unavailable on this server. Verified transport information remains available.'
    } finally { if (generation === current) loading.value = false }
  }
  async function sample(seconds: number | null) {
    if (!enabled.value || (seconds !== null && (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600))) return
    cancel()
    elapsedSeconds.value = seconds
    await refresh()
  }
  watch(enabled, value => { if (!value) { cancel(); snapshot.value = null; error.value = ''; elapsedSeconds.value = null } })
  onBeforeUnmount(cancel)
  return { enabled, snapshot, loading, error, elapsedSeconds, features, refresh, sample, cancel }
}
