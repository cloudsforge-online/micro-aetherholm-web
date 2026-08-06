/**
 * The app shell: the company bar, the navigation strip, and the page.
 *
 * The bar is `CloudsForgeBar` from @cloudsforge/ui and is never reimplemented — it is what makes
 * moving between surfaces feel like one application. Everything this app adds goes BELOW it.
 * The bar marks `worlds` current, because a title is played through Forge Worlds — see PRODUCT
 * in src/lib/hosts.ts.
 *
 * The degradation banner reads `GET /readyz` once per mount (`aetherholm/src/server.ts:346`).
 * `role="status"`, not `alert`: the app still works — the chronicle is static history and reads
 * fine against a degraded service — and a screen reader interrupted on every navigation is worse
 * than being told once, politely.
 */
import { useEffect, useState } from 'react'
import {
  CloudsForgeBar,
  CloudsForgeFooter,
  CookieBanner,
  MainRegion,
  SkipLink,
} from '@cloudsforge/ui'
import { applyHead, surfaceMeta } from '@cloudsforge/ui/seo'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { PRODUCT, SURFACE } from '../lib/hosts.ts'
import { fetchReadiness, type Readiness } from '../lib/aetherholm.ts'
import { keyart, titleArt } from '../lib/art.ts'
import { useSession } from '../lib/auth.tsx'
import { NAV, routeFor } from '../lib/routes.ts'

export function AppShell() {
  const { account, signIn, signOut } = useSession()
  // Starts 'unknown' rather than 'ready': before the probe answers we have established nothing,
  // and 'unknown' and 'ready' render identically (no banner), so the initial value cannot flash a
  // claim we cannot support.
  const [readiness, setReadiness] = useState<Readiness>('unknown')

  useEffect(() => {
    let live = true
    void fetchReadiness().then((r) => {
      if (live) setReadiness(r.readiness)
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <>
      {/*
        The skip link is the first focusable thing in the document, and it is now the SHARED one.

        This shell already had a skip link and it was HALF the pattern: `.ah-skip` pointed at
        `#main`, and the `<main id="main">` below carried no `tabIndex={-1}`. A `<main>` is not
        focusable by default, so in Chrome and Safari following the link scrolled the page, left
        focus on the link itself, and sent the very next Tab back into the shared bar — the exact
        journey the link exists to skip, walked twice. `SkipLink` and `MainRegion` set the id and
        the tabindex from one constant (`MAIN_ID`, now `cf-main`), so the two cannot disagree and
        neither half can be shipped without the other.
      */}
      <SkipLink>Skip to the page</SkipLink>
      <CloudsForgeBar current={PRODUCT} account={account} onSignIn={() => signIn()} onSignOut={signOut} />

      <TitleStrip />

      <nav className="ah-nav" aria-label="Game sections">
        <div className="ah-nav__inner">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `ah-nav__link${isActive ? ' is-active' : ''}`}
            >
              {item.nav}
            </NavLink>
          ))}
        </div>
      </nav>

      {/*
        `=== 'degraded'`, NOT `!ready`. Only the service saying so puts this banner on screen.
        Under the old two-state boolean an unreachable probe was indistinguishable from a service
        that had answered "not ready", so when the gateway stopped routing `/readyz` this banner
        appeared for every visitor of a perfectly healthy game. A degradation warning that is
        sometimes wrong is a degradation warning nobody reads.
      */}
      {readiness === 'degraded' && (
        <div className="ah-degraded" role="status">
          <span className="ah-degraded__icon" aria-hidden="true">
            ▲
          </span>
          <p>Aetherholm is not answering ready just now. The chronicle still reads; play may fail.</p>
        </div>
      )}

      <DocumentMeta />

      {/*
        `MainRegion` rather than a hand-written `<main>`: it sets `id={MAIN_ID}` and
        `tabIndex={-1}` together, which is the pair the skip link needs and the pair this file got
        half right. The id is `cf-main` now rather than `main`; nothing else in this app
        referenced the old one — the only reader was the anchor above, and it composes its href
        from the same constant.
      */}
      <MainRegion className="ah-main">
        <Outlet />
      </MainRegion>

      {/*
        The company footer, from @cloudsforge/ui. Every link in it is derived from the surface
        registry, so a new product appears here without this file changing — which is the reason
        the estate is not growing a fifth hand-rolled footer beside the four it already had.

        `current` is SURFACE, not the bar's surface: see lib/hosts.ts for why those are two
        different questions. `account` decides only whether the operator surfaces are offered.
      */}
      <CloudsForgeFooter current={SURFACE} account={account} />

      {/*
        LAST IN THE DOCUMENT, AND THEREFORE LAST IN THE TAB ORDER. That is deliberate: the banner
        is a dialog and is explicitly NOT modal, so a player who came here to read a sealed
        season's chronicle can read it and answer afterwards. A consent banner that traps focus is
        the coercion the regulation is about.

        It renders NOTHING until it knows this reader has not already answered, and nothing at all
        on an origin where analytics would not report anyway — which is every local stack and every
        `.localtest.me` gateway host. A banner asking permission for something that will not happen
        is worse than no banner.
      */}
      <CookieBanner />
    </>
  )
}

