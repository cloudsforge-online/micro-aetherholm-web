/**
 * The boot sequence. The order is not arbitrary.
 *
 *   1. Observability first, so an exception thrown by anything below is reported rather than
 *      lost. A crash during the first render is the single most valuable event this app can send.
 *   2. `bootstrapSession()` second, and AWAITED, so the SSO hand-off code in the URL fragment is
 *      redeemed before React mounts. It strips `#cf_code` from the address bar before the
 *      exchange goes over the wire — see the note in @cloudsforge/ui. Rendering first would show
 *      a signed-out shell to a user who has just signed in, and would leave the code on screen
 *      for the length of a network round trip.
 *   3. Render last.
 *
 * Consent is primed BETWEEN 1 and 2. See the note beside `initAnalytics()`.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@cloudsforge/ui/tokens.css'
import '@cloudsforge/ui/ui.css'
import './styles.css'
import { initAnalytics } from '@cloudsforge/ui/consent'
import { App } from './app.tsx'
import { bootstrapSession } from './lib/api.ts'
import { initObs } from './lib/obs.ts'

initObs()

/*
 * Consent Mode, primed with every category DENIED before anything else can run.
 *
 * Two pushes onto a plain array: no request, no cookie, no script. The analytics tag is loaded
 * here only if THIS reader granted consent on a previous visit; a first-time reader gets nothing
 * at all until they press Accept in the banner the shell renders last.
 *
 * It goes second — after `initObs()`, before `bootstrapSession()` — and the position is the whole
 * point. A denied default installed AFTER a tag could have arrived is not a default, it is a
 * race, and the losing branch of that race sets a cookie. `bootstrapSession()` is a network round
 * trip, so putting this after it would open exactly that window.
 *
 * `initObs()` still comes first, and the two are not in competition: Lantern is this estate's own
 * first-party error sink, reached from this origin with no cookie and no third party, and an
 * exception thrown by the line below is worth more reported than lost.
 */
initAnalytics()

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

void bootstrapSession().finally(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
