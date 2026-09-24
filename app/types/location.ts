export type LocationSource = 'GEOAPIFY' | 'USER_GPS'

/** A resolved geographic point. It is never a verified PAMANA transport node. */
export interface SelectedLocation {
  id: string
  label: string
  formattedAddress?: string
  lat: number
  lng: number
  placeId?: string
  category?: string
  source: LocationSource
}

export interface LocationSearchOptions {
  countryCode?: string
  bias?: { latitude: number; longitude: number }
  limit?: number
  language?: string
}
