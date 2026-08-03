/**
 * The archipelago map: islands on the wind lattice, as SVG.
 *
 * Plain SVG, no renderer: a strategy map is labels, lines and click targets, and the honest cost
 * of drawing it is zero dependencies. Islands are laid out on three rings by altitude band —
 * Shallows outermost, Highwind innermost — at the angle their `idx` gives them. The LAYOUT is
 * this client's presentation choice (the service ships no coordinates; geography is a graph,
 * `docs/ecosystem/20-aetherholm.md` §2); the GRAPH — which islands, which lanes, which travel
 * seconds — is the server's, verbatim.
 *
 * Lanes are directed, and the map says so: every lane is drawn as a curve bowed to ITS side of
 * the pair, so A→B and B→A are two visibly separate strokes, each with its own direction
 * multiplier (`multiplierBp`, formatted ×1.25-style). Selecting an island foregrounds its
 * outbound lanes with their labels; the rest stay faint rather than vanishing, because the shape
 * of the lattice is the strategy.
 *
 * SPIRES, honestly: this client CANNOT mark them. The service flags spire islands in its own
 * database (`aetherholm/src/migrations.ts:369` `is_spire`, maintained by
 * `aetherholm/src/lattice.ts:80`) but `GET /v1/archipelagos/:id/islands` does not select the
 * flag — `IslandSummary` (`aetherholm/src/seasons.ts:214-220`) carries id, idx, band and plots
 * only. Marking spires from a client-side reimplementation of `spireIdxsFor` would be this
 * repository maintaining a private copy of world-generation logic, which is the drift the whole
 * citation discipline exists to prevent. So the map says so on screen, and the defect is
 * reported in the README rather than papered over.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import {
  fetchCurrentSeason,
  fetchIslands,
  fetchLanes,
  foundCity,
  type Island,
  type Lane,
  type Season,
} from '../lib/aetherholm.ts'
import { formatDuration, formatMultiplier } from '../lib/format.ts'
import { Empty, Failed, Loading } from '../components/states.tsx'

const SIZE = 720
const CENTRE = SIZE / 2
/** Ring radius per band: the higher the band, the nearer the centre — a plan view of altitude. */
const BAND_RADIUS: Record<string, number> = { shallows: 320, midreach: 230, highwind: 140 }

interface Point {
  x: number
  y: number
}

/** Where an island sits: its band's ring, at its idx's angle among all islands. */
function placeIslands(islands: readonly Island[]): Map<string, Point> {
  const points = new Map<string, Point>()
  const total = Math.max(1, islands.length)
  for (const island of islands) {
    const angle = (island.idx / total) * 2 * Math.PI - Math.PI / 2
    const radius = BAND_RADIUS[island.band] ?? 280
    points.set(island.id, {
      x: CENTRE + radius * Math.cos(angle),
      y: CENTRE + radius * Math.sin(angle),
    })
  }
  return points
}

/** A quadratic curve bowed to the lane's own side, so the two directions never overlap. */
function lanePath(from: Point, to: Point): string {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.max(1, Math.hypot(dx, dy))
  // Perpendicular offset, to the right of travel: each direction bows to its own side.
  const ox = (-dy / len) * Math.min(40, len / 5)
  const oy = (dx / len) * Math.min(40, len / 5)
  return `M ${from.x} ${from.y} Q ${mx + ox} ${my + oy} ${to.x} ${to.y}`
}

