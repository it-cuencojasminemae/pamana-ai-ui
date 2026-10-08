import type { Feature, Polygon, MultiPolygon } from 'geojson'

export interface PinArea {
  id: string
  label: string
  enabled: boolean
  verified: boolean
  reason: string | null
  boundary: Feature<Polygon | MultiPolygon> | null
  displayBoundary?: Feature<Polygon | MultiPolygon> | null
  source: string
  sourceUrl: string
  verifiedAt: string | null
  notice: string
  travelTimeEnabled: boolean
}