/**
 * Keep the title, the description, the robots directive, the Open Graph card and the canonical
 * link in step with the address.
 *
 * A component IN THE SHELL rather than a hook each page calls, because the failure mode of the
 * second shape is the page that forgets to call it — and the page that forgets is the one added
 * last, which is the one nobody has bookmarked yet and therefore the one nobody notices is titled
 * with the previous screen's title.
 *
 * ── Where the words come from ─────────────────────────────────────────────────────────────────
 *
 * `surfaceMeta(SURFACE, …)`, and SURFACE is `aetherholm` — NOT `PRODUCT`. The two constants
 * answer different questions and `lib/hosts.ts` says which is which at length; the consequence
 * here is concrete. `PRODUCT` is `worlds` because the shared bar marks the platform a player is
 * playing THROUGH, and passing it to this call would title every screen of this game
 * "Forge Worlds" and describe it as "Ninety Days After, and what follows it" — a different
 * product's row, in the one place a search result and a link preview read.
 *
 * The only thing this file adds is which page you are on, and that is read off `ROUTES` — the
 * same declaration the navigation, the router and nginx's enumerated locations are derived from —
 * rather than typed a fifth time. `/battles` has `nav: null` (it is opened from a notification or
 * the chronicle, not from the strip) and so gets the surface name alone: the shell cannot know
 * WHICH battle, and "Battle reports" here would be a second declaration of a name only this
 * component would hold.
 *
 * ── The robots directive, which is the half that was missing ──────────────────────────────────
 *
 * Four of this client's six routes are behind `ProtectedRoute` and answer a signed-out visitor by
 * sending them to hub's login. Indexing them publishes addresses that bounce, so they are
 * `noindex, nofollow` — and so is an address this app does not own at all, which nginx has
 * already answered 404 for. `nginx.conf`'s sitemap lists exactly the complement of that set, and
 * `test/sitemap.test.ts` holds the two together in both directions: a sitemap that invited a
 * crawler to a page whose own meta tag refuses it would be this file and that one disagreeing in
 * public.
 *
 * ── What this does NOT replace ────────────────────────────────────────────────────────────────
 *
 * The static tags in `index.html`. They are what a link-preview fetcher gets — the ones chat
 * clients use generally do not execute JavaScript — so the shell keeps its own title, description
 * and card, and `test/head.test.ts` asserts that its copy of the description is byte-identical to
 * the one this call produces.
 */
function DocumentMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const route = routeFor(pathname)
    // Unknown OR gated. An unowned address is already a 404 from nginx and must never be indexed;
    // a gated one redirects a crawler to a login it cannot pass.
    const indexable = route !== undefined && !route.protected
    applyHead(
      surfaceMeta(SURFACE, {
        ...(route?.nav == null ? {} : { title: route.nav }),
        path: pathname,
        ...(indexable ? {} : { robots: 'noindex, nofollow' }),
      }),
      window.location.origin,
    )
  }, [pathname])

  return null
}

/**
 * The title's own lockup: the mark and the wordmark, on the backdrop they were painted against.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE GAME NAMES ITSELF AT ALL, UNDER A BAR THAT ALREADY SAYS "CLOUDSFORGE".
 *
 * `CloudsForgeBar` marks `worlds` current, because a title is played through Forge Worlds — see
 * PRODUCT in lib/hosts.ts. So before this strip existed, the only name on any screen was the
 * platform's, and the product a player actually opened was identified by the browser tab. Emberkin
 * carries its wordmark for the same reason and has since its art landed.
 *
 * THE WORDMARK IS THE `<h1>`-LEVEL NAME AND IT IS AN IMAGE, so it carries real `alt` text — unlike
 * the empty-state splashes, which are decoration and are hidden. A reader who cannot see it must
 * still be told which game this is. It is NOT marked up as a heading: every page already renders
 * its own `<h1>`, and a second one above it would give the document two competing titles.
 *
 * The backdrop is `keyart/wordmark-backdrop`, the 1536×512 scene the wordmark was composed
 * against, applied as a CSS background rather than a fourth `<img>` — it is a texture, it must
 * crop freely at every width, and it must never be a thing a screen reader announces.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
function TitleStrip() {
  const mark = titleArt('mark')
  const wordmark = titleArt('wordmark')
  const backdrop = keyart('wordmark-backdrop')

  return (
    <div
      className="ah-title"
      // Inline because the value comes from the generated catalogue: a URL in the stylesheet would
      // be a second place the asset path is spelled, and the one that no test reads.
      style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
    >
      <Link className="ah-title__lockup" to="/">
        {mark && <img className="ah-title__mark" src={mark} alt="" aria-hidden="true" />}
        {wordmark ? (
          <img className="ah-title__wordmark" src={wordmark} alt="Aetherholm" />
        ) : (
          // The set has no wordmark: say the name in text rather than show nothing. This is the
          // `null` discipline of lib/art.ts at its only load-bearing call site.
          <span className="ah-title__fallback">Aetherholm</span>
        )}
      </Link>
    </div>
  )
}
