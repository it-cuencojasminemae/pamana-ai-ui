# Phase 26 — hackathon demo preparation

Preparation: 2026-10-02. Authenticated rehearsal: 2026-10-04. Branch: `feature/pamana-mexico-revision`.

## Status and scope

**Phase 26 PASS — authenticated rehearsal accepted on 2026-10-04.** Passenger, LGU and Administrator used existing accounts and manual user login. Passenger baseline journeys, live Gemini guides, reports preview, and demo-ON Passenger/LGU mobility were inspected through the normal UI. Administrator inspected all six workbench sections without saves. Production builds, demo-OFF restoration and integrity checks passed. Live report submission was conditionally skipped because no safe disposable-report cleanup exists; mocked submission/ownership/isolation passed.

Phase 24.5 remains **OPEN — external operational prototype limitation**. There is no genuine REAL Driver/Vehicle assignment accepted for the pilot; the REAL trip/GPS/occupancy lifecycle is not manually accepted, and phone GPS requires trusted HTTPS. The existing Phase 24.5 report is unchanged. Simulation does not satisfy those checks. Phase 27 has not started; nothing is deployed.

The objective is a repeatable demonstration of rural mobility information access using the Mexico–San Fernando pilot. PAMANA's existing pages and visual design remain the presentation. No new journey architecture, geographic presets, provider client, schema, credentials or transport records were added.

## Presenter sequence and accounts

Use existing accounts through normal login. Never embed or share passwords in this document, source code, screenshots or slides.

| Approximate time | Role | Action |
| --- | --- | --- |
| 0:00–2:00 | Passenger | Dashboard → Trip Planner; search origin near PSU Mexico and destination SM City Pampanga; choose resolved suggestions; Plan Journey; inspect direct and transfer options and map. |
| 2:00–2:45 | Passenger | Select direct journey; Explain this trip; keep factual cards visible even if AI is unavailable. Open Report an issue with this journey and My Reports. |
| 2:45–3:30 | Passenger | Search Robinsons Starmills → PSU Mexico; inspect the distinct inbound service and SAN JUAN signboard. |
| 3:30–4:30 | Passenger/LGU | Live Map / Live Mobility; show explicitly gated SIMULATED DEMO vehicles, occupancy samples and stable camera. |
| 4:30–5:30 | LGU | Dashboard → Live Mobility → Disruptions → Transport Data; inspect targets and evidence without saving an invented official disruption. Show the safe in-memory disruption rehearsal result. |
| 5:30–6:30 | Administrator | Transport Data workbench; inspect nodes, directional variants, ordered stops, fares, service fields and verification metadata. Do not save mutations. |
| 6:30–7:00 | Presenter/Driver | Explain the Driver UI and Phase 24.5 assignment/HTTPS limitation honestly. |

This is a suggested 5–8 minute sequence, not an official hackathon time limit. Prepare authenticated role sessions before presenting; the normal sidebar provides page navigation. Changing roles must use normal logout/login. Read-only LGU/Admin demonstration is sufficient.

## Transport scenarios and expected facts

Use geographic searches for passenger inputs. A Geoapify mall/campus POI is not a verified transport boarding/drop-off node. Inspect the normal API result; access/egress walking depends on the selected geographic result. Do not type unresolved free text and treat it as a destination. No coordinates are duplicated in Vue.

| Scenario | Data and expected result |
| --- | --- |
| Direct | PSU Mexico frontage → verified SM Pampanga Main Gate drop-off; explicit outbound variant. REGULAR fare PHP 30 is KNOWN. |
| Transfer | PSU → Mexico Bayan / Sta. Monica → SM; first leg tricycle, then the modeled SM-bound Arayat jeepney segment. REGULAR total is PARTIAL; known subtotal PHP 14, first-leg fare unknown. PHP 14 is not the total. |
| Return | Robinsons Starmills Arayat Gate → PSU Mexico; explicit INBOUND variant with SAN JUAN signboard. Do not reverse outbound, board a Magalang service or claim a known return fare. |

