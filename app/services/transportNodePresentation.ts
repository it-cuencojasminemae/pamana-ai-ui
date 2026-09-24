import type { GeoJSONSource, LayerSpecification, Map as LibreMap } from 'maplibre-gl'
import type { MapPointFeature } from '../types/map.ts'
import { MAP_TOKENS } from './mapPresentation.ts'
import { markerImage } from './mapLibrePresentation.ts'

export const TRANSPORT_NODE_SOURCE_ID = 'pamana-transport-nodes'
export const TRANSPORT_NODE_LAYER_IDS = ['pamana-transport-node-selection', 'pamana-transport-node-points', 'pamana-transport-node-icons']

export function transportNodeLayers(): LayerSpecification[] {
  const colors: any[] = ['match', ['get', 'semantic']]
  for (const semantic of ['pickup', 'stop', 'dropoff', 'transfer', 'terminal', 'destination', 'essential-service'] as const) colors.push(semantic, MAP_TOKENS[semantic].color)
  colors.push(MAP_TOKENS.stop.color)
  return [
    { id: TRANSPORT_NODE_LAYER_IDS[0]!, type: 'circle', source: TRANSPORT_NODE_SOURCE_ID, filter: ['==', ['get', 'featureId'], ''], paint: { 'circle-radius': 24, 'circle-color': '#0f172a', 'circle-opacity': .18, 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 2 } },
    { id: TRANSPORT_NODE_LAYER_IDS[1]!, type: 'circle', source: TRANSPORT_NODE_SOURCE_ID, paint: { 'circle-radius': 17, 'circle-color': colors as any, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } },
    { id: TRANSPORT_NODE_LAYER_IDS[2]!, type: 'symbol', source: TRANSPORT_NODE_SOURCE_ID, layout: { 'icon-image': ['concat', 'pamana-', ['get', 'semantic']], 'icon-size': .8, 'icon-allow-overlap': true, 'icon-ignore-placement': true } },
  ]
}

/** Dedicated infrastructure source. Updates only setData and never move the camera. */
export function createTransportNodePresentation(map: LibreMap, images: (semantic: keyof typeof MAP_TOKENS) => ImageData = markerImage) {
  let features: MapPointFeature[] = []
  let selected: string | null = null
  const data = () => ({ type: 'FeatureCollection' as const, features })
  function highlight() {
    if (map.getLayer(TRANSPORT_NODE_LAYER_IDS[0]!)) map.setFilter(TRANSPORT_NODE_LAYER_IDS[0]!, ['==', ['get', 'featureId'], selected ?? ''])
  }
  function sync() {
    if (!map.getSource(TRANSPORT_NODE_SOURCE_ID) && !map.isStyleLoaded()) return
    for (const semantic of ['pickup', 'stop', 'dropoff', 'transfer', 'terminal', 'destination', 'essential-service'] as const) {
      if (!map.hasImage(`pamana-${semantic}`)) map.addImage(`pamana-${semantic}`, images(semantic), { pixelRatio: 2 })
    }
    if (!map.getSource(TRANSPORT_NODE_SOURCE_ID)) map.addSource(TRANSPORT_NODE_SOURCE_ID, { type: 'geojson', data: data() })
    else (map.getSource(TRANSPORT_NODE_SOURCE_ID) as GeoJSONSource).setData(data())
    for (const layer of transportNodeLayers()) if (!map.getLayer(layer.id)) map.addLayer(layer)
    highlight()
  }
  return {
    sync,
    update(next: MapPointFeature[]) { features = next; sync() },
    select(id: string | null) { selected = id; highlight() },
  }
}
