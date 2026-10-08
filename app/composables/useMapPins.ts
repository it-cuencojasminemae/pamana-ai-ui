import type { SelectedLocation } from '../types/location'
import type { PinArea } from '../types/pinArea'
import { makeMapPin, pinInsideBoundary, validPinArea, validPinBoundary } from '../services/mapPins'

export function useMapPins() {
  const { apiFetch } = useApi()
  const geoapify = useGeoapify()
  const area = shallowRef<PinArea | null>(null)
  const mode = ref<'origin' | 'destination' | null>(null)
  const error = ref('')
  const loading = ref(false)
  const enabled = computed(() => Boolean(area.value?.enabled && area.value.verified))
  const boundary = computed(() => enabled.value ? area.value!.boundary : null)
  // Do not fall back to the combined authorization boundary on older servers.
  const displayBoundary = computed(() => enabled.value && area.value?.displayBoundary
    && validPinBoundary(area.value.displayBoundary.geometry) ? area.value.displayBoundary : null)
  let controller: AbortController | null = null
  let enrichment: AbortController | null = null
  let generation = 0

  async function load() {
    controller?.abort()
    const active = new AbortController()
    controller = active
    const current = ++generation
    loading.value = true
    let timer: ReturnType<typeof setTimeout>
    try {
      const timeout = new Promise<null>(resolve => { timer = setTimeout(() => { active.abort(); resolve(null) }, 7000) })
      const value = await Promise.race([apiFetch<unknown>('/api/pamana-ai/pin-area', { signal: active.signal }), timeout])
      if (current !== generation) return
      area.value = validPinArea(value) ? value : null
      error.value = area.value ? '' : 'Pin selection is temporarily unavailable. You can still search for places.'
      if (!enabled.value) mode.value = null
    } catch {
      if (current === generation) { area.value = null; mode.value = null; error.value = 'Pin selection is temporarily unavailable. You can still search for places.' }
    } finally { clearTimeout(timer!); if (current === generation) loading.value = false }
  }

  function start(next: 'origin' | 'destination') {
    if (!enabled.value) return
    enrichment?.abort()
    mode.value = mode.value === next ? null : next
    error.value = ''
  }

  function choose(point: { lat: number; lng: number }): SelectedLocation | null {
    if (!enabled.value || !pinInsideBoundary(area.value?.boundary?.geometry, point)) {
      error.value = `Choose a point inside ${area.value?.label || 'the enabled pilot area'}.`
      return null
    }
    enrichment?.abort()
    error.value = ''
    return makeMapPin(point)
  }

  async function enrich(pin: SelectedLocation, apply: (location: SelectedLocation) => void) {
    enrichment?.abort()
    const active = new AbortController()
    enrichment = active
    try {
      const result = await geoapify.reverseGeocodeLocation({ latitude: pin.lat, longitude: pin.lng }, active.signal)
      if (!active.signal.aborted && result.ok && result.data[0]) {
        apply({ ...pin, label: `Pinned location · ${result.data[0].label}`.slice(0, 200), formattedAddress: result.data[0].formattedAddress })
      }
    } catch { /* The coordinate selection stays usable without a street label. */ }
  }

  onBeforeUnmount(() => { generation++; controller?.abort(); enrichment?.abort() })
  return { area, mode, error, loading, enabled, boundary, displayBoundary, load, start, choose, enrich }
}
