import type { FeatureCollection, Point } from 'geojson'
import type { MapPointFeature, MapSemantic } from '../types/map.ts'
import type { DataMode, VerificationStatus } from '../types/transportation.ts'
import type { MapTransportNode, TransportNodeDiagnostics, TransportNodeType } from '../types/transportNode.ts'

const NODE_TYPES = new Set<TransportNodeType>([
  'ROADSIDE_PICKUP', 'DESIGNATED_STOP', 'TERMINAL', 'LOADING_BAY', 'DROP_OFF', 'TRANSFER_POINT',
  'TRANSPORT_HUB', 'LANDMARK', 'DESTINATION', 'ESSENTIAL_SERVICE', 'EMERGENCY_PICKUP',
])
const VERIFICATION_STATUSES = new Set<VerificationStatus>([
  'AUTHORITATIVE_CURRENT', 'FIELD_VERIFIED', 'CORROBORATED_RESEARCH', 'HISTORICAL_UNVERIFIED',
  'SIMULATED_DEMO', 'RESEARCH_CANDIDATE',
])
const PASSENGER_STATUSES = new Set<VerificationStatus>(['AUTHORITATIVE_CURRENT', 'FIELD_VERIFIED'])

export const PASSENGER_TRANSPORT_NODE_QUERY = Object.freeze({
  'filters[planning_enabled][$eq]': true,
  'filters[verification_status][$in][0]': 'AUTHORITATIVE_CURRENT',
  'filters[verification_status][$in][1]': 'FIELD_VERIFIED',
  'filters[data_mode][$eq]': 'REAL',
  'pagination[pageSize]': 100,
  sort: 'name:asc',
  'fields[0]': 'name', 'fields[1]': 'node_code', 'fields[2]': 'node_type',
  'fields[3]': 'latitude', 'fields[4]': 'longitude', 'fields[5]': 'planning_enabled',
  'fields[6]': 'verification_status', 'fields[7]': 'data_mode', 'fields[8]': 'verified_at',
  'fields[9]': 'source_name', 'fields[10]': 'source_url', 'fields[11]': 'source_reference',
})

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const coordinate = (value: unknown) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
const recordData = (record: unknown): Record<string, unknown> | null => {
  if (!record || typeof record !== 'object') return null
  const value = record as Record<string, unknown>
  return value.attributes && typeof value.attributes === 'object' ? { ...value, ...(value.attributes as Record<string, unknown>) } : value
}

export function normalizeTransportNode(record: unknown): MapTransportNode | null {
  const data = recordData(record)
  if (!data) return null
  const id = text(data.documentId) ?? (typeof data.id === 'number' || typeof data.id === 'string' ? String(data.id) : null)
  const code = text(data.node_code)
  const name = text(data.name)
  const type = text(data.node_type) as TransportNodeType | null
  const verificationStatus = text(data.verification_status) as VerificationStatus | null
  const dataMode = text(data.data_mode) as DataMode | null
  if (!id || !code || !name || !type || !NODE_TYPES.has(type) || !verificationStatus || !VERIFICATION_STATUSES.has(verificationStatus)
    || !dataMode || !['REAL', 'SIMULATED'].includes(dataMode) || typeof data.planning_enabled !== 'boolean') return null
  return {
    id, documentId: text(data.documentId) ?? undefined, code, name, type,
    lat: coordinate(data.latitude), lng: coordinate(data.longitude),
    verificationStatus, planningEnabled: data.planning_enabled, dataMode,
    verifiedAt: text(data.verified_at), sourceName: text(data.source_name), sourceUrl: text(data.source_url),
    sourceReference: text(data.source_reference), source: 'PAMANA_TRANSPORT_DB',
  }
}

export function passengerTransportNodeEligible(node: MapTransportNode) {
  return node.planningEnabled === true && PASSENGER_STATUSES.has(node.verificationStatus) && node.dataMode === 'REAL'
    && !!node.verifiedAt && Number.isFinite(new Date(node.verifiedAt).getTime()) && !!node.sourceName
    && !!(node.sourceUrl || node.sourceReference)
}

export function hasUsableTransportNodeCoordinates(node: MapTransportNode) {
  return node.lat !== null && node.lng !== null && Number.isFinite(node.lat) && Number.isFinite(node.lng)
    && Math.abs(node.lat) <= 90 && Math.abs(node.lng) <= 180 && !(node.lat === 0 && node.lng === 0)
}

export function normalizePassengerTransportNodes(records: unknown[]) {
  const diagnostics: TransportNodeDiagnostics = { received: Array.isArray(records) ? records.length : 0, visible: 0, unmapped: 0, ineligible: 0, malformed: 0 }
  const nodes: MapTransportNode[] = []
  for (const record of Array.isArray(records) ? records : []) {
    const node = normalizeTransportNode(record)
    if (!node) { diagnostics.malformed++; continue }
    if (!passengerTransportNodeEligible(node)) { diagnostics.ineligible++; continue }
    if (!hasUsableTransportNodeCoordinates(node)) { diagnostics.unmapped++; continue }
    nodes.push(node)
  }
  diagnostics.visible = nodes.length
  return { nodes, diagnostics }
}

