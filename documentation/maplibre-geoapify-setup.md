# Phase 6 — MapLibre GL JS + Geoapify setup

Phase 7 builds on this historical setup: see [the passenger renderer documentation](phase-7-maplibre-passenger-map.md). Its client-only renderer now connects the loader/error contracts and supplies Vite's bundled MapLibre 6 worker URL. Phase 6 scope statements below describe the original checkpoint.

Decision recorded 2026-09-23. The selected platform is **MapLibre GL JS + Geoapify + PAMANA's verified transport database**, not Google Maps Platform. This supersedes provider choices in the original revision roadmap, not historic Street View evidence. Separation of rendering, external geography and locally verified transport truth is the reason for this change; it is not a promise of unlimited free services.

## Ownership and scope

| System | Responsibility | Must not do |
| --- | --- | --- |
| MapLibre GL JS | Browser rendering, markers, GeoJSON layers, camera/bounds, route/vehicle/disruption visualization | Decide which jeepney to ride |
| Geoapify | Styles/tiles, geocoding, reverse geocoding, autocomplete, POIs, walking and geographic road routing | Establish jeepney routes, transport bays, fares, timetables or planning eligibility |
| PAMANA database | Transport routes/variants, verified boarding/alighting/transfer points, signboards, fares, service, disruptions and local instructions | Treat provider POIs or driving paths as field-verified transport evidence |

A mall POI can identify a destination. It does not prove San Juan passengers alight at that coordinate. PAMANA remains the authoritative application source for transport facts, but its research records still fail the planning gate. Geoapify results carry `authority: EXTERNAL_GEOGRAPHY`; no service method writes to Strapi or promotes evidence.

Phase 6 installs foundations only. **No MapLibre component/map instance, autocomplete UI, geometry generation, journey engine, passenger activation, database migration or Phase 7 work.** Leaflet 1.9.4, its CSS, `PamanaLeafletMap`, `PamanaMapPanel`, and existing passenger/driver/LGU pages remain unchanged. `PamanaMapPanel` remains the presentation boundary: its current props are plain data, not Leaflet objects. MapLibre 6.11.1 is installed directly, with no Vue wrapper.

## Configuration and manual account steps

