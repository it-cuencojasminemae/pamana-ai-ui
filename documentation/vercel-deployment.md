# First Vercel preview deployment

PAMANA uses Nuxt 4 SSR on Vercel, the Strapi 5 API on Render, and PostgreSQL on
Neon behind Strapi. The frontend never connects to Neon or an AI provider.

## Project settings

| Setting | Value |
| --- | --- |
| Framework preset | Nuxt |
| Root Directory | Repository root |
| Node.js version | 22.x (Nuxt requires at least 22.19.0) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Leave the framework default; this is an SSR application |
| SSR function runtime | Standard Nitro `nodejs22.x` |

Validation uses the official, SHA-256-verified Node 22.23.3 Windows runtime and
npm 11.12.1. Vercel supplies its current Node 22 patch version, so do not assume
the patch number is identical. Select 22.x explicitly in Project Settings;
Vercel's default for a new project can be a newer LTS major. There is no
`engines.node` override in this manifest. See
[Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
and [Nuxt on Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt).

Installed Nitro 2.13.4 supports Vercel Node majors 18, 20 and 22 in its preset
generator. It selects 22 when built on Node 22; a Node 24 local build also falls
back to 22. Keep the standard preset: no runtime override or `vercel.json` is
needed. The local explicit validation command is
`npm run build -- --preset=vercel`; Vercel detects its environment automatically.
Inspect `.vercel/output/config.json` (Build Output API version 3) and
`.vercel/output/functions/__fallback.func/.vc-config.json` after that build.
The node-server build is used separately for local production HTTP smoke tests.

## Environment configuration

Set the following in the intended Vercel Preview environment and separately in
Production when ready. Public variables are browser-visible.

| Name | Purpose |
| --- | --- |
| `NUXT_PUBLIC_API_URL` | Render HTTPS origin, with no trailing slash or `/api` suffix |
| `NUXT_PUBLIC_GEOAPIFY_API_KEY` | Approved, restricted browser key |
| `NUXT_PUBLIC_GEOAPIFY_MAP_STYLE` | Style identifier; use `osm-carto` |
| `NUXT_PUBLIC_DEMO_MODE` | Keep the intended prototype disclosure enabled by default |
| `NUXT_PUBLIC_PAMANA_DEMO_MODE_ENABLED` | Keep the simulated live feed opt-in disabled by default |

The expected API format is `https://<actual-render-backend>.onrender.com`.
Services append `/api/...` through `useApi`, using `runtimeConfig.public.apiUrl`.
The localhost fallback in `nuxt.config.ts` is for development. No source edit is
needed for deployment. The legacy `NUXT_PUBLIC_CARTO_BASEMAP_KEY` is unused by
the active MapLibre stack and need not be configured.

Do not set OpenAI keys, Neon/database credentials, Strapi APP_KEYS, JWT secrets
or backend tokens in this frontend project or any `NUXT_PUBLIC_` variable.
Keep `.env` local and ignored. Geoapify is intentionally used in the browser;
restrict its key to the actual approved preview/production origins or referrers
and the needed maps/search/routing APIs where supported by the provider. A
missing key produces the tested map-unavailable state. Do not reuse a backend
provider key as the public browser key.

## Render integration and sessions

Add each actual frontend origin to the backend's `CORS_ORIGINS` allowlist, for
example `https://<actual-project>.vercel.app`. An origin has a scheme and host,
with no path or trailing slash. Preview deployment hostnames can change; allow
the exact preview origin used for testing as well as any stable project origin.
Credentialed requests cannot use `Access-Control-Allow-Origin: *`. The backend
must return the exact allowed origin and `Access-Control-Allow-Credentials: true`,
allow `Authorization` and `Content-Type` headers, and handle OPTIONS preflights
and the application methods (GET, POST, PUT, DELETE, and PATCH if used).

Frontend login, refresh and logout use `credentials: include`; access tokens are
restored client-side and role middleware remains intact. Backend authorization
is authoritative. The current backend CORS middleware enables credentials, but
its default allowlist only covers local development. Its refresh-cookie fallback
is SameSite=Lax. For the initial cross-site Vercel/Render hosts, the backend must
configure HttpOnly, Secure, SameSite=None refresh cookies with a compatible path
and domain, and clear them with matching attributes on logout. Lax cookies do
not support this cross-site credentialed refresh flow. Even None/Secure cookies
can be blocked by browser third-party-cookie policies; test the actual preview
in the target browsers. A same-site custom-domain arrangement may be needed
for reliable persistent sessions. This preparation does not change the backend.

Before accepting the deployed integration, verify real login, refresh after
expiry, reload/session restoration, logout and the four role boundaries. Local
fixture results and HTTP 200 protected SSR shells are not proof of live
authorization, cross-site cookies, provider access or real-device GPS acceptance.
Existing Phase 24.5 real-device Driver/GPS acceptance remains open.

## Portable and optional validation

```sh
npm ci
npm ls --depth=0
npm test
npm run build
npm run test:production-smoke
npm run build -- --preset=vercel
git diff --check
```

`npm test` includes every portable Node regression script plus the standalone
trip-selection/camera contract. Nuxt prepares its component registry during
`npm ci`. Tests use committed transport-only checkpoints described in
`scripts/fixtures/README.md`; no sibling checkout, database credentials, backend
packages or ignored acceptance JSON are needed. Map worker and CSS remain
client-side, coordinates stay unchanged for colocated markers, selected markers
have priority, and ordinary feature updates do not reset the camera.

Opt-in checks are separate:

- `npm run test:integration:backend` needs a sibling `pamana-backend` checkout
  with its required packages installed. It directly exercises the backend fare
  orchestrator with injected services and verifies transport permissions. It
  does not call the database, router provider or AI provider.
- `npm run test:integration:database` (legacy alias `test:phase-6-db`) also needs
  the backend `.env`, `pg` and a reachable intended database. It starts a
  read-only transaction. This historical Phase 6 checkpoint expects null transit
  geometry and the old pilot digest; it is not an acceptance test for the later
  approved Batch A5B geometry. Run only against that checkpoint or deliberately
  advance its independently approved expectations. It is not required for a
  frontend clone and was not run during this preparation.
- `npm run test:production-smoke` requires a preceding node-server build. It
  renders public routes and protected shells and verifies all five development
  preview routes return 404, without requesting provider access.

The disruption-empty-state regression now tests the backend's existing
`NO_TRANSPORT_JOURNEY` plus `NO_JOURNEY_DUE_TO_ACTIVE_DISRUPTION` warning. The
message advises retrying after the disruption clears. Generic empty, loading
and failure states remain distinct; route advisories and maps are preserved.

## Evidence and local artifacts

The existing Batch B/C screenshots were reviewed: visible account information
belongs to the intentional test account, with no passwords, tokens or provider
keys. They are historical UI evidence, not new deployment acceptance. The saved
browser-result JSON contains guide examples rather than sessions or credentials.
Recovery copies, install/build/test logs, audit JSON, the portable validation
snapshot and the downloaded runtime stay under ignored `.cache/`. Nuxt output,
dependencies, `.vercel/` and `coverage/` stay ignored.

Dependency audit findings and their production relevance are documented in
[dependency-audit.md](dependency-audit.md). Audit exit status is recorded
separately from build/test status; findings have not been hidden or force-fixed.
