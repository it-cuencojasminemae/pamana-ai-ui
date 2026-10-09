import { createWeatherProvider, weatherPoint } from '../utils/weatherProvider'

const provider = createWeatherProvider()
export default defineEventHandler(async event => {
  const query = getQuery(event)
  const point = weatherPoint(query.lat, query.lng)
  if (!point) throw createError({ statusCode: 400, statusMessage: 'Choose a location in Pampanga.' })
  setHeader(event, 'Cache-Control', 'no-store')
  return provider.get(point)
})
