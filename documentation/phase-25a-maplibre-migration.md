# Phase 25A — remaining MapLibre migrations

## Roadmap decision and scope

Path B is explicitly approved for the prototype. Phase 24.5 remains **OPEN**, with no genuine REAL Driver/Vehicle assignment, no accepted real trip/GPS/occupancy lifecycle, and a trusted HTTPS environment still needed for phone GPS. Its existing acceptance document is unchanged. Synthetic validation here does not satisfy Phase 24.5.

This phase changes frontend map presentation only. Phase 25B Leaflet removal and Phase 26 have not started. The unrelated local `nuxt.config.ts` edit is untouched and excluded from this commit. No authentication, permissions, API endpoints, polling cadence, transport truth, planner rules, fares, availability, ETA, disruption targeting, or AI behavior changes.

## Consumer inventory and migration evidence

| Consumer | Previous Leaflet behavior | MapLibre replacement and validation |
| --- | --- | --- |
| Driver `demand-map.vue` | 420px basemap, demand badge, two screen-positioned decorative circles, simulated demand list | Existing panel now explicitly uses MapLibre. Badge/circles/list and the existing simulated-data notice remain. Circles do not capture touches or become geographic transport features. Actual page render tested; corresponding preview scene visually checked. |
| LGU `index.vue` | 160px empty corridor overview basemap, no geographic demand layer | MapLibre compact presentation retains the measured 160px canvas and panel. No inferred demand geometry. Actual page render tested; preview basemap and controls visually checked. |
| LGU `live-mobility.vue` | 460px map of `/api/live-vehicles`, shared location, two existing filter controls and live-position badge | Same data props and authenticated GET endpoint; existing 15-second, visibility-aware, cancellable polling retained. Source updates retain ID, REAL/SIMULATED label, exact route/variant, occupancy, and recorded time. Filters remain above the map and clear the zoom controls at narrow widths. Actual page render/polling tested; preview markers, filters, resize, zoom/pan and refresh visually checked. Existing filters still have their existing single-option behavior; no new filtering business logic. |
| LGU `disruptions.vue` | 340px map using optional legacy point coordinates; structured record management outside the map | Same records and management form. Presentation adapter accepts only supplied valid Point/LineString/MultiLineString/Polygon/MultiPolygon geometry, or existing legacy coordinates when geometry is absent. No target-coordinate inference. Dedicated disruption source, selection/details and explicit fit supported. Actual page render/adapter tested; synthetic polygon and updates visually checked. Legacy point records are passed separately to the retained compatibility renderer. |
| Shared `PamanaMapPanel.vue` default | Default Leaflet, with named overlays visible only for Leaflet | Default MapLibre; named overlays are provider-neutral. Explicit Leaflet prop and error-state compatibility button retained. Compact height and reserved tool space are presentation props. Default/explicit renderer branches and overlays tested. |

Passenger trip planner and live map, Driver current-trip map, and Admin/LGU transport workbench already explicitly use MapLibre. Their existing tests and frontend regression suite pass. All development map previews use MapLibre by default; the new migration preview can explicitly exercise rollback.

Remaining runtime Leaflet dependencies are intentional rollback compatibility: `PamanaLeafletMap.vue`, its Leaflet CSS/imports, the shared panel's explicit/failure compatibility branch, `leaflet` in `package.json`, and its existing lockfile entry. The Leaflet component and lockfile are unchanged. There are no remaining default-Leaflet production pages, independent Leaflet plugins, or Leaflet composables. Leaflet remains installed and its runtime/CSS remains reachable until Phase 25B.

## Rendering, controls and camera

The existing MapLibre loader, Geoapify basemap configuration, CSS, semantic tokens, GeoJSON sources/layers and `setData()` architecture are reused. No second map/provider implementation.

Source initialization now checks that the stylesheet exists, rather than waiting for every source/tile to finish loading. Browser testing found that the old guard could suppress infrastructure/disruption sources after the general source started loading. A regression test exercises all three sources while `isStyleLoaded()` is false but the stylesheet is ready. This also protects existing Passenger and Driver transport-node rendering.

