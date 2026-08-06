/**
 * The app shell: the company bar, the navigation strip, and the page.
 *
 * The bar is `CloudsForgeBar` from @cloudsforge/ui and is never reimplemented — it is what makes
 * moving between surfaces feel like one application. Everything this app adds goes BELOW it.
 * The bar marks `worlds` current, because a title is played through Forge Worlds — see PRODUCT
 * in src/lib/hosts.ts.
 *
 * The degradation banner reads `GET /readyz` once per mount (`aetherholm/src/server.ts`).
 * `role="status"`, not `alert`: the app still works — the chronicle is static history and reads
 * fine against a degraded service — and a screen reader interrupted on every navigation is worse
 * than being told once, politely.
 */
import { useEffect, useState } from 'react'
import { CloudsForgeBar, CloudsForgeFooter } from '@cloudsforge/ui'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { FOOTER_SURFACE, PRODUCT } from '../lib/hosts.ts'
import { fetchReadiness, type Readiness } from '../lib/aetherholm.ts'
import { keyart, titleArt } from '../lib/art.ts'
import { useSession } from '../lib/auth.tsx'
import { NAV } from '../lib/routes.ts'

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
        The skip link is the first focusable thing in the document, and it is visually hidden until
        it TAKES FOCUS, at which point it must become visible. A skip link that stays hidden when
        focused is worse than none: a keyboard reader activates it and cannot tell whether anything
        happened. `site` and `network-site` already ship one; this shell did not, so every keyboard
        user tabbed through the whole shared bar and the sub-navigation to reach the page, on every
        navigation.
      */}
      <a className="ah-skip" href="#main">
        Skip to the page
      </a>
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

      <main className="ah-main" id="main">
        <Outlet />
      </main>

      {/*
        The company footer, from @cloudsforge/ui. Every link in it is derived from the surface
        registry, so a new product appears here without this file changing — which is the reason
        the estate is not growing a fifth hand-rolled footer beside the four it already had.

        `current` is FOOTER_SURFACE, not the bar's surface: see lib/hosts.ts for why those are two
        different questions. `account` decides only whether the operator surfaces are offered.
      */}
      <CloudsForgeFooter current={FOOTER_SURFACE} account={account} />
    </>
  )
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
