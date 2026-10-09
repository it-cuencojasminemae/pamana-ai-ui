import type { Ref } from 'vue'
import type { WeatherPoint, WeatherResponse } from '../types/weather'
import { validCurrentWeather } from '../services/weatherPresentation'

export function useCurrentWeather(point: Ref<WeatherPoint | null>) {
  const current = ref<WeatherResponse | null>(null)
  const loading = ref(false)
  let generation = 0, active = false
  let controller: AbortController | null = null
  let interval: ReturnType<typeof setInterval> | undefined
  async function refresh() {
    if (!active) return
    const version = ++generation
    controller?.abort()
    controller = new AbortController()
    const requestController = controller
    const timer = setTimeout(() => requestController.abort(), 10_000)
    current.value = null; loading.value = true
    try {
      const data = await $fetch('/api/weather', { query: point.value ? { lat: point.value.lat, lng: point.value.lng } : {}, signal: controller.signal })
      if (active && version === generation) current.value = validCurrentWeather(data) ? data : null
    } catch { if (active && version === generation) current.value = null }
    finally { clearTimeout(timer); if (active && version === generation) loading.value = false }
  }
  watch(() => [point.value?.lat, point.value?.lng], () => { void refresh() })
  onMounted(() => { active = true; void refresh(); interval = setInterval(() => { void refresh() }, 5 * 60_000) })
  onBeforeUnmount(() => { active = false; generation++; controller?.abort(); clearInterval(interval) })
  return { current, loading, refresh }
}
