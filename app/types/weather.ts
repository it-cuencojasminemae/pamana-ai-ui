export type WeatherPoint = { lat: number; lng: number; label?: string }
export type WeatherResponse = {
  status: 'CURRENT' | 'UNAVAILABLE'
  source: 'OPEN_METEO'
  evidenceClass: 'WEATHER_MODEL'
  asOf: string | null
  fetchedAt: string
  temperatureC: number | null
  precipitationMm: number | null
  windKmh: number | null
  humidityPercent: number | null
  weatherCode: number | null
  isDay: boolean | null
}
