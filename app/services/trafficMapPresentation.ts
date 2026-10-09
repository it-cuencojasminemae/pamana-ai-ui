import type { Map as LibreMap, RasterTileSource } from 'maplibre-gl'

export const TRAFFIC_SOURCE_ID = 'pamana-traffic-flow'
export const TRAFFIC_LAYER_ID = 'pamana-traffic-flow-layer'
export function trafficProtocol(apiFetch: <T>(path: string, options: Record<string, unknown>) => Promise<T>,
  onLoaded: () => void, onFailure: () => void) {
  return async (request: { url: string }, controller: AbortController) => {
    const path = request.url.match(/:\/\/tiles\/(\d+)\/(\d+)\/(\d+)(?:\?|$)/)
    if (!path) throw new Error('Traffic unavailable')
    try {
      const data = await apiFetch<ArrayBuffer>(`/api/pamana-ai/traffic-tiles/${path[1]}/${path[2]}/${path[3]}`, {
        responseType: 'arrayBuffer', signal: controller.signal, timeout: 10_000,
      })
      if (!controller.signal.aborted) onLoaded()
      return { data, cacheControl: 'no-store' }
    } catch {
      if (!controller.signal.aborted) onFailure()
      throw new Error('Traffic unavailable')
    }
  }
}
export function createTrafficPresentation(map: LibreMap, protocol: string) {
  let revision = 0
  const tiles = () => [`${protocol}://tiles/{z}/{x}/{y}?refresh=${++revision}`]
  function update(enabled: boolean, refresh = false) {
    if (!enabled && !map.getSource(TRAFFIC_SOURCE_ID)) return
    if (!map.getSource(TRAFFIC_SOURCE_ID)) map.addSource(TRAFFIC_SOURCE_ID, { type: 'raster', tiles: tiles(), tileSize: 256,
      minzoom: 10, maxzoom: 18, bounds: [120.3, 14.7, 121.1, 15.5], attribution: '&copy; <a href="https://www.tomtom.com/" target="_blank" rel="noopener">TomTom</a>' })
    else if (refresh) (map.getSource(TRAFFIC_SOURCE_ID) as RasterTileSource).setTiles(tiles())
    if (!map.getLayer(TRAFFIC_LAYER_ID)) map.addLayer({ id: TRAFFIC_LAYER_ID, type: 'raster', source: TRAFFIC_SOURCE_ID,
      minzoom: 10, paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 0 }, layout: { visibility: enabled ? 'visible' : 'none' } },
    map.getLayer('pamana-route-halo') ? 'pamana-route-halo' : undefined)
    else map.setLayoutProperty(TRAFFIC_LAYER_ID, 'visibility', enabled ? 'visible' : 'none')
  }
  return { update }
}
