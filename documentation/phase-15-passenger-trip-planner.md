# Phase 15 passenger trip planner

The existing PAMANA user interface is the visual source of truth for Phase 15. The journey-planning interface extends the current design system rather than replacing it.

The passenger Trip Planner sends resolved Phase 8 origin and destination coordinates to the authenticated `POST /api/pamana-ai/trip-plan` endpoint. The client sends only the locations, departure timestamp, and passenger fare category. Route variants, boarding nodes, fare facts, vehicle facts, service facts, and journey ordering remain server-owned.

Journey options use neutral numbering and preserve the order returned by the deterministic backend. Cards show each walking, transit, and transfer leg. Unknown fare, schedule, availability, ETA, and transit duration stay visibly unavailable. A headway is described as a typical service interval and is never presented as an arrival time.

The selected journey is adapted to provider-neutral map features. Geoapify walking geometry is dashed; verified PAMANA transit geometry is solid. Null transit geometry produces no line. Selecting a journey changes the map fit token once, while subsequent source updates do not reset the camera. Leaflet remains available through the existing compatibility path.

The production empty state is expected until verified planning nodes and eligible transport connections exist. Geoapify search results remain runtime geographic selections and are never written to Strapi or treated as verified PAMANA transport nodes.
