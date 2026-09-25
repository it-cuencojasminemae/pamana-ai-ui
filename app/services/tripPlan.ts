import type { SelectedLocation } from '../types/location.ts'
import type { PassengerCategory, TripPlanClientError, TripPlanRequest, TripPlanResponse } from '../types/tripPlan.ts'

type ApiFetcher = <T>(endpoint: string, options?: Record<string, unknown>) => Promise<T>

export interface TripPlanResult {
  ok: boolean
  data?: TripPlanResponse
  error?: TripPlanClientError
}

export function buildTripPlanRequest(
  origin: SelectedLocation,
  destination: SelectedLocation,
  departureAt: string,
  passengerCategory: PassengerCategory,
): TripPlanRequest {
  return {
    origin: { lat: origin.lat, lng: origin.lng, label: origin.label, source: origin.source },
    destination: { lat: destination.lat, lng: destination.lng, label: destination.label, source: destination.source },
    departureAt,
    passengerCategory,
  }
}

function statusFromError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const candidate = error as { statusCode?: unknown; response?: { status?: unknown } }
  const status = candidate.response?.status ?? candidate.statusCode
  return typeof status === 'number' ? status : null
}

function providerFailure(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { data?: { status?: unknown } }
  return candidate.data?.status === 'ROUTING_PROVIDER_UNAVAILABLE'
}

function validResponse(value: unknown): value is TripPlanResponse {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<TripPlanResponse>
  const journeysValid = Array.isArray(result.journeys) && result.journeys.every(journey => Boolean(
    journey && typeof journey === 'object' && typeof journey.id === 'string' && Array.isArray(journey.legs)
      && journey.fareSummary && journey.availabilitySummary && journey.durationSummary,
  ))
  return ['JOURNEYS_FOUND', 'NO_ELIGIBLE_ACCESS_NODES', 'NO_TRANSPORT_JOURNEY', 'ROUTING_PROVIDER_UNAVAILABLE'].includes(String(result.status))
    && journeysValid
    && Boolean(result.meta && typeof result.meta === 'object')
}

export async function fetchTripPlan(
  apiFetch: ApiFetcher,
  request: TripPlanRequest,
  signal?: AbortSignal,
): Promise<TripPlanResult> {
  try {
    const response = await apiFetch<unknown>('/api/pamana-ai/trip-plan', {
      method: 'POST',
      body: request,
      signal,
    })
    if (!validResponse(response)) return { ok: false, error: 'INVALID_RESPONSE' }
    return { ok: true, data: response }
  } catch (error: unknown) {
    if (signal?.aborted) return { ok: false, error: 'CANCELLED' }
    const status = statusFromError(error)
    if (status === 400) return { ok: false, error: 'INVALID_INPUT' }
    if (status === 401 || status === 403) return { ok: false, error: 'AUTH_REQUIRED' }
    if (providerFailure(error)) return { ok: false, error: 'PROVIDER_UNAVAILABLE' }
    return { ok: false, error: 'SERVICE_UNAVAILABLE' }
  }
}

export const tripPlanFingerprint = (request: TripPlanRequest) => JSON.stringify(request)
