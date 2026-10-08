import type { Map as LibreMap, GeoJSONSource, LayerSpecification } from 'maplibre-gl'
import type { PilotLandmark, LandmarkCategory } from '../types/pilotLandmarks.ts'

export const LANDMARK_SOURCE = 'pamana-pilot-landmarks'
export const LANDMARK_LAYERS = ['pamana-pilot-landmark-icons', 'pamana-pilot-landmark-labels']
export const LANDMARK_CATEGORIES: Record<LandmarkCategory, { color: string; label: string }> = {
  HOSPITAL: { color: '#e84962', label: 'Hospital' }, SCHOOL: { color: '#527886', label: 'School' },
  SHOPPING: { color: '#167ad4', label: 'Shopping' }, MARKET: { color: '#d17a20', label: 'Market' }, SERVICE: { color: '#697685', label: 'Service' },
}
export function landmarkImage(category: LandmarkCategory) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const c = canvas.getContext('2d')!
  c.beginPath(); c.arc(32, 32, 27, 0, Math.PI * 2); c.fillStyle = LANDMARK_CATEGORIES[category].color; c.fill()
  c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke(); c.lineJoin = 'round'; c.lineCap = 'round'
  const path = (points: number[][]) => { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)); c.stroke() }
  if (category === 'HOSPITAL') { path([[32, 20], [32, 44]]); path([[20, 32], [44, 32]]) }
  else if (category === 'SCHOOL') { path([[17, 27], [32, 20], [47, 27], [32, 34], [17, 27]]); path([[23, 32], [23, 39], [32, 43], [41, 39], [41, 32]]); path([[47, 27], [47, 38]]) }
  else if (category === 'SHOPPING') { c.strokeRect(22, 27, 20, 18); path([[26, 28], [26, 22], [38, 22], [38, 28]]) }
  else if (category === 'MARKET') { path([[18, 29], [23, 20], [41, 20], [46, 29], [18, 29]]); c.strokeRect(22, 29, 20, 16); path([[30, 36], [30, 45]]) }
  else { path([[35, 18], [24, 34], [33, 34], [28, 46], [42, 29], [33, 29], [35, 18]]) }
  return c.getImageData(0, 0, 64, 64)
}
export function landmarkLayers(labels = true): LayerSpecification[] {
  const layers: LayerSpecification[] = [{ id: LANDMARK_LAYERS[0]!, type: 'symbol', source: LANDMARK_SOURCE, minzoom: 11,
    layout: { 'icon-image': ['concat', 'pamana-landmark-', ['get', 'category']], 'icon-size': 0.8, 'icon-allow-overlap': false, 'icon-padding': 3 } }]
  if (labels) layers.push({ id: LANDMARK_LAYERS[1]!, type: 'symbol', source: LANDMARK_SOURCE, minzoom: 13,
    layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-max-width': 14,
      'text-variable-anchor': ['right', 'left', 'top', 'bottom'], 'text-radial-offset': 1.6, 'text-justify': 'auto', 'text-padding': 4, 'text-allow-overlap': false },
    paint: { 'text-color': '#34485d', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } })
  return layers
}
export function createLandmarkPresentation(map: LibreMap, images = landmarkImage) {
  let landmarks: PilotLandmark[] = []
  function sync() {
    const style = map.getStyle()
    if (!style) return
    if (!landmarks.length && !map.getSource(LANDMARK_SOURCE)) return
    const data = { type: 'FeatureCollection' as const, features: landmarks.map(i => ({ type: 'Feature' as const, id: i.id,
      geometry: { type: 'Point' as const, coordinates: [i.lng, i.lat] }, properties: { landmarkId: i.id, category: i.category, name: i.name } })) }
    for (const category of Object.keys(LANDMARK_CATEGORIES) as LandmarkCategory[]) {
      const id = `pamana-landmark-${category}`
      if (!map.hasImage(id)) map.addImage(id, images(category), { pixelRatio: 2 })
    }
    if (!map.getSource(LANDMARK_SOURCE)) map.addSource(LANDMARK_SOURCE, { type: 'geojson', data })
    else (map.getSource(LANDMARK_SOURCE) as GeoJSONSource).setData(data)
    for (const layer of landmarkLayers(Boolean(style.glyphs))) if (!map.getLayer(layer.id)) map.addLayer(layer)
  }
  return { sync, update(next: PilotLandmark[]) { landmarks = next; sync() } }
}
