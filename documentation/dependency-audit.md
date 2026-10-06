# Deployment dependency audit, 2026-10-06

`npm audit --omit=dev` reports **60 affected package entries: 6 critical,
17 high, 36 moderate and 1 low** for the current lockfile. This is a refreshed
registry result, superseding the earlier audit with no critical entries. The
audit counts propagated parent entries as well as underlying advisories; six
critical entries do not mean six independently exploitable application flaws.
The raw result remains local in `.cache/readiness-audit-production.json`.

Nuxt packages include build/development tools in production dependencies, so
`--omit=dev` is not equivalent to inspecting the deployed SSR bundle.

| Direct dependency / affected transitive package | Severity | Compatible patch and remediation | Likely relevance in PAMANA |
| --- | --- | --- | --- |
| `nuxt` 4.5.2 → devtools → `simple-git` 3.36.0 / `@simple-git/argv-parser` 1.1.1 | Critical, propagated through Nuxt tooling | Parser fixed in 2.0.1; simple-git trailer guard fixed in 4.0.1, with later parser updates needed. No newer simple-git 3.x exists in the checked registry. Requires an upstream tooling change/major dependency review, not a Nuxt 3 downgrade. | Git operation guard bypasses need attacker-controlled Git arguments/config/environment. No frontend app or SSR API performs Git operations. Devtools/build chain risk remains for untrusted checkouts or build inputs. |
| `vue` 3.5.41 → `@vue/server-renderer` 3.5.41 | High | 3.5.42 exists and fits the current Vue 3 ranges; update aligned Vue packages together and revalidate. | Deployed SSR uses the renderer. The advisory concerns attacker-controlled attribute names with CR; PAMANA does not deliberately accept arbitrary attribute-name objects from its API. This is a runtime dependency that merits prompt patching. |
| `nuxt` → `devalue` 5.9.1 | High / moderate / low advisories | Patched 5.9.3+ fits `^5.9.0`; registry also has 5.9.4. No Nuxt major change required. | Nuxt SSR payload serialization is deployed. Shared-memory, sparse-array and adversarial serialization inputs are relevant if application state can contain those shapes. No such request-to-state path was demonstrated here. |
| `nuxt` → `undici` 8.10.0 | High / moderate / low advisories | 8.10.2+ fits `^8.10.0`; registry has 8.11.2. No Nuxt major change required. | Review if adding server-side fetch, WebSockets, shared caching/retry interceptors or BalancedPool. Current Strapi access is through browser `$fetch`; no app code configures these affected undici features. |
| `@nuxt/ui` → `@tiptap/core` 3.30.3 / `prosemirror-view` 1.42.2 | High (plus moderate) | Audit identifies compatible updates; fixed thresholds 3.30.5 and 1.42.3 respectively. No Nuxt major change required. | No Tiptap editor is used in this app. Markdown parsing/attribute merging and editor paste paths are not exposed by current screens. Reassess if adopting the editor. |
| Nuxt/UI build chain → `svgo` 4.0.2 / `source-map-js` 1.2.1 | High | Fixed thresholds 4.1.0 and 1.2.2; compatible updates indicated by audit. | SVG sanitization and malicious indexed source-map inputs. Source assets are repository-controlled; PAMANA does not use SVGO as a sanitizer for user uploads. |
| Nuxt/Nitro build chain → `brace-expansion` 5.0.9 / nested 2.1.4, `braces` 3.0.3 | High (plus moderate) | Brace-expansion fixed thresholds 5.0.12 / 2.1.7 fit their majors. Braces advisory covers all published versions in this audit; parent dependency changes may be needed despite npm's `fixAvailable: true`. | Pattern recursion/expansion denial of service, chiefly build-time globbing. No app feature submits untrusted patterns to these libraries. |
| Nuxt/Nitro `listhen` → `node-forge` 1.4.0 | High | Latest registry version checked is still 1.4.0; no fixed node-forge release identified. npm's aggregate remedy downgrades Nuxt and is unsuitable. | PKCS#1 signature verification. No application feature performs forge RSA verification; local TLS tooling is distinct from Vercel's managed HTTPS. |

Remaining moderate entries include propagated tooling dependencies. The full
machine-readable audit records their ranges and advisory links. There are no
active Leaflet dependencies. Package installation remains exactly lockfile-based;
no audit fix, forced remediation, dependency override, major upgrade or Nuxt
downgrade was applied. Compatible runtime patches are a separate, reviewable
follow-up rather than a hidden install-time dependency change.

The production output must also be checked for absence of Git/devtools/forge
dependencies; this narrows runtime exposure but does not erase build risks.
This review found no demonstrated exploitable request path that blocks a
controlled preview. It is not a claim of a vulnerability-free production release.

Primary advisory references:

- [simple-git VISUAL guard bypass](https://github.com/advisories/GHSA-v5rq-49vh-5v5c)
- [simple-git trailer command configuration](https://github.com/advisories/GHSA-x6jw-m9v5-85vh)
- [Vue SSR attribute-name XSS](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6)
- [devalue shared-memory serialization](https://github.com/advisories/GHSA-j22f-vq7h-c4qm)
- [undici BalancedPool TLS options](https://github.com/advisories/GHSA-w293-vg96-wgc3)
