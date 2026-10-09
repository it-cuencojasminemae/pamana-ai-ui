import type { WeatherResponse } from '../types/weather.ts'

export function validCurrentWeather(value: unknown, now = Date.now()): value is WeatherResponse {
  const data = value as WeatherResponse | null
  return !!data && data.status === 'CURRENT' && data.source === 'OPEN_METEO' && data.evidenceClass === 'WEATHER_MODEL'
    && typeof data.asOf === 'string' && Number.isFinite(Date.parse(data.asOf))
    && now - Date.parse(data.asOf) <= 90 * 60_000 && Date.parse(data.asOf) - now <= 10 * 60_000
    && [data.temperatureC, data.precipitationMm, data.windKmh, data.humidityPercent, data.weatherCode]
      .every(value => typeof value === 'number' && Number.isFinite(value))
    && typeof data.isDay === 'boolean'
}

export function weatherCondition(code: number | null) {
  if (code === 0) return { label: 'Clear sky', icon: 'i-lucide-sun' }
  if (code !== null && code >= 1 && code <= 3) return { label: code === 3 ? 'Overcast' : 'Partly cloudy', icon: 'i-lucide-cloud-sun' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'i-lucide-cloud-fog' }
  if (code !== null && code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'i-lucide-cloud-drizzle' }
  if (code !== null && ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))) return { label: 'Rain', icon: 'i-lucide-cloud-rain' }
  if (code !== null && code >= 95) return { label: 'Thunderstorms', icon: 'i-lucide-cloud-lightning' }
  if (code !== null && code >= 71 && code <= 86) return { label: 'Snow', icon: 'i-lucide-cloud-snow' }
  return { label: 'Weather conditions', icon: 'i-lucide-cloud' }
}
