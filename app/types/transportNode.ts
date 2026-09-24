import type { DataMode, VerificationStatus } from './transportation'

export type TransportNodeType =
  | 'ROADSIDE_PICKUP'
  | 'DESIGNATED_STOP'
  | 'TERMINAL'
  | 'LOADING_BAY'
  | 'DROP_OFF'
  | 'TRANSFER_POINT'
  | 'TRANSPORT_HUB'
  | 'LANDMARK'
  | 'DESTINATION'
  | 'ESSENTIAL_SERVICE'
  | 'EMERGENCY_PICKUP'

/** Normalized transport infrastructure; never a Geoapify place result. */
export interface MapTransportNode {
  id: string
  documentId?: string
  code: string
  name: string
  type: TransportNodeType
  lat: number | null
  lng: number | null
  verificationStatus: VerificationStatus
  planningEnabled: boolean
  dataMode: DataMode
  verifiedAt?: string | null
  sourceName?: string | null
  sourceUrl?: string | null
  sourceReference?: string | null
  source: 'PAMANA_TRANSPORT_DB'
}

export interface TransportNodeDiagnostics {
  received: number
  visible: number
  unmapped: number
  ineligible: number
  malformed: number
}
