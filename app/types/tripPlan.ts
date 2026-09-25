import type { LineString, MultiLineString } from 'geojson'
import type { SelectedLocation } from './location'

export type PassengerCategory = 'REGULAR' | 'STUDENT' | 'SENIOR' | 'PWD'
export type TripPlanStatus = 'JOURNEYS_FOUND' | 'NO_ELIGIBLE_ACCESS_NODES' | 'NO_TRANSPORT_JOURNEY' | 'ROUTING_PROVIDER_UNAVAILABLE'
export type KnowledgeStatus = 'KNOWN' | 'PARTIAL' | 'UNKNOWN' | 'NOT_APPLICABLE'

export interface TripPlanPoint {
  lat: number
  lng: number
  label?: string
  source?: 'USER_GPS' | 'GEOAPIFY' | null
}

export interface TripPlanRequest {
  origin: TripPlanPoint
  destination: TripPlanPoint
  departureAt: string
  passengerCategory: PassengerCategory
}

export interface JourneyNodeReference {
  nodeId?: string | null
  nodeCode?: string | null
  name?: string | null
  lat?: number
  lng?: number
}

export interface JourneyFare {
  status: KnowledgeStatus
  currency: string | null
  regularFare: number | null
  discountedFare: number | null
  payableFare: number | null
  discountType: PassengerCategory | null
  sourceSummary: string | null
  verificationStatus: string | null
  warnings: string[]
}

export interface JourneyService {
  status: KnowledgeStatus
  operatingMode: 'FREQUENCY_BASED' | 'SCHEDULED' | 'LEAVE_WHEN_FULL' | 'CONTINUOUS_UNSCHEDULED' | null
  serviceStart: string | null
  serviceEnd: string | null
  headwayMinutes: { minimum: number; maximum: number } | null
  scheduledDepartures: string[]
  leaveWhenFull: boolean | null
  limitedService: boolean | null
  windowStatus: 'WITHIN_SERVICE_WINDOW' | 'OUTSIDE_SERVICE_WINDOW' | 'UNKNOWN'
  sourceSummary: string | null
  verificationStatus: string | null
  warnings: string[]
}

export interface JourneyAvailability {
  status: 'LIVE_ACTIVE' | 'SERVICE_EXPECTED' | 'LIMITED' | 'OUTSIDE_SERVICE' | 'UNKNOWN'
  wait: {
    status: 'SERVICE_INTERVAL_ONLY' | 'ESTIMATED_WINDOW' | 'UNKNOWN' | 'NOT_APPLICABLE'
    lowMinutes: number | null
    highMinutes: number | null
    basis?: string | null
  }
  activeVehicleCount: number | null
  boardableVehicleCount: number | null
  sourceSummary: string | null
  warnings: string[]
}

interface JourneyLegBase {
  sequence: number
  fare: JourneyFare
  service: JourneyService
  availability: JourneyAvailability
}

export interface JourneyWalkLeg extends JourneyLegBase {
  type: 'WALK'
  from: TripPlanPoint
  to: TripPlanPoint
  distanceMeters: number | null
  durationSeconds: number | null
  geometry: LineString | MultiLineString | null
  instructions: { text: string; distanceMeters: number | null; durationSeconds: number | null }[]
  source: 'GEOAPIFY'
  calculatedAt: string | null
}

export interface JourneyTransitLeg extends JourneyLegBase {
  type: 'TRANSIT'
  transportMode: string | null
  route: { id: string | null; code: string | null }
  variant: { id: string | null; code: string | null }
  direction: string | null
  operatingStatus: string | null
  boardAt: JourneyNodeReference | null
  alightAt: JourneyNodeReference | null
  intermediateNodes: JourneyNodeReference[]
  signboard: string | null
  segmentDistanceMeters: number | null
  durationSeconds: null
  geometry: LineString | MultiLineString | null
}

export interface JourneyTransferLeg extends JourneyLegBase {
  type: 'TRANSFER'
  at: JourneyNodeReference | null
  fromRouteVariantId: string | null
  fromVariantCode: string | null
  toRouteVariantId: string | null
  toVariantCode: string | null
}

export type JourneyLeg = JourneyWalkLeg | JourneyTransitLeg | JourneyTransferLeg

export interface PamanaJourney {
  id: string
  transferCount: number
  modes: string[]
  legs: JourneyLeg[]
  fareSummary: {
    totalStatus: 'KNOWN' | 'PARTIAL' | 'UNKNOWN'
    knownSubtotal: number | null
    totalFare: number | null
    currency: string | null
    warnings: string[]
  }
  availabilitySummary: {
    status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'UNKNOWN'
    transitLegsKnown: number
    transitLegsUnknown: number
    warnings: string[]
  }
  durationSummary: {
    status: 'PARTIAL' | 'UNKNOWN'
    knownWalkingDurationSeconds: number | null
    totalJourneyDurationSeconds: null
  }
  warnings: string[]
  dataQuality: {
    planningEligible: boolean
    verificationStatuses: string[]
    dataModes: string[]
  }
}

export interface TripPlanResponse {
  request: TripPlanRequest
  status: TripPlanStatus
  journeys: PamanaJourney[]
  warnings: string[]
  meta: {
    journeyCount: number
    generatedAt: string
    dataMode: 'REAL'
    maxJourneys: number
  }
}

export type TripPlanClientError = 'INVALID_INPUT' | 'AUTH_REQUIRED' | 'PROVIDER_UNAVAILABLE' | 'SERVICE_UNAVAILABLE' | 'INVALID_RESPONSE' | 'CANCELLED'

export interface TripPlanSearchInput {
  origin: SelectedLocation
  destination: SelectedLocation
  departureAt: string
  passengerCategory: PassengerCategory
}
