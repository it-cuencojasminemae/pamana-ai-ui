# Phase 24.5 — manual operational acceptance

Date: 2026-10-02 (Asia/Manila)

Branch: `feature/pamana-mexico-revision`

**Overall result: NOT TESTED — ENVIRONMENT BLOCKER for the real operational lifecycle. Phase 24.5 does not pass yet.**

Driver login on a real phone passed by the user's report. The phone shows “No vehicle is assigned to this driver account.” The read-only database audit corroborates that state. No REAL Driver trip, GPS observation, occupancy update or trip completion was fabricated to satisfy acceptance.

## Checkpoints and preserved state

- Backend Phase 24 checkpoint: `7c78fd58b4caaff618d9b51d7a2341ec0f7adfba`.
- Frontend Phase 24 checkpoint: `d9af751dbbe269e6d8c752da40f2cbd30255592f`.
- Backend application and frontend application code are unchanged by Phase 24.5.
- The pre-existing frontend `nuxt.config.ts` edit is untouched and excluded from staging.
- Its SHA256 remains `20DCCC32408726EBA10100EEB1F4ECF169BC33F2F0CD330EC3FDAC38A71E5D44`.
- No permissions were weakened, no credential changed, no permanent test user/vehicle created, and no simulated vehicle relabeled REAL.
- Phases 25A, 25B and 26 were not started. Leaflet remains installed.

## Device and LAN evidence

The user confirmed:

- Phone: **Redmi Turbo 4 Pro**.
- Browser: **Brave Browser**; version not supplied.
- URL: `http://192.168.1.13:3000`.
- Existing Driver account: `driver`.
- Page loading and Driver login succeeded; the Driver workspace displayed the no-assigned-vehicle state.

These phone results are **user-reported**, not an agent-operated phone session. Session longevity, cross-role page denial and phone GPS permission have not been independently exercised in this run. Credentials and tokens are excluded from this report.

Host-side checks after development-service startup:

| Endpoint | HTTP result |
| --- | --- |
| `http://127.0.0.1:3000/login` | 200 |
| `http://192.168.1.13:3000/login` | 200 |
| `http://127.0.0.1:1337/_health` | 204 |
| `http://192.168.1.13:1337/_health` | 204 |
| LAN login CORS preflight | 204; exact allowed origin `http://192.168.1.13:3000`; credentials allowed |

The existing backend was already occupying port 1337 when a startup attempt ran; that attempt exited without replacing the existing backend. The existing user-owned backend process was left running. The LAN frontend was started using the existing development command with `--host 0.0.0.0`; no config file was edited. Initial failed connectivity probes were superseded by the successful status checks and the user's real-phone login.

## Driver and vehicle readiness

Read-only PostgreSQL inventory found:

| Requirement | Actual state |
| --- | --- |
| Driver-role account | One: `driver`, not blocked |
| Linked Driver profile | `DRV-TEST-001`, active, **SIMULATED** |
| Assigned Vehicle | None |
| Assigned Route | None |
| Eligible assigned RouteVariant choices | None |
| Existing Vehicle records | Four, all **SIMULATED**, assigned to legacy `SL-SF-01` / `SL-SF-02` routes |
| Genuine REAL Vehicle ready for this acceptance test | None found |
| Current Trips / active Trips / VehicleLocations | 0 / 0 / 0 |

The UI message is correct for the stored assignment. This is an operational setup blocker, not evidence of a broken Driver UI.

### Required manual setup

An Administrator must provide a legitimate operator/vehicle assignment using actual operational details:

1. Provide an active **REAL** Driver profile linked to an existing Driver-role account. The current test profile is SIMULATED; its demo identity must not simply be presented as a real operator.
2. Provide a genuine **REAL** Vehicle with its actual identity and positive capacity, initially available, and assign it to that Driver.
3. Assign the Vehicle to an already eligible **REAL** pilot Route. Do not change the Route's evidence, fares, planning gate or variant truth.
4. For testing separate outward/return choices, the existing `RCH-SJ-CSF-SM-ROB` route has:
   - `RCH-SJ-SMROB-OUT`: PSU Mexico / San Juan → SM City Pampanga.
   - `RCH-SJ-SMROB-IN`: Robinsons Starmills Arayat Gate → PSU Mexico / San Juan.
5. Confirm the Driver UI exposes those exact server-authorized directional variants with readable labels. No variant reversal or legacy San Luis fallback is permitted.

All four pilot variants are still REAL, ACTIVE and planning enabled. The other eligible variants remain `PILOT-PSU-MEXICO-BAYAN-TRICYCLE-OUT` and `PILOT-ARAYAT-SF-MEXICO-BAYAN-SM-OUT`. Their presence does not assign them to a Driver automatically.

### Phone GPS environment prerequisite

