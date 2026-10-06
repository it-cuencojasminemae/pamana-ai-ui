# Batch C: automatic PAMANA AI Trip Guide

Implemented and reviewed on 5 October 2026. No commit or push was made. Work stops at Batch C for the user's review. Earlier uncommitted Batch A/A.5/B changes remain in both repositories; the scope below identifies Batch C separately.

The Passenger trip planner now generates the selected Recommended journey's guide automatically after a successful search. Route cards, deterministic details and the MapLibre selection render independently of the AI request. The compact supporting card is titled **PAMANA AI Trip Guide**, with optional **Explain again**. Its loading and failure states affect only that card.

## Request flow and source of truth

`Find Best Route → deterministic journey results → Recommended selection/cards/map → post-render selected-journey watcher → authenticated PAMANA journey-explanation endpoint → OpenAI → backend validation → frontend validation → guide`.

The existing authenticated, bounded and rate-limited endpoint is reused. The journey explanation service explicitly selects OpenAI as requested, while unrelated legacy provider selection remains unchanged. The existing provider uses the Responses API, a strict structured output schema and `store: false`; the implementation was checked against [OpenAI's Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). The configured live model was `gpt-4o-mini`.

The frontend sends public origin/destination labels, ordered readable ride modes, pickup/drop-off names, supplied signboards, returned payable total and transfer count. Actual walking instruction text and an actual estimated wait window may be included; unknown service values are omitted. A second backend projection removes technical fields even when a legacy client sends a larger accepted DTO. IDs, route/variant codes, coordinates, geometry, distances, provenance, verification, confidence, research and scoring do not reach OpenAI. Partial walking duration is excluded because it is not total journey duration.

The AI never participates in routing, ranking, pricing, discount calculation, transfer counting or transport data writes. The fare engine, approved geometry/distances, eligibility, verification and Batch B category logic were not changed by Batch C. The existing `pamana-ai/explain.js` and provider/endpoint contract were audited; the separate legacy explanation path was retained.

## Prompt, validation and fallback

The prompt identifies PAMANA's passenger explanation assistant, restricts it to the supplied journey in ride order, treats strings as untrusted data, forbids choosing another route or computing/modifying fare/transfers, and forbids invented stops/signboards/services/ETA/wait/schedules/availability. It requests simple English, 2–4 short sentences, at most 120 words, exact supplied signboards, the returned fare and the supplied transfer count. It bans internal identifiers, metadata, raw fields, enums, tables and headings.

Backend and frontend guards reject obvious codes, database identifiers, internal enums/fields, technical provenance, HTML/URLs, oversized text, incorrect fares/transfers, unexpected numeric values and unknown time/wait/availability claims. They check ride modes, order and supplied signboards. Normal place-name abbreviations such as “Sta.” are preserved. Invalid text is rejected rather than displayed.

Missing keys, provider errors, rate limits, invalid responses and timeouts show “Trip guide is temporarily unavailable. Your route details are still shown above.” A short deterministic guide reuses Batch B presentation helpers and the returned fare/transfers. No provider errors, status codes, stack traces or credentials appear in the card. The frontend also bounds hung requests at 25 seconds; the existing provider has its own request timeout.

The first live OpenAI response omitted the supplied signboard. Validation correctly rejected it and the route remained usable. The prompt was strengthened to require every supplied signboard verbatim; subsequent required live cases displayed accepted guides. This rejection and the successful requests exercised both fallback and normal behavior.

## Cache and concurrent requests

The cache lives in the current page/search result session and keys entries by journey ID plus exact passenger facts. Only the initial Recommended option and options the passenger selects are requested automatically. Pending, successful and failed requests are reused when switching back, preventing automatic retry loops and repeated provider calls. Explain again aborts/replaces only the selected entry and explicitly regenerates it.

New searches and location changes abort and clear the cache. A search-generation counter and entry identity reject late responses after new searches or forced regeneration. Selection has its own key: completion for an off-screen option fills only that option's cache and cannot replace the displayed guide for another option. Unmount aborts outstanding work. AI explanations are not persisted to the database.

## Actual browser results

Used the existing Passenger account; the user signed in directly. Passwords and session tokens were not requested, read or recorded. All four required cases exercised live authenticated HTTP search, real Geoapify walking and real OpenAI generation. Initial guides required no Explain click.

| Selected journey | Returned payable fare | Transfers | Live result |
| --- | ---: | ---: | --- |
| PSU Mexico → SM City Pampanga, regular | ₱27 | 0 | Automatic accepted guide |
| Robinsons Starmills → PSU Mexico, regular | ₱28 | 0 | Automatic accepted guide |
| Robinsons Starmills → PSU Mexico, explicit Student | ₱23 | 0 | Automatic accepted guide |
| PSU → tricycle → Mexico Bayan → jeep → SM, regular | ₱114 | 1 | Automatic accepted guide after option selection |

Actual displayed direct guide:

> Ride the Jeep marked SM Pampanga from Pampanga State University Mexico Campus – Front Waiting Area and get off at SM City Pampanga Main Gate Drop-off Area. The estimated fare is ₱27 with no transfers.

Actual displayed regular inbound guide:

> Ride the Jeep marked SAN JUAN from Robinsons Starmills – Arayat Gate Return Loading Area and get off at Pampanga State University Mexico Campus – Front Waiting Area. The estimated fare is ₱28 with no transfers needed.

Actual displayed Student guide:

> Ride the Jeep marked SAN JUAN from Robinsons Starmills – Arayat Gate Return Loading Area and get off at Pampanga State University Mexico Campus – Front Waiting Area. After that, walk north, turn right onto the walkway, walk north on Mexico-Arayat Road, and then turn right. The estimated fare is ₱23 and no transfers are needed.

Actual displayed transfer guide:

> Ride the Tricycle from Pampanga State University Mexico Campus – Front Waiting Area and get off at Mexico Bayan – Sta. Monica Parish Church Transfer Area. Then transfer to the Jeep marked SM Pampanga and get off at SM City Pampanga Main Gate Drop-off Area. Walk northwest, turn left, walk west on SM Loading and Unloading Bay, and bear right onto 3/Jose Abad Santos Avenue. The estimated fare is ₱114 with 1 transfer.

Walking text in these examples came from returned walking instructions, not model estimates. The regular/Student values are not hardcoded in the prompt or service. Tests additionally exercise the real saved DTOs for PSU Student ₱22, transfer Student ₱111, onward Student ₱11 and undiscounted tricycle ₱100. These extra values were tested automatically, not all searched in the live browser.

The transfer selection changed map features, details and fare immediately while the guide alone showed loading. Returning to the direct option immediately restored its original cached text without another explanation POST; server logs showed only the initial direct and newly selected transfer requests until explicit regeneration. Explain again generated fresh direct wording. Mobile Explain again also generated an accepted ₱23 guide.

No route/variant code, database identifier, verification/provenance enum, unknown ETA, wait or availability appeared in the accepted guides. Duration/wait/service remain unknown in pilot data and are omitted. The disabled Fastest category remains unchanged.

Desktop review used 1440 × 1000; measured CSS viewport/document widths were 1309/1299. Phone review used 390 × 844; measured widths were 355/345, with no horizontal overflow. The phone layout stacked cards, map, route details and a wrapping compact guide. Map zoom remained usable, and regeneration did not replace deterministic results. The development overlay is visible in screenshots.

- [Desktop Student card, details and accepted guide](batch-c-screenshots/desktop-inbound-student.jpg)
- [Phone Student details and accepted guide](batch-c-screenshots/phone-student-guide.jpg)
- [Recorded actual browser texts and outcomes](batch-c-browser-results.json)

Local server recovery was needed during review: a restrictive backend host prevented retries from reaching the API, and one backend reload required Passenger sign-in again. Restoring the configured host resolved connectivity. After all required live cases passed, the frontend listener stopped; it was restarted and a fresh Passenger trip planner page loaded. The attempted final re-selection was interrupted, so that fresh page may require Find Best Route to show its results again.

## Validation and database safety

- Frontend: **98 tests passed, 0 failed**, covering Batch C's 12 tests, Batch B, fare contracts, approved geometry, MapLibre, REAL/SIMULATED isolation and applicable phase regressions. The separate trip-planner selection/camera contract script passed.
- Backend: **36 tests passed, 0 failed** in the combined C/B/A and phase 14/20/22 run. Batch C contributes 10 focused tests, Batch B 6 and Batch A 17; three legacy script suites also passed.
- Tests use actual saved pilot DTOs and actual page/composable/component code, and cover automatic selection/invocation, render-before-AI, per-guide loading, valid/invalid outputs, returned regular/discounted/transfer fares, cache and failure-cache reuse, explicit regeneration, stale selection/search/regeneration, timeout, empty/error states, no loops, minimal provider facts, auth/rate limits and key boundaries.
- Frontend production build passed after the implementation/validation changes. Backend production build passed; the later prompt-only wording amendment passed the service tests. Routine dependency/chunk/deprecation warnings did not fail either build.
- `git diff --check` passed in both repositories. New Batch C text files were checked for trailing whitespace.
- The configured OpenAI key was absent from all **245 scanned frontend source, script and built public asset files**. It remains backend-only; the frontend calls PAMANA's endpoint, never OpenAI directly. No literal key was printed or recorded.
- Final transport audit used a repeatable-read, read-only transaction and passed after the required browser cases. Digest remains **`0d24f4205ae5fd89c4e580a2e82afaaa9012bcbf94ad2455d63dfbd87c2d060a`**, unchanged from approved A.5B/B. Counts remain nodes 10, routes 8, variants 4, variant stops 8, fare rules 2 and service patterns 0; verification/planning counts also match.

Database evidence: `pamana-backend/documentation/batch-c-database-audit.json`. No new tables, migrations, transport record writes or persistent AI cache were added.

## Files changed for Batch C

Frontend implementation:

- `app/pages/passenger/trip-planner.vue` — automatic post-render guide invocation, regeneration wiring and compact component integration.
- `app/composables/useJourneyExplanation.ts` — current-search per-journey/facts cache, failure cache, timeout, cancellation and stale response protection.
- `app/services/journeyExplanation.ts` — minimal request, defense-in-depth display validation and deterministic Batch B fallback.
- `app/components/journey/PamanaTripGuide.vue` — new compact responsive guide/loading/fallback card.

Frontend validation/evidence:

- `scripts/test-batch-c-guide.mjs` — new C tests.
- `scripts/test-phase-20.mjs`, `scripts/test-phase-23.mjs`, `scripts/test-batch-a-contract.mjs` — update obsolete on-demand/full-payload/single-cache expectations while preserving deterministic contracts.
- `package.json` — `test:batch-c` command.
- This report, `batch-c-browser-results.json` and `batch-c-screenshots/`.

Backend implementation/validation:

- `src/services/pamana-ai/journey-explanation.js` — passenger prompt, OpenAI selection, minimal projection and validated result gate.
- `src/services/pamana-ai/passenger-guide.js` — new public-facts projection and deterministic output guard.
- `scripts/test-batch-c-guide.js` — new C provider/service/security tests.
- `scripts/test-phase-20-journey-explanation.js` — valid short passenger guide fixture.
- `package.json` — `test:batch-c` command.
- `documentation/batch-c-database-audit.json` — final read-only audit.

Remaining limitations: Geoapify still finds PSU under its old Don Honorio Ventura Technological State University alias; transport pickup names are correct. Pilot total time, wait and service availability remain unknown. AI wording can vary and invalid generations intentionally fall back; output guards are practical deterministic checks, not a general proof of every natural-language assertion. No blocking issue was found in the required accepted desktop/phone guide cases.
