<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

type MapItem = Record<string, any>

const props = withDefaults(defineProps<{
  height?: string
  center?: [number, number]
  zoom?: number
  markers?: MapItem[]
  routePoints?: MapItem[]
  // Reserved for a future verified GeoJSON LineString. Stop coordinates stay
  // the honest fallback until that data exists.
  routeGeometry?: { coordinates?: unknown } | null
  userLocation?: { lat: number; lng: number } | null
  markerLabel?: (item: MapItem) => string
  routeColor?: string
  routeLabel?: string
  routeDashed?: boolean
  fitKey?: string | number | null
}>(), {
  height: '360px',
  center: () => [15.05, 120.70],
  zoom: 11,
  markers: () => [],
  routePoints: () => [],
  routeGeometry: null,
  userLocation: null,
  routeColor: '#65a30d',
  routeLabel: 'Approximate corridor',
  routeDashed: false,
  fitKey: null
})

const emit = defineEmits<{ ready: [map: any] }>()
const mapElement = ref<HTMLElement | null>(null)
let map: any = null
let markerLayer: any = null
let routeLayer: any = null
let userMarker: any = null
let fitRouteControl: any = null

const defaultLabel = (item: MapItem) => item.label ?? item.name ?? item.title ?? item.vehicle_number ?? item.plate_number ?? 'Location'
const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;')

function markerColor(item: MapItem) {
  const colors: Record<string, string> = {
    origin: '#65a30d', pickup: '#65a30d', destination: '#f97316', dropoff: '#f97316',
    intermediate: '#64748b', transfer: '#9333ea', vehicle: item.source === 'simulation' ? '#9333ea' : '#16a34a'
  }
  return colors[item.kind] || '#65a30d'
}

function markerGlyph(item: MapItem) {
  if (item.kind === 'transfer') return '↔'
  if (item.kind === 'vehicle') return '▰'
  return '•'
}

function markerIcon(L: any, item: MapItem) {
  const kind = escapeHtml(item.kind || 'intermediate')
  const source = escapeHtml(item.source || '')
  return L.divIcon({
    className: 'pamana-leaflet-icon', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18],
    html: `<span class="pamana-map-marker pamana-map-marker--${kind} ${source === 'simulation' ? 'is-demo' : ''}" style="--marker-color:${markerColor(item)}"><span class="pamana-map-marker__halo"></span><span class="pamana-map-marker__core">${markerGlyph(item)}</span></span>`
  })
}

function popupContent(item: MapItem) {
  if (Array.isArray(item.popupLines)) {
    const [title, ...details] = item.popupLines
    return `<div class="pamana-map-popup"><strong>${escapeHtml(title)}</strong>${details.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div>`
  }
  return `<div class="pamana-map-popup"><strong>${escapeHtml(props.markerLabel ? props.markerLabel(item) : defaultLabel(item))}</strong></div>`
}

