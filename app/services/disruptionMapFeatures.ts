import type { StructuredDisruption } from '../types/disruption.ts'
import type { MapDisruptionFeature } from '../types/map.ts'
import { effectLabel, targetLabel } from './disruption.ts'
import { legacyMarkerFeatures, validPosition } from './mapPresentation.ts'

const line = (value: unknown) => Array.isArray(value) && value.length >= 2 && value.every(validPosition)
const ring = (value: unknown) => Array.isArray(value) && value.length >= 4 && value.every(validPosition)
  && value[0][0] === value.at(-1)[0] && value[0][1] === value.at(-1)[1]
const polygon = (value: unknown) => Array.isArray(value) && value.length > 0 && value.every(ring)

/** Management overlay only: supplied geometry or legacy coordinates, never inferred target locations. */
export function disruptionMapFeatures(records: StructuredDisruption[]): MapDisruptionFeature[] {
  return records.flatMap(record => {
    const supplied = record.geometry_geojson as { type?: string; coordinates?: unknown } | null
    const coordinates = supplied?.coordinates
    const valid = supplied && ({
      Point: validPosition(coordinates), LineString: line(coordinates), Polygon: polygon(coordinates),
      MultiLineString: Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(line),
      MultiPolygon: Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(polygon),
    } as Record<string, boolean>)[supplied.type || '']
    // Invalid supplied geometry is not replaced with a guessed point.
    const geometry = supplied ? valid === true ? supplied : null : legacyMarkerFeatures([record])[0]?.geometry
    if (!geometry) return []
    const id = `disruption-${record.documentId}`
    return [{ type: 'Feature', id, geometry, properties: {
      semantic: 'disruption', featureId: id, recordId: record.documentId, label: record.title,
      source: 'PAMANA', dataMode: record.data_mode, verificationStatus: record.verification_status ?? undefined,
      planningEnabled: record.planning_enabled,
      details: [effectLabel(record.effect), targetLabel(record), `Status: ${record.disruption_status}`,
        `Geometry source: ${record.geometry_source || 'Unknown'}`, record.description].filter(Boolean),
    } } as MapDisruptionFeature]
  })
}
