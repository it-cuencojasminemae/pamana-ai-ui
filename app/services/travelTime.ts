import type { TravelTimeEstimate } from '../types/travelTime.ts'

export function validTravelTime(value: unknown, journeyId: string): value is TravelTimeEstimate {
  if (!value || typeof value !== 'object') return false
  const result = value as TravelTimeEstimate
  if (result.journeyId !== journeyId || !['COMPLETE', 'PARTIAL', 'UNAVAILABLE', 'DISABLED'].includes(result.status)) return false
  if (result.status === 'DISABLED' || result.status === 'UNAVAILABLE') return true
  const metric = (n: unknown) => n === null || typeof n === 'number' && Number.isFinite(n) && n >= 0
  if (![result.walkingSeconds, result.rideSeconds, result.movingSeconds].every(metric)
    || result.source !== 'GEOAPIFY_ROAD_PROXY' || !Array.isArray(result.exclusions)
    || !['WAITING', 'BOARDING', 'TRANSFER_DELAYS', 'LIVE_TRAFFIC'].every(item => result.exclusions!.includes(item))
    || typeof result.walkingComplete !== 'boolean' || typeof result.ridesComplete !== 'boolean'
    || !Number.isInteger(result.knownRideCount) || !Number.isInteger(result.rideCount)
    || result.knownRideCount! < 0 || result.rideCount! < result.knownRideCount!
    || !Number.isFinite(Date.parse(result.calculatedAt || '')) || !Number.isFinite(Date.parse(result.expiresAt || ''))
    || Date.parse(result.expiresAt!) <= Date.parse(result.calculatedAt!)) return false
  if (result.ridesComplete !== (result.knownRideCount === result.rideCount && result.rideCount! > 0)) return false
  if (result.status === 'COMPLETE') return result.walkingComplete && result.ridesComplete && result.movingSeconds !== null
    && result.walkingSeconds !== null && result.rideSeconds !== null
    && Math.abs(result.movingSeconds! - result.walkingSeconds! - result.rideSeconds!) < 0.01
  return result.movingSeconds === null
}

export const travelMinutes = (seconds: number | null | undefined) => typeof seconds === 'number' && Number.isFinite(seconds)
  ? `${Math.max(seconds > 0 ? 1 : 0, Math.round(seconds / 60))} min` : 'Unavailable'
