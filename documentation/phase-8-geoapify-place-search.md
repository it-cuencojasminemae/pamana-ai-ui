# Phase 8 — Geoapify place search

Phase 8 adds runtime-only geographic origin and destination selection. Geoapify results are normalized to `SelectedLocation` objects and rendered as external geography on the Phase 7 MapLibre map. They are never treated as PAMANA transport nodes or written to Strapi.

## API behavior

- Address suggestions use `/v1/geocode/autocomplete` with `format=geojson`, `filter=countrycode:ph`, a Pampanga proximity ranking bias, English labels, and a six-result limit.
- Dashboard query strings and quick-place text use `/v1/geocode/search` before becoming resolved selections.
- GPS remains the coordinate authority for Current Location. `/v1/geocode/reverse` may enrich its display address, but a reverse-geocoding failure does not invalidate GPS.
- Autocomplete waits 320 ms, requires two characters, aborts stale requests, ignores stale responses, caches exact normalized queries, and caps rendered suggestions at eight.

## UI behavior

`PamanaLocationSearch.vue` supports origin and destination modes, `v-model`, clearing, loading and no-result states, sanitized failures, keyboard navigation, and ARIA combobox/listbox semantics. Editing selected text clears its resolved coordinate object until another suggestion is chosen.

The passenger trip planner requires two resolved locations before its existing compatibility route search can run. Phase 8 does not add route calculation, nearest-stop lookup, transport-node rendering, fare, ETA, or walking/road geometry.

## Live smoke test — 2026-09-24

Tested with the local browser-visible Geoapify key through `/dev/location-search-preview`:

- `SM City Pampanga` returned selectable San Fernando/Mexico Pampanga results and updated the destination marker.
- `Robinsons Starmills Pampanga` returned selectable San Fernando Pampanga results and updated the marker.
- `Pampanga State University Mexico Campus` returned the Mexico campus under Geoapify's current Don Honorio Ventura university naming; the Mexico, Pampanga result was selectable and mapped.
- `Sta. Monica Parish Church Mexico Pampanga` returned Sta. Monica Parish in Mexico, Pampanga and updated the marker.
- Arrow/Enter keyboard selection worked.
- Browser location denial displayed a safe search fallback and did not crash or invalidate the map.
- The MapLibre map remained `READY`; console warnings and errors were zero after the final fix.
- No 401/403 authorization errors appeared and no API key appeared in console logs.

No provider response was stored in the database. Read-only Phase 3–6 database checks passed with the Phase 5B transport digest unchanged.