export function MapPage() {
  const [season, setSeason] = useState<Season | null | undefined>(undefined)
  const [islands, setIslands] = useState<Island[]>([])
  const [lanes, setLanes] = useState<Lane[]>([])
  const [notice, setNotice] = useState<ErrorNotice | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [founding, setFounding] = useState(false)
  const [foundNotice, setFoundNotice] = useState<string | null>(null)
  const [cityName, setCityName] = useState('')
  const [plot, setPlot] = useState(1)

  const load = useCallback(() => {
    setNotice(null)
    setSeason(undefined)
    fetchCurrentSeason()
      .then(async (open) => {
        setSeason(open)
        if (!open) return
        const [isles, winds] = await Promise.all([
          fetchIslands(open.archipelagoId),
          fetchLanes(open.archipelagoId),
        ])
        setIslands(isles)
        setLanes(winds)
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'The archipelago could not be loaded.')))
  }, [])

  useEffect(load, [load])

  const points = useMemo(() => placeIslands(islands), [islands])
  const selectedIsland = islands.find((i) => i.id === selected) ?? null
  const outbound = useMemo(
    () => (selected ? lanes.filter((lane) => lane.fromIslandId === selected) : []),
    [lanes, selected],
  )

  async function onFound() {
    if (!selectedIsland) return
    setFounding(true)
    setFoundNotice(null)
    try {
      const city = await foundCity({ islandId: selectedIsland.id, plot, name: cityName })
      setFoundNotice(`Founded ${city.name} on plot ${city.plot}. Its aegis holds until ${new Date(city.aegisUntil).toLocaleString()}.`)
      load()
    } catch (err) {
      setFoundNotice(noticeFor(err, 'The founding failed.').message)
    } finally {
      setFounding(false)
    }
  }

  if (notice) return <Failed notice={notice} onRetry={load} />
  if (season === undefined) return <Loading label="Reading the winds" />
  if (season === null) {
    return (
      <Empty
        title="No season is open yet"
        hint="The world opens when the season does; the chronicle holds every sealed one."
      />
    )
  }

  return (
    <div className="ah-map">
      <header className="ah-page-head">
        <h1>{season.name}</h1>
        <p className="ah-page-head__meta">
          Season seed <code className="cf-num">{season.seed}</code> · seals{' '}
          {new Date(season.endsAt).toLocaleDateString()}
        </p>
        <p className="ah-page-head__note">
          Spire islands are not marked: the islands route does not expose the flag the service
          keeps. See the README’s known gaps.
        </p>
      </header>

      <div className="ah-map__layout">
        <svg
          className="ah-map__svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          /*
            `role="group"`, NOT `role="img"`.
            
            `img` makes the whole subtree presentational, and this subtree contains nine
            `role="button"` island targets with `tabIndex={0}`. So assistive technology was told
            the map is a single picture while the controls inside it were still in the tab order:
            axe reports it as `nested-interactive`, and a screen-reader user reading the map as an
            image would find focus landing on things they had not been told about. `group` is what
            a labelled container of interactive elements is, and the label is unchanged.
            
            Found by running axe against the rendered page (test/browser-journeys.test.ts).
          */
          role="group"
          aria-label="The archipelago: islands and wind lanes"
        >
          <defs>
            <marker id="wind-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" className="ah-map__arrow" />
            </marker>
          </defs>

          {lanes.map((lane) => {
            const from = points.get(lane.fromIslandId)
            const to = points.get(lane.toIslandId)
            if (!from || !to) return null
            const active = lane.fromIslandId === selected
            return (
              <path
                key={lane.id}
                d={lanePath(from, to)}
                className={`ah-map__lane${active ? ' is-active' : ''}`}
                markerEnd="url(#wind-arrow)"
              >
                <title>
                  {formatMultiplier(lane.multiplierBp)} · {formatDuration(lane.travelSeconds)}
                </title>
              </path>
            )
          })}

          {islands.map((island) => {
            const p = points.get(island.id)
            if (!p) return null
            return (
              <g key={island.id} transform={`translate(${p.x} ${p.y})`}>
                <circle
                  r={island.id === selected ? 13 : 9}
                  className={`ah-map__island ah-map__island--${island.band}${island.id === selected ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Island ${island.idx}, ${island.band}, ${island.freePlots} free plots`}
                  onClick={() => setSelected(island.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelected(island.id)
                  }}
                />
                <text className="ah-map__label" y="-14" textAnchor="middle">
                  {island.idx}
                </text>
              </g>
            )
          })}
        </svg>

        <aside className="ah-map__panel">
          {!selectedIsland && (
            <Empty title="Select an island" hint="Its winds, plots and founding form appear here." />
          )}
          {selectedIsland && (
            <>
              <h2>
                Island {selectedIsland.idx} <span className="ah-band">{selectedIsland.band}</span>
              </h2>
              <p>
                {selectedIsland.freePlots} of {selectedIsland.plots} plots free.
              </p>

              <h3>Outbound winds</h3>
              {outbound.length === 0 && <p className="ah-dim">No outbound lanes.</p>}
              <ul className="ah-lane-list">
                {outbound.map((lane) => {
                  const target = islands.find((i) => i.id === lane.toIslandId)
                  return (
                    <li key={lane.id}>
                      → island {target?.idx ?? '?'} · {formatMultiplier(lane.multiplierBp)} ·{' '}
                      {formatDuration(lane.travelSeconds)}
                    </li>
                  )
                })}
              </ul>

              <h3>Found a city</h3>
              <form
                className="ah-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void onFound()
                }}
              >
                <label>
                  City name
                  <input
                    className="cf-input"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    required
                    maxLength={60}
                  />
                </label>
                <label>
                  Plot (1–{selectedIsland.plots})
                  <input
                    className="cf-input cf-input--mono"
                    type="number"
                    min={1}
                    max={selectedIsland.plots}
                    value={plot}
                    onChange={(e) => setPlot(Number(e.target.value))}
                  />
                </label>
                <button type="submit" className="cf-btn cf-btn--ember" disabled={founding || cityName.length === 0}>
                  {founding ? 'Founding…' : 'Found city'}
                </button>
                <p className="ah-dim">
                  A new city holds a free 7-day aegis. It is never sold, to anyone, ever.
                </p>
                {foundNotice && <p role="status">{foundNotice}</p>}
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
