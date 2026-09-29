import type { PamanaJourney } from '../types/tripPlan'
import type { JourneyExplanationRequest, JourneyExplanationResponse, JourneyExplanationStatus } from '../types/journeyExplanation'

type ApiFetcher = <T>(endpoint: string, options?: Record<string, unknown>) => Promise<T>
const statuses: JourneyExplanationStatus[] = ['AVAILABLE', 'PROVIDER_UNAVAILABLE', 'INVALID_JOURNEY', 'NOT_CONFIGURED']

const explanationFare = (fare: PamanaJourney['legs'][number]['fare']) => ({
  status: fare.status, currency: fare.currency, regularFare: fare.regularFare,
  discountedFare: fare.discountedFare, payableFare: fare.payableFare,
  discountType: fare.discountType, sourceSummary: fare.sourceSummary,
  verificationStatus: fare.verificationStatus, warnings: fare.warnings,
})
const explanationService = (service: PamanaJourney['legs'][number]['service']) => ({
  status: service.status, operatingMode: service.operatingMode,
  serviceStart: service.serviceStart, serviceEnd: service.serviceEnd,
  headwayMinutes: service.headwayMinutes, scheduledDepartures: service.scheduledDepartures,
  leaveWhenFull: service.leaveWhenFull, limitedService: service.limitedService,
  windowStatus: service.windowStatus, sourceSummary: service.sourceSummary,
  verificationStatus: service.verificationStatus, warnings: service.warnings,
})
const explanationAvailability = (availability: PamanaJourney['legs'][number]['availability']) => ({
  status: availability.status,
  wait: {
    status: availability.wait.status, lowMinutes: availability.wait.lowMinutes,
    highMinutes: availability.wait.highMinutes, basis: availability.wait.basis ?? null,
  },
  activeVehicleCount: availability.activeVehicleCount,
  boardableVehicleCount: availability.boardableVehicleCount,
  sourceSummary: availability.sourceSummary, warnings: availability.warnings,
})

/** Removes coordinates, internal IDs, geometry, identity, and raw provider/database objects. */
export function buildJourneyExplanationRequest(originLabel: string, destinationLabel: string, journey: PamanaJourney): JourneyExplanationRequest {
  const legs = journey.legs.map((leg) => {
    if (leg.type === 'WALK') return {
      sequence: leg.sequence, type: leg.type,
      from: { label: leg.from.label ?? null }, to: { label: leg.to.label ?? null },
      distanceMeters: leg.distanceMeters, durationSeconds: leg.durationSeconds,
      instructions: leg.instructions.map(instruction => ({
        text: instruction.text, distanceMeters: instruction.distanceMeters, durationSeconds: instruction.durationSeconds,
      })),
      source: leg.source,
    }
    if (leg.type === 'TRANSFER') return {
      sequence: leg.sequence, type: leg.type,
      at: { name: leg.at?.name ?? null },
      fromVariantCode: leg.fromVariantCode, toVariantCode: leg.toVariantCode,
    }
    return {
      sequence: leg.sequence, type: leg.type, transportMode: leg.transportMode,
      route: { code: leg.route.code }, variant: { code: leg.variant.code },
      direction: leg.direction, operatingStatus: leg.operatingStatus,
      boardAt: { name: leg.boardAt?.name ?? null }, alightAt: { name: leg.alightAt?.name ?? null },
      intermediateNodes: leg.intermediateNodes.map(node => ({ name: node.name ?? null })),
      signboard: leg.signboard, segmentDistanceMeters: leg.segmentDistanceMeters,
      durationSeconds: leg.durationSeconds,
      fare: explanationFare(leg.fare),
      service: explanationService(leg.service),
      availability: explanationAvailability(leg.availability),
    }
  })
  const warnings = journey.warnings.map((warning) => typeof warning === 'string' ? warning : {
    type: warning.type, effect: warning.effect, message: warning.message, severity: warning.severity,
    startsAt: warning.startsAt, endsAt: warning.endsAt,
  })
  return {
    originLabel, destinationLabel,
    journey: {
      transferCount: journey.transferCount,
      modes: journey.modes,
      legs,
      fareSummary: journey.fareSummary,
      availabilitySummary: journey.availabilitySummary,
      durationSummary: journey.durationSummary,
      warnings,
    },
  }
}

function validResponse(value: unknown): value is JourneyExplanationResponse {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<JourneyExplanationResponse>
  return statuses.includes(result.status as JourneyExplanationStatus)
    && (result.provider === undefined || result.provider === null || result.provider === 'gemini' || result.provider === 'openai')
    && (result.explanation === null || typeof result.explanation === 'string')
    && typeof result.generatedAt === 'string'
    && (result.warning === undefined || typeof result.warning === 'string')
}

export async function fetchJourneyExplanation(apiFetch: ApiFetcher, request: JourneyExplanationRequest, signal?: AbortSignal): Promise<JourneyExplanationResponse> {
  try {
    const response = await apiFetch<unknown>('/api/pamana-ai/journey-explanation', { method: 'POST', body: request, signal })
    if (validResponse(response)) return response
    return { status: 'PROVIDER_UNAVAILABLE', explanation: null, generatedAt: new Date().toISOString(), warning: 'Trip explanation is temporarily unavailable.' }
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    const candidate = error as { data?: unknown; response?: { _data?: unknown } }
    const body = candidate.data ?? candidate.response?._data
    if (validResponse(body)) return body
    return { status: 'PROVIDER_UNAVAILABLE', explanation: null, generatedAt: new Date().toISOString(), warning: 'Trip explanation is temporarily unavailable.' }
  }
}
