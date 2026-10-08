import type { PilotLandmark, PilotLandmarkCatalog } from '../types/pilotLandmarks.ts'
import type { SelectedLocation } from '../types/location.ts'
import { z } from 'zod'

const item = z.object({ id: z.string().regex(/^csf-[a-z0-9-]+$/), name: z.string().min(1).max(200),
  category: z.enum(['HOSPITAL', 'SCHOOL', 'SHOPPING', 'MARKET', 'SERVICE']), lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
  aliases: z.array(z.string().max(200)).max(20), connectionNote: z.string().max(500).optional() })
const catalog = z.object({ enabled: z.boolean(), version: z.string(), source: z.object({ type: z.string(), reportedAt: z.string(), observedAt: z.string().nullable(), coordinatePurpose: z.string(), transportStopVerified: z.boolean() }), landmarks: z.array(item).max(100) })
export function parseLandmarkCatalog(value: unknown): PilotLandmarkCatalog | null {
  const result = catalog.safeParse(value)
  if (!result.success || new Set(result.data.landmarks.map(i => i.id)).size !== result.data.landmarks.length || (!result.data.enabled && result.data.landmarks.length)) return null
  return result.data
}
export function landmarkLocation(item: PilotLandmark): SelectedLocation {
  return { id: `landmark-${item.id}`, landmarkId: item.id, label: item.name, lat: item.lat, lng: item.lng,
    category: item.category, source: 'PILOT_LANDMARK', formattedAddress: item.id.startsWith('research-reference-') ? 'User-reported pilot transport reference' : 'City of San Fernando, Pampanga · Pilot landmark' }
}
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function searchLandmarks(items: PilotLandmark[], query: string): SelectedLocation[] {
  const q = normalize(query)
  if (q.length < 2) return []
  return items.filter(i => [i.name, ...i.aliases].some(text => normalize(text).includes(q))).map(landmarkLocation)
}
export function landmarkQuery(mode: 'origin' | 'destination', point: SelectedLocation | null) {
  return { [mode === 'origin' ? 'fromLandmark' : 'toLandmark']: point?.source === 'PILOT_LANDMARK' ? point.landmarkId : undefined }
}
export function readLandmarkQuery(query: Record<string, unknown>, mode: 'origin' | 'destination', items: PilotLandmark[]) {
  const raw = query[mode === 'origin' ? 'fromLandmark' : 'toLandmark']
  if (raw === undefined || raw === null) return { present: false, location: null }
  const selected = typeof raw === 'string' ? items.find(i => i.id === raw) : undefined
  return { present: true, location: selected ? landmarkLocation(selected) : null }
}
