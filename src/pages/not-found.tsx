/**
 * The 404 page. nginx has already answered 404 for this address (see nginx.conf) — this renders
 * INSIDE that response, so the status line and the screen agree. It offers the route table as
 * somewhere to go, which is why every route in src/lib/routes.ts carries a blurb.
 */
import { Link } from 'react-router-dom'
import { ROUTES } from '../lib/routes.ts'

export function NotFoundPage() {
  return (
    <div className="ah-state ah-state--empty" role="status">
      <span className="ah-state__icon" aria-hidden="true">
        ◇
      </span>
      <p className="ah-state__title">Nothing is charted at this address</p>
      <p className="ah-state__hint">The winds do know these:</p>
      <ul className="ah-notfound">
        {ROUTES.map((route) => (
          <li key={route.path}>
            <Link className="ah-link" to={route.path}>
              {route.nav ?? route.path}
            </Link>{' '}
            — {route.blurb}
          </li>
        ))}
      </ul>
    </div>
  )
}
