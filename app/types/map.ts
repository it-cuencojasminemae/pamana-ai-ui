import type { Feature, FeatureCollection, Point, LineString, Polygon, MultiPolygon } from 'geojson'
import type { DataMode, VerificationStatus } from './transportation'

/** Presentation interchange only, NOT a journey response or routing decision model.
 * GeoJSON positions use [longitude, latitude]. Unknown coordinates produce no feature.
 */
export type MapSemantic = 'passenger' | 'origin-location' | 'pickup' | 'dropoff' | 'stop' | 'transfer' | 'terminal'
  | 'vehicle' | 'destination' | 'essential-service' | 'walking-route' | 'transport-route' | 'disruption'
export interface MapFeatureProperties {
  [key: string]: unknown
  semantic: MapSemantic
  label: string
  source: 'PAMANA' | 'GEOAPIFY' | 'DEVICE'
  recordId?: string
  legId?: string
  dataMode?: DataMode
  verificationStatus?: VerificationStatus
  planningEnabled?: boolean
}
export type MapPointFeature = Feature<Point, MapFeatureProperties>
export type MapLineFeature = Feature<LineString, MapFeatureProperties>
export type MapAreaFeature = Feature<Polygon | MultiPolygon, MapFeatureProperties>
export interface MapPresentation {
  features: FeatureCollection<Point | LineString | Polygon | MultiPolygon, MapFeatureProperties>
  selectedLegId: string | null
}
// Geoapify POIs and driving geometry must never be cast into verified PAMANA facts.
// Vehicle REAL/SIMULATED labeling and verification remain independent of renderer.
