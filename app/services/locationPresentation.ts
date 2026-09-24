import type { MapPointFeature } from '../types/map.ts'
import type { SelectedLocation } from '../types/location.ts'

/** Geographic selections stay external/device geography, never PAMANA transport facts. */
export function locationMapFeature(location: SelectedLocation, mode: 'origin' | 'destination'): MapPointFeature {
  return {
    type: 'Feature',
    id: `selected-${mode}-${location.id}`,
    geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
    properties: {
      semantic: mode === 'origin' ? 'origin-location' : 'destination-location',
      label: location.label,
      source: location.source === 'GEOAPIFY' ? 'GEOAPIFY' : 'DEVICE',
      recordId: location.id,
      geographicRole: mode,
      placeId: location.placeId,
      isTransportNode: false,
    },
  }
}
