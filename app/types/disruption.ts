export type DisruptionEffect =
  | 'WARNING_ONLY'
  | 'LIMITED_SERVICE'
  | 'ROUTE_SUSPENDED'
  | 'VARIANT_SUSPENDED'
  | 'NODE_CLOSED'
  | 'BOARDING_CLOSED'
  | 'ALIGHTING_CLOSED'
  | 'TRANSFER_BLOCKED'

export type VerificationStatus =
  | 'AUTHORITATIVE_CURRENT'
  | 'FIELD_VERIFIED'
  | 'CORROBORATED_RESEARCH'
  | 'HISTORICAL_UNVERIFIED'
  | 'SIMULATED_DEMO'
  | 'RESEARCH_CANDIDATE'

export interface DisruptionTargetRoute {
  id: string
  code: string
  name: string
  status: string
  planningEnabled: boolean
}

export interface DisruptionTargetVariant {
  id: string
  code: string
  name: string
  direction: string
  routeId: string | null
  routeCode: string | null
  operatingStatus: string
  planningEnabled: boolean
}

export interface DisruptionTargetNode {
  id: string
  code: string
  name: string
  type: string
  locality: string | null
  planningEnabled: boolean
}

export interface DisruptionTargetOptions {
  routes: DisruptionTargetRoute[]
  variants: DisruptionTargetVariant[]
  nodes: DisruptionTargetNode[]
}

export interface DisruptionRelation {
  documentId: string
  route_name?: string
  route_code?: string
  display_name?: string
  variant_code?: string
  name?: string
  node_code?: string
}

export interface StructuredDisruption {
  documentId: string
  type: string
  title: string
  description: string | null
  severity: string
  starts_at: string
  ends_at?: string | null
  disruption_status: string
  data_mode: 'REAL' | 'SIMULATED'
  effect?: DisruptionEffect | null
  planning_enabled?: boolean
  verification_status?: VerificationStatus | null
  resolved_at?: string | null
  resolution_notes?: string | null
  affected_route?: DisruptionRelation | null
  affected_route_variant?: DisruptionRelation | null
  affected_transport_node?: DisruptionRelation | null
}
