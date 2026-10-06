# Batch B: Passenger route options

Completed for browser review on 5 October 2026. No commit or push was made. Batch C was not started.

Passenger results now have backend category choices, compact OPTION A/B cards, automatic Recommended selection, and deterministic pickup/ride/transfer/drop-off details beside the existing MapLibre map. Cards display returned payable fares as whole pesos and use the returned vehicle transfer count. Unknown wait, service availability and total time are hidden. Loading disables duplicate submissions; empty and API error states use short passenger-facing copy with retry for errors.

The fare engine, approved geometry, distances, transport records, planning flags, verification and provenance were not changed by Batch B. Existing on-demand AI explanation remains unchanged and was not invoked during browser review. Earlier uncommitted Batch A/A.5 work remains in both repositories; the file lists below identify the Batch B scope specifically.

## Categories and selection

No frontend ranking or fare calculation was added. The planner already supplies a deterministic order; a small backend presentation classifier returns four category IDs alongside that order.

| Category | Backend rule |
| --- | --- |
| Recommended | First valid journey in the existing deterministic planner order. That order prioritizes fewer transfers, fewer vehicle legs, then stable route/node keys. |
| Cheapest | Lowest returned payable journey total only when every valid option has a known, finite nonnegative total in the same currency. |
| Fastest | Lowest complete total journey duration only when every valid option has a known, finite nonnegative total duration. Walking duration alone is insufficient. |
| Fewest Transfers | Lowest returned transfer count. Initial boarding and walking are not added to that count. |

Ties retain backend order. Classification excludes planning-ineligible options, non-REAL options, journeys without transit, and transit legs missing boarding/alighting points. This filters the presentation set without changing stored eligibility. The frontend checks that category IDs refer to valid returned options, selects the explicit Recommended ID, and otherwise falls back to the first valid backend option.

For all current pilot responses, the direct journey is Recommended, Cheapest and Fewest Transfers. **Fastest is unavailable** because total transit/journey duration is unknown. Its disabled button says “Time data unavailable.” Wait and availability are also unknown for these pilot records and are omitted. If a backend response lacks classifications, only Recommended receives the deterministic fallback; other categories remain unavailable.

## Observed fares and transfers

These values were read from returned DTOs, not hardcoded into components.

| Journey | Regular | Explicit Student | Transfers | Evidence |
| --- | ---: | ---: | ---: | --- |
| PSU Mexico → SM City Pampanga | ₱27 | ₱22 | 0 | Regular in live browser; both in controller/API smoke |
| Robinsons Starmills → PSU Mexico | ₱28 | ₱23 | 0 | Both in live browser and controller/API smoke |
| Mexico Bayan → SM City Pampanga | ₱14 | ₱11 | 0 | Controller/API smoke |
| PSU → tricycle → Mexico Bayan → jeep → SM | ₱114 | ₱111 | 1 | Regular in live browser; both in controller/API smoke |
| PSU → Mexico Bayan tricycle | ₱100 | ₱100 | 0 | Controller/API smoke |

Transfer details display “Estimated fare: ₱100” for the tricycle and “Fare: ₱14” for the regular onward jeep. Backend DEMO_ESTIMATE provenance remains intact internally. Student context does not discount the tricycle. No student category is assumed on initial load.

## Desktop and phone review

Used the user's existing Passenger account in the in-app browser; the user signed in directly. No passwords or session tokens were requested, read or recorded.

- PSU → SM returned two options through the live HTTP search. The direct jeep was selected automatically. Clicking OPTION B changed the selected state, MapLibre route/features, and details to the two vehicle legs. Clicking Recommended returned to OPTION A.
- Robinsons → PSU returned a selected direct jeep with ₱28 and 0 transfers. Explicitly selecting Student and searching again returned ₱23.
- Phone review used a requested 390 × 844 viewport override. Browser zoom produced a measured CSS viewport of 355 × 767; document width was 345, so there was no horizontal overflow. Desktop override was 1440 × 1000, with measured CSS width 1309 and document width 1299. Temporary overrides were reset after review.
- Phone cards were easy to tap and showed both whole-peso fares and transfer counts. The layout stacked cards, map and details. Map zoom and explicit Fit features remained usable. The viewport resize preserved the current camera; explicit Fit features fitted the route to the phone map.
- No route codes, provenance enums, `.00` fare formatting, fabricated wait or fabricated ETA appeared in the reviewed results. The existing AI button remained on-demand and was not clicked.

Geoapify currently finds the PSU Mexico campus under its older **Don Honorio Ventura Technological State University** name. Browser searches used that provider result; the returned transport pickup is correctly named **Pampanga State University Mexico Campus – Front Waiting Area**. SM's provider result was Entrance Gate 2; the returned transit drop-off is the approved Main Gate Drop-off Area. This naming limitation was not addressed by changing transport records.

No blocking layout issue was found. Current limitations are the provider's old campus alias and unavailable time/wait/service data. The existing AI wording remains outside Batch B. Browser screenshots include the existing workspace header, sidebar and development overlay.

Screenshots:

