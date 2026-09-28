import type { DataMode, VerificationStatus } from './transportation'

export type WorkbenchEntity = 'transport-nodes' | 'routes' | 'route-variants'
  | 'route-variant-stops' | 'fare-rules' | 'service-patterns'

export interface WorkbenchSummary {
  entity: WorkbenchEntity
  label: string
  code: string
  missingCriticalFields: string[]
  evidence: string
}
export interface WorkbenchRecord {
  id?: number
  documentId: string
  [key: string]: unknown
  planning_enabled?: boolean
  verification_status?: VerificationStatus
  data_mode?: DataMode
  workbench: WorkbenchSummary
}

export interface WorkbenchFilters {
  verification?: string
  planning?: string
  dataMode?: string
  route?: string
  nodeType?: string
}

export interface WorkbenchConfirmations {
  coordinate?: boolean
  geometry?: boolean
  order?: boolean
}
