# Phase 7 — MapLibre passenger presentation

## Scope and integration

`PamanaMapLibreMap.vue` is a browser-only, presentation-focused renderer. It reuses Phase 6's `useMapLibre`, runtime configuration and GeoJSON types. No autocomplete, geocoding, POI search, routing request, journey engine, transport seeding, schema migration or planning activation is added.

`PamanaMapPanel` accepts `provider="maplibre"`; its default remains `leaflet` for unmigrated consumers. Passenger trip-planner and live-map pages opt into MapLibre. Driver/LGU consumers, Leaflet package/CSS and `PamanaLeafletMap.vue` remain unchanged. Missing/error states expose an explicit compatibility-map button; there is no silent provider switch. Revert a page's provider prop for a simple rollback.

The panel adapts existing plain marker props without changing search behavior. It deliberately does **not** turn `routePoints` into lines. Only `routeGeometry` supplied by the caller is adapted to a LineString. Unknown research coordinates stay absent, never coerced from null to zero or replaced by mall centroids. Phase 5B records remain unchanged.

## Component API

Inputs: optional `[longitude, latitude]` center, zoom, height, userLocation `{lat,lng}`, `nodes`/`vehicles` arrays of `MapPointFeature`, `lines` array of `MapLineFeature`, selectedFeatureId, fitToFeatures, and fitKey. Stable feature IDs are recommended for selection. Outputs: `feature-selected` (ID), `map-ready` and sanitized `map-error` (state). No raw MapLibre instance or provider error/URL is emitted. These events are forwarded by the panel.

`mapPresentation.ts` owns coordinate guards, backend/legacy marker-type mapping and shared semantic tokens. `mapLibrePresentation.ts` translates GeoJSON into one source and six WebGL layers: route halo, solid route, dashed walking line, selection halo, node circles and semantic icons. Icons are locally drawn raster images; they do not require remote glyph fonts. Node/vehicle sets do not create hundreds of DOM marker components. Feature selection works by canvas click or an accessible HTML selector. Labels and icons supplement color.

The component consumes user location only. The existing `useGeolocation` remains shared through the panel; the new renderer never requests browser geolocation permission itself. Late GPS fixes and vehicle polling update the source but do not move the camera.

## Style, CSS and lifecycle

The style URL is resolved by Phase 6 configuration from `geoapifyApiKey` and the optional `geoapifyMapStyle` identifier. Blank style retains the documented Phase 6 default; a quieter supported style such as `positron` can be selected locally. The URL format follows [Geoapify's official map style documentation](https://apidocs.geoapify.com/docs/maps/). Attribution is retained.

MapLibre CSS is imported once by the shared loader, never duplicated in the component. MapLibre 6 needs its explicit Vite worker URL: `maplibre-gl-worker.mjs?worker&url`, passed to `setWorkerUrl` before construction. This bundles the worker's shared dependency and avoids both development optimizer-relative worker 404s and missing production sibling imports. See [MapLibre's Vite installation guidance](https://maplibre.org/maplibre-gl-js/docs/#esm).

Initialization is onMounted only, after config and loader checks. Load/style-load attach or restore presentation layers. Prop changes call setData and selection styling rather than recreating the map. A ResizeObserver calls resize without refitting. Unmount removes event listeners, disconnects the observer, clears the timeout, removes the map and ignores late imports. The shared composable disposes loader state.

States: INITIALIZING, READY, MISSING_CONFIG, TILE_ERROR, INITIALIZATION_ERROR. A ready map with no supplied transport features shows a textual empty state while leaving the basemap usable. Missing/invalid keys, import/WebGL failures and tile errors show readable messages and retry/compatibility options. Raw errors and key-bearing provider URLs are not logged by this implementation.

## Camera and responsive/accessibility behavior

- Initial load fits supplied transport features once. With no features, initial user location takes precedence; otherwise a configurable regional viewport is used for presentation only.
- Explicit journey selection changes fitKey and fits once. Marker selection highlights only.
- GPS/vehicle polling and style reload do not refit. “My location” explicitly recenters; “Fit features” explicitly fits supplied transport features, excluding moving users/vehicles.
- Map fills the supplied height/container, uses compact corner controls and mobile-sized hit targets. Cooperative gestures avoid trapping page scrolling. Feature picker, controls, canvas and states have accessible labels; selected features show text/type/verification or simulation information.

## Validation and local preview

`npm run test:phase-7` covers input filtering, type mapping, supplied lines, style/source reuse, camera intent, SFC compilation and actual compiled component lifecycle with mocks (SSR, missing config, initialization failures, late load, errors, unmount cleanup). No new test framework or dependency is installed. Phase 6's regression now allows the panel to evolve while still asserting the Leaflet renderer is byte-for-byte unchanged.

The development-only `/dev/map-preview` route provides manual controls for synthetic offshore markers/line, simulated GPS, mobile container width and unmount/remount. Fixtures are local UI data, never database records or San Juan geometry. The route returns 404 in production. Do not use screenshots containing provider keys or developer network URLs as committed fixtures.

Live validation on 2026-09-24: the locally configured `positron` style, source metadata and a regional vector tile all returned HTTP 200. The browser visibly rendered the regional basemap, synthetic marker icons and dashed LineString. Selection, zoom, explicit location recenter, GPS updates, mobile container resizing and unmount/remount were exercised. Synthetic offshore fixtures remain development-only. No provider authorization or MapLibre initialization errors appeared during the successful localhost session. An earlier 127.0.0.1 session failed to import Nuxt's client entry before hydration; the subsequent localhost session loaded correctly.

The final fix retains the explicit Vite-bundled MapLibre 6 worker in the shared loader. Initialization now times out even if the module import stalls, and ignores its late completion. After a map has rendered, transient tile errors show a compact notice while keeping the canvas usable; a successful idle state clears the notice without refitting. Mobile controls/legend reserve room for wrapped attribution. Lifecycle regressions exercise timeout and tile recovery. The SSR smoke runner now selects a real free port because Nitro interprets port `0` as the default 3000.

Validation passed: frontend Phase 6/7 tests and selection contract; backend Phase 1–5B, planning eligibility, trip-search planning gate and time-slot suites; frontend and backend production builds; missing-key production SSR smoke (including production 404 for this preview); read-only transport-record integrity check. Build output includes dependency deprecation/chunk-size warnings but no build failure. No schema, seed, migration, planning record, geocoding UI, or journey-engine changes were made.

Database validation uses `test:phase-6-db` read-only; prior seeding/backfill scripts must not be run for this phase. Initial transport-row digest: `77776e1a08d971a39b2718a10a116c7748e452900f26931dfbc90acd0377fdae`. Routes 7, transport nodes 10, variants 2; variant stops, fares and service patterns 0; planning-enabled count 0.
