import type { GeoJSONSource, LayerSpecification, Map as LibreMap } from 'maplibre-gl'
import type { MapPointFeature } from '../types/map.ts'
import { MAP_TOKENS } from './mapPresentation.ts'
import { markerImage, markerLayers } from './mapLibrePresentation.ts'

export const TRANSPORT_NODE_SOURCE_ID = 'pamana-transport-nodes'
export const TRANSPORT_NODE_LAYER_IDS = ['pamana-transport-node-points', 'pamana-transport-node-icons', 'pamana-transport-node-selection']

export function transportNodeLayers(): LayerSpecification[] {
  return markerLayers(TRANSPORT_NODE_SOURCE_ID, ['pamana-transport-node-points', 'pamana-transport-node-icons', 'pamana-transport-node-selection'])
}

/** Dedicated infrastructure source. Updates only setData and never move the camera. */
export function createTransportNodePresentation(map: LibreMap, images: (semantic: keyof typeof MAP_TOKENS, selected?: boolean) => ImageData = markerImage) {
  let features: MapPointFeature[] = []
  let selected: string | null = null
  const data = () => ({ type: 'FeatureCollection' as const, features })
  function highlight() {
    if (!map.getLayer('pamana-transport-node-selection')) return
    map.setFilter('pamana-transport-node-selection', ['==', ['get', 'featureId'], selected ?? ''])
    map.setFilter('pamana-transport-node-icons', ['!=', ['get', 'featureId'], selected ?? ''])
    if (selected && features.some(f => f.properties.featureId === selected)) map.moveLayer?.('pamana-transport-node-selection')
  }
  function sync() {
    if (!map.getSource(TRANSPORT_NODE_SOURCE_ID) && !map.getStyle()) return
    for (const semantic of ['pickup', 'stop', 'dropoff', 'transfer', 'terminal', 'destination', 'essential-service'] as const) {
      if (!map.hasImage(`pamana-${semantic}`)) map.addImage(`pamana-${semantic}`, images(semantic), { pixelRatio: 2 })
      if (!map.hasImage(`pamana-${semantic}-selected`)) map.addImage(`pamana-${semantic}-selected`, images(semantic, true), { pixelRatio: 2 })
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
