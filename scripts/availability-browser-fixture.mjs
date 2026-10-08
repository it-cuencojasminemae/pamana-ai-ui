// Explicitly opt-in, localhost-only browser QA. All records live in memory;
// this script does not import Strapi, connect to Postgres, or use real accounts.
import http from 'node:http'
if (!process.argv.includes('--fixture-server')) throw Error('Pass --fixture-server for isolated browser QA.')
const user = { id: 1, username: 'ui.fixture', email: 'fixture@example.invalid', role: { name: 'Driver', type: 'driver' } }
let active = true
let availability = { status: 'UNKNOWN', reportedStatus: 'UNKNOWN', source: null, confidence: 'UNKNOWN', reportedAt: null, expiresAt: null, ageSeconds: null, stale: false, dataMode: 'REAL' }
const trip = () => ({ documentId: 'trip-ui-fixture', started_at: new Date().toISOString(), direction: 'outbound', data_mode: 'REAL', availability,
  route: { documentId: 'route-ui-fixture', route_code: 'UI FIXTURE', route_name: 'Synthetic browser test', origin: 'Fixture origin', destination: 'Fixture destination' },
  route_variant: { documentId: 'variant-ui-fixture', display_name: 'UI fixture — synthetic trip', direction: 'OUTBOUND', signboard_text: 'TEST ONLY', geometry_geojson: null, route_variant_stops: [] },
  vehicle: { documentId: 'vehicle-ui-fixture', vehicle_number: 'UI fixture', plate_number: 'TEST ONLY', capacity: 20, current_occupancy: 0, occupancy_level: null } })
http.createServer(async (request, response) => {
  const origin = request.headers.origin
  if (['http://localhost:3030', 'http://127.0.0.1:3030'].includes(origin)) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
  const chunks = []; for await (const chunk of request) chunks.push(chunk)
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
  const url = new URL(request.url, 'http://localhost:1437')
  let data
  if (url.pathname === '/api/auth/local') data = { jwt: 'ui-fixture-token-only', user }
  else if (url.pathname === '/api/users/me') data = user
  else if (url.pathname === '/api/driver-active-trip') data = { data: active ? trip() : null }
  else if (url.pathname === '/api/driver-trip-options') data = { data: { vehicle: null, routes: [], emptyReason: 'NO_ASSIGNED_VEHICLE' } }
  else if (url.pathname === '/api/driver-trips/trip-ui-fixture/availability' && request.method === 'PUT') {
    if (!['AVAILABLE', 'LIMITED', 'FULL', 'UNKNOWN'].includes(body?.data?.status)) { response.writeHead(400); response.end('{}'); return }
    const now = Date.now()
    availability = { status: body.data.status, reportedStatus: body.data.status, source: 'DRIVER', confidence: 'REPORTED', reportedAt: new Date(now).toISOString(), expiresAt: new Date(now + 900000).toISOString(), ageSeconds: 0, stale: false, dataMode: 'REAL' }
    await new Promise(resolve => setTimeout(resolve, 300))
    data = { data: availability }
  } else if (url.pathname === '/api/trips/trip-ui-fixture' && request.method === 'PUT') { active = false; data = { data: trip() } }
  else if (url.pathname === '/api/vehicle-locations') data = { data: {} }
  else if (url.pathname === '/api/auth/refresh') data = { jwt: 'ui-fixture-token-only' }
  else if (url.pathname === '/api/live-vehicles') data = { data: [] }
  else data = { data: [] }
  response.end(JSON.stringify(data))
}).listen(1437, '127.0.0.1', () => console.log('Isolated in-memory availability QA API on 127.0.0.1:1437'))
