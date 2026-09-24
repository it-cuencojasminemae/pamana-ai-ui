# Phase 9: PAMANA transport nodes on MapLibre

Phase 9 reads transport infrastructure from the existing authenticated Strapi `GET /api/transport-nodes` endpoint. It adds no endpoint, schema, migration, seed, or database write.

## Passenger visibility

The request filters for `planning_enabled = true`, `data_mode = REAL`, and either `AUTHORITATIVE_CURRENT` or `FIELD_VERIFIED`. The frontend repeats the complete Phase 2 trust check before rendering: the record must also have a valid verification date, a source name, a source URL or reference, and usable coordinates. Null, invalid, and `(0, 0)` coordinates never become map features.

Research candidates and planning-disabled records remain outside the ordinary passenger map. Records that pass the trust rule but lack coordinates are counted as unmapped diagnostics; Phase 9 does not geocode, infer, repair, or save them. A separate research-map mode remains deferred.

## Presentation and selection

Normalized records use the `PAMANA_TRANSPORT_DB` source and become GeoJSON `Point` features. They render through the dedicated `pamana-transport-nodes` MapLibre source and node-specific circle/symbol layers. Updates call `setData`; they do not recreate the map or move the camera.

Node selection displays the name, node type, verification state, data mode, planning availability, and source summary. Geoapify origin/destination results retain their separate `GEOAPIFY` source, geographic marker semantics, and “Geographic place selection” description.

The Nearby stops panel sorts visible nodes by straight-line geographic distance from the browser location. This is display-only proximity, not a boarding, route, transfer, or journey recommendation.

## Failure behavior

Transport-node loading is independent of live-vehicle loading and the base map. Unauthorized or unavailable node requests show a sanitized passenger message while the map, user location, location search, and vehicle data continue to work.

## Deferred work

Phase 9 does not add routing, route geometry, nearest-pickup decisions, transfer logic, fare or ETA calculations, Strapi writes, or a journey engine. Leaflet remains installed and available through `PamanaMapPanel` as the compatibility renderer.
