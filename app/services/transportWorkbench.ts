import type { WorkbenchEntity, WorkbenchRecord } from '../types/transportWorkbench'

export const WORKBENCH_ENTITIES: ReadonlyArray<{ key: WorkbenchEntity; label: string; icon: string }> = [
  { key: 'transport-nodes', label: 'Transport nodes', icon: 'i-lucide-map-pin' },
  { key: 'routes', label: 'Routes', icon: 'i-lucide-route' },
  { key: 'route-variants', label: 'Route variants', icon: 'i-lucide-git-branch' },
  { key: 'route-variant-stops', label: 'Ordered stops', icon: 'i-lucide-list-ordered' },
  { key: 'fare-rules', label: 'Fares', icon: 'i-lucide-coins' },
  { key: 'service-patterns', label: 'Service', icon: 'i-lucide-clock-3' },
]

export const VERIFICATION_OPTIONS = [
  'RESEARCH_CANDIDATE', 'CORROBORATED_RESEARCH', 'FIELD_VERIFIED',
  'AUTHORITATIVE_CURRENT', 'HISTORICAL_UNVERIFIED', 'SIMULATED_DEMO',
] as const

export const NODE_TYPES = [
  'ROADSIDE_PICKUP', 'DESIGNATED_STOP', 'TERMINAL', 'LOADING_BAY', 'DROP_OFF',
  'TRANSFER_POINT', 'TRANSPORT_HUB', 'LANDMARK', 'DESTINATION',
  'ESSENTIAL_SERVICE', 'EMERGENCY_PICKUP',
] as const

export function relationDocumentId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.documentId || record.document_id || '')
  }
  return ''
}

export function editableRecord(record: WorkbenchRecord): Record<string, any> {
  const output = structuredClone(record) as Record<string, any>
  delete output.id
  delete output.documentId
  delete output.createdAt
  delete output.updatedAt
  delete output.publishedAt
  delete output.workbench
  for (const field of ['cooperative', 'route', 'route_variant', 'transport_node', 'start_node', 'end_node']) {
    if (field in output) output[field] = relationDocumentId(output[field])
  }
  if (Array.isArray(output.days_of_week)) output.days_of_week = output.days_of_week.join(', ')
  if (output.verified_at) {
    const date = new Date(output.verified_at)
    output.verified_at = Number.isFinite(date.getTime())
      ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
      : ''
  }
  if (output.geometry_geojson && typeof output.geometry_geojson !== 'string') {
    output.geometry_geojson = JSON.stringify(output.geometry_geojson, null, 2)
  }
  return output
}

export function serializeWorkbenchForm(entity: WorkbenchEntity, form: Record<string, any>): Record<string, any> {
  const output = structuredClone(form)
  if (output.verified_at) output.verified_at = new Date(output.verified_at).toISOString()
  if (entity === 'transport-nodes') {
    for (const field of ['latitude', 'longitude']) output[field] = output[field] === '' ? null : Number(output[field])
  }
  if (entity === 'route-variant-stops') {
    output.sequence = Number(output.sequence)
    if (output.distance_from_variant_start_m !== '' && output.distance_from_variant_start_m != null) {
      output.distance_from_variant_start_m = Number(output.distance_from_variant_start_m)
    }
  }
  if (entity === 'fare-rules') {
    for (const field of ['regular_base_fare', 'base_distance_km', 'per_km_after_base', 'minimum_fare',
      'student_discount_percent', 'senior_discount_percent', 'pwd_discount_percent']) {
      output[field] = output[field] === '' || output[field] == null ? null : Number(output[field])
    }
  }
  if (entity === 'service-patterns') {
    output.days_of_week = typeof output.days_of_week === 'string'
      ? output.days_of_week.split(',').map((day: string) => day.trim().toUpperCase()).filter(Boolean)
      : output.days_of_week
    for (const field of ['headway_min_minutes', 'headway_max_minutes']) {
      output[field] = output[field] === '' || output[field] == null ? null : Number(output[field])
    }
  }
  if (entity === 'route-variants') {
    output.geometry_geojson = typeof output.geometry_geojson === 'string' && output.geometry_geojson.trim()
      ? JSON.parse(output.geometry_geojson) : null
  }
  return output
}

export function workbenchErrorMessage(error: any): string {
  const details = error?.data?.error?.details || error?.response?._data?.error?.details
  if (Array.isArray(details) && details.length) return details.map((item) => String(item).replaceAll('_', ' ').toLowerCase()).join(' · ')
  if (error instanceof SyntaxError) return 'Geometry must be valid GeoJSON.'
  return 'The record could not be saved. Review the highlighted facts and evidence.'
}

export function verificationTone(status: unknown): string {
  if (status === 'AUTHORITATIVE_CURRENT' || status === 'FIELD_VERIFIED') return 'bg-green-100 text-green-800'
  if (status === 'CORROBORATED_RESEARCH') return 'bg-amber-100 text-amber-800'
  if (status === 'SIMULATED_DEMO') return 'bg-violet-100 text-violet-800'
  return 'bg-neutral-100 text-neutral-600'
}
