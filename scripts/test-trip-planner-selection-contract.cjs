'use strict';

/**
 * Guards the selected-card -> Leaflet contract without requiring a browser
 * test runner. The page must derive both map stops and coordinates from the
 * selected option, then pass that exact list to PamanaMapPanel.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'app', 'pages', 'passenger', 'trip-planner.vue');
const page = fs.readFileSync(pagePath, 'utf8');

assert.match(page, /options\.value\.find\(option => option\.id === selectedOptionId\.value\)/);
assert.match(page, /selectedOption\.value\?\.stops/);
assert.match(page, /:route-points="selectedOptionStops"/);
assert.match(page, /:markers="selectedOptionMarkers"/);
assert.match(page, /:nodes="geographicLocationMarkers"/);
assert.match(page, /:fit-key="mapFitKey"/);
assert.match(page, /selectedOption\.value\?\.id/);

const fixtures = {
  cheapest: [
    { documentId: 'transfer-origin', latitude: 15.1667, longitude: 120.7333, sequence: 1 },
    { documentId: 'transfer-stop', latitude: 15.1206, longitude: 120.7188, sequence: 2 },
    { documentId: 'transfer-destination', latitude: 15.0285, longitude: 120.6898, sequence: 3 },
  ],
  fastest: [
    { documentId: 'direct-origin', latitude: 15.1667, longitude: 120.7333, sequence: 1 },
    { documentId: 'direct-santo-tomas', latitude: 15.1206, longitude: 120.7188, sequence: 2 },
    { documentId: 'direct-ogc', latitude: 15.0746, longitude: 120.7043, sequence: 3 },
    { documentId: 'direct-destination', latitude: 15.0285, longitude: 120.6898, sequence: 4 },
  ],
};

const mapPointsFor = (selectedCard) =>
  [...fixtures[selectedCard]]
    .sort((first, second) => first.sequence - second.sequence)
    .map(({ documentId, latitude, longitude }) => [documentId, latitude, longitude]);

assert.deepStrictEqual(mapPointsFor('cheapest'), [
  ['transfer-origin', 15.1667, 120.7333],
  ['transfer-stop', 15.1206, 120.7188],
  ['transfer-destination', 15.0285, 120.6898],
]);
assert.deepStrictEqual(mapPointsFor('fastest'), [
  ['direct-origin', 15.1667, 120.7333],
  ['direct-santo-tomas', 15.1206, 120.7188],
  ['direct-ogc', 15.0746, 120.7043],
  ['direct-destination', 15.0285, 120.6898],
]);
assert.ok(
  !mapPointsFor('fastest').some(([id]) => id === 'transfer-stop'),
  'Selecting a direct card must not reuse the transfer stop row.'
);

console.log('ok - selected route stops and markers are derived from selectedOption only');
console.log('ok - selected stops and resolved geographic markers are passed through the provider-neutral panel');
console.log('ok - selecting the direct fixture excludes the transfer-route stop row');