function coordinates(item: MapItem): [number, number] | null {
  const lat = Number(item.latitude ?? item.lat ?? item.location?.latitude ?? item.location?.lat)
  const lng = Number(item.longitude ?? item.lng ?? item.lon ?? item.location?.longitude ?? item.location?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

function routeCoordinates(): [number, number][] {
  const geometry = props.routeGeometry?.coordinates
  if (Array.isArray(geometry)) {
    const geoJsonPoints = geometry.map((point: unknown) => Array.isArray(point) && point.length >= 2
      ? [Number(point[1]), Number(point[0])] as [number, number] : null)
      .filter((point): point is [number, number] => point !== null && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    if (geoJsonPoints.length >= 2) return geoJsonPoints
  }
  return props.routePoints.map(coordinates).filter((point): point is [number, number] => point !== null)
}

function fitRoute() {
  const route = routeCoordinates()
  if (map && route.length >= 2) map.fitBounds(route, { padding: [50, 50], maxZoom: 15 })
}

function clearLayers() {
  markerLayer?.clearLayers()
  routeLayer?.remove()
  routeLayer = null
  userMarker?.remove()
  userMarker = null
}

async function renderMap(fitToBounds: boolean) {
  if (!map) return
  const L = await import('leaflet')
  clearLayers()
  markerLayer = L.layerGroup().addTo(map)
  const bounds: [number, number][] = []

  for (const item of props.markers) {
    const point = coordinates(item)
    if (!point) continue
    L.marker(point, { icon: markerIcon(L, item) }).addTo(markerLayer).bindPopup(popupContent(item))
    bounds.push(point)
  }

  const route = routeCoordinates()
  if (route.length >= 2) {
    routeLayer = L.layerGroup().addTo(map)
    L.polyline(route, { color: '#ffffff', weight: 12, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
    L.polyline(route, {
      color: props.routeColor, weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
      dashArray: props.routeDashed ? '10 10' : undefined
    }).addTo(routeLayer).bindPopup(`<div class="pamana-map-popup"><strong>${escapeHtml(props.routeLabel)}</strong><span>${props.routeDashed ? 'Simulated transfer scenario' : 'Reference stop corridor'}</span></div>`)
    bounds.push(...route)
  }

  if (props.userLocation) {
    const point: [number, number] = [props.userLocation.lat, props.userLocation.lng]
    userMarker = L.circleMarker(point, { radius: 8, weight: 3, fillOpacity: 1, color: '#2563eb', fillColor: '#ffffff' }).addTo(map)
    userMarker.bindPopup('Your current location')
  }

  // Only fit on initial display, selection change, or first GPS arrival.
  // Subsequent GPS updates redraw layers without taking map control away.
  if (fitToBounds && bounds.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
}

onMounted(async () => {
  if (!mapElement.value) return
  const L = await import('leaflet')
  map = L.map(mapElement.value, { center: props.center, zoom: props.zoom, zoomControl: true, attributionControl: true })

  const publicConfig = useRuntimeConfig().public
  const cartoKey = String(publicConfig.cartoBasemapKey || '').trim()
  const usingCarto = Boolean(cartoKey)
  const tileUrl = usingCarto
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`
    : publicConfig.mapTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  const attribution = usingCarto
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; OpenStreetMap contributors'
  L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(map)

  const FitRouteControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const button = L.DomUtil.create('button', 'pamana-fit-route-control')
      button.type = 'button'
      button.title = 'Fit selected route'
      button.setAttribute('aria-label', 'Fit selected route')
      button.textContent = 'Fit route'
      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.on(button, 'click', fitRoute)
      return button
    }
  })
  fitRouteControl = new FitRouteControl()
  fitRouteControl.addTo(map)
  emit('ready', map)
  await renderMap(true)
})

let hadUserLocation = !!props.userLocation
let lastFitKey = props.fitKey
watch(() => [props.markers, props.routePoints, props.routeGeometry, props.userLocation], () => {
  const hasUserLocation = !!props.userLocation
  const justArrived = !hadUserLocation && hasUserLocation
  const routeSelectionChanged = props.fitKey !== lastFitKey
  hadUserLocation = hasUserLocation
  lastFitKey = props.fitKey
  renderMap(justArrived || routeSelectionChanged)
}, { deep: true })

onBeforeUnmount(() => {
  if (map) {
    fitRouteControl?.remove()
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="relative overflow-hidden rounded-[inherit]" :style="{ minHeight: height }">
    <div ref="mapElement" class="absolute inset-0 z-0" />
    <div class="pointer-events-none absolute inset-0 z-10"><slot /></div>
  </div>
</template>

<style scoped>
:global(.leaflet-control-zoom) { overflow: hidden; border: 1px solid rgb(229 229 229 / 0.92) !important; border-radius: 14px !important; box-shadow: 0 8px 22px rgb(23 23 23 / 0.14) !important; }
:global(.leaflet-control-zoom a), :global(.pamana-fit-route-control) { display: grid !important; min-width: 34px !important; height: 34px !important; place-items: center !important; border: 0 !important; border-bottom: 1px solid rgb(229 229 229 / 0.9) !important; background: rgb(255 255 255 / 0.96) !important; color: #404040 !important; font: 600 15px/1 system-ui, sans-serif !important; }
:global(.leaflet-control-zoom a:last-child) { border-bottom: 0 !important; }
:global(.pamana-fit-route-control) { width: auto !important; min-width: 76px !important; margin-top: 10px !important; border: 1px solid rgb(229 229 229 / 0.92) !important; border-radius: 12px !important; box-shadow: 0 8px 22px rgb(23 23 23 / 0.14) !important; font-size: 11px !important; }
:global(.pamana-fit-route-control:hover), :global(.leaflet-control-zoom a:hover) { background: #f7fee7 !important; color: #4d7c0f !important; }
:global(.pamana-leaflet-icon) { background: transparent !important; border: 0 !important; }
:global(.pamana-map-marker) { position: relative; display: grid; width: 36px; height: 36px; place-items: center; }
:global(.pamana-map-marker__halo) { position: absolute; inset: 2px; border: 2px solid var(--marker-color); border-radius: 999px; background: rgb(255 255 255 / 0.94); box-shadow: 0 4px 12px rgb(23 23 23 / 0.2), 0 0 0 4px color-mix(in srgb, var(--marker-color) 18%, transparent); }
:global(.pamana-map-marker__core) { position: relative; z-index: 1; color: var(--marker-color); font: 800 20px/1 system-ui, sans-serif; }
:global(.pamana-map-marker--transfer .pamana-map-marker__core) { font-size: 15px; }
:global(.pamana-map-marker--vehicle .pamana-map-marker__core) { font-size: 17px; }
:global(.pamana-map-marker.is-demo .pamana-map-marker__halo) { border-style: dashed; }
:global(.leaflet-popup-content-wrapper) { border-radius: 14px !important; box-shadow: 0 10px 28px rgb(23 23 23 / 0.18) !important; }
:global(.leaflet-popup-content) { margin: 11px 13px !important; }
:global(.pamana-map-popup) { display: grid; gap: 3px; color: #525252; font: 500 11px/1.4 system-ui, sans-serif; }
:global(.pamana-map-popup strong) { color: #171717; font-size: 11px; font-weight: 800; letter-spacing: 0.045em; text-transform: uppercase; }
</style>
