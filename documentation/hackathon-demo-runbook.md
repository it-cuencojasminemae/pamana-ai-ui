# PAMANA presenter runbook

Aim for roughly 5–8 minutes. This is a suggested rehearsal duration, not an official event limit. Use PAMANA's normal menus and existing visual design.

## Before demo

- Start the local backend, frontend and PostgreSQL. In `pamana-backend`, run `npm run demo:check`, then `npm run demo:rehearse`. The latter is a read-only engine rehearsal with in-memory disruption/AI fixtures, not live provider acceptance.
- Require pilot digest `3d63fcdb5d9581d71e2c68d54db9c00868510dcc9b91e6e38fcb893373af9139` and planning counts 3 routes, 4 variants, 4 eligible coordinate-bearing nodes. STOP on an unexpected mismatch.
- For simulation, explicitly set the existing local backend `PAMANA_DEMO_MODE_ENABLED=true` and frontend `NUXT_PUBLIC_PAMANA_DEMO_MODE_ENABLED=true`, then restart. Defaults stay disabled. Do not expose secrets on screen.
- Prepare normal authenticated Passenger, LGU and Administrator accounts. Never show passwords. Phase 26 authenticated rehearsal passed on 2026-10-04 for all three roles, including live Geoapify journeys, Gemini direct/transfer guides and demo-ON Passenger/LGU maps. Recheck providers before each presentation because availability/quota can change.
- Use matching page/API hosts. For a desktop localhost session, temporarily set the frontend process's `NUXT_PUBLIC_API_URL=http://localhost:1337`. For the phone LAN session, use the configured LAN address for both page and API. A localhost page with a LAN API prevents the existing SameSite=Lax refresh cookie from being sent after access-token expiry. Do not weaken cookie security to fix a host mismatch. The original local configuration and demo flags were restored after rehearsal; the unrelated `nuxt.config.ts` LAN edit remains untouched.
- Keep factual journey cards and this runbook available if an external provider fails. Do not use mock screenshots as a claim of a live API success.

## Passenger story — about 2½ minutes

Say: “PAMANA helps passengers find locally evidenced transport options from a less-central origin toward San Fernando. The journey engine is deterministic.”

1. Passenger dashboard → Trip Planner. Search PSU Mexico / Pampanga State University Mexico Campus as origin and SM City Pampanga as destination. Select real suggestions with address context. Use REGULAR category for the known-fare example.
2. Plan Journey. Inspect the actual result: direct outbound to the verified SM Main Gate drop-off, PHP 30 known fare. Show walking access/egress only when supplied by the normal walking service.
3. Select the one-transfer option via Mexico Bayan / Sta. Monica: tricycle, transfer, then SM-bound jeepney. Point out PARTIAL fare: PHP 14 known subtotal; the first leg and total remain unknown.
4. Show the selected journey on MapLibre. Walking is dashed. A solid approximate road path is an optional Geoapify presentation aid, with its notice; it is not verified jeepney geometry. Unknown transit geometry remains null.
5. Open Report an issue with this journey → My Reports. Say: “Passenger feedback is evidence for review; it does not automatically change routes, occupancy or official disruptions.” Leave a fictional demonstration report unsent.
6. Search Robinsons Starmills → PSU Mexico and inspect the independent inbound SAN JUAN service. Do not reverse the outbound route. Return fare remains unknown.

If a search resolves to an inappropriate entrance, choose a better specific suggestion; never edit coordinates or transport records to force the story.

## AI explanation — about 30 seconds

Click Explain this trip on the selected factual journey. The frontend uses the provider-neutral backend flow; the local checker currently reports **GEMINI CONFIGURED**. It may use OpenAI if explicitly configured later through the existing server selector.

Say: “AI explains this factual result. It does not calculate routes or supply missing fares, schedules or arrival times.”

If unavailable, leave the factual cards visible and say: “The AI explanation is an assistance layer. The factual journey is computed independently.” Retry after recovery; do not claim a mocked failure test proves live AI success.

## Live/simulated operations — about 1 minute

Passenger Live Map or LGU Live Mobility shows **SIMULATED DEMO · NOT REAL TRANSPORT DATA** only after explicit opt-in.

1. Choose Live simulated clock. Pan/zoom manually; refresh or wait at least one 15-second polling tick. Camera should stay in place.
2. Use Available → Near full → Full. Show the synthetic variant ID, freshness and occupancy label. These offshore samples are not jeeps operating in Pampanga and do not change REAL journey availability or generate an ETA.
3. Press Reset simulation; choose Live simulated clock to resume movement. No operational record is written.

The existing `/dev/live-vehicle-preview` is a clearly labeled development-only fallback for layout, stale diagnostics and camera checks. It is not a substitute for authenticated production-page acceptance or REAL vehicle coverage.

## LGU story — about 1 minute

Normal LGU login → dashboard → Live Mobility → Disruptions → Transport Data.

Show explicit route/variant/node targets and evidence metadata. Do not save an invented official incident or alter pilot records. Present `demo:rehearse` output as a **temporary in-memory engine demonstration**: suspend direct outbound, retain transfer and unrelated inbound, then reset by removing the fixture. No disruption remains active in PostgreSQL.

## Admin/verification story — about 1 minute

Normal Administrator login → Transport Data. Inspect TransportNodes, Routes, directional RouteVariants, ordered stops, fare and service fields, verification status and evidence. Read-only demonstration is acceptable. Do not press save simply to show CRUD.

Say: “These tools support maintaining local transport knowledge. The pilot has field-verified project-team evidence; this does not assert government verification of every route.”

## Known limitations

- Phase 24.5 stays OPEN: no genuine REAL Driver/Vehicle assignment is accepted, REAL trip/GPS/occupancy lifecycle is unaccepted, and phone GPS needs trusted HTTPS. Existing Driver UI/screenshots or clearly synthetic fixtures may illustrate capability without claiming field acceptance.
- Geoapify handles geography, not jeepney truth. Search, walking, basemap and approximate road paths need network/provider access. New journeys needing walking can fail if routing is unavailable. Do not invent geography or straight transit lines.
- AI and approximate paths can fail without destroying the existing factual journey. A style/tile error means the map is unavailable; use the readable error and factual cards.
- Unknown timetable, wait, ETA, discounted or return fare stays unknown. PAMANA does not claim exact arrival prediction or Pampanga-wide live jeep coverage.
- Phase 26 authenticated role/provider and phone-size checks passed. Passenger reporting was inspected through the contextual form and My Reports; a fictional live report was not submitted because no safe cleanup workflow exists. Submission/ownership/isolation were verified with mocked controller tests. LGU user hide/return resumed correctly; hidden-request cancellation and pause/resume are also verified by the actual page-handler regression.

## Reset

Reset simulation to 0 seconds or resume the live simulated clock. Clear/reselect locations or refresh Trip Planner to reset selection; fit/recenter only by explicit user intent. Retry failed AI on demand. Re-run the disruption rehearsal without its in-memory effect. Leave fictional reports unsent and administrative forms unsaved. Turn both local demo flags off and restart after presenting. No database restoration, pilot mutation or new REAL operational record is required.

See [Phase 26 scenario and validation record](phase-26-hackathon-demo-scenarios.md) for acceptance evidence, boundaries and detailed fallbacks. Stop after Phase 26; push and Phase 27 deployment require separate authorization.
