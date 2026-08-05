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
 * SPIRES ARE MARKED, at last, from the server's own flag — `IslandSummary.spire`
 * (`aetherholm/src/seasons.ts:227`), selected at `:235` and mapped at `:248`. This page used to
 * carry a paragraph explaining that it could not mark them and a note on screen saying so; the
 * service had closed that gap and the client's `Island` interface dropped the field on parse, so
 * the apology outlived the defect by every deploy since. See the field's own header in
 * `src/lib/aetherholm.ts` and micro-org#176. What has NOT changed is the rule the old paragraph
 * was defending: the flag is READ, never recomputed. A client-side `spireIdxsFor` would be this
 * repository keeping a private copy of world generation, which is the drift the citation
 * discipline exists to prevent.
 *
 * The generated art arrives here too (micro-org#175): `icons/status-spire` marks the objective,
 * `icons/ui-wind-lane` and `icons/ui-lane-junction` label the two things the lattice is made of,
 * and the selected island shows its band's archetype painting. READ `islandArt` IN lib/art.ts
 * BEFORE TOUCHING THAT LAST ONE — the band is the server's and the biome is this client's
 * illustration, and the caption saying so is load-bearing.
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
import { islandArt, islandBiome, splash, statusIcon, uiIcon } from '../lib/art.ts'
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
  const spireGlyph = statusIcon('spire')
  const laneGlyph = uiIcon('wind-lane')
  const junctionGlyph = uiIcon('lane-junction')
  const archetype = selectedIsland ? islandArt(selectedIsland.band, selectedIsland.idx) : null
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
      /* `season-dawn`: a fresh archipelago at first light, founding airships fanning out. The
         screen a player sees between seasons is the one place that painting belongs. */
      <Empty
        title="No season is open yet"
        hint="The world opens when the season does; the chronicle holds every sealed one."
        art={splash('season-dawn')}
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
        <p className="ah-page-head__note ah-legend">
          <span className="ah-legend__item">
            {spireGlyph && <img className="ah-glyph" src={spireGlyph} alt="" aria-hidden="true" />}
            Aether Spire — the season’s objective
          </span>
          <span className="ah-legend__item">
            {laneGlyph && <img className="ah-glyph" src={laneGlyph} alt="" aria-hidden="true" />}
            Wind lane, drawn once per direction
          </span>
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
                  className={`ah-map__island ah-map__island--${island.band}${island.id === selected ? ' is-selected' : ''}${island.spire ? ' is-spire' : ''}`}
                  role="button"
                  tabIndex={0}
                  /*
                    The spire is named in the ACCESSIBLE NAME, not only drawn. It is the season's
                    victory objective, so a reader who cannot see the glyph must still be able to
                    find the four islands the whole game is about by tabbing the map.
                  */
                  aria-label={`Island ${island.idx}, ${island.band}, ${island.freePlots} free plots${island.spire ? ', Aether Spire' : ''}`}
                  onClick={() => setSelected(island.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelected(island.id)
                  }}
                />
                {/*
                  An SVG <image>, because an <img> element cannot live inside an <svg>. That has a
                  consequence worth knowing: it is NOT an HTMLImageElement, so it does not appear
                  in `document.images` and beacon's decoded-<img> check cannot see it — the same
                  blind spot that let Tessera serve 392 canvas sprites to nobody. What guards it is
                  the surface's `imagery` declaration in micro-beacon, which resolves the path in
                  Chromium from this origin. The legend above renders the same glyph as a real
                  <img>, so both tiers have something to look at.
                */}
                {island.spire && spireGlyph && (
                  <image
                    className="ah-map__spire"
                    href={spireGlyph}
                    x={-9}
                    y={-9}
                    width={18}
                    height={18}
                    aria-hidden="true"
                  />
                )}
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
              {/*
                ═══════════════════════════════════════════════════════════════════════════════
                THE BAND IS DATA. THE BIOME IS ILLUSTRATION. THE CAPTION SAYS SO, AND MUST.

                `islandArt` picks `<band>_<biome>` from the twelve archetype paintings. The band
                comes off the wire and is constrained at the database
                (`aetherholm/src/migrations.ts:160`). The biome does NOT exist: no route, no
                column, no document names one — the four are authored in the art set's own
                ART_BIBLE §3, which says as much. So the archetype is chosen from the island's
                index, stable for every player and every visit, and the sentence under it tells
                the reader exactly which half of the picture is a fact.

                Dropping that caption turns a decoration into a claim about terrain the game does
                not model. If it goes, the picture goes with it. See lib/art.ts.
                ═══════════════════════════════════════════════════════════════════════════════
              */}
              {archetype && (
                <figure className="ah-island">
                  <img className="ah-island__art" src={archetype} alt="" aria-hidden="true" decoding="async" />
                  <figcaption className="ah-dim">
                    A {selectedIsland.band} island. The game records no terrain, so the{' '}
                    {islandBiome(selectedIsland.idx)} archetype shown is art direction chosen from
                    this island’s index — not a fact about it.
                  </figcaption>
                </figure>
              )}

              <h2>
                Island {selectedIsland.idx} <span className="ah-band">{selectedIsland.band}</span>
                {selectedIsland.spire && (
                  <span className="ah-spire-tag">
                    {spireGlyph && <img className="ah-glyph" src={spireGlyph} alt="" aria-hidden="true" />}
                    Aether Spire
                  </span>
                )}
              </h2>
              <p>
                {selectedIsland.freePlots} of {selectedIsland.plots} plots free.
              </p>

              <h3 className="ah-heading--glyphed">
                {junctionGlyph && <img className="ah-glyph" src={junctionGlyph} alt="" aria-hidden="true" />}
                Outbound winds
              </h3>
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
