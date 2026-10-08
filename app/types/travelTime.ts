export interface TravelTimeEstimate {
  journeyId: string
  status: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'DISABLED'
  walkingSeconds?: number | null
  rideSeconds?: number | null
  movingSeconds?: number | null
  walkingComplete?: boolean
  ridesComplete?: boolean
  knownRideCount?: number
  rideCount?: number
  calculatedAt?: string
  expiresAt?: string
  source?: 'GEOAPIFY_ROAD_PROXY'
  exclusions?: string[]
  reasons?: string[]
}