Pilot truth comes from existing PAMANA records. Computed schedule, headway, exact wait, vehicle ETA and total travel duration remain unavailable. Do not derive a student discount from evidence of approximate or exact student payments; current schema limitations remain. Existing service notes are evidence, not an exact timetable. Inspect the actual current response rather than promising every search will resolve to the same campus or mall entrance.

## Read-only deterministic rehearsal

From `pamana-backend`, use:

```powershell
npm run demo:check
npm run demo:rehearse
```

The checker performs local HTTP health/page requests, one bounded PostgreSQL connection, read-only queries and configuration-presence checks. It prints statuses, counts and the pilot digest, never credentials or account identities. It does **not** call a paid provider. `CORE_READY` confirms local core prerequisites only. `simulationReady` requires both flags; `fullDemoConfigurationReady` adds geography and selected AI configuration. Neither proves provider authorization, model availability, quota or browser acceptance.

The rehearsal reads actual eligible pilot endpoint coordinates, directional variants, ordered stops and fares. It invokes the existing deterministic orchestration internally. It starts exactly at transport endpoints, so no nonzero walking geometry or provider response is invented. This validates transport facts and reset behavior, **not** an authenticated HTTP journey or live Geoapify walking request. Any nonzero walking attempt fails safely in this rehearsal. All queries run in a read-only transaction that is rolled back.

The rehearsal applies a **SIMULATED REHEARSAL, in-memory normalized `VARIANT_SUSPENDED` effect** to the direct outbound variant. The transfer alternative remains, unrelated inbound is unchanged, and a new request without the effect restores the baseline. It never inserts a Disruption, marks a fixture FIELD_VERIFIED, or enables a simulated record in the production planner. The normal REAL disruption loader and gates remain unchanged. Present its CLI output as an engine fixture demonstration, not a currently active LGU incident. Re-running requires no database restoration.

The same rehearsal checks simulated occupancy/reset and a mocked AI failure. Mocked provider failure is not a live AI success test.

## Live mobility and occupancy

Opt in locally using both existing flags, then restart the corresponding development processes:

```ini
# backend .env, local presentation session only
PAMANA_DEMO_MODE_ENABLED=true
# frontend .env, local presentation session only
NUXT_PUBLIC_PAMANA_DEMO_MODE_ENABLED=true
```

Current local check: both flags DISABLED. Phase 26 does not enable them automatically. Keep production defaults disabled; restore local values and restart after the presentation.

Passenger Live Map and LGU Live Mobility share the existing authenticated Phase 16 `/api/pamana-demo/live-vehicles` GET feed through one composable. The server still enforces its own flag, role permission and rate limit. New small controls appear only with the frontend flag and visibly say **SIMULATED DEMO · NOT REAL TRANSPORT DATA**. Offshore synthetic vehicles are not jeeps currently traveling in Pampanga, and their synthetic variant is not a pilot route association.

Use **Live simulated clock** for moving markers at the existing 15-second visible-page polling cadence. Use **Available**, **Near full**, **Full** for deterministic 0/20/40-second snapshots. **Reset simulation** samples 0 seconds; **Live simulated clock** resumes server-clock sampling. Snapshot controls are GET-only; no GPS, occupancy, trips or vehicles are persisted. Markers include variant/occupancy/freshness metadata. Invalid, REAL or incomplete simulation responses are rejected; failures keep the last valid snapshot and display a sanitized message.

Manual camera check: pan/zoom → refresh/wait for polling → camera remains unchanged. Only explicit My Location / Fit features or a journey-selection intent may move the camera. Source updates use existing MapLibre `setData()` layers; no new map is created on updates. Hidden pages cancel simulation requests; stale responses cannot overwrite a later sample. Loading requests deduplicate. No ETA is derived from occupancy. REAL planner availability excludes simulated operations.

## Maps and provider fallbacks

All production maps use MapLibre. Leaflet remains absent after Phase 25B. WALK geometry stays dashed; supplied transit geometry is solid. Cached Geoapify road paths are separately classified `APPROXIMATE_ROAD_PATH`, with the existing approximate-path notice. They are never verified transit geometry or planner inputs. Verified `RouteVariant.geometry` remains null in this pilot.