GPS, vehicle, occupancy and disruption refreshes do not recreate the map, call fit, or recenter. Initial fitting and explicit fit-token changes retain the existing camera policy. Automatic fitting continues to exclude vehicle/GPS polling positions. The explicit **Fit features** control can include vehicles and supplied disruption areas; **My location** alone explicitly recenters on shared location. Source refreshes preserve selected IDs and updated detail text. ResizeObserver and disposal/listener cleanup remain in place.

No key or invalid config still yields the existing readable `MISSING_CONFIG` state. Initialization/tile failures retain sanitized errors, retry, and explicit compatibility controls. Existing tests cover missing configuration, delayed imports, tile recovery, SSR safety, listener removal, map removal and observer cleanup.

## Browser smoke checks

Local Geoapify key configured; tested `/dev/map-migration-preview` with development-only offshore synthetic fixtures. No database/API writes or genuine GPS observations were generated. Production middleware and role permissions were not bypassed or weakened. Actual production pages were exercised by compiled SFC/SSR tests; these browser checks exercise their shared renderer, dimensions, data adapters and overlay layouts, not genuine operational sessions.

- Basemap loads after refresh; all four preview scenes reach READY.
- Zoom and keyboard pan work; explicit fit shows the simulated vehicle or disruption area.
- Pan followed by simulated vehicle/disruption refresh retains the map position and selection. Automated tests also verify no extra camera calls or map constructors.
- Compact dashboard map/canvas both measure 160px.
- Desktop and narrow phone-width resizing retain the map; filter menus open and can be dismissed by keyboard. Existing browser zoom means a requested 390px viewport yielded approximately 300 CSS pixels, providing an additional narrow-layout check.
- Vehicle selection displays SIMULATED, exact synthetic variant, UNKNOWN occupancy and recorded time. Synthetic disruption selection displays its status, source and warning; valid area geometry is visible.
- Leaflet rollback still renders, preserves filters, and can return to MapLibre.
- Final browser diagnostics: zero errors/warnings, no Geoapify authorization errors, no MapLibre errors, and no provider-key URLs printed in console.

Real phone GPS and REAL Driver operations remain NOT TESTED — ENVIRONMENT/OPERATIONAL BLOCKER in Phase 24.5. Browser permission was not requested by this migration.

## Tests, builds and integrity

- New Phase 25A tests: 7 passed (compiled page integration, default/rollback renderer and slots, metadata, actual LGU polling/cancellation, disruption geometry validation, concurrent source initialization/camera stability, lifecycle/selection/resize/disposal).
- Frontend regression: Phase 6–9, 15–17, 18B, 19–21, 23–25A: 93 tests passed. Phase 18A and trip-planner selection contract checks also pass.
- Backend regression: 26 existing test files passed, covering Phases 1–5B, 10–14, 16–24, planning eligibility, trip-search gate, time slots, presentation-only geometry boundary and pilot fixtures.
- Read-only pilot database regression passes: exact field coordinates, trust metadata, ordered stops, null verified transit geometry, direct/return/transfer planning and fare preservation.
- Frontend and backend production builds pass. Backend retains its existing nonfatal Windows XDG configuration-access warning.
- Whitespace, conflict and secret scans pass. No credentials/provider keys are stored in fixtures or documentation.

Database changes: **ZERO**. No seeds, migrations, operational writes, reports or disruptions were created. Trips/active trips/VehicleLocations remain 0/0/0. Planning-enabled routes/variants/coordinate-bearing eligible nodes remain **3/4/4**.

Pilot digest: `3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139`.

Backend remains `7c78fd58b4caaff618d9b51d7a2341ec0f7adfba`; no backend commit. Frontend Phase 25A commit is recorded in the completion report. This phase is committed locally; no push is performed by this task.

## Phase 25B readiness

Under the approved prototype Path B, the software prerequisite for Phase 25B is satisfied: all required production maps have validated MapLibre replacements and no production page defaults to Leaflet. A separate Phase 25B can remove the explicit compatibility component/branch, CSS and package/lockfile dependency, then run the full map regression and production build. Removal is not performed here.

This does not close Phase 24.5, establish real-device operational acceptance, or imply production readiness. Its external assignment/HTTPS/manual lifecycle blockers remain documented.
