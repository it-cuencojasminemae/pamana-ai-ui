import type { Map as LibreMap, GeoJSONSource, LayerSpecification } from 'maplibre-gl'
import type { MapPointFeature, MapLineFeature } from '../types/map.ts'
import { MAP_TOKENS, createFitPolicy } from './mapPresentation.ts'

export const SOURCE_ID = 'pamana-features'
export const LAYER_IDS = ['pamana-route-halo', 'pamana-route', 'pamana-walking', 'pamana-selection', 'pamana-points', 'pamana-icons']
type Features = (MapPointFeature | MapLineFeature)[]

// Shared semantic tokens drive both WebGL symbols and HTML legend/control styles.
export function markerImage(semantic: keyof typeof MAP_TOKENS) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const glyph = MAP_TOKENS[semantic].glyph
  const path = (points: number[][]) => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!)); ctx.stroke() }
  if (glyph === 'vehicle' || glyph === 'terminal') {
    ctx.strokeRect(19, 19, 26, 25); ctx.strokeRect(24, 24, 16, 10)
    path([[23, 44], [23, 49]]); path([[41, 44], [41, 49]])
    if (glyph === 'terminal') path([[14, 17], [32, 9], [50, 17]])
  } else if (glyph === 'transfer') { path([[16, 25], [46, 25], [39, 18]]); path([[48, 39], [18, 39], [25, 46]]) }
  else if (glyph === 'up' || glyph === 'down') { const d = glyph === 'up' ? -1 : 1; path([[32, 32 - d * 14], [32, 32 + d * 14]]); path([[22, 32 + d * 4], [32, 32 + d * 14], [42, 32 + d * 4]]) }
  else if (glyph === 'flag') { path([[23, 49], [23, 16], [45, 16], [40, 25], [45, 33], [23, 33]]) }
  else if (glyph === 'cross') { path([[32, 19], [32, 45]]); path([[19, 32], [45, 32]]) }
  else if (glyph === 'warning') { path([[32, 15], [49, 46], [15, 46], [32, 15]]); path([[32, 26], [32, 34]]); ctx.fillRect(30, 39, 4, 4) }
  else { ctx.beginPath(); ctx.arc(32, glyph === 'person' ? 24 : 32, 6, 0, Math.PI * 2); ctx.fill(); if (glyph === 'person') { ctx.beginPath(); ctx.arc(32, 43, 10, Math.PI, 0); ctx.stroke() } }
  return ctx.getImageData(0, 0, 64, 64)
}

export function presentationLayers(): LayerSpecification[] {
  const colors: any[] = ['match', ['get', 'semantic']]
  for (const [semantic, token] of Object.entries(MAP_TOKENS)) colors.push(semantic, token.color)
  colors.push(MAP_TOKENS.stop.color)
  const line = ['==', ['geometry-type'], 'LineString'] as any
  const point = ['==', ['geometry-type'], 'Point'] as any
  return [
    { id: LAYER_IDS[0]!, type: 'line', source: SOURCE_ID, filter: line, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 } },
    { id: LAYER_IDS[1]!, type: 'line', source: SOURCE_ID, filter: ['all', line, ['!=', ['get', 'semantic'], 'walking-route']], paint: { 'line-color': colors as any, 'line-width': 5 } },
    { id: LAYER_IDS[2]!, type: 'line', source: SOURCE_ID, filter: ['all', line, ['==', ['get', 'semantic'], 'walking-route']], paint: { 'line-color': MAP_TOKENS['walking-route'].color, 'line-width': 4, 'line-dasharray': [2, 2] } },
    { id: LAYER_IDS[3]!, type: 'circle', source: SOURCE_ID, filter: ['all', point, ['==', ['get', 'featureId'], '']], paint: { 'circle-radius': 23, 'circle-color': '#0f172a', 'circle-opacity': 0.18, 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 2 } },
    { id: LAYER_IDS[4]!, type: 'circle', source: SOURCE_ID, filter: point, paint: { 'circle-radius': ['case', ['==', ['get', 'semantic'], 'passenger'], 13, 17], 'circle-color': colors as any, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } },
    { id: LAYER_IDS[5]!, type: 'symbol', source: SOURCE_ID, filter: point, layout: { 'icon-image': ['concat', 'pamana-', ['get', 'semantic']], 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-ignore-placement': true } },
  ]
}

/** Renderer adapter only; owns layers/camera, never data fetching or geometry calculation. */
export function createMapPresentation(map: LibreMap, images: (semantic: keyof typeof MAP_TOKENS) => ImageData = markerImage) {
  let features: Features = []
  let selected: string | null = null
  const policy = createFitPolicy()
  const sourceData = () => ({ type: 'FeatureCollection' as const, features })
  function highlight() {
    map.setFilter('pamana-selection', ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'featureId'], selected ?? '']])
    map.setPaintProperty('pamana-route-halo', 'line-color', ['case', ['==', ['get', 'featureId'], selected ?? ''], '#0f172a', '#ffffff'])
    map.setPaintProperty('pamana-route-halo', 'line-width', ['case', ['==', ['get', 'featureId'], selected ?? ''], 13, 10])
  }
  function sync() {
    if (!map.getSource(SOURCE_ID) && !map.isStyleLoaded()) return
    for (const semantic of Object.keys(MAP_TOKENS) as (keyof typeof MAP_TOKENS)[]) {
      if (!map.hasImage(`pamana-${semantic}`)) map.addImage(`pamana-${semantic}`, images(semantic), { pixelRatio: 2 })
    }
    if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: 'geojson', data: sourceData() })
    else (map.getSource(SOURCE_ID) as GeoJSONSource).setData(sourceData())
    for (const layer of presentationLayers()) if (!map.getLayer(layer.id)) map.addLayer(layer)
    highlight()
  }
  function fit() {
    const coordinates = features.filter(f => f.properties.semantic !== 'passenger' && f.properties.semantic !== 'vehicle')
      .flatMap(f => f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates)
    if (!coordinates.length) return
    const lngs = coordinates.map(p => p[0]!), lats = coordinates.map(p => p[1]!)
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 65, maxZoom: 16, duration: 500 })
  }
  return {
    sync,
    update(next: Features, id: string | null) { features = next; selected = id; sync() },
    fitOnIntent(token: unknown, enabled: boolean) { if (policy.shouldFit(token, enabled)) fit() },
    fit,
  }
}
