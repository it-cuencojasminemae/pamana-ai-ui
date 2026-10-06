import type { JourneyTransitLeg, PamanaJourney, RouteOptionCategory, TripPlanClientError, TripPlanResponse } from '../types/tripPlan.ts'
import { formatFare } from './tripPlanPresentation.ts'

export const categoryLabels: Record<RouteOptionCategory, string> = {
  recommended: 'Recommended', cheapest: 'Cheapest', fastest: 'Fastest', fewestTransfers: 'Fewest Transfers',
}

export function validRouteOptions(journeys: PamanaJourney[]) {
  return journeys.filter(journey => journey.dataQuality.planningEligible
    && journey.dataQuality.dataModes.length > 0 && journey.dataQuality.dataModes.every(mode => mode === 'REAL')
    && journey.legs.some(leg => leg.type === 'TRANSIT')
    && journey.legs.filter(leg => leg.type === 'TRANSIT').every(leg => leg.boardAt && leg.alightAt))
}

export function defaultRouteOption(response: TripPlanResponse) {
  const options = validRouteOptions(response.journeys)
  const explicit = response.recommendations?.recommended.journeyId
  return options.find(journey => journey.id === explicit)?.id ?? options[0]?.id ?? null
}

export function routeCategories(response: TripPlanResponse | null, options: PamanaJourney[]) {
  return (Object.keys(categoryLabels) as RouteOptionCategory[]).map(key => {
    const id = response?.recommendations?.[key].journeyId
    const journeyId = options.find(j => j.id === id)?.id
      ?? (key === 'recommended' && response ? defaultRouteOption(response) : null)
    return { key, label: categoryLabels[key], journeyId,
      unavailable: key === 'fastest' ? 'Time data unavailable' : key === 'cheapest' ? 'Fare ranking unavailable' : 'Not available' }
  })
}

export function passengerText(value: string | null | undefined, fallback: string) {
  const text = value?.trim()
  return text && !/(?:RCH-|PILOT-|FIELD_VERIFIED|MANUAL_VERIFIED|DEMO_ESTIMATE|FARE_DISTANCE_UNAVAILABLE|UNKNOWN_SERVICE_PATTERN|PUJ_TRADITIONAL|PUJ_MODERN)/i.test(text) ? text : fallback
}

export function transportLabel(mode: string | null) {
  return ({ PUJ_TRADITIONAL: 'Jeep', PUJ_MODERN: 'Jeep', JEEPNEY: 'Jeep', TRICYCLE: 'Tricycle', BUS: 'Bus', UV_EXPRESS: 'UV Express', 'UV EXPRESS': 'UV Express' } as Record<string, string>)[mode || ''] || 'Public transport'
}

export function fareLabel(journey: PamanaJourney) {
  const summary = journey.fareSummary
  if (summary.totalStatus === 'KNOWN' && summary.totalFare !== null) return formatFare(summary.totalFare, summary.currency || 'PHP')
  return 'Fare unavailable'
}

export function waitLabel(leg: JourneyTransitLeg | undefined) {
  const wait = leg?.availability.wait
  if (wait?.status !== 'ESTIMATED_WINDOW' || wait.lowMinutes === null || wait.highMinutes === null || wait.highMinutes < wait.lowMinutes) return null
  return `${wait.lowMinutes === wait.highMinutes ? wait.lowMinutes : `${wait.lowMinutes}–${wait.highMinutes}`} min`
}

export function routeOptionPresentation(journey: PamanaJourney, optionNumber: number) {
  const transit = journey.legs.filter((leg): leg is JourneyTransitLeg => leg.type === 'TRANSIT')
  const sequence = transit.map(leg => transportLabel(leg.transportMode))
  const dropoff = passengerText(transit.at(-1)?.alightAt?.name, 'the drop-off point')
  const pickup = passengerText(transit[0]?.boardAt?.name, 'the pickup point')
  const via = passengerText(transit[0]?.alightAt?.name, 'the interchange')
  const status = journey.availabilitySummary.status
  const availability = ({ AVAILABLE: 'Service available', PARTIAL: 'Some service information available', UNAVAILABLE: 'Service unavailable at this time', UNKNOWN: null })[status]
  return {
    option: `OPTION ${optionNumber <= 26 ? String.fromCharCode(64 + optionNumber) : optionNumber}`,
    title: transit.length === 1 ? `Direct ${sequence[0]} to ${dropoff}` : `${sequence.join(' + ')} via ${via}`,
    sequence, fare: fareLabel(journey), transfers: `${journey.transferCount} ${journey.transferCount === 1 ? 'Transfer' : 'Transfers'}`,
    pickup, dropoff, availability, wait: waitLabel(transit[0]),
    // The current DTO has no total transit time. Walking time is not an ETA.
    totalTime: null,
    steps: transit.map((leg, index) => ({
      pickup: passengerText(leg.boardAt?.name, 'the pickup point'),
      dropoff: passengerText(leg.alightAt?.name, 'the drop-off point'),
      instruction: `${index ? 'Transfer to' : 'Take'} a ${transportLabel(leg.transportMode).toLowerCase()} to ${passengerText(leg.alightAt?.name, 'the drop-off point')}.`,
      signboard: passengerText(leg.signboard, ''),
      fare: leg.fare.status === 'KNOWN' ? formatFare(leg.fare.payableFare, leg.fare.currency || 'PHP') : 'Fare unavailable',
      estimated: leg.fare.isDemoEstimate === true || leg.fare.sourceType === 'DEMO_ESTIMATE',
    })),
  }
}

export function routeResultState(loading: boolean, error: TripPlanClientError | null, searched: boolean, options: PamanaJourney[], response: TripPlanResponse | null = null) {
  if (loading) return { kind: 'loading', title: 'Finding the best routes…', description: 'Checking supported routes for your trip.' }
  if (error) return { kind: 'error', title: "We couldn't load route options right now.", description: 'Please try again.' }
  if (options.length) return { kind: 'results', title: 'Route options', description: 'Choose a route to see it on the map.' }
  if (searched && response?.status === 'NO_TRANSPORT_JOURNEY' && response.warnings.includes('NO_JOURNEY_DUE_TO_ACTIVE_DISRUPTION')) {
    return { kind: 'empty', title: 'An active disruption is affecting routes for this trip.', description: 'Try another pickup point or destination, or check again when the disruption clears.' }
  }
  if (searched) return { kind: 'empty', title: 'No supported route was found for this trip yet.', description: 'Try another pickup point or destination.' }
  return { kind: 'idle', title: 'Where would you like to go?', description: 'Choose your pickup point and destination to see route options.' }
}
