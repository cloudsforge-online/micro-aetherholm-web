/**
 * This app's addresses, declared once.
 *
 * Three things must agree about them: this file, the route table in `src/app.tsx`, and the
 * enumerated `location` block in `nginx.conf`. `test/routes.test.ts` checks all three against
 * each other, because a route added to the router and not to nginx works perfectly under
 * `pnpm dev` and 404s on the first hard refresh in production — a failure that survives review,
 * since nothing about the diff looks wrong.
 *
 * nginx enumerates rather than falling back because an unknown address must answer 404. See the
 * header of `nginx.conf`.
 */

export interface RouteDef {
  /** The path, without a trailing slash. The index route is `/`. */
  readonly path: string
  /** The label in the navigation strip. Null keeps it out of the nav (detail routes). */
  readonly nav: string | null
  /** A one-line description, used by the not-found page to offer somewhere to go. */
  readonly blurb: string
  /** Requires a session. Not a security boundary — the service checks every token. */
  readonly protected: boolean
}

export const ROUTES: readonly RouteDef[] = [
  {
    path: '/',
    nav: 'Archipelago',
    blurb: 'The islands on the wind lattice: lanes, their direction multipliers, and where to found.',
    protected: true,
  },
  {
    path: '/cities',
    nav: 'Cities',
    blurb: 'Your sky-cities: live stocks, build and research queues, the shipyard.',
    protected: true,
  },
  {
    path: '/fleets',
    nav: 'Fleets',
    blurb: 'Compose from the ten classes, see the Aether cost before you commit, watch arrivals.',
    protected: true,
  },
  {
    path: '/battles',
    nav: null,
    blurb: 'A battle report: both orders of battle, the stored result, and its digest.',
    protected: false,
  },
  {
    path: '/alliance',
    nav: 'Alliance',
    blurb: 'Your banner: a micro-community binding, island claims, beacons and shared lanes.',
    protected: true,
  },
  {
    path: '/chronicle',
    nav: 'Chronicle',
    blurb: 'Sealed seasons — public history, readable without an account.',
    protected: false,
  },
]

/** The nav, in order. Derived — never a second hand-maintained list. */
export const NAV: readonly RouteDef[] = ROUTES.filter((r) => r.nav !== null)

/**
 * Every path except the index, without its leading slash.
 *
 * This is the exact alternation nginx's `location ~ ^/(…)` block must carry. The index is
 * excluded because nginx matches `location = /` separately.
 */
export const NON_INDEX_PATHS: readonly string[] = ROUTES.filter((r) => r.path !== '/').map((r) =>
  r.path.slice(1),
)

/**
 * A route the CI image job may deep-link to and expect a 200.
 *
 * A REAL route, and one that does not require a session — the probe has no token. `/chronicle`
 * is also the one screen whose data is anonymous by design (`aetherholm/src/server.ts:915`), so
 * the address a stranger is most likely to be handed is the one the probe proves survives a hard
 * refresh.
 */
export const DEEP_LINK_PATH = '/chronicle'

export function routeFor(path: string): RouteDef | undefined {
  return ROUTES.find((r) => r.path === path)
}
