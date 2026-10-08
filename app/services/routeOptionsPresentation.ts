import type { JourneyTransitLeg, PamanaJourney, RouteOptionCategory, TripPlanClientError, TripPlanResponse } from '../types/tripPlan.ts'
import { formatFare } from './tripPlanPresentation.ts'

export const categoryLabels: Record<RouteOptionCategory, string> = {
  recommended: 'Recommended', cheapest: 'Cheapest', fastest: 'Fastest', fewestTransfers: 'Fewest Transfers',
  mostReliable: 'Most Reliable',
}

export function validRouteOptions(journeys: PamanaJourney[], mode = 'OPERATIONAL') {
  return journeys.filter(journey => journey.dataQuality.planningEligible
    && journey.dataQuality.dataModes.length > 0 && journey.dataQuality.dataModes.every(mode => mode === 'REAL')
    && (mode === 'RESEARCH_PREVIEW' || (!journey.dataQuality.researchPreview && !journey.dataQuality.verificationStatuses.includes('RESEARCH_CANDIDATE')))
    && journey.legs.some(leg => leg.type === 'TRANSIT')
    && journey.legs.filter(leg => leg.type === 'TRANSIT').every(leg => leg.boardAt && leg.alightAt))
}

export function defaultRouteOption(response: TripPlanResponse) {
  const options = validRouteOptions(response.journeys, response.meta?.planningMode)
  const explicit = response.recommendations?.recommended.journeyId
  return options.find(journey => journey.id === explicit)?.id ?? options[0]?.id ?? null
}

