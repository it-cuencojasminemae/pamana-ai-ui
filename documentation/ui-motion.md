# UI animation layer

PAMANA uses the existing Motion Vue 2.4.0 installation as a pinned direct dependency. The Nuxt module supplies `MotionConfig`, which respects the device's reduced-motion preference. Shared CSS handles button/link feedback and the opacity-only page entrance.

Use `v-pamana-reveal` on an existing element or a component with a single element root. It preserves the element's layout and event handlers. `PamanaMotionSection` provides the same behavior for a new semantic section, accepting `preset` and `delay` props.

- `rise`: 12 px entrance over 320 ms; sibling staggering uses 40 ms steps capped at 240 ms.
- `fade`: opacity only, for maps, forms with dropdowns, and other coordinate-sensitive surfaces.
- `panel`: 6 px entrance over 200 ms without delay; closing removes the panel immediately so dismissed options cannot remain interactive.
- `delay` is in milliseconds. Shared timing defaults live in `app/services/uiMotion.ts`.

Only mounting starts a reveal. Reactive updates, polling, query changes, and changes to a directive's value do not replay it. Offscreen sections stay visible before an observer starts their first entrance. Nested sections avoid compound entrances. Maps and elements with existing transforms automatically use opacity only.

Server rendering emits visible content and a marker attribute, with no initial opacity/transform styles. Completion, unmount, reduced-motion changes, focus, and pointer interaction stop the animation and release its observer/listeners. User interaction immediately stabilizes an entering surface. Authenticated pages are not retained for exit animations; Nuxt UI continues to own modal/drawer transitions and focus management.

Add `data-pamana-feedback` to interactive controls for hover/press feedback. Disabled controls do not move, hover movement requires a fine pointer, and reduced motion disables the effects. Avoid animating operational numbers, map canvases, table rows on refresh, or rekeying stateful components to replay an entrance.

## Validation

Run `node --test scripts/test-ui-motion.mjs`, `npm test`, `node scripts/test-trip-planner-selection-contract.cjs`, and `npm run build`. The animation tests cover SSR visibility, reduced motion, map transforms, resource cleanup, failure recovery, and live element reuse.

The baseline portable suite has two existing harness failures in `test-connected-research.mjs` and `test-phase-23.mjs`; with eight animation tests added, 198 of 200 pass with the same two failures. Standard builds require Google Fonts access and filesystem access for Nitro dependency tracing. In this restricted environment, production output was validated using temporary build overrides for `ui.fonts: false` and `nitro.externals.trace: false`; these overrides are not part of application configuration or a standalone deployment build.

Headless Edge checks use synthetic API responses. They cover every production route, desktop/mobile overflow, visible completed entrances, custom dropdowns, drawer Escape/focus restoration, client navigation, and reduced motion. Provider tiles are blocked during these checks; existing map regression tests cover geometry and camera policies.
