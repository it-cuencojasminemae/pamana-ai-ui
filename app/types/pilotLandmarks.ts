export type LandmarkCategory = 'HOSPITAL' | 'SCHOOL' | 'SHOPPING' | 'MARKET' | 'SERVICE'
export interface PilotLandmark {
  nodeType?: string
  evidenceClass?: string
  id: string
  name: string
  category: LandmarkCategory
  lat: number
  lng: number
  aliases: string[]
  connectionNote?: string
}
export interface PilotLandmarkCatalog {
  enabled: boolean
  version: string
  source: { type: string; reportedAt: string; observedAt: string | null; coordinatePurpose: string; transportStopVerified: boolean }
  landmarks: PilotLandmark[]
}
