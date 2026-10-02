import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { disruptionLayers, createDisruptionMapPresentation, DISRUPTION_SOURCE_ID } from '../app/services/disruptionMapPresentation.ts'
import { journeyMapPresentation } from '../app/services/tripPlanPresentation.ts'

const read = path => fs.readFileSync(path, 'utf8')

const unavailable = {
  fare: { status: 'UNKNOWN', currency: null, regularFare: null, discountedFare: null, payableFare: null, discountType: null, sourceSummary: null, verificationStatus: null, warnings: [] },
  service: { status: 'UNKNOWN', operatingMode: null, serviceStart: null, serviceEnd: null, headwayMinutes: null, scheduledDepartures: [], leaveWhenFull: null, limitedService: null, windowStatus: 'UNKNOWN', sourceSummary: null, verificationStatus: null, warnings: [] },
  availability: { status: 'UNKNOWN', wait: { status: 'UNKNOWN', lowMinutes: null, highMinutes: null }, activeVehicleCount: null, boardableVehicleCount: null, sourceSummary: null, warnings: [] },
}

function journey(warnings) {
  return {
    id: 'phase18b', transferCount: 0, modes: ['JEEPNEY'], warnings,
    fareSummary: { totalStatus: 'UNKNOWN', knownSubtotal: null, totalFare: null, currency: null, warnings: [] },
    availabilitySummary: { status: 'UNKNOWN', transitLegsKnown: 0, transitLegsUnknown: 1, warnings: [] },
    durationSummary: { status: 'UNKNOWN', knownWalkingDurationSeconds: null, totalJourneyDurationSeconds: null },
    dataQuality: { planningEligible: true, verificationStatuses: ['FIELD_VERIFIED'], dataModes: ['REAL'] },
    legs: [{ sequence: 1, type: 'TRANSIT', transportMode: 'JEEPNEY', route: { id: 'r', code: 'R' }, variant: { id: 'v', code: 'V' }, direction: 'OUTBOUND', operatingStatus: 'ACTIVE', boardAt: null, alightAt: null, intermediateNodes: [], signboard: null, segmentDistanceMeters: null, durationSeconds: null, geometry: null, ...unavailable }],
  }
}

test('verified disruption geometry becomes a dedicated semantic map feature', () => {
  const warning = { code: 'DISRUPTION_WARNING', type: 'DISRUPTION', effect: 'WARNING_ONLY', disruptionId: 'd1', message: 'Flood advisory', severity: 'high', startsAt: '2026-09-27T00:00:00.000Z', endsAt: null, geometry: { type: 'Polygon', coordinates: [[[120.7, 15.1], [120.71, 15.1], [120.71, 15.11], [120.7, 15.1]]] } }
  const map = journeyMapPresentation(journey([warning, warning]), null, null)
  assert.equal(map.disruptions.length, 1)
  assert.equal(map.disruptions[0].properties.semantic, 'disruption')
  assert.equal(map.disruptions[0].properties.source, 'PAMANA_TRANSPORT_DB')
  assert.equal(map.disruptions[0].geometry.type, 'Polygon')
  assert.equal(journeyMapPresentation(journey([{ ...warning, geometry: null }]), null, null).disruptions.length, 0)
})

test('disruption overlay updates GeoJSON without moving the camera', () => {
  let sourceData = null
  const sources = new Map()
  const layers = new Set()
  const calls = []
  const map = {
    getSource: id => sources.get(id),
    isStyleLoaded: () => true, getStyle: () => ({ version: 8 }),
    addSource(id, config) {
      sourceData = config.data
      sources.set(id, { setData(data) { sourceData = data } })
    },
    getLayer: id => layers.has(id) ? {} : null,
    addLayer(layer) { layers.add(layer.id) },
    fitBounds() { calls.push('fitBounds') },
    easeTo() { calls.push('easeTo') },
    jumpTo() { calls.push('jumpTo') },
  }
  const presentation = createDisruptionMapPresentation(map)
  presentation.update([])
  presentation.update([{ type: 'Feature', id: 'd1', geometry: { type: 'Point', coordinates: [120.7, 15.1] }, properties: { semantic: 'disruption', label: 'Advisory', source: 'PAMANA_TRANSPORT_DB' } }])
  assert.equal(sourceData.features.length, 1)
  assert.ok(sources.has(DISRUPTION_SOURCE_ID))
  assert.deepEqual(calls, [])
  assert.equal(disruptionLayers().length, 4)
})

test('passenger UI keeps existing design and renders warnings and disruption no-journey copy', () => {
  const card = read('app/components/journey/PamanaJourneyCard.vue')
  const planner = read('app/pages/passenger/trip-planner.vue')
  const panel = read('app/components/PamanaMapPanel.vue')
  const libre = read('app/components/PamanaMapLibreMap.vue')
  assert.match(card, /Active journey disruptions/)
  assert.match(card, /LIMITED_SERVICE/)
  assert.match(planner, /NO_JOURNEY_DUE_TO_ACTIVE_DISRUPTION/)
  assert.match(planner, /:disruptions="mapPresentation\.disruptions"/)
  assert.match(panel, /<PamanaLeafletMap/)
  assert.match(panel, /:disruptions="disruptions"/)
  assert.match(libre, /Disruption polling updates only its GeoJSON source and never changes the camera/)
  assert.doesNotMatch(read('app/services/disruptionMapPresentation.ts'), /fitBounds|easeTo|jumpTo/)
})

test('Phase 18B adds no report workflow, AI, routing or transport truth writes', () => {
  const changed = [
    'app/services/disruptionMapPresentation.ts',
    'app/services/tripPlanPresentation.ts',
    'app/components/journey/PamanaJourneyCard.vue',
    'app/pages/passenger/trip-planner.vue',
  ].map(read).join('\n')
  assert.doesNotMatch(changed, /PassengerReport|Geoapify.*Routing|routeWalk|api::transport-node|\$fetch\([^)]*strapi/i)
})
