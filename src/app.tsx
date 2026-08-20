/**
 * The route table.
 *
 * It must agree with `src/lib/routes.ts` and with the enumerated `location` block in
 * `nginx.conf`; `test/routes.test.ts` checks all three against each other. A route added here
 * and not to nginx works perfectly under `pnpm dev` and 404s on the first hard refresh in
 * production.
 *
 * No lazy boundary: this client has no renderer and no heavyweight page — the map is inline SVG
 * — so splitting a page that renders tables would buy a round trip and save nothing.
 */
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ScrollToTop } from './components/scroll-to-top.tsx'
import { AppShell } from './components/shell.tsx'
import { AuthProvider, ProtectedRoute } from './lib/auth.tsx'
import { AlliancePage } from './pages/alliance.tsx'
import { BattlesPage } from './pages/battles.tsx'
import { ChroniclePage } from './pages/chronicle.tsx'
import { CitiesPage } from './pages/cities.tsx'
import { FleetsPage } from './pages/fleets.tsx'
import { MapPage } from './pages/map.tsx'
import { NotFoundPage } from './pages/not-found.tsx'
import { BASE } from './lib/routes.ts'

export function App() {
  return (
    <BrowserRouter basename={BASE}>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <ProtectedRoute>
                  <MapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cities"
              element={
                <ProtectedRoute>
                  <CitiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fleets"
              element={
                <ProtectedRoute>
                  <FleetsPage />
                </ProtectedRoute>
              }
            />
            {/*
              Public: a sealed season's battles open without a session (server.ts), and a
              live one answers its own refusal, which the page renders honestly.
            */}
            <Route path="/battles" element={<BattlesPage />} />
            <Route
              path="/alliance"
              element={
                <ProtectedRoute>
                  <AlliancePage />
                </ProtectedRoute>
              }
            />
            {/* Public by design: the chronicle is the game's anonymous surface. */}
            <Route path="/chronicle" element={<ChroniclePage />} />
            {/*
              The catch-all renders inside the shell, so a wrong address is a page of this app
              rather than a bare error. nginx has already answered 404 for it; see nginx.conf.
            */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
