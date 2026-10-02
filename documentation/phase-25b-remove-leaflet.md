# Phase 25B — remove legacy Leaflet mapping

Date: 2026-10-02 (Asia/Manila). Branch: `feature/pamana-mexico-revision`.

**Result: software cleanup and regression validation passed. Phase 24.5 remains OPEN. Phase 26 has not started.**

MapLibre GL JS with Geoapify is now PAMANA's sole supported production mapping stack. Leaflet has been removed after all required production consumers were migrated and validated.

## Audit and removal

The audit covered both repositories' tracked source, scripts, dependencies/lockfile, configuration, documentation and development previews. Searches included case-insensitive Leaflet, `PamanaLeafletMap`, CSS imports, renderer/provider switches and `L.map`, `L.marker`, `L.polyline`, `L.tileLayer`, `L.layerGroup`, `L.latLng`. SQL aliases and ordinary identifiers were inspected rather than mistaken for mapping APIs.

| Before removal | Classification | Resolution |
| --- | --- | --- |
| `app/components/PamanaLeafletMap.vue`, its dynamic package import and CSS | A: executable rollback renderer | Deleted the component; its exclusive CSS and APIs disappear with it. |
| Shared `PamanaMapPanel.vue` optional renderer branch/error button | A: executable rollback path | Removed the branch, fallback state and button. Always renders MapLibre. |
| `leaflet` manifest and lockfile entry | A: runtime dependency | Removed version 1.9.4 using an offline uninstall. Lockfile comparison confirms no other package changes. |
| `compatibilityMarkers` on LGU Disruptions | A: obsolete caller contract | Removed; the dedicated provider-neutral disruption prop is retained. |
| Map migration preview checkbox/provider toggle | B: development compatibility | Removed. All existing synthetic scenes remain; added local workbench map-contract fixtures only. |
| Phase 6/7/8/9/15/16/17/18B/23/25A test assumptions | B: test compatibility | Replaced obsolete preservation checks with MapLibre compilation/rendering/lifecycle checks. Useful contracts remain. |
| Earlier phase documents, including Phase 24.5 and Phase 25A | C: historical records | Preserved. Those statements describe their checkpoints; this document supersedes their stack inventories. |
| Backend `PAMANA_CLAUDE_CODE_CONTEXT.md` original Leaflet design and earlier phase reports | C: historical architecture/reports | Preserved; no backend executable Leaflet dependency exists. |

No separate Leaflet plugin, composable, or direct Leaflet type package was installed. MapLibre GL JS remains 6.11.1 and GeoJSON types remain installed. `.env.example` now describes the active mapping configuration; its unused legacy Carto config field is retained because this cleanup does not alter the protected Nuxt config. README and the setup document identify the current stack. No real environment key was edited or committed.

## Production consumers

Source inspection and Vue compilation verify explicit MapLibre usage for each consumer below. Shared-panel tests also execute both the explicit setting and its default, with named overlays, ordinary slots and marker metadata.

| Consumer | Preserved contract |
| --- | --- |
| Passenger Trip Planner | Selected factual journey, geographic endpoints, WALK geometry, transit geometry only when supplied, selection fit token. |
| Passenger Live Map | Transport nodes, geographic selection, shared GPS and live vehicles. |
| Driver Current Trip | Exact assigned Trip/RouteVariant, position and trip-ID camera intent. No Driver operational changes. |
| Driver Demand Map | 420px map, existing demand decorations and SIMULATED label. |
| LGU Dashboard | Compact 160px overview and existing command-center UI. |
| LGU Live Mobility | 460px map, filters, tool clearance, occupancy/freshness/variant metadata; unchanged 15-second visibility-aware polling and cancellation. |
| LGU Disruptions | 340px map, supplied Point/LineString/area overlays, feature details and explicit trust/target metadata. |
| Admin/LGU transport workbench | 280px candidate coordinate and supplied geometry previews; existing role gates and human confirmations. |

`PamanaMapPanel` preserves still-needed public props and event forwarding (`feature-selected`, `map-ready`, `map-error`). Its optional provider prop is retained as MapLibre-only to avoid changing valid callers. Plain-data legacy marker adaptation remains useful to migrated pages; it has no dependency on Leaflet. Existing unused route presentation props remain compatible, but stop coordinates never synthesize a transit line.

