# Phase 18B: passenger disruption presentation

The Phase 18B passenger changes preserve the existing PAMANA Trip Planner design. A remaining journey may carry normalized `DISRUPTION_WARNING` or `LIMITED_SERVICE` objects. The selected and unselected journey cards render these as compact amber advisories without exposing provider records or raw enum values.

When the unified API returns `NO_TRANSPORT_JOURNEY` together with `NO_JOURNEY_DUE_TO_ACTIVE_DISRUPTION`, the existing alert region explains that a verified closure or suspension affects the available connection.

Verified disruption geometry is converted to the provider-neutral map feature contract and passed through `PamanaMapPanel` to the existing MapLibre component. A dedicated `pamana-disruptions` GeoJSON source supports points, lines, and polygons. Null geometry draws nothing. Source refreshes use `setData` and contain no camera calls, so polling cannot reset a passenger's pan or zoom. Leaflet remains available as the compatibility renderer.

Disruptions affect PAMANA journey planning only through explicit structured transport relations and verified deterministic effects. Names, descriptions, and geographic proximity are not used to infer transport impact.
