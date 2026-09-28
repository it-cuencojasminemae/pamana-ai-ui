import type { ComputedRef } from 'vue'
import type { MapLineFeature } from '../types/map'
import type { PamanaJourney } from '../types/tripPlan'
import { createApproximateRoadPathResolver } from '../services/approximateRoadPath'

export function useApproximateJourneyPaths(journey: ComputedRef<PamanaJourney | null>) {
  const geoapify = useGeoapify()
  const resolver = createApproximateRoadPathResolver((points, mode, signal) => geoapify.routeGeography(points, mode, signal))
  const lines = ref<MapLineFeature[]>([])
  let controller: AbortController | null = null
  let generation = 0

  watch(journey, async value => {
    controller?.abort()
    controller = new AbortController()
    const current = ++generation
    if (!value) { lines.value = []; return }
    const resolved = await resolver.resolveJourney(value, controller.signal)
    if (current === generation && !controller.signal.aborted) lines.value = resolved
  }, { immediate: true })

  onBeforeUnmount(() => { generation++; controller?.abort() })
  return { lines: readonly(lines) }
}