export function routeCategories(response: TripPlanResponse | null, options: PamanaJourney[]) {
  return (Object.keys(categoryLabels) as RouteOptionCategory[]).map(key => {
    const id = response?.recommendations?.[key]?.journeyId
    const journeyId = options.find(j => j.id === id)?.id
      ?? (key === 'recommended' && response ? defaultRouteOption(response) : null)
    return { key, label: categoryLabels[key], journeyId,
      unavailable: key === 'mostReliable' ? 'Insufficient evidence' : key === 'fastest' ? 'Time data unavailable' : key === 'cheapest' ? 'Fare ranking unavailable' : 'Not available' }
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
  return summary.knownSubtotal !== null && summary.knownSubtotal !== undefined ? `${formatFare(summary.knownSubtotal, summary.currency || 'PHP')} known subtotal; total unknown` : 'Fare unavailable'
}

export function waitLabel(leg: JourneyTransitLeg | undefined) {
  const wait = leg?.availability.wait
  if (!wait || (wait.status !== 'ESTIMATED_WINDOW' && !(wait.status === 'SERVICE_INTERVAL_ONLY' && leg?.availability.evidenceClass === 'SIMULATED')) || wait.lowMinutes === null || wait.highMinutes === null || wait.highMinutes < wait.lowMinutes) return null
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
    totalTime: journey.durationSummary.evidenceClass === 'SIMULATED' && journey.durationSummary.totalJourneyDurationSeconds !== null
      ? `Demo: ${Math.ceil(journey.durationSummary.totalJourneyDurationSeconds / 60)} min` : null,
    steps: transit.map((leg, index) => ({
      pickup: passengerText(leg.boardAt?.name, 'the pickup point'),
      dropoff: passengerText(leg.alightAt?.name, 'the drop-off point'),
      instruction: `${index ? 'Transfer to' : 'Take'} a ${transportLabel(leg.transportMode).toLowerCase()} to ${passengerText(leg.alightAt?.name, 'the drop-off point')}.`,
      signboard: passengerText(leg.signboard, ''),
      boardingInstructions: (leg.boardingInstructions || []).map(text => passengerText(text, '')).filter(Boolean),
      signboardAliases: (leg.signboardAliases || []).map(text => passengerText(text, '')).filter(Boolean),
      fare: leg.fare.status === 'KNOWN' ? formatFare(leg.fare.payableFare, leg.fare.currency || 'PHP') : 'Fare unavailable',
      estimated: leg.fare.isDemoEstimate === true || leg.fare.sourceType === 'DEMO_ESTIMATE' || leg.evidenceClass === 'USER_REPORTED',
    })),
  }
}

/** Preserve planner leg order and walking instructions without asking AI to route. */
export function journeyNavigationSteps(journey: PamanaJourney) {
  const rides = routeOptionPresentation(journey, 1).steps
  let rideIndex = 0
  return journey.legs.flatMap((leg, index) => {
    if (leg.type === 'TRANSIT') {
      const ride = rides[rideIndex++]!
      if (leg.boardAt?.connector?.temporary && leg.boardAt.connector.role === 'ACCESS') {
        const wait = ride.boardingInstructions.find(text => text.startsWith('Wait at a safe roadside'))
          || 'Wait at a safe roadside pickup point for this jeepney. Confirm the boarding side and exact roadside position locally.'
        return [{ type: 'BOARDING', instruction: wait, walkingInstructions: [] as string[], boardingInstructions: [] as string[], signboardAliases: [] as string[], signboard: '', fare: '', estimated: false, pickup: '', dropoff: '' },
          { ...ride, instruction: `Board the ${passengerText(leg.boardAt.connector.serviceLabel, 'selected')} jeepney and alight at ${ride.dropoff}.`,
            boardingInstructions: ride.boardingInstructions.filter(text => text !== wait), type: 'TRANSIT', walkingInstructions: [] as string[] }]
      }
      return [{ ...ride, type: 'TRANSIT', walkingInstructions: [] as string[] }]
    }
    if (leg.type !== 'WALK' || (leg.distanceMeters === 0 && !leg.instructions.length)) return []
    const walkingInstructions = leg.instructions.map(value => passengerText(value.text, '')).filter(Boolean)
    const nextRide = journey.legs.slice(index + 1).find(value => value.type === 'TRANSIT')
    const destination = leg.to.label || nextRide?.boardAt?.name
    const purpose = leg.purpose === 'TRANSFER' ? 'Transfer walk' : leg.purpose === 'EGRESS' ? 'Final walk' : 'Walking access'
    return [{ type: 'WALK', instruction: `${purpose}: walk to ${passengerText(destination, 'your destination')} (${Number.isFinite(leg.distanceMeters) ? `${Math.round(leg.distanceMeters!)} m` : 'distance unknown'}).`,
      walkingInstructions, boardingInstructions: [] as string[], signboardAliases: [] as string[], signboard: '', fare: '', estimated: false, pickup: '', dropoff: '' }]
  })
}

export function routeResultState(loading: boolean, error: TripPlanClientError | null, searched: boolean, options: PamanaJourney[], response: TripPlanResponse | null = null) {
  if (loading) return { kind: 'loading', title: 'Finding the best routes…', description: 'Checking supported routes for your trip.' }
  if (error) return { kind: 'error', title: "We couldn't load route options right now.", description: 'Please try again.' }
  if (options.length) return { kind: 'results', title: 'Route options', description: 'Choose a route to see it on the map.' }
  if (searched && response?.status === 'NO_TRANSPORT_JOURNEY' && response.warnings.includes('NO_JOURNEY_DUE_TO_ACTIVE_DISRUPTION')) {
    return { kind: 'empty', title: 'An active disruption is affecting routes for this trip.', description: 'Try another pickup point or destination, or check again when the disruption clears.' }
  }
  if (searched) return { kind: 'empty', title: 'No supported route was found for this trip yet.', description: response?.meta?.planningMode === 'RESEARCH_PREVIEW' ? 'No connected research journey was established for these locations. Boarding or pedestrian access evidence may still be unavailable.' : 'Verified transport coverage is unavailable for these locations. Try another pickup point or destination.' }
  return { kind: 'idle', title: 'Where would you like to go?', description: 'Choose your pickup point and destination to see route options.' }
}
