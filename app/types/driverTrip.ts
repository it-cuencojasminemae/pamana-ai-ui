import type { DataMode, VerificationStatus } from './transportation'

export type DriverDirection = 'OUTBOUND' | 'INBOUND'

export interface DriverVariantOption {
  documentId: string
  variantCode: string
  displayName: string
  direction: DriverDirection
  origin: string
  destination: string
  signboard: string | null
  operatingStatus: 'ACTIVE' | 'LIMITED'
  dataMode: DataMode
}

export interface DriverRouteOption {
  documentId: string
  routeCode: string
  routeName: string
  origin: string
  destination: string
  variants: DriverVariantOption[]
}

export interface DriverTripOptions {
  vehicle: null | {
    documentId: string
    vehicleNumber: string
    plateNumber: string
    capacity: number | null
    dataMode: DataMode
  }
  routes: DriverRouteOption[]
  activeTripDocumentId: string | null
  emptyReason: 'NO_ASSIGNED_VEHICLE' | 'NO_ASSIGNED_ROUTE' | 'NO_ELIGIBLE_VARIANTS' | null
}

export interface DriverTransportNode {
  documentId: string
  name: string
  node_code: string
  latitude: number | string | null
  longitude: number | string | null
  node_type: string
  data_mode: DataMode
  verification_status: VerificationStatus
  planning_enabled: boolean
}

export interface DriverVariantStop {
  documentId: string
  sequence: number
  pickup_allowed: boolean
  dropoff_allowed: boolean
  transfer_allowed: boolean
  transport_node?: DriverTransportNode | null
}

export interface ActiveDriverTrip {
  availability?: import('./vehicleAvailability').VehicleAvailability
  documentId: string
  direction: 'outbound' | 'inbound'
  data_mode: DataMode
  started_at: string
  route?: {
    documentId: string
    route_code: string
    route_name: string
    origin: string
    destination: string
  } | null
  route_variant?: {
    documentId: string
    variant_code: string
    display_name: string
    direction: DriverDirection
    signboard_text: string | null
    geometry_geojson?: { type: 'LineString'; coordinates: [number, number][] } | null
    route_variant_stops?: DriverVariantStop[]
  } | null
  vehicle?: {
    documentId: string
    vehicle_number: string
    plate_number: string
    capacity: number | null
    current_occupancy: number | null
    occupancy_level: string | null
  } | null
}
