import type { LineString, MultiLineString, Point, Polygon, MultiPolygon } from 'geojson'
import type { SelectedLocation } from './location'

export type PassengerCategory = 'REGULAR' | 'STUDENT' | 'SENIOR' | 'PWD'
export type PlanningMode = 'OPERATIONAL' | 'RESEARCH_PREVIEW'
export type AccessPreference = 'AUTO' | 'WALK_ONLY' | 'FEEDER'
export type TripPlanStatus = 'JOURNEYS_FOUND' | 'NO_ELIGIBLE_ACCESS_NODES' | 'NO_TRANSPORT_JOURNEY' | 'ROUTING_PROVIDER_UNAVAILABLE'
export type KnowledgeStatus = 'KNOWN' | 'PARTIAL' | 'UNKNOWN' | 'NOT_APPLICABLE'
export type FareStatus = KnowledgeStatus | 'FARE_DISTANCE_UNAVAILABLE'
export type FareSourceType = 'SYSTEM_CALCULATED' | 'DEMO_ESTIMATE' | 'VERIFIED_RULE' | 'FREE_WALK'

export interface JourneyDisruptionWarning {
  code: 'DISRUPTION_WARNING' | 'LIMITED_SERVICE'
  type: 'DISRUPTION'
  effect: 'WARNING_ONLY' | 'LIMITED_SERVICE'
  disruptionId: string
  message: string
  severity: string
  startsAt: string
  endsAt: string | null
  geometry: Point | LineString | MultiLineString | Polygon | MultiPolygon | null
}

export type JourneyWarning = string | JourneyDisruptionWarning

export interface TripPlanPoint {
  lat: number
  lng: number
  label?: string
  source?: 'USER_GPS' | 'GEOAPIFY' | 'MAP_PIN' | 'PILOT_LANDMARK' | null
  landmarkId?: string
}

export interface TripPlanRequest {
  planningMode?: PlanningMode
  accessPreference?: AccessPreference
  origin: TripPlanPoint
  destination: TripPlanPoint
  departureAt: string
  passengerCategory: PassengerCategory
}

export interface JourneyNodeReference {
  connector?: { temporary: boolean; role: string; sectionId: string; evidenceClass: string; direction: string; serviceLabel?: string; fieldBoardingSideVerified?: boolean }
  nodeType?: string | null
  nodeId?: string | null
  nodeCode?: string | null
  name?: string | null
  lat?: number
  lng?: number
}

export interface JourneyFare {
  status: FareStatus
  currency: string | null
  regularFare: number | null
  discountedFare: number | null
  payableFare: number | null
  discountType: PassengerCategory | null
  sourceSummary: string | null
  verificationStatus: string | null
  sourceType?: FareSourceType | null
  isCalculated?: boolean
  isDemoEstimate?: boolean
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
  evidenceClass?: 'SIMULATED'
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
  purpose?: 'ACCESS' | 'TRANSFER' | 'EGRESS'
  connectionId?: string
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
  signboardAliases?: string[]
  boardingInstructions?: string[]
  segmentDistanceMeters: number | null
  roadDistanceSource?: 'STORED_ROUTE_STOP_DISTANCE' | 'STORED_ROAD_GEOMETRY' | 'RESEARCH_DERIVED_GEOMETRY' | null
  durationSeconds: number | null
  evidenceClass?: 'USER_REPORTED' | 'VERIFIED_OPERATIONAL'
  geometrySource?: 'RESEARCH_PREVIEW'
  durationEvidenceClass?: 'SIMULATED'
  geometry: LineString | MultiLineString | null
}

export interface JourneyTransferLeg extends JourneyLegBase {
  to?: JourneyNodeReference | null
  connectionId?: string
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
    status: 'KNOWN' | 'PARTIAL' | 'UNKNOWN'
    knownWalkingDurationSeconds: number | null
    totalJourneyDurationSeconds: number | null
    evidenceClass?: 'SIMULATED'
  }
  warnings: JourneyWarning[]
  dataQuality: {
    planningEligible: boolean
    verificationStatuses: string[]
    dataModes: string[]
    researchPreview?: boolean
    evidenceClass?: string
  }
}

export interface TripPlanResponse {
  request: TripPlanRequest
  status: TripPlanStatus
  journeys: PamanaJourney[]
  recommendations?: JourneyRecommendations
  warnings: string[]
  meta: {
    journeyCount: number
    generatedAt: string
    dataMode: 'REAL'
    maxJourneys: number
    planningMode?: PlanningMode
    pendingAccessConnections?: number
    researchPreview?: boolean
    evidenceClass?: string
  }
}

export type RouteOptionCategory = 'recommended' | 'cheapest' | 'fastest' | 'fewestTransfers' | 'mostReliable'
export type JourneyRecommendations = Record<RouteOptionCategory, {
  journeyId: string | null
  unavailableReason: 'NO_VALID_JOURNEY' | 'FARE_DATA_UNAVAILABLE' | 'TIME_DATA_UNAVAILABLE' | 'RELIABILITY_EVIDENCE_INSUFFICIENT' | null
}>

export type TripPlanClientError = 'INVALID_INPUT' | 'AUTH_REQUIRED' | 'PROVIDER_UNAVAILABLE' | 'SERVICE_UNAVAILABLE' | 'INVALID_RESPONSE' | 'CANCELLED'

export interface TripPlanSearchInput {
  origin: SelectedLocation
  destination: SelectedLocation
  departureAt: string
  passengerCategory: PassengerCategory
}
