# Phase 17 — Driver route and live trip UI

The existing PAMANA Driver dashboard remains the visual source of truth. Phase 17 keeps its glass cards, rounded controls, lime/emerald accents, typography, spacing, and navigation while replacing the legacy route/direction assumptions.

## Driver flow

1. The dashboard loads the authenticated driver's assigned Vehicle, Route, and server-eligible directional RouteVariants.
2. Route and direction controls use human-readable names, endpoints, direction, and verified signboard text.
3. Starting sends only the selected RouteVariant document ID. Server-owned Driver, Vehicle, Route, direction, data mode, and timestamps are never supplied by the client.
4. Current Trip lists the selected RouteVariant's stored stop sequence exactly as supplied.
5. The shared geolocation composable publishes a fresh browser position at most every 15 seconds while Current Trip is mounted.
6. Occupancy count controls send an observed passenger count; the backend validates capacity and derives the normalized state.
7. End Trip completes the authenticated driver's active trip and stops location tracking.

## Map behavior

Current Trip now uses the existing MapLibre/Geoapify map stack. Only coordinate-bearing nodes from the selected RouteVariant render. A transit line renders only when that variant already has supplied LineString geometry. Stop order is never connected into invented geometry, and inbound stops are never produced by reversing outbound stops.

The trip document ID is the camera fit token, so the initial selected trip can fit once. Subsequent browser GPS fixes update the shared GeoJSON source without changing the camera. Leaflet remains installed as compatibility support.

## States and limitations

Location denial and GPS publication failures produce readable status text and do not crash or end the Trip. REAL and SIMULATED badges remain visible. Phase 16 demo simulation is not imported into Driver pages.

There are currently zero planning-enabled production variants in the Mexico–San Fernando research dataset. Drivers therefore see the honest empty state until authorized reviewers verify and enable real transport truth in a later workflow.