- [Desktop: Recommended PSU → SM](batch-b-screenshots/desktop-psu-sm-direct.jpg)
- [Desktop: selected transfer option](batch-b-screenshots/desktop-psu-sm-transfer.jpg)
- [Desktop: Robinsons → PSU, regular](batch-b-screenshots/desktop-robinsons-psu.jpg)
- [Desktop: Robinsons → PSU, Student](batch-b-screenshots/desktop-robinsons-psu-student.jpg)
- [Phone: route cards](batch-b-screenshots/mobile-route-options.jpg)
- [Phone: transfer details](batch-b-screenshots/mobile-transfer-details.jpg)
- [Phone: explicit map fit](batch-b-screenshots/mobile-transfer-map.jpg)

## Map behavior

The existing MapLibre renderer, approved transit coordinates, walking connectors, GPS controls, feature selection and camera-preservation pipeline were reused. Selection shares the same journey ID across cards, details and map. The existing fit key changes with explicit journey selection, while ordinary geometry updates retain the camera. Transit boarding/alighting nodes are included so the transfer point can appear along with the endpoint nodes. Passenger map line labels describe the destination instead of exposing route codes. No Leaflet was introduced.

Live review verified automatic selected route display, switching between the direct and transfer geometry, returning through Recommended, supplied node labels, and explicit mobile fit. Regression tests cover geometry identity, camera preservation, transport-node rendering and REAL/SIMULATED isolation; GPS positioning was not activated during this review.

## Validation

- Frontend: **86 tests passed, 0 failed** in the combined Batch B, Batch A, Batch A.5B, phase 7/9/15/16/18b/20/23/24/26 and approximate-road-path suites. The existing trip-planner selection contract script also passed.
- Batch B's 11 frontend tests render the actual Vue card/details components from real saved backend DTOs, verify regular/discounted whole-peso fares, zero/one transfers, hidden technical/unknown values, category fallback, actual composable loading/dedup/error/empty behavior, card selection events, and selected map geometry. Responsive source checks are supplemented by the live phone review above.
- Backend: Batch B's 6 classification tests and 17 Batch A fare tests passed. Existing phase 10/11/12/13/14/18b regressions passed.
- Actual Passenger controller + Strapi loader smoke passed for **8 regular/Student requests**, including exact approved stored geometry, fares and returned classifications. The smoke controls walking routes and does not itself test HTTP/auth; live Passenger browser searches separately exercised HTTP/auth and the real walking provider.
- Frontend production build passed. Backend production build passed. Routine dependency/chunk/deprecation warnings did not fail either build.
- `git diff --check` passed in both repositories. New Batch B text files were also checked for trailing whitespace.
- Final transport audit used a **repeatable-read, read-only database transaction** and passed after live browser review. Digest remains `0d24f4205ae5fd89c4e580a2e82afaaa9012bcbf94ad2455d63dfbd87c2d060a`, identical to Batch A.5B. Counts remain nodes 10, routes 8, variants 4, variant stops 8, fare rules 2, service patterns 0. Planning and verification counts are unchanged.

Backend evidence: `pamana-backend/documentation/batch-b-passenger-api-results.json` and `pamana-backend/documentation/batch-b-database-audit.json`.

## Files changed for Batch B

Frontend implementation:

- `app/pages/passenger/trip-planner.vue` — results/categories/loading/empty/error layout, selected map/details integration and public report context.
- `app/components/journey/PamanaJourneyCard.vue` — compact selectable passenger option card.
- `app/components/journey/PamanaJourneyDetails.vue` — new deterministic selected route details.
- `app/services/routeOptionsPresentation.ts` — new DTO-based labels, category selection, optional-value handling and result states.
- `app/composables/useTripPlan.ts` — valid option filtering and Recommended selection; existing request generation/abort behavior retained.
- `app/types/tripPlan.ts` and `app/services/tripPlanContract.ts` — optional backend category contract and validation.
- `app/services/tripPlanPresentation.ts` — whole-peso formatting, public map line labels and supplied transit nodes.

Frontend validation/documentation:

- `scripts/test-batch-b-route-options.mjs` — new Batch B tests.
- `scripts/test-phase-15.mjs`, `scripts/test-phase-18b.mjs`, `scripts/test-phase-24.mjs` — obsolete copy/ranking expectations and composable harness imports updated.
- `package.json` — `test:batch-b` command.
- This report and `documentation/batch-b-screenshots/`.

Minimal backend presentation contract addition:

- `src/services/pamana-journey/journey-recommendations.js` — new backend classifier over the existing returned order/totals/transfers.
- `src/services/pamana-journey/trip-plan-orchestrator.js` — adds classifier output to the response; its earlier Batch A transfer/distance edits are separate.
- `scripts/test-batch-b-recommendations.js` — new classification tests.
- `scripts/test-phase-14-unified-trip-plan.js` — updated response expectation for the additive category contract.
- `scripts/smoke-batch-b-api.js` — new controller/database-loader classification smoke.
- `package.json` — `test:batch-b` command.
- `documentation/batch-b-passenger-api-results.json` and `documentation/batch-b-database-audit.json` — verification evidence.

The frontend's pre-existing `nuxt.config.ts` and `app/services/journeyExplanation.ts` edits are not Batch B changes. No backend fare/AI/geometry service edits were added by Batch B. The local frontend and existing backend remain available for user review.