| Failure | Presenter action and truthful behavior |
| --- | --- |
| Geoapify search unavailable | Retry a specific query after recovery. Do not invent a geographic selection or substitute campus/mall coordinates for transport truth. Existing selected factual journey may remain; a new unresolved input cannot plan. |
| Walking provider unavailable | A new trip needing nonzero access/egress may be unavailable. Keep existing verified records visible; do not claim walking can always be omitted or add straight-line walking. |
| Approximate road path unavailable | Journey and node markers remain usable; no fake straight transit line is added. Explain that the corridor path is an optional presentation aid. |
| Map style/tile unavailable | Use the existing readable error state and journey cards. Do not call a blank map a successful basemap test. |
| AI unavailable | Keep the selected deterministic journey. Use the sanitized unavailable state and retry Explain this trip after recovery. “The AI explanation is an assistance layer. The factual journey is computed independently.” |
| Demo backend disabled/unavailable | Simulation controls display sanitized unavailable status, with no invented live vehicle replacement. Check both flags and intended role permissions. |

Geoapify search/basemap/walking/presentation paths and AI require network/provider access. Browser Geoapify configuration is deliberately public; AI, server routing, database and session secrets remain server-only. No offline route approximation was added. Existing geography caches/deduplication, AI exact-fact reuse, batched location queries, rate/payload limits and 15-second visible polling remain intact.

## Reporting, LGU/Admin and Driver

Passenger: open **Report an issue with this journey**, inspect contextual fields, and open **My Reports**. Reports are review evidence; they do not change verified routes, official disruptions or Driver occupancy. The authenticated contextual report form and My Reports were inspected. Submission, ownership and review isolation are covered by mocked controller regression tests. No safe disposable-report cleanup workflow exists in the current UI, so the conditional live submission step was skipped and fictional text cleared without submitting. A genuine submission demonstration requires a real report or disposable test environment.

LGU/Admin: inspect current structured targets, existing data, verification/evidence metadata and validation UI. Do not save or promote a demo fixture to trusted data. Passenger/Driver cannot access the workbench. Anonymous endpoints are not enabled for convenience.

Driver: show the existing UI or its existing development fixture and explain “No vehicle is assigned” if that is the actual state. Do not create a fake REAL driver, assignment, trip, GPS ping or occupancy. Trusted HTTPS and a genuine operator/vehicle assignment are prerequisites to the unresolved real-device acceptance.

## Reset and pre-demo checklist

1. Run `demo:check`; require unchanged digest and planning counts. If digest mismatches, STOP and investigate. Check intended accounts/permissions without printing credentials.
2. Explicitly opt in to both local demo flags if simulation is wanted; verify the server gate via normal authenticated UI. Do not loosen permissions.
3. Test the actual selected geographic results, normal trip-plan response, map and AI once through Passenger login. Configuration presence alone is insufficient.
4. Rehearse LGU/Admin read-only pages and Driver limitation. Confirm desktop and phone-size layout, console health and reachable controls.
5. Reset simulated samples to 0 / resume live simulated clock; no fixture is persisted. Development preview Reset also clears stale/occupancy toggles.
6. Reset the disruption by re-running without the in-memory effect; no official incident was created. Do not edit pilot records.
7. Clear/reselect geographic inputs or refresh Trip Planner to reset selection. Pan/zoom remains stable during polling; use explicit Fit features if wanted.
8. Retry failed AI on demand. Successful identical facts reuse the existing short-lived cache; changed selection resets explanation.
9. Leave fictional reports unsent and LGU/Admin forms unsaved. A real report is evidence with a persistent review lifecycle, not a disposable simulation; there is no new report-delete shortcut.
10. Disable the local demo flags and restart when finished. No database restoration is needed.

## Validation record