## Map behavior and evidence boundaries

The MapLibre implementation changes only the initialization-error copy that formerly suggested compatibility mode. Loader, sources, layers, `setData()`, reactive updates, resize observer, listeners and disposal remain intact. Missing configuration and tile/initialization failures remain readable states; errors never activate another renderer or log raw provider URLs.

Compiled lifecycle tests independently update vehicles, GPS, transport nodes, disruptions, generic demand features and occupancy: one map instance, one initial fit, no additional fit or recenter. Explicit Fit features and My Location still move the camera. Actual source/layer tests verify repeated `setData()` updates reuse layers, including when another source is still loading.

Walking remains dashed, approximate road paths use their separate solid presentation layer, and supplied verified transit geometry remains authoritative. `APPROXIMATE_ROAD_PATH` never becomes RouteVariant geometry, planner input, ETA input, disruption targeting or evidence. The existing approximate-path tests cover cached endpoint pairs, unchanged factual journeys, provider failure with no fake straight line, and line-style separation. No routing or geography service was modified.

Geoapify retains basemap/style, geocoding/place search, walking connectors and existing presentation-only road routing. PAMANA retains transport truth. No new map or planning functionality was introduced.

## Validation

- Frontend: **98/98 tests passed** across Phases 6–9, 15–17, 18B, 19–21, 23–25B and approximate-road-path coverage. Five new Phase 25B tests audit executable source/packages, compile every required consumer and execute the actual workbench setup with mocked persistence. Phase 25A lifecycle coverage now checks all six background updates independently.
- Frontend selection/map contract and Phase 18A script checks passed separately.
- Missing-key production SSR smoke passed login, registration and protected map-page responses. Development map preview returns 404 in production. This is SSR evidence, not authenticated operational acceptance.
- Backend: **26/26 test files passed**, including prior phase suites, planning eligibility/gate, deterministic journey/availability/disruption/Driver/security coverage, time slots and presentation-path boundaries. Read-only live pilot integrity test passed separately.
- Frontend and backend production builds passed. Existing large MapLibre chunk/export-deprecation warnings and the backend's nonfatal Windows XDG config warning remain; no dependency upgrade was attempted.
- Production source, `.output` and generated distribution scans found **zero Leaflet renderer/CSS references**. Manifest, lockfile and installed tree contain no Leaflet. No bundle-size saving is claimed.
- Whitespace/conflict and secret scans passed; no committed source/test/log contains a real key, and no server secrets appear in browser output assets. Public Geoapify browser configuration retains its existing contract.

### Browser checks

The local in-app browser used real Geoapify styles/tiles with the existing key, and clearly labeled local synthetic overlays. No provider response was saved to the database. Browser smoke uses the existing development previews allowed by the specification where genuine operational data is unavailable; it does not claim authenticated REAL page acceptance.

| Development preview | Manual evidence |
| --- | --- |
| `/dev/trip-planner-preview` | READY; geographic origin/destination, pickup/drop-off, walking/transit overlays; direct/transfer journey selection, zoom/pan, explicit fit and width changes. Missing transit geometry stays undrawn. |
| `/dev/map-preview` | READY; all synthetic transport categories and vehicle; manually pan/zoom, refresh vehicle twice and update synthetic GPS twice with settled camera unchanged; explicit My Location and mobile resizing. |
| `/dev/live-vehicle-preview` | READY; advance clock and change occupancy to FULL without recenter; explicit My Location, narrow layout and running simulated clock; freshness/occupancy labels retained. |
| `/dev/map-migration-preview` — Driver Demand, Dashboard, Live Mobility, Disruptions | READY for each; live Geoapify basemap, compact/dashboard dimensions, demand decoration, live vehicle/filter overlay, supplied disruption area and selectable details; zoom/pan, refresh and narrow resizing. Map reload reaches READY. |
| Same preview — Workbench node/geometry | READY; selectable synthetic coordinate marker and supplied line at 280px, zoom/pan/refresh. Actual workbench SFC setup is separately executed in tests: candidate changes never save or confirm, geometry stays empty until supplied, LGU cannot elevate trust. |

