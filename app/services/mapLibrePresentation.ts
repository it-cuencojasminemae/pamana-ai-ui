import type { Map as LibreMap, GeoJSONSource, LayerSpecification } from 'maplibre-gl'
import type { MapPointFeature, MapLineFeature, MapDisruptionFeature } from '../types/map.ts'
import { MAP_TOKENS, createFitPolicy, validPosition } from './mapPresentation.ts'

export const SOURCE_ID = 'pamana-features'
export const LAYER_IDS = ['pamana-route-halo', 'pamana-route', 'pamana-approximate-road-path', 'pamana-walking', 'pamana-points', 'pamana-icons', 'pamana-selection']
type Features = (MapPointFeature | MapLineFeature)[]

// Shared semantic tokens drive both WebGL symbols and HTML legend/control styles.
export function markerImage(semantic: keyof typeof MAP_TOKENS, selected = false) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 96
  const ctx = canvas.getContext('2d')!
  if (selected) {
    ctx.beginPath(); ctx.arc(48, 48, 44, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'; ctx.fill()
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.stroke()
  }
  // The badge and glyph are one collision-managed symbol, never separate overlays.
  ctx.beginPath(); ctx.arc(48, 48, semantic === 'passenger' ? 28 : 34, 0, Math.PI * 2)
  ctx.fillStyle = MAP_TOKENS[semantic].color; ctx.fill()
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke()
  ctx.translate(16, 16)
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
  else if (glyph === 'exit') { path([[28, 18], [18, 18], [18, 46], [28, 46]]); path([[27, 32], [47, 32], [39, 24]]); path([[47, 32], [39, 40]]) }
  else if (glyph === 'cross') { path([[32, 19], [32, 45]]); path([[19, 32], [45, 32]]) }
  else if (glyph === 'warning') { path([[32, 15], [49, 46], [15, 46], [32, 15]]); path([[32, 26], [32, 34]]); ctx.fillRect(30, 39, 4, 4) }
  else { ctx.beginPath(); ctx.arc(32, glyph === 'person' ? 24 : 32, 6, 0, Math.PI * 2); ctx.fill(); if (glyph === 'person') { ctx.beginPath(); ctx.arc(32, 43, 10, Math.PI, 0); ctx.stroke() } }
  return ctx.getImageData(0, 0, 96, 96)
}