| Check | Result |
| --- | --- |
| Frontend relevant Phase 6–26 suite | 109 tests PASS; new Phase 26 10/10, including reactive editor, stale entity response and warning sanitization regressions. |
| Backend relevant Phase 1–26 suite | 33 Node test entries PASS (legacy phase scripts contain multiple assertions); new Phase 26 7/7, including numeric stop summaries and mocked submission/My Reports isolation. |
| Selection and disruption foundation | Trip-planner selection contract and Phase 18A frontend checks PASS. |
| Live database audits | Pilot, workbench permissions/data, Phase 22 role matrix and Phase 23 batched latest-location query PASS. Phase 23 creates connection-local temporary fixtures only, dropped on commit; no persistent records change. |
| Read-only Phase 26 rehearsal | Direct, transfer, explicit inbound, PARTIAL fare, unknown duration/wait, in-memory targeted suspension/reset, mocked AI failure and simulated occupancy/reset PASS. No external provider requests. |
| Builds | Backend and frontend production builds PASS. Backend prints an existing nonfatal local XDG configuration permission warning; build completes. |
| Desktop preview | 1280×900 existing development live-vehicle preview: Map READY, zoom/pan and position refresh inspected; corridor remains at the manually moved camera; no horizontal overflow, no console errors. Uses SIMULATED OPERATIONAL DATA only. |
| Phone-size preview | 390×844 same development preview: Map READY after resize, occupancy FULL and STALE diagnostic state visible, Reset restores 0 seconds / AVAILABLE / FRESH; no horizontal overflow, no console errors. This is viewport testing, not real phone GPS acceptance. |
| Authenticated LGU baseline | Dashboard, Live Mobility, Disruptions and all six workbench tabs inspected with flags OFF. MapLibre basemaps and verified-node coordinate preview rendered. Zero active REAL vehicles; no official disruption records; no service records. Node, inbound variant, stop and fare editors opened without saves. LGU trust/planning elevation controls locked. |
| Authenticated Passenger baseline | Dashboard → Trip Planner → direct/transfer/inbound → selected maps → Gemini guide → contextual report form/My Reports inspected with flags OFF. Geoapify search, walking and basemaps worked through the normal authenticated flow. Direct board/drop-off and PHP 30 fare matched; transfer used tricycle → Mexico Bayan/Sta. Monica → jeepney with PHP 14 partial subtotal; inbound used Robinsons Arayat Gate/SAN JUAN → PSU frontage. Unknown values stayed unknown. |
| Authenticated AI | Current Gemini provider returned guides for direct and transfer journeys. Text corresponded to selected facts, preserved the partial fare and unknown schedule/wait/availability/total duration, and did not alter the deterministic journey. Mocked failure also retained factual results. |
| Passenger reports | Selected-journey context and My Reports loaded. No fictional report was submitted because there is no safe disposable-report cleanup UI. Four pre-existing reports remain; mocked create/ownership/isolation regression PASS. |
| Authenticated demo ON | Passenger Live Map and LGU Live Mobility loaded the authenticated simulation feed. Available/near-full/full 0/20/40-second samples, reset and live clock worked. Variant `SIM-DEMO-DIRECT-ONLY`, occupancy/freshness and SIMULATED labels were visible. REAL active count stayed zero. Manually moved cameras stayed unchanged during Refresh/polling; no ETA or wait was introduced. |
| LGU hide/resume | User performed an at-least-20-second hide/return check and confirmed completion; the resumed page/map was healthy. The automation surface itself keeps `document.visibilityState` visible when its panel is hidden, so its panel toggle is not evidence of a hidden document. The actual LGU page handler regression verifies hidden ticks make no request, abort in-flight work, and request again on visibility restoration. |
| Authenticated Administrator | All six tabs and node/route/inbound-variant/stop/fare editors inspected; empty Service tab and new service form inspected then canceled. Admin trust/planning controls were enabled; LGU elevation controls were locked. PSU MapLibre coordinate preview rendered. Geometry stayed empty/UNKNOWN. No saves or new records. |
| Flags restored | Both owned development processes restarted with their original local configuration, without the temporary demo/API-host overrides. Both demo flags are disabled/unset. Live Mobility after reload shows no simulation controls/overlay, zero live vehicles, a rendered MapLibre basemap and zero console errors. Local environment files were never edited. |
| Role separation | Passenger navigation to LGU/Admin and LGU navigation to Admin/Passenger redirect to the role's home. Anonymous workbench/simulation requests return 403. Administrator normal workbench inspection succeeds; live Phase 22 permission matrix and regression retain Passenger/Driver write restrictions. No credential guessing, token injection or permission bypass. |
| Driver real-device acceptance | **OPEN**, unchanged Phase 24.5 external limitation. |
| Final hygiene | Both repository diffs pass whitespace and conflict-marker checks. Secret scan of source, Phase 26 logs and built browser assets finds no server-secret exposure. |