Browser diagnostics across the four preview pages: **0 console errors**, no Leaflet runtime references, no Geoapify authorization errors, and no key logging. Normal development information messages are not map errors. Temporary browser viewport overrides were reset. Offshore fixture maps can show quiet ocean tiles; these test coordinates are never research transport facts.

## Database and protected local state

Persistent database changes: **ZERO**. No seed, migration, transport write, trip, GPS or occupancy observation was created. Read-only before/after audits matched completely, including operational counts. Live pilot integrity confirms exact field-verified coordinates, ordered stops, fares, trust metadata and null transit geometry.

- Pilot digest: `3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139`.
- Planning-enabled routes: **3**; RouteVariants: **4**; coordinate-bearing eligible TransportNodes: **4**.
- Backend unchanged at `7c78fd58b4caaff618d9b51d7a2341ec0f7adfba`; backend working tree clean. No backend commit.
- Unrelated `nuxt.config.ts` edit unchanged and excluded from staging/commit. SHA256: `20DCCC32408726EBA10100EEB1F4ECF169BC33F2F0CD330EC3FDAC38A71E5D44`.
- Phase 24.5 document unchanged. SHA256: `DEE2DC1EDF9BEE18A3B579658ECD55EE695DC7C3EA79182B8D474363C85B441F`.

## Completion report and limits

| Requested item | Result |
| --- | --- |
| 1. Final Leaflet audit | No executable production dependency remains; A/B/C inventory above. |
| 2. Production consumers | All eight required consumers verified against source and compilation. |
| 3. Renderer removal | `PamanaLeafletMap.vue` deleted. |
| 4. CSS removal | Exclusive renderer CSS/import deleted; shared PAMANA and MapLibre styling preserved. |
| 5. Packages | Leaflet 1.9.4 removed; no separate type/plugin package; no other lockfile changes. |
| 6. Other obsolete code | Panel fallback/state/button, Disruptions compatibility prop and dev toggle removed. |
| 7. Panel | Always MapLibre; useful props, events and both slot kinds preserved. |
| 8–11. Passenger/Driver/LGU/workbench | Compiled component tests plus synthetic browser matrix above. No real operational lifecycle claim. |
| 12. Camera | All six background updates stable; explicit camera actions retained. |
| 13. Approximate road paths | Presentation-only classification, styles, cache and failure isolation unchanged and tested. |
| 14. Geoapify | Existing service/composable/configuration unchanged. |
| 15. Tests updated | Ten earlier phase scripts updated; five cleanup tests added; six update types exercised. |
| 16. Tests/builds | 98 frontend tests, two frontend scripts, production SSR smoke, 26 backend files, live read-only pilot test; both builds passed. |
| 17. Browser smoke | All synthetic scene checks passed; no console/provider authorization errors or key logging observed. |
| 18. Remaining references | Historical docs and absence/regression assertions only. No executable frontend Leaflet reference. |
| 19. Bundle/dependencies | No Leaflet in production output, manifest, lockfile or installed tree. |
| 20. Database changes | Zero; read-only before/after state equal. |
| 21. Planning counts | Routes 3 / variants 4 / eligible coordinate-bearing nodes 4. |
| 22. Pilot digest | Exact digest above, unchanged. |
| 23. Phase 24.5 | OPEN — external operational prototype limitation, never passed by synthetic tests. |
| 24. Frontend commit | `refactor: remove legacy Leaflet mapping`; resulting hash reported after commit. |
| 25. Backend commit | None; checkpoint unchanged. |
| 26. Push | Not pushed; prior explicit approval covered Phase 25A only. Separate approval needed for this commit. |
| 27. Phase 26 readiness | Mapping software prerequisite satisfied under approved Path B. Not started; Phase 24.5 still requires legitimate assignments and trusted HTTPS real-device GPS/lifecycle acceptance. |

MapLibre requires browser WebGL and valid provider configuration/network access. Failure shows the existing readable unavailable state; there is now no legacy renderer fallback. Human workbench review and verification remain required. Removing Leaflet does not fabricate transport geometry or establish operational acceptance.