The current LAN URL uses HTTP. Browser geolocation requires a secure context; the localhost exception applies to the browser's own device, not an arbitrary LAN host. Consequently, HTTP LAN page/login success does not establish GPS readiness.

Before the real-phone GPS test, provide a phone-trusted HTTPS frontend and a compatible HTTPS/proxied backend, with the frontend API URL and explicit CORS origin aligned. Preserve the existing authentication/session protections. No browser security bypass or insecure-origin flag is proposed.

This prerequisite follows the browser API contract documented by [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) and [MDN Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). Actual GPS permission failure was not triggered in this run because no valid operational Trip could start.

No TLS/LAN configuration was changed. Any additional environment configuration must be reviewed separately; the protected `nuxt.config.ts` edit remains user-owned.

## Manual acceptance matrix

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Real-device frontend and Driver login | PASS — USER-REPORTED | Redmi Turbo 4 Pro / Brave; Driver workspace no-vehicle message |
| Session longevity / unauthorized Passenger-LGU-Admin access | NOT TESTED — ENVIRONMENT BLOCKER | Only successful login/Driver workspace is reported; Phase 24 automated role coverage remains prior evidence |
| Driver/Vehicle/Route assignment | BLOCKER | SIMULATED profile, no assigned Vehicle/Route; no REAL Vehicle inventory |
| Valid Route → directional RouteVariant selection | NOT TESTED — ENVIRONMENT BLOCKER | No assigned eligible selection can be offered |
| Start Trip / correct attribution / duplicate conflict | NOT TESTED — ENVIRONMENT BLOCKER | No valid REAL assigned vehicle context |
| Phone GPS permission / valid fix / no 0,0 fallback | NOT TESTED — ENVIRONMENT BLOCKER | No active Trip; phone-trusted secure context also required |
| Authenticated GPS publishing and exact Trip/Vehicle/variant attribution | NOT TESTED — ENVIRONMENT BLOCKER | No phone fix or operational Trip |
| Passenger fresh REAL marker / movement | NOT TESTED — ENVIRONMENT BLOCKER | No REAL operational location exists |
| LGU fresh REAL marker / route / occupancy | NOT TESTED — ENVIRONMENT BLOCKER | No REAL operational location exists; view still uses Leaflet |
| AVAILABLE → NEAR_FULL → FULL occupancy propagation | NOT TESTED — ENVIRONMENT BLOCKER | No assigned vehicle/active Trip |
| Driver active-trip route/variant/vehicle/GPS state | NOT TESTED — ENVIRONMENT BLOCKER | No active Trip |
| End Trip / publishing stops / history | NOT TESTED — ENVIRONMENT BLOCKER | No Trip was started |
| Actual 60-second stale GPS observation | NOT TESTED — ENVIRONMENT BLOCKER | No genuine location to age |
| Pan/zoom stability while receiving Driver GPS and occupancy | NOT TESTED — ENVIRONMENT BLOCKER | No REAL updates; mocked camera tests pass separately |
| REAL / SIMULATED separation during device operation | NOT TESTED — ENVIRONMENT BLOCKER | No REAL operation; no demo flag was enabled or simulated run performed |
| Direct / transfer / return pilot after Driver operations | NOT TESTED — ENVIRONMENT BLOCKER for manual post-operation replay | Driver operations did not occur; read-only actual pilot graph/fare database regression passed |
| Live walking / approximate road display after Driver operations | NOT TESTED — ENVIRONMENT BLOCKER | No new live provider/manual display smoke in this phase |
| Explain selected trip | NOT TESTED — ENVIRONMENT BLOCKER | No new manual explanation call; Phase 24 live Gemini result remains prior evidence |
| Passenger report / My Reports / occupancy remains unaffected | NOT TESTED — ENVIRONMENT BLOCKER | No new report submitted; no cleanup needed |
| Safe disruption activate/resolve | NOT TESTED — ENVIRONMENT BLOCKER | No safe fixture was activated and no disruption was written |
| Leaflet production inventory | PASS — READ-ONLY | Inventory below identifies all retained production consumers |

No manual operational item is marked PASS solely because a unit test passed.

## Remaining Leaflet inventory — input to Phase 25A

Classification: **A** production and still required; **B** development/test only; **C** historical/legacy references without an executable runtime consumer.

