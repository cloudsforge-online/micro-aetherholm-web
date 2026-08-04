/**
 * The app shell: the company bar, the navigation strip, and the page.
 *
 * The bar is `CloudsForgeBar` from @cloudsforge/ui and is never reimplemented — it is what makes
 * moving between surfaces feel like one application. Everything this app adds goes BELOW it.
 * The bar marks `worlds` current, because a title is played through Forge Worlds — see PRODUCT
 * in src/lib/hosts.ts.
 *
 * The degradation banner reads `GET /readyz` once per mount (`aetherholm/src/server.ts:328`).
 * `role="status"`, not `alert`: the app still works — the chronicle is static history and reads
 * fine against a degraded service — and a screen reader interrupted on every navigation is worse
 * than being told once, politely.
 */
import { useEffect, useState } from 'react'
import { CloudsForgeBar, CloudsForgeFooter } from '@cloudsforge/ui'
import { NavLink, Outlet } from 'react-router-dom'
import { FOOTER_SURFACE, PRODUCT } from '../lib/hosts.ts'
import { fetchReadiness, type Readiness } from '../lib/aetherholm.ts'
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