1. Register/sign in at [Geoapify MyProjects](https://myprojects.geoapify.com/) and create a PAMANA project.
2. Open API Keys. Use separate development/production keys where practical.
3. Configure allowed HTTP referrers/origins for localhost and the actual deployed domain as appropriate. Geoapify also documents IP and CORS settings; use its console's current syntax. Browser keys are visible to users and network tools, not secrets protected by `.env` alone. Restrictions reduce abuse; they are not user authentication. [Provider key guidance](https://apidocs.geoapify.com/docs/geocoding/)
4. Set these locally in the ignored frontend `.env`; never paste a real key into source, documentation, screenshots, issues or test output:

```dotenv
NUXT_PUBLIC_GEOAPIFY_API_KEY=
NUXT_PUBLIC_GEOAPIFY_MAP_STYLE=
```

Both are optional for Phase 6. Nuxt maps them to `runtimeConfig.public.geoapifyApiKey` and `geoapifyMapStyle`, using empty defaults. Existing `apiUrl`, `demoMode` and `cartoBasemapKey` are preserved. No backend key is required or added: server-side provider integration is not implemented. OpenAI/Gemini, database, JWT and Strapi credentials remain backend-only.

`geoapifyMapStyle` is a Geoapify style **identifier**, not a URL. Blank selects `osm-carto` when a key exists; for example `positron` can be configured instead. Unknown style names may fail at the provider; arbitrary URLs/query strings are rejected to avoid forwarding the key elsewhere. Supported styles and attribution requirements are listed in [Geoapify Maps documentation](https://apidocs.geoapify.com/docs/maps/). Phase 7 must preserve provider/OSM attribution and make transport overlays more prominent than the basemap.

For local setup: `npm ci`, configure `.env` if desired, then `npm run dev`. Nuxt dev/build loads `.env`; deployed production servers need the `NUXT_PUBLIC_*` values supplied by their process/hosting environment. Missing config is a normal disabled state, not a startup failure. No request occurs merely by opening existing pages.

## Modules and lifecycle

- `app/services/mapConfiguration.ts`: validated optional configuration; fixed Geoapify style host; no logging.
- `app/services/mapLibreLoader.ts`: dynamic JS/CSS loading only after a browser/config check, deduplicated concurrent imports, `idle/ssr/unconfigured/loading/ready/error/disposed` states, sanitized failures, disposal that ignores late imports. `ready` means library loaded, **not map rendered**.
- `app/composables/useMapLibre.ts`: Nuxt config and readonly Vue state adapter; scope disposal. No automatic initialization. Phase 7 will own the DOM container, instantiate/remove the map and markers, remove event listeners, and connect map errors to `reportRenderFailure` (`TILE_LOAD_FAILED` / `MAP_INITIALIZATION_FAILED`). Those error-reporting contracts are prepared and unit-tested, not wired to a nonexistent map.
- `app/services/geoapify.ts`: reusable opt-in client for autocomplete, forward/reverse geocoding, category/radius POI search and walk/drive geographic routing. Fixed HTTPS API origin, URL-encoded parameters, no auth tokens/cookies, no redirects, bounded timeout, AbortSignal cancellation, no automatic retries. Returns typed success/failure results rather than throwing provider details into the app. No external calls in tests.
- `app/composables/useGeoapify.ts`: injects runtime config only. Future UI callers must debounce search, cancel stale requests/on-unmount and show local error states. It does not use `useApi` because PAMANA authentication refresh/logout must never be triggered by provider errors.

Missing/invalid config, HTTP authorization errors, rate limits, malformed responses, network errors, timeout and cancellation are distinct redacted error codes. Raw errors/URLs can contain keys and must not be logged. These local failures must not navigate away, log out a user, or disable unrelated dashboard/API functions. There is no Nominatim autocomplete fallback.

## GeoJSON presentation contract

`app/types/map.ts` uses standard `Point`, `LineString`, `Feature` and `FeatureCollection` (plus polygon/multipolygon disruption areas). Coordinates are `[longitude, latitude]`. Unknown coordinates produce **no feature**, never `[0,0]`, a centroid or a guessed line. This is a renderer-neutral presentation contract, not a future journey API response model.

Semantic roles: passenger, pickup, dropoff, stop, transfer, terminal, vehicle, destination, walking-route, transport-route, disruption. Features can carry record/leg IDs, source, verification and REAL/SIMULATED labels; selected leg is an ID, not a MapLibre layer object. Final styles are deferred. Walking/road Geoapify responses remain external geography and must be validated/adapted before presentation; driving geometry must never silently become jeepney geometry. Neither provider supplies a verified stop sequence.

The four Phase 5A/5B passenger nodes and both direct variants remain planning-disabled and coordinate/geometry-null. No fields are renamed or migrated; legacy `google_place_id` schema fields remain untouched and unused by this setup.

## Cost, attribution and future phases

Geoapify has a credit-based free tier and paid plans. Requests, tiles and routing can have different credit costs/rate limits. Check [current pricing](https://www.geoapify.com/pricing/) and project usage before deployment; do not encode a quota or price assumption in application logic. Future work should debounce/cancel searches, avoid duplicate route calls and preserve attribution. No paid subscription or account change was performed here.

Phase 7: MapLibre renderer and map error/cleanup wiring. Later search phases: Geoapify autocomplete/POI resolution. Later walking phases: geographic connectors. PAMANA's independently verified database and journey engine decide public-transport legs; provider road routing never recommends a San Juan jeepney. Leaflet removal happens only after replacement validation.

## Validation

`npm run test:phase-6` uses only synthetic inputs/mocked requests and checks dependency installation, public-config allowlist, empty-key behavior, SSR-safe loader lifecycle, error isolation and unchanged Leaflet code. Node 24 runs these TypeScript imports with built-in type stripping.

`npm run test:phase-6-db` is an optional **workspace-only read-only** regression: it expects sibling `pamana-backend` and its ignored `.env`, and asserts Phase 5B facts/planning remain unchanged. Backend credentials are neither copied into frontend configuration nor included in its bundle. Normal frontend build/runtime does not need this test or backend environment file.

Also run prior Phase 1–5B suites, eligibility/planning gates, time slots, frontend selection tests and both builds. No Geoapify key is required for these checks. Live key restrictions, quota/attribution settings and real tile/network behavior must be checked manually when Phase 7 is authorized.

After a production build, `npm run test:phase-6-smoke` starts and stops a local Nuxt server with empty Geoapify configuration. It checks login/registration SSR and protected map-page responses without a provider request. This is not a browser/WebGL rendering test; the actual MapLibre renderer is deliberately deferred.

Dependency audit at setup reported 38 existing advisories (2 high, 35 moderate, 1 low), in the unchanged Tiptap/SVGO/esbuild dependency trees. No pre-existing package versions were changed by installation, and no MapLibre advisory was reported. Review/remediate those separately; do not use an indiscriminate audit fix as part of mapping setup.

### Completion evidence — 2026-09-23

- Phase 6 mocked unit tests, missing-key production SSR smoke checks, read-only database checks, frontend selection tests and Phase 1–5B regression suites passed (including prior transactional database tests with fixtures rolled back).
- Backend and frontend production builds passed. New service/GeoJSON modules passed a strict standalone TypeScript check. Nuxt emitted non-blocking plugin-timing and dependency export-deprecation warnings.
- Database before/after full-row digest: `77776e1a08d971a39b2718a10a116c7748e452900f26931dfbc90acd0377fdae`. Routes 7, nodes 10, variants 2, variant stops/fares/service patterns 0. Planning-enabled routes/nodes/variants remain 0. No migration, startup backfill, persistent database writes or coordinates/geometry were introduced.
- Root workspace roadmap `PAMANA_UPDATED_SYSTEM_REVISION_PHASES_V2.md` was updated to the new provider choice. That workspace file is outside both Git repositories; this committed document is the repository's durable platform decision. Archived research/Street View evidence was preserved.
