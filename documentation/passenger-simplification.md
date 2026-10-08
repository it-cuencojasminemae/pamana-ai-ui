# Passenger simplification acceptance — 2026-10-08

The Trip Planner and Live Map now omit Planning mode, Reach your first jeepney, and the Pilot landmarks dropdown for all passengers. Landmark search, map icons, and selected landmark Plan from here / Plan to here actions remain available. The bottom selection panel appears only when a landmark is selected.

Authenticated capabilities select Research Preview only when the server permits it through both demo and research flags. Otherwise planning is Operational. Access is AUTO. Stale URL choices are ignored and rewritten on initialization and handoff. Research and simulated-evidence badges remain distinct, alongside deterministic signboard and driver-confirmation instructions.

Only the two passenger maps use the new camera policy: empty maps open at latitude 15.117429648993976, longitude 120.7024058913807, zoom 14.5. Catalogs, GPS and live observations cannot determine that initial framing. Pin-selection mode preserves the camera. A single endpoint outside San Juan includes the San Juan anchor; two endpoints and selected journeys fit relevant endpoints and available geometry. Explicit endpoint changes trigger fitting; ordinary feed/style updates do not. My Location remains an explicit action.

The compatible pin-area API adds `displayBoundary` containing the existing verified San Juan polygon. Green fill and dashed lines use this property. Full `boundary` still authorizes enabled San Juan and San Fernando pins, including polygon holes. The frontend does not fall back to painting the full boundary when an older backend lacks `displayBoundary`; deploy backend support first.

No migration, transport records, route geometry, operational eligibility, fares, or database transfer permissions were changed by this presentation update. Existing research routes remain subject to their evidence gates. A disposable local passenger account was used for UI acceptance and removed afterward; no operational user was edited.

Two issues discovered in manual testing were fixed: asynchronous startup URL rewrites could race Live Map handoff, and swapping one selected endpoint with an empty field could retain stale display text. Initialization now completes before planning/handoff controls are usable, abandoned page initialization cannot rewrite the next page, and empty location labels synchronize correctly.

| Verification | Result |
|---|---|
| Frontend `npm test` | 185 passed, 0 failed; 3 legacy contract checks also passed |
| Backend connected research, local pins/time, San Fernando expansion suites | 55 passed, 0 failed |
| Frontend production build through Nuxt `buildNuxt` | PASS; isolated build/output directories avoid concurrent dev-build locks |
| Backend `npm run build` | PASS |
| `git diff --check` | PASS; line-ending warnings only |
| Four demo/research combinations, authorization, stale capabilities and cancellation | Automated PASS |
| Boundary validation, holes, display/authorization separation | Automated PASS |
| Passenger camera, GPS/background/style refresh, explicit My Location | Automated PASS |
| Authenticated local capabilities/pin-area endpoints | 200; San Juan display polygon and San Fernando authorization retained |
| Anonymous local capabilities/pin-area endpoints | 403 |

Actual UI results are separate from fixtures:

| Actual Passenger UI check | Desktop | Mobile |
|---|---|---|
| Dropdown removal and initial San Juan focus | PASS | PASS, 390×844 |
| Exact San Juan pin → St. Nicolas College | PASS | PASS, final source recheck |
| San Fernando pin near Victory Liner → San Juan | PASS, final source recheck | PASS |
| Restored return endpoints, stale settings and refresh | PASS | PASS; content width 380 at viewport width 390 |
| Live Map San Juan focus and San Fernando pin framing | PASS | Covered by responsive checks and shared camera fixtures |
| Landmark icon selection and Plan from/to actions | PASS | PASS |
| Landmark handoff/refresh and immediate exact-pin handoff | PASS | PASS |
| Swap, clear and pin replacement | Shared behavior | PASS; replacement persisted full-precision new coordinates |
| San Fernando green shading absent | PASS | PASS on journey maps |
| Forced map style reload | Automated PASS | Automated PASS; not separately forced in the browser |

The outbound example produced four options. The selected journey used Mexico Bayan then a Palengke jeep: ₱19 + ₱16 = ₱35, one transfer, 127 m walking, approximately 33 minutes moving time. Its simulated total of 48 minutes was labeled separately. The return example preserved origin 15.0394, 120.6832 and the canonical San Juan terminal destination: two options, Robinsons jeep ₱14 plus SAN JUAN jeep ₱28 = ₱42, one transfer, 145 m access plus 1,386 m egress. Moving time remained partial: 23 minutes walking and 30 minutes known road time for one of two rides. Missing time was not invented. These new research examples are **AUTOMATED FIXTURE: PASS; RESEARCH PREVIEW UI: PASS; NORMAL VERIFIED PLANNING: NOT YET ELIGIBLE**.

Screenshots and machine-readable results are in `passenger-simplification/`: `desktop-san-juan.jpg`, `mobile-san-juan.jpg`, `desktop-live-san-juan.jpg`, `desktop-live-san-fernando-pin.jpg`, `desktop-landmark-actions.jpg`, `mobile-landmark-actions.jpg`, `desktop-outbound-research.jpg`, `mobile-outbound-final.jpg`, `desktop-return-final.jpg`, `mobile-return-research.jpg`, `desktop-return-refresh.jpg`, `mobile-return-refresh.jpg`, and `mobile-pin-replacement-final.jpg`. See `acceptance-results.json` for exact URLs and observations. Test/build logs are beside this report; backend API/test/build/cleanup logs are in backend documentation.

Browser reconnections and occasional session interruptions occurred during development. A historical development hydration warning was observed; the final configured-origin return journey and refresh had no new console errors. A temporary production acceptance server on port 3001 could not log in because browser API access from that origin was blocked; it was stopped without changing network/security settings. Production compilation passed, while actual browser acceptance used the configured development server on port 3000. The existing frontend uses a LAN backend address; keep frontend/backend origins and cookie settings consistent for the hackathon. Temporary browser viewport overrides and test tabs were cleaned up.

Risk remains low to moderate: capability-driven default mode and camera timing are the main integration changes. No zero-breakage claim is made. This update changes presentation and defaults; it does not promote research evidence to operational verification or expand transport coverage.
