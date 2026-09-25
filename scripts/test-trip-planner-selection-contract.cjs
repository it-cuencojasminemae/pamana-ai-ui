'use strict';

/** Guards the selected deterministic journey -> MapLibre contract. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'pages', 'passenger', 'trip-planner.vue'), 'utf8');
const adapter = fs.readFileSync(path.join(__dirname, '..', 'app', 'services', 'tripPlanPresentation.ts'), 'utf8');
const map = fs.readFileSync(path.join(__dirname, '..', 'app', 'components', 'PamanaMapLibreMap.vue'), 'utf8');

assert.match(page, /tripPlan\.selectedJourney\.value/);
assert.match(page, /journeyMapPresentation\(tripPlan\.selectedJourney\.value/);
assert.match(page, /:nodes="mapPresentation\.nodes"/);
assert.match(page, /:lines="mapPresentation\.lines"/);
assert.match(page, /:fit-key="mapFitKey"/);
assert.match(page, /tripPlan\.selectedJourneyId\.value = \$event/);
assert.match(adapter, /if \(!journey\) return \{ nodes, lines: \[\] \}/);
assert.match(adapter, /leg\.geometry/);
assert.doesNotMatch(adapter, /routePoints|intermediateNodes\.map|connectStops/i);

const fitWatcher = map.match(/watch\(\(\) => props\.fitKey,[\s\S]*?\n\}\)/)?.[0] || '';
assert.match(fitWatcher, /fitOnIntent/);
assert.match(map, /watch\(features, \(\) => updateFeaturePresentation\(\)/);
assert.doesNotMatch(map.match(/watch\(features,[^\n]+/)?.[0] || '', /fitOnIntent|fitBounds|easeTo/);

console.log('ok - selected journey alone drives map nodes, lines, and explicit fit token');
console.log('ok - supplied leg geometry is rendered without connecting stop order');
console.log('ok - ordinary feature refreshes update the source without recentering');