export function transportNodeSemantic(type: TransportNodeType): MapSemantic {
  if (['ROADSIDE_PICKUP', 'LOADING_BAY', 'EMERGENCY_PICKUP'].includes(type)) return 'pickup'
  if (['DESIGNATED_STOP', 'LANDMARK'].includes(type)) return 'stop'
  if (type === 'DROP_OFF') return 'dropoff'
  if (type === 'TRANSFER_POINT') return 'transfer'
  if (['TERMINAL', 'TRANSPORT_HUB'].includes(type)) return 'terminal'
  if (type === 'DESTINATION') return 'destination'
  return 'essential-service'
}

export const transportNodeTypeLabel = (type: TransportNodeType) => ({
  ROADSIDE_PICKUP: 'Roadside pickup', DESIGNATED_STOP: 'Designated stop', TERMINAL: 'Terminal', LOADING_BAY: 'Loading bay',
  DROP_OFF: 'Drop-off', TRANSFER_POINT: 'Transfer point', TRANSPORT_HUB: 'Transport hub', LANDMARK: 'Landmark stop',
  DESTINATION: 'Destination node', ESSENTIAL_SERVICE: 'Essential service', EMERGENCY_PICKUP: 'Emergency pickup',
})[type]

export const verificationLabel = (status: VerificationStatus) => ({
  AUTHORITATIVE_CURRENT: 'Authoritative', FIELD_VERIFIED: 'Field verified', CORROBORATED_RESEARCH: 'Corroborated research',
  HISTORICAL_UNVERIFIED: 'Historical', SIMULATED_DEMO: 'Simulated', RESEARCH_CANDIDATE: 'Research candidate',
})[status]

export function transportNodeFeatureCollection(nodes: MapTransportNode[]): FeatureCollection<Point, MapPointFeature['properties']> {
  return { type: 'FeatureCollection', features: nodes.filter(node => passengerTransportNodeEligible(node) && hasUsableTransportNodeCoordinates(node)).map(node => ({
    type: 'Feature', id: `transport-node-${node.id}`, geometry: { type: 'Point', coordinates: [node.lng!, node.lat!] }, properties: {
      semantic: transportNodeSemantic(node.type), label: node.name, source: 'PAMANA_TRANSPORT_DB', recordId: node.id,
      nodeCode: node.code, nodeType: node.type, nodeTypeLabel: transportNodeTypeLabel(node.type),
      verificationStatus: node.verificationStatus, verificationLabel: verificationLabel(node.verificationStatus),
      planningEnabled: node.planningEnabled, planningLabel: node.planningEnabled ? 'Available for passenger planning' : 'Not yet enabled for passenger routing',
      dataMode: node.dataMode, sourceSummary: node.sourceName ?? undefined, isTransportNode: true,
    },
  })) }
}

const radians = (degrees: number) => degrees * Math.PI / 180
export function geographicDistanceKm(first: { lat: number; lng: number }, second: { lat: number; lng: number }) {
  const lat = radians(second.lat - first.lat), lng = radians(second.lng - first.lng)
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(lng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Geographic proximity only; this makes no boarding, route, or journey-suitability decision. */
export function sortTransportNodesByGeographicDistance(nodes: MapTransportNode[], user: { lat: number; lng: number } | null) {
  return nodes.map(node => ({ node, distanceKm: user && hasUsableTransportNodeCoordinates(node) ? geographicDistanceKm(user, { lat: node.lat!, lng: node.lng! }) : null }))
    .sort((a, b) => a.distanceKm !== null && b.distanceKm !== null ? a.distanceKm - b.distanceKm : a.node.name.localeCompare(b.node.name))
}

export type TransportNodeFetchResult =
  | { ok: true; nodes: MapTransportNode[]; diagnostics: TransportNodeDiagnostics }
  | { ok: false; error: 'UNAUTHORIZED' | 'UNAVAILABLE' }

export async function fetchPassengerTransportNodes(
  apiFetch: <T>(endpoint: string, options?: Record<string, unknown>) => Promise<T>, signal?: AbortSignal,
): Promise<TransportNodeFetchResult> {
  try {
    const response = await apiFetch<{ data?: unknown[] }>('/api/transport-nodes', { query: PASSENGER_TRANSPORT_NODE_QUERY, signal })
    if (!response || !Array.isArray(response.data)) return { ok: false, error: 'UNAVAILABLE' }
    return { ok: true, ...normalizePassengerTransportNodes(response.data) }
  } catch (error: any) {
    if (signal?.aborted) return { ok: false, error: 'UNAVAILABLE' }
    const status = error?.response?.status ?? error?.statusCode ?? error?.status
    return { ok: false, error: status === 401 || status === 403 ? 'UNAUTHORIZED' : 'UNAVAILABLE' }
  }
}