| Use | Class | Current behavior and migration consideration |
| --- | --- | --- |
| `app/pages/driver/demand-map.vue` | A | Calls default-Leaflet panel; demand decorations/overlay are prototype presentation. Preserve layout/overlay behavior in future migration. |
| `app/pages/lgu/index.vue` | A | Command-center corridor-supply panel defaults to Leaflet. |
| `app/pages/lgu/live-mobility.vue` | A | Real live-vehicle markers, shared user location, overlays and 15-second visibility-aware polling; defaults to Leaflet. Administrator can also access this LGU view. |
| `app/pages/lgu/disruptions.vue` | A | Structured disruption records supplied through legacy marker prop and shared user location; defaults to Leaflet. Accessible to LGU and Administrator. Preserve explicit target/trust contracts in future migration. |
| `app/components/PamanaMapPanel.vue` | A | Default is Leaflet; MapLibre consumers also expose explicit compatibility fallback on errors. |
| `app/components/PamanaLeafletMap.vue` | A | Sole direct Leaflet renderer/import; includes Leaflet CSS, layers, popups, route fit control, user marker and disposal. |
| `package.json` / `package-lock.json` | A | Required direct Leaflet 1.9.4 dependency retained for the above consumers and rollback. No separate direct Leaflet type dependency found. |
| Passenger Trip Planner / Passenger Live Map | A — rollback only | Both explicitly use MapLibre; shared panel can still invoke the Leaflet compatibility path. No direct Leaflet page import. |
| Driver Current Trip | A — rollback only | Explicit MapLibre; exact selected Trip is fit key. Shared Leaflet fallback remains available. |
| Admin/LGU transport workbench | A — rollback only | Coordinate and supplied geometry previews explicitly use MapLibre; shared compatibility fallback remains. No separate default-Leaflet Admin page map was found. |
| Dev previews | B | Explicit MapLibre or direct MapLibre component; retained shared compatibility path may be reachable. No separate Leaflet dev renderer found. |
| `scripts/test-phase-6/7/8/9/15/16/17/18b/23.mjs` | B | Compatibility/package preservation assertions. Update only when later removal is authorized and safe. |
| Previous phase mapping documentation | C | Historical descriptions of retained Leaflet; later supported-stack documentation needs updating in Phase 25B. |

Search covered application components/pages/composables, scripts, documentation, Nuxt config and package/lock files for Leaflet, `L.`, renderer, CSS and dependency references. No separate Leaflet plugin or Leaflet composable was found. No executable Leaflet renderer can currently be classified as dead/unreferenced: it remains actively used.

Code inspection shows Leaflet redraw fits on initial display, first user-location arrival or changed selection; recurring vehicle marker updates alone do not request fit. **This is not a substitute for the missing real-device camera test.**

## Focused validation and integrity

Fresh checks run without modifying application code:

- Backend Phase 17 Driver policy/flow tests: PASS.
- Backend Phase 13 wait/availability tests: PASS, including exactly related fresh evidence, FULL/UNKNOWN boardability and explicit simulated exclusion.
- Existing pilot database suite: PASS; actual verified graph returns direct, transfer and inbound return journeys; fares preserve PHP 30/PHP 14 and unsupported discounts remain unknown.
- Presentation-road-path boundary tests: PASS; approximate geometry is excluded from planner truth.
- Frontend Phase 17: 7 tests PASS.
- Frontend Phase 7: 5 tests PASS, including setData/source lifecycle and explicit-only camera fits.
- Freshness policy inspected: `locationMaxAgeSeconds: 60`; unchanged.
- Production builds were not rerun for documentation-only work. Both passed at Phase 24; no new production build acceptance is claimed.
- Documentation diff/conflict/secret scans run before its commit.

Final transport state:

| Invariant | Value |
| --- | --- |
| Planning-enabled Routes | 3 |
| Planning-enabled RouteVariants | 4 |
| Coordinate-bearing FIELD_VERIFIED eligible nodes | 4 |
| RouteVariantStops / FareRules / ServicePatterns | 8 / 2 / 0 |
| Verified pilot transit geometry | Null; unchanged |
| Trip / active Trip / VehicleLocation counts before and after | 0 / 0 / 0 |
| Phase 24.5 transport/operational writes | Zero |

Pilot digest: `3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139`.

User-initiated Driver login may create normal authentication session records. Those are distinct from transport truth and Trip/VehicleLocation acceptance data.

## Defects and delivery

- **BLOCKER — operational setup:** no REAL Driver/Vehicle assignment. No application defect demonstrated; no fake records or trust changes made.
- **BLOCKER — phone GPS environment prerequisite:** only HTTP LAN access is currently established. No browser permission denial is claimed; secure-context setup remains necessary.
- Application acceptance defects fixed: **none**. No route, fare, planning, disruption, reporting, AI, workbench, security or performance behavior was changed.
- Backend commit: none; backend working tree stays clean.
- Frontend delivery: documentation-only commit recording incomplete acceptance. The commit hash is reported separately, avoiding a self-referential hash inside the document.
- Push: not performed; no Phase 24.5 push approval has been given.
- **Phase 25A readiness: NO.** Resume Phase 24.5 after legitimate assignments and phone-compatible HTTPS are provided. Complete the device lifecycle, simultaneous Passenger/LGU observation, occupancy, end/history, stale-location and camera checks, then rerun remaining manual regressions. Stop after Phase 24.5; do not migrate or remove Leaflet yet.