export function markerLayers(source: string, ids: [string, string, string], point: any = ['==', ['geometry-type'], 'Point']): LayerSpecification[] {
  const layout = {
    'icon-size': 1,
    'icon-offset': ['coalesce', ['get', 'markerOffset'], ['literal', [0, 0]]],
    'icon-padding': 2,
    'icon-allow-overlap': false,
    'icon-ignore-placement': false,
    'icon-rotation-alignment': 'viewport',
    'icon-pitch-alignment': 'viewport',
  } as const
  return [
    // Small anchors retain the exact location when colocated badges are spread apart.
    { id: ids[0], type: 'circle', source, filter: point, paint: { 'circle-radius': 3, 'circle-color': '#334155', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' } },
    { id: ids[1], type: 'symbol', source, filter: point, layout: { ...layout, 'icon-image': ['concat', 'pamana-', ['get', 'semantic']] } as any },
    // Top layer gives the selected badge first placement priority without overlap.
    { id: ids[2], type: 'symbol', source, filter: ['all', point, ['==', ['get', 'featureId'], '']], layout: { ...layout, 'icon-image': ['concat', 'pamana-', ['get', 'semantic'], '-selected'] } as any },
  ]
}

export function presentationLayers(): LayerSpecification[] {
  const line = ['==', ['geometry-type'], 'LineString'] as any
  const point = ['==', ['geometry-type'], 'Point'] as any
  return [
    { id: LAYER_IDS[0]!, type: 'line', source: SOURCE_ID, filter: line, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 } },
    { id: LAYER_IDS[1]!, type: 'line', source: SOURCE_ID, filter: ['all', line, ['==', ['get', 'semantic'], 'transport-route']], paint: { 'line-color': MAP_TOKENS['transport-route'].color, 'line-width': 7 } },
    { id: LAYER_IDS[2]!, type: 'line', source: SOURCE_ID, filter: ['all', line, ['==', ['get', 'semantic'], 'approximate-road-path']], paint: { 'line-color': MAP_TOKENS['approximate-road-path'].color, 'line-width': 6 } },
    { id: LAYER_IDS[3]!, type: 'line', source: SOURCE_ID, filter: ['all', line, ['==', ['get', 'semantic'], 'walking-route']], paint: { 'line-color': MAP_TOKENS['walking-route'].color, 'line-width': 4, 'line-dasharray': [2, 2] } },
    ...markerLayers(SOURCE_ID, ['pamana-points', 'pamana-icons', 'pamana-selection'], point),
  ]
}

/** Renderer adapter only; owns layers/camera, never data fetching or geometry calculation. */
export function createMapPresentation(map: LibreMap, images: (semantic: keyof typeof MAP_TOKENS, selected?: boolean) => ImageData = markerImage) {
  let features: Features = []
  let selected: string | null = null
  const policy = createFitPolicy()
  const sourceData = () => ({ type: 'FeatureCollection' as const, features })
  function highlight() {
    if (!map.getLayer('pamana-selection')) return
    map.setFilter('pamana-selection', ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'featureId'], selected ?? '']])
    map.setFilter('pamana-icons', ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'featureId'], selected ?? '']])
    if (selected && features.some(f => f.geometry.type === 'Point' && f.properties.featureId === selected)) map.moveLayer?.('pamana-selection')
    map.setPaintProperty('pamana-route-halo', 'line-color', ['case', ['==', ['get', 'featureId'], selected ?? ''], '#0f172a', '#ffffff'])
    map.setPaintProperty('pamana-route-halo', 'line-width', ['case', ['==', ['get', 'featureId'], selected ?? ''], 13, 10])
  }
  function sync() {
    // A loaded stylesheet can accept sources while other sources/tiles are still loading.
    if (!map.getSource(SOURCE_ID) && !map.getStyle()) return
    for (const semantic of Object.keys(MAP_TOKENS) as (keyof typeof MAP_TOKENS)[]) {
      if (!map.hasImage(`pamana-${semantic}`)) map.addImage(`pamana-${semantic}`, images(semantic), { pixelRatio: 2 })
      if (!map.hasImage(`pamana-${semantic}-selected`)) map.addImage(`pamana-${semantic}-selected`, images(semantic, true), { pixelRatio: 2 })
    }
    if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: 'geojson', data: sourceData() })
    else (map.getSource(SOURCE_ID) as GeoJSONSource).setData(sourceData())
    for (const layer of presentationLayers()) if (!map.getLayer(layer.id)) map.addLayer(layer)
    highlight()
  }
  function positions(value: unknown): number[][] {
    if (validPosition(value)) return [value]
    return Array.isArray(value) ? value.flatMap(positions) : []
  }
  function fit(additional: MapDisruptionFeature[] = [], includeVehicles = false) {
    const coordinates = [...features, ...additional].filter(f => f.properties.semantic !== 'passenger' && (includeVehicles || f.properties.semantic !== 'vehicle'))
      .flatMap(f => positions(f.geometry.coordinates))
    if (!coordinates.length) return
    const lngs = coordinates.map(p => p[0]!), lats = coordinates.map(p => p[1]!)
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 65, maxZoom: 16, duration: 500 })
  }
  return {
    sync,
    update(next: Features, id: string | null) { features = next; selected = id; sync() },
    select(id: string | null) { selected = id; highlight() },
    fitOnIntent(token: unknown, enabled: boolean, additional: MapDisruptionFeature[] = []) { if (policy.shouldFit(token, enabled)) fit(additional) },
    fit,
  }
}
