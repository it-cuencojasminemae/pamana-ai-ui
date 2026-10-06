import type { PamanaJourney } from '../types/tripPlan'
import type { JourneyExplanationRequest, JourneyExplanationResponse, JourneyExplanationStatus } from '../types/journeyExplanation'
import { passengerText, routeOptionPresentation, transportLabel } from './routeOptionsPresentation.ts'

type ApiFetcher = <T>(endpoint: string, options?: Record<string, unknown>) => Promise<T>
const statuses: JourneyExplanationStatus[] = ['AVAILABLE', 'PROVIDER_UNAVAILABLE', 'INVALID_JOURNEY', 'NOT_CONFIGURED']
export const guideUnavailableMessage = 'Trip guide is temporarily unavailable. Your route details are still shown above.'
const forbiddenText = /RCH-|PILOT-|\b[a-f\d]{24,64}\b|\b[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\b|\b(?:FIELD_VERIFIED|MANUAL_VERIFIED|DEMO_ESTIMATE|SYSTEM_CALCULATED|UNKNOWN_SERVICE_PATTERN|FARE_DISTANCE_UNAVAILABLE|PUJ_TRADITIONAL|PUJ_MODERN|STORED_ROUTE_STOP_DISTANCE|STORED_ROAD_GEOMETRY|SIMULATED_DEMO)\b|geometry_source|verification_status|data_mode|planning_enabled|sourceType|roadDistanceSource|transferCount|totalFare|payableFare|\b(?:headway|variant|provenance|cumulative distance|fare policy|planning eligibility|database|API key)\b/i
const internalFields = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b|sourceSummary|verificationStatus|dataQuality|geometrySource|availabilitySummary|durationSummary|originLabel|destinationLabel|nodeId|routeId|variantId|estimatedFare|estimatedWaitMinutes|walkingInstructions|\b(?:confidence|JSON)\b/
const guideLabel = (value: string | null | undefined, fallback: string) => value && !forbiddenText.test(value) && !internalFields.test(value) ? passengerText(value, fallback) : fallback

/** Passenger facts only. No IDs, codes, coordinates, geometry, provenance or scoring. */
export function buildJourneyExplanationRequest(originLabel: string, destinationLabel: string, journey: PamanaJourney): JourneyExplanationRequest {
  return {
    originLabel: guideLabel(originLabel, 'Your pickup point'),
    destinationLabel: guideLabel(destinationLabel, 'Your destination'),
    journey: {
      transferCount: journey.transferCount,
      legs: journey.legs.filter(leg => leg.type !== 'TRANSFER').map(leg => leg.type === 'WALK' ? {
        sequence: leg.sequence, type: leg.type,
        instructions: leg.instructions.slice(0, 2).map(instruction => ({ text: guideLabel(instruction.text, '') })).filter(instruction => instruction.text),
      } : {
        sequence: leg.sequence, type: leg.type, transportMode: transportLabel(leg.transportMode),
        boardAt: { name: guideLabel(leg.boardAt?.name, 'the pickup point') },
        alightAt: { name: guideLabel(leg.alightAt?.name, 'the drop-off point') },
        signboard: guideLabel(leg.signboard, ''),
        ...(leg.availability.wait.status === 'ESTIMATED_WINDOW' && leg.availability.wait.lowMinutes !== null && leg.availability.wait.highMinutes !== null ? {
          availability: { wait: { status: 'ESTIMATED_WINDOW', lowMinutes: leg.availability.wait.lowMinutes, highMinutes: leg.availability.wait.highMinutes } },
        } : {}),
      }),
      fareSummary: { totalStatus: journey.fareSummary.totalStatus, totalFare: journey.fareSummary.totalFare, currency: journey.fareSummary.currency },
      ...(journey.availabilitySummary.status === 'AVAILABLE' || journey.availabilitySummary.status === 'UNAVAILABLE' ? {
        availabilitySummary: { status: journey.availabilitySummary.status },
      } : {}),
      // Partial walking duration is deliberately excluded: it is not total journey time.
    },
  }
}

/** Reuses Batch B's supplied ride instructions, fare and transfer values; never routes or prices. */
export function deterministicTripGuide(journey: PamanaJourney) {
  const data = routeOptionPresentation(journey, 1)
  const rides = data.steps.map((step, index) => `${index ? 'At' : 'From'} ${guideLabel(step.pickup, 'the pickup point')}, ${index ? 'transfer to' : 'take'} a ${data.sequence[index].toLowerCase()}${guideLabel(step.signboard, '') ? ` marked ${step.signboard}` : ''} and get off at ${guideLabel(step.dropoff, 'the drop-off point')}.`)
  return `${rides.join(' ')} Estimated ${data.steps.length > 1 ? 'total ' : ''}fare: ${data.fare}. ${journey.transferCount === 0 ? 'No transfer is needed.' : `This trip has ${data.transfers.toLowerCase()}.`}`
}

/** Defense in depth even if an older backend returns unvalidated provider text. */
export function safeJourneyGuide(text: string, request: JourneyExplanationRequest) {
  if (!text || text.length > 1200 || text.split(/\s+/).length > 120 || forbiddenText.test(text) || internalFields.test(text) || /[<>`]|https?:\/\//i.test(text)) return false
  const sentences = text.trim().replace(/\b(Sta|St|Dr|Mr|Mrs|Ms|Jr|Sr)\./gi, '$1').split(/[.!?]+(?:\s+|$)/).filter(Boolean)
  if (sentences.length < 2 || sentences.length > 4) return false
  const journey = request.journey as { transferCount: number; legs: any[]; fareSummary: { totalStatus: string; totalFare: number | null; currency: string | null }; availabilitySummary?: { status: string } }
  const transit = journey.legs.filter(leg => leg.type === 'TRANSIT')
  if (transit.every(leg => !leg.availability?.wait) && /\b(?:minutes?|wait(?:ing)?\s+(?:time|for|\d)|arrives? (?:in|soon|shortly))\b/i.test(text)) return false
  if (/\b(?:ETA|hours?|days?|duration|travel time|trip takes|journey takes|schedule|every)\b/i.test(text)) return false
  if (!journey.availabilitySummary && /\b(?:availability|high availability|service (?:is )?available|reliable service)\b/i.test(text)) return false
  const fare = journey.fareSummary
  if (fare.totalStatus === 'KNOWN' && fare.totalFare !== null) {
    const number = String(fare.totalFare)
    const amounts = [...text.matchAll(/(?:₱|PHP\s*|pesos?\s*)([\d,]+(?:\.\d+)?)/gi)].map(match => match[1].replaceAll(',', ''))
    amounts.push(...[...text.matchAll(/\b([\d,]+(?:\.\d+)?)\s*pesos?\b/gi)].map(match => match[1].replaceAll(',', '')))
    if (!amounts.length || amounts.some(amount => amount !== number)) return false
  } else if (/(?:₱|PHP\s*|\d\s*pesos?)/i.test(text)) return false
  const count = journey.transferCount
  if (count === 0 && !/\b(?:(?:no|zero|0) transfers?|without (?:any )?transfers?)\b/i.test(text)) return false
  if (count > 0 && !new RegExp(`\\b(?:${count}|${['zero', 'one', 'two'][count] || count}) transfers?\\b`, 'i').test(text)) return false
  if ([...text.matchAll(/\b(\d+) transfers?\b/gi)].some(match => Number(match[1]) !== count)) return false
  if (count > 0 && /\b(?:no|zero) transfers?\b/i.test(text)) return false
  const countWords = ['no', 'zero', 'one', 'two', 'three', 'four']
  if ([...text.matchAll(/\b(no|zero|one|two|three|four) transfers?\b/gi)].some(match => Math.max(0, countWords.indexOf(match[1].toLowerCase()) - 1) !== count)) return false
  const allowedNumbers = new Set([String(count), String(fare.totalFare), ...(JSON.stringify(request).match(/\d+(?:\.\d+)?/g) || [])])
  if ((text.match(/\d+(?:\.\d+)?/g) || []).some(number => !allowedNumbers.has(number))) return false
  if (transit.some(leg => !text.toLowerCase().includes(leg.transportMode.toLowerCase()) || (leg.signboard && !text.toLowerCase().includes(leg.signboard.toLowerCase())))) return false
  let position = 0
  for (const leg of transit) { const next = text.toLowerCase().indexOf(leg.transportMode.toLowerCase(), position); if (next < 0) return false; position = next + leg.transportMode.length }
  return true
}

function validResponse(value: unknown): value is JourneyExplanationResponse {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<JourneyExplanationResponse>
  return statuses.includes(result.status as JourneyExplanationStatus)
    && (result.provider === undefined || result.provider === null || result.provider === 'gemini' || result.provider === 'openai')
    && (result.explanation === null || typeof result.explanation === 'string')
    && typeof result.generatedAt === 'string'
}

export function unavailableGuide(): JourneyExplanationResponse {
  return { status: 'PROVIDER_UNAVAILABLE', explanation: null, generatedAt: new Date().toISOString() }
}

export async function fetchJourneyExplanation(apiFetch: ApiFetcher, request: JourneyExplanationRequest, signal?: AbortSignal): Promise<JourneyExplanationResponse> {
  try {
    const response = await apiFetch<unknown>('/api/pamana-ai/journey-explanation', { method: 'POST', body: request, signal })
    if (validResponse(response)) return response.status === 'AVAILABLE' && (!response.explanation || !safeJourneyGuide(response.explanation, request))
      ? unavailableGuide() : { status: response.status, provider: response.provider, explanation: response.status === 'AVAILABLE' ? response.explanation : null, generatedAt: response.generatedAt }
    return unavailableGuide()
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    return unavailableGuide()
  }
}