Screenshots and sanitized logs are local ignored validation artifacts. No provider result, report fixture, disruption or operational simulation was stored in PostgreSQL. Phone-size authenticated Passenger direct/transfer/inbound cards, AI/report actions and live map were checked alongside desktop views; target phone breakpoint had no horizontal overflow. Simulation labels remained visible. This does not assert real-phone GPS acceptance.

### Authenticated rehearsal defects and recovery

- MINOR: Command Center hardcoded an active-disruption total of 1 while the official list/database held 0. Replaced it with an unavailable total and a Disruptions-page reference; browser verified.
- MAJOR: Review and save serialization attempted `structuredClone` on Vue reactive proxies. Unwrap the root with `toRaw` before cloning. Regression verifies reactive review/serialization preserve original facts; node, variant, stop and fare editors now open normally without saves.
- MINOR: Workbench geographic search used an unresolved Nuxt component name. Corrected it to the existing auto-import name; accessible search and the MapLibre node preview render.
- MINOR: Numeric stop sequences were falsely reported missing, and structural stop records were shown as planning-disabled. Corrected summary validation and structural labeling; existing sequences display without a false missing warning. No planner or data change.
- MAJOR: A failed entity-tab request retained records from the previous entity. Clear records for each load and ignore older response/error/loading updates. A regression covers failure and late responses, preventing review of stale records under the wrong entity.
- SECURITY: Vue development warning traces serialized application state into the ignored local diagnostic log, including the public Geoapify key. A development-only warning handler logs fixed categories without messages, props or component traces; a regression proves synthetic provider/auth values are omitted. The affected diagnostic log was redacted after stopping the owned frontend process. Secret scan then passed; no value is recorded here.
- LOCAL CONFIGURATION: Expired sessions returned 401 followed by refresh 400 when the browser page used localhost while the frontend API URL used the LAN host. The existing HttpOnly/SameSite=Lax refresh cookie is not sent across that site boundary. For the localhost rehearsal only, a frontend process override selected the localhost API; the user signed in again normally. No cookie/token inspection, security relaxation, `.env` modification or `nuxt.config.ts` edit was used. Use matching page/API hosts for future presenter sessions: both localhost on the desktop, or both the configured LAN host on a phone. Normal local configuration is restored after the test.
- LOCAL PROCESS NETWORK: An initial backend process lacked outbound network access, so walking degraded to its sanitized provider-unavailable result. The existing live Geoapify smoke test passed with network access, and restarting the backend with that access restored authenticated walking/journeys. No routing fallback or fabricated geometry was added.
- Editing backend source caused its ordinary development restart; the request during restart showed the existing sanitized unavailable state. After health recovery, fare/service/stop requests succeeded. This transient network failure is recorded, not counted as a clean uninterrupted session.

Affected post-fix suites: frontend Phase 21/25A/26 18 test entries PASS (Phase 26 10/10), backend Phase 21/26 8 entries PASS (Phase 26 7/7). Final full frontend Phase 6–26 and approximate-path suite passes 109 entries; full backend suite passes 33 entries. Trip-planner selection contract and four live pilot/workbench/security/performance database audits PASS. Both production builds pass after the fixes. Build warnings are nonfatal existing dependency/chunk/timing notices and the backend local XDG permission notice.

Persistent database changes: **ZERO**. Planning counts: **3 Routes / 4 RouteVariants / 4 coordinate-bearing eligible TransportNodes**. Pilot digest:

```text
3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139
```

The unrelated user-owned `nuxt.config.ts` LAN edit and the original Phase 24.5 report are byte-for-byte unchanged. The LAN edit is excluded from Phase 26 staging/commits. Phase 27 requires a separate authorized deployment task and its environment prerequisites; it remains untouched.

Final demo-OFF restoration and hygiene passed; scoped Phase 26 commits are authorized. Their hashes are reported outside their own commit contents. No push is authorized by this rehearsal and no earlier commit is amended.

## Completion report

