# Phase 16 simulated live map

The passenger Live Map can display the separate Phase 16 simulator only when `NUXT_PUBLIC_PAMANA_DEMO_MODE_ENABLED=true`. This browser setting controls whether the UI requests the feed; it cannot enable simulation. The backend still requires its independent, server-only `PAMANA_DEMO_MODE_ENABLED=true` gate and authenticated permission.

> Simulated operational activity exists only to demonstrate PAMANA's live system behavior. It does not convert unverified transport routes, stops, fares, schedules, or vehicle activity into real passenger guidance.

Simulated snapshots are normalized into the existing provider-neutral `MapPointFeature` contract with `semantic: "vehicle"`, `dataMode: "SIMULATED"`, and `simulation: true`. They flow through the existing MapLibre GeoJSON source and `setData()` update path. A vehicle refresh does not initialize a new map, call `fitBounds`, or move the camera. The map excludes vehicle markers from automatic fitting.

The existing Passenger UI remains the visual source of truth. When simulation is visible it shows a `SIMULATED DEMO · NOT REAL TRANSPORT DATA` label, separate REAL and SIMULATED active counts, occupancy, trip state, and stale-location status. The ordinary production feed and its error state remain independent.

`/dev/live-vehicle-preview` is development-only and uses the same offshore synthetic coordinates as a local visual fixture. It provides Start, Pause, Reset, Advance 15 seconds, occupancy, stale diagnostic, and 360px viewport controls. It never authenticates around the backend, writes transport data, or represents its corridor as Pampanga transport truth.

Phase 16 leaves the current production limitation intact: there are no planning-enabled routes, variants, or nodes, and simulated vehicles never supply production journey availability or passenger guidance.
