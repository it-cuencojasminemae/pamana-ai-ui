import type { PilotLandmark } from '../types/pilotLandmarks'
import type { MapPointFeature } from '../types/map'
import { markerSemantic } from './mapPresentation.ts'

export function researchReferenceFeatures(references: PilotLandmark[]): MapPointFeature[] {
  return references.filter(item => item.nodeType === 'TERMINAL' || item.nodeType === 'LOADING_BAY').map(item => ({
    type: 'Feature', id: item.id, geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
    properties: { semantic: markerSemantic(item.nodeType), label: `${item.name} · RESEARCH`, source: 'PAMANA',
      verificationStatus: 'RESEARCH_CANDIDATE', planningEnabled: false, evidenceClass: 'USER_REPORTED',
      contextualReference: true,
      details: ['User-reported local transport reference. Operational verification pending.'] },
  }))
}
