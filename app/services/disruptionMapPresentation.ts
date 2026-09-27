import type { GeoJSONSource, LayerSpecification, Map as LibreMap } from 'maplibre-gl'
import type { MapDisruptionFeature } from '../types/map.ts'

export const DISRUPTION_SOURCE_ID = 'pamana-disruptions'
export const DISRUPTION_LAYER_IDS = [
  'pamana-disruption-fill',
  'pamana-disruption-line',
  'pamana-disruption-point-halo',
  'pamana-disruption-point',
]

export function disruptionLayers(): LayerSpecification[] {
  return [
    {
      id: DISRUPTION_LAYER_IDS[0]!, type: 'fill', source: DISRUPTION_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.14 },
    },
    {
      id: DISRUPTION_LAYER_IDS[1]!, type: 'line', source: DISRUPTION_SOURCE_ID,
      filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
      paint: { 'line-color': '#b91c1c', 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.5] },
    },
    {
      id: DISRUPTION_LAYER_IDS[2]!, type: 'circle', source: DISRUPTION_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 15, 'circle-color': '#fef2f2', 'circle-opacity': 0.9 },
    },
    {
      id: DISRUPTION_LAYER_IDS[3]!, type: 'circle', source: DISRUPTION_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 8, 'circle-color': '#dc2626', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    },
  ]
}

/** Dedicated overlay lifecycle. Data refreshes never invoke a camera method. */
export function createDisruptionMapPresentation(map: LibreMap) {
  let features: MapDisruptionFeature[] = []
  const sourceData = () => ({ type: 'FeatureCollection' as const, features })
  function sync() {
    if (!map.getSource(DISRUPTION_SOURCE_ID) && !map.isStyleLoaded()) return
    if (!map.getSource(DISRUPTION_SOURCE_ID)) map.addSource(DISRUPTION_SOURCE_ID, { type: 'geojson', data: sourceData() })
    else (map.getSource(DISRUPTION_SOURCE_ID) as GeoJSONSource).setData(sourceData())
    for (const layer of disruptionLayers()) if (!map.getLayer(layer.id)) map.addLayer(layer)
  }
  return {
    sync,
    update(next: MapDisruptionFeature[]) { features = next; sync() },
  }
}
