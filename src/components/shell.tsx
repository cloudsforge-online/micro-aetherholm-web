/**
 * The app shell: the company bar, the navigation strip, and the page.
 *
 * The bar is `CloudsForgeBar` from @cloudsforge/ui and is never reimplemented — it is what makes
 * moving between surfaces feel like one application. Everything this app adds goes BELOW it.
 * The bar marks `worlds` current, because a title is played through Forge Worlds — see PRODUCT
 * in src/lib/hosts.ts.
 *
 * The degradation banner reads `GET /readyz` once per mount (`aetherholm/src/server.ts:314`).
 * `role="status"`, not `alert`: the app still works — the chronicle is static history and reads
 * fine against a degraded service — and a screen reader interrupted on every navigation is worse
 * than being told once, politely.
 */
import { useEffect, useState } from 'react'
import { CloudsForgeBar } from '@cloudsforge/ui'
import { NavLink, Outlet } from 'react-router-dom'
import { PRODUCT } from '../lib/hosts.ts'
import { fetchReadiness } from '../lib/aetherholm.ts'
import { useSession } from '../lib/auth.tsx'
import { NAV } from '../lib/routes.ts'

export function AppShell() {
  const { account, signIn, signOut } = useSession()
  const [ready, setReady] = useState(true)

  useEffect(() => {
    let live = true
    void fetchReadiness().then((r) => {
      if (live) setReady(r.ready)
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <>
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

      {!ready && (
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
    </>
  )
}
