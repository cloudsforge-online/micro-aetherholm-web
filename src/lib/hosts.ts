/**
 * Where this app talks to, resolved at runtime.
 *
 * `cloudsforgeHosts()` reads `window.location.hostname` on every call, so the same bundle
 * addresses `http://localhost:4120` when served from localhost and `https://aetherholm.<apex>`
 * when served from the apex. Nothing here reads a build-time constant; see the note in
 * vite.config.ts.
 *
 * Unlike `micro-emberkin-web` at the time it was built, this client needs NO derivation and no
 * correction: the surface registry already carries an `aetherholm` entry
 * (`ui/packages/ui/src/surfaces.ts:426-442`), added when the service shipped, with
 * `devPort: 4120` read from the service itself (`aetherholm/src/env.ts:105`). Emberkin's
 * `deriveSurfaceUrl`/`stripOwnLabel` workaround existed because its registry entry did not; the
 * whole point of keeping that workaround small and loud was that a successor would not need it.
 * This file is the deletion it promised.
 */
import { cloudsforgeHosts, type CloudsForgeHosts, type SurfaceKey } from '@cloudsforge/ui'

/**
 * The surface this application presents itself AS, for the product switcher.
 *
 * Aetherholm is a Forge Worlds title (docs/ecosystem/20-aetherholm.md §5), so `worlds` is the
 * entry the bar marks current — the same choice `micro-emberkin-web` makes and for the same
 * reason: a player who opens the switcher from inside the game should see the platform they are
 * playing on highlighted. A title is not a sixth product and claims no switcher slot of its own
 * (`ui/packages/ui/src/surfaces.ts:441`, `inSwitcher: false`).
 */
export const PRODUCT: SurfaceKey = 'worlds'
/**
 * The surface this application IS, for the footer. **Deliberately not `'worlds'`.**
 *
 * The two constants answer two different questions and collapsing them would make one of them
 * wrong. `PRODUCT` is what the BAR marks current, and the switcher is a list of platforms a
 * player chooses between — Aetherholm is played through Forge Worlds, so `worlds` is the honest
 * highlight there. The FOOTER lists surfaces, and Aetherholm is one: it has its own registry row and
 * its own hostname (`aetherholm` in @cloudsforge/ui's surfaces.ts). So "you are here" in the footer is
 * Aetherholm, and the footer's closing line reads Aetherholm's own blurb rather than Forge Worlds'.
 */
export const FOOTER_SURFACE: SurfaceKey = 'aetherholm'


/** The name reported to the observability ingest and shown in error copy. */
export const APP_NAME = 'aetherholm-web'

/**
 * Every CloudsForge base URL the registry knows, for the current environment.
 *
 * Call it per use; never cache the result in a module constant — the registry resolves from
 * `window.location.hostname`, which a test may change between calls.
 */
export function hosts(): CloudsForgeHosts {
  return cloudsforgeHosts()
}

/**
 * The base URL of `micro-aetherholm`, resolved now.
 *
 * Unlike the template's `apiBase()` this never collapses to the empty string. The template's does
 * because an SPA and its API usually share an origin behind the gateway; Aetherholm's client and
 * service are separate surfaces even in production, so the request is always absolute and always
 * cross-origin. Pretending otherwise would send every call to the static file server.
 */
export function apiBase(): string {
  return new URL(hosts().aetherholm).origin
}

/** The page origin, or a stable placeholder when there is no document (tests, prerender). */
export function pageOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}
