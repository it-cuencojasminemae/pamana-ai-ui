# Phase 18A: structured disruption management

The existing LGU Disruptions page now records deterministic disruption effects against exact PAMANA `Route`, `RouteVariant`, and `TransportNode` document IDs. Choosing a route filters the variant selector. Labels help LGU users select records, but labels, description text, map coordinates, and proximity never create the backend relation.

The form preserves the current PAMANA visual system and supports disruption type, severity, effect, explicit targets, active time window, `REAL`/`SIMULATED` mode, evidence, notes, and optional validated GeoJSON. Administrator users also see verification status, verification time, and planning-eligibility controls. LGU users cannot elevate verification or planning eligibility through the client or backend.

Resolving a disruption records both a structured resolution timestamp and required resolution details. Existing location markers remain available for legacy latitude/longitude records. No missing geometry is invented.

Phase 18A does not change the passenger Trip Planner, its response types, map presentation, journey graph, or route selection. The interface labels disruption-aware planning as pending Phase 18B.