| Item | Result |
| --- | --- |
| 1. Passenger authenticated rehearsal | PASS; normal Dashboard/Trip Planner/maps/AI/report form/My Reports flow. |
| 2. Direct journey | PASS; explicit outbound PSU frontage → SM Main Gate, PHP 30 regular fare, walking connectors and separate approximate-path notice. |
| 3. Transfer journey | PASS; exactly one transfer, tricycle → Mexico Bayan/Sta. Monica → jeepney; PHP 14 known subtotal, unknown total. |
| 4. Return journey | PASS; independent INBOUND/SAN JUAN from Robinsons Arayat Gate → PSU frontage, unknown return fare. |
| 5. AI guide | Live Gemini direct/transfer guides PASS; facts/unknowns preserved. Mocked failure leaves factual journey usable. |
| 6. Passenger reporting | Contextual form and My Reports PASS; live fictional submission skipped for lack of safe cleanup. Mocked create/ownership/isolation PASS. |
| 7. Demo-mode gating | OFF baseline → authenticated ON → restored OFF verified. Both server and frontend flags required. |
| 8. Simulated live vehicle | Passenger/LGU GET feed and map PASS; offshore SIMULATED variant/occupancy/freshness shown, zero REAL active vehicles. |
| 9. Occupancy | AVAILABLE → NEAR_FULL → FULL and reset PASS; no ETA/wait manufactured. |
| 10. LGU authenticated rehearsal | Dashboard, Live Mobility, Disruptions and workbench PASS. User hide/return resumed; actual handler polling regression PASS. |
| 11. LGU disruption/reset | In-memory exact outbound suspension/reset PASS; transfer retained, unrelated inbound unchanged; zero official disruptions inserted. |
| 12. LGU workbench | Six sections, evidence and map preview inspected without saves; trust/planning elevation locked. |
| 13. Admin authenticated rehearsal | Six sections and editors/new service preview PASS; intended trust/planning controls enabled, no saves. |
| 14. Role separation | Browser Passenger/LGU redirects, anonymous 403, live permission matrix and Passenger/Driver restrictions PASS. |
| 15. Mobile rehearsal | Authenticated Passenger cards, map, AI/report actions and SIMULATED labels inspected at phone size; target breakpoint without overflow. No real phone GPS claim. |
| 16. Camera behavior | Pan/zoom preserved through Passenger Refresh and Passenger/LGU polling; explicit Fit remains intentional. MapLibre sources update without map recreation. |
| 17. Demo resetability | Samples reset to 0; live clock resumes; disruption effect removed per request; no database restoration required. |
| 18. Demo flags restored | Original local environment restored via process restart; controls/overlay absent after reload. |
| 19. Console/network issues | Final protected page/map checks have zero console errors. Earlier sandbox provider access and localhost/LAN refresh-cookie mismatch are recorded above with safe process recovery. |
| 20. Defects found/fixed | Reactive clone, stale entity responses, geographic component name, stop summary/label, hardcoded disruption count and unsafe dev warning traces fixed and regression-tested. |
| 21. Tests/builds | Frontend 109, backend 33 entries, selection contract and four database audits PASS. Both production builds, whitespace/conflict/secret checks PASS. |
| 22. Database changes | ZERO persistent transport/operational/report/disruption changes. Counts: 4 vehicles, 1 driver, 0 trips, 0 GPS rows, 0 disruptions, 4 existing reports. Authentication/session records are separate. |
| 23. Planning counts | Routes 3; variants 4; coordinate-bearing eligible nodes 4. |
| 24. Pilot digest | `3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139` unchanged. |
| 25. Phase 24.5 status | OPEN; original report byte-for-byte unchanged. REAL assignment/lifecycle/HTTPS prerequisites remain. |
| 26. Backend commit | Scoped Phase 26 commit hash supplied in the completion response after commit. |
| 27. Frontend commit | Scoped Phase 26 commit hash supplied in the completion response; unrelated LAN edit unchanged/excluded. |
| 28. Push status | Not pushed; explicit push approval required. No earlier commit amended. |
| 29. Readiness for Phase 27 | Phase 26 software/demo acceptance PASS. Separate deployment authorization/environment preflight required; Phase 27 remains untouched. |
