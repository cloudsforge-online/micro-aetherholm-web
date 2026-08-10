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
 * (`aetherholm/src/seasons.ts`), selected by the island query and mapped onto the summary. This page used to
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
 *
 * ── MORE THAN ONE WORLD, since 2026-08-10 (micro-org#332) ────────────────────────────────────
 *
 * This page used to render one archipelago: the open season's. That was not a design decision, it
 * was the only id a client could obtain. A Private Skerry is bought through `worlds` and raised by
 * `POST /v1/provision`, which a browser must never call, and nothing told the buyer what had been
 * made for them — so a purchased world existed, with its twelve islands and its own wind lattice,
 * and the client that draws worlds could not address it. `GET /v1/archipelagos` is the read half,
 * and this page is where it lands, because a skerry is not a second KIND of map: it is the same
 * map of a smaller, private graph. A separate screen would have duplicated every line below to
 * show the same thing.
 *
 * Two consequences worth naming, because both were wrong on this page before:
 *
 *   - THE SEASON IS NO LONGER THE PRECONDITION. The old empty state said "the archipelago exists
 *     only inside a season", which the schema contradicts: a skerry has `season_id` null by
 *     constraint (`aetherholm/src/migrations.ts`). Between seasons, an owner now has
 *     their own world to look at, and that sentence is only shown to somebody who owns none.
 *   - THE SWITCHER IS HIDDEN WHEN THERE IS NOTHING TO SWITCH. A select with one option is a
 *     control that teaches the reader something can be changed and then refuses; nobody who owns
 *     no skerry sees one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import {
  fetchCurrentSeason,
  fetchIslands,
  fetchLanes,
  fetchOwnedArchipelagos,
  foundCity,
  type Island,
  type Lane,
  type OwnedArchipelago,
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
  const [owned, setOwned] = useState<OwnedArchipelago[]>([])
  /** The archipelago id being drawn: the season's world, or one of this player's own. */
  const [viewing, setViewing] = useState<string | null>(null)
  const [islands, setIslands] = useState<Island[]>([])
  const [lanes, setLanes] = useState<Lane[]>([])
  const [notice, setNotice] = useState<ErrorNotice | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [founding, setFounding] = useState(false)
  const [foundNotice, setFoundNotice] = useState<string | null>(null)
  const [cityName, setCityName] = useState('')
  const [plot, setPlot] = useState(1)
  /** Bumped to re-read the world being drawn, without re-asking which worlds exist. */
  const [epoch, setEpoch] = useState(0)

  /**
   * WHICH worlds this player may look at. Both reads together: the season is public and the
   * skerries are the subject's own, and a player who owns one between seasons still has somewhere
   * to be — so neither answer alone decides what this page shows.
   */
  const loadWorlds = useCallback(() => {
    setNotice(null)
    setSeason(undefined)
    Promise.all([fetchCurrentSeason(), fetchOwnedArchipelagos()])
      .then(([open, skerries]) => {
        setSeason(open)
        setOwned(skerries)
        // The season first when there is one — it is the game everybody is playing. A player who
        // has switched to their skerry stays there across a refresh of this list, because the
        // reload after founding a city must not silently move them somewhere else.
        setViewing((current) =>
          current && (current === open?.archipelagoId || skerries.some((s) => s.id === current))
            ? current
            : (open?.archipelagoId ?? skerries[0]?.id ?? null),
        )
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'The archipelago could not be loaded.')))
  }, [])

  useEffect(loadWorlds, [loadWorlds])

  // THE world being drawn. Separate from the list above so that switching worlds costs two
  // requests rather than four, and so that founding a city re-reads the map without re-deciding
  // which map it is.
  useEffect(() => {
    if (!viewing) return undefined
    let live = true
    const target = viewing
    Promise.all([fetchIslands(target), fetchLanes(target)])
      .then(([isles, winds]) => {
        if (!live) return
        setIslands(isles)
        setLanes(winds)
      })
      .catch((err: unknown) => {
        if (live) setNotice(noticeFor(err, 'That archipelago could not be loaded.'))
      })
    return () => {
      // A slow answer for the world you just switched AWAY from must not paint over the one you
      // are looking at.
      live = false
    }
  }, [viewing, epoch])

  const load = useCallback(() => {
    loadWorlds()
    setEpoch((n) => n + 1)
  }, [loadWorlds])

  const viewedSkerry = owned.find((a) => a.id === viewing) ?? null
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
  if (season === null && owned.length === 0) {
    return (
      /* `season-dawn`: a fresh archipelago at first light, founding airships fanning out. The
         screen a player sees between seasons is the one place that painting belongs — and it is
         now shown only to somebody who owns no world of their own, which is what makes the
         sentence below true rather than merely usual. */
      <Empty
        title="No season is running"
        hint="You own no private skerry, so there is no archipelago to fly over until a season opens. The Chronicle is where the world is meanwhile — every sealed season, open to anybody."
        art={splash('season-dawn')}
      />
    )
  }

  const isSeason = season !== null && viewing === season.archipelagoId
  return (
    <div className="ah-map">
      <header className="ah-page-head">
        <h1>{isSeason ? season.name : (viewedSkerry?.name ?? 'Archipelago')}</h1>
        {isSeason ? (
          <p className="ah-page-head__meta">
            Season seed <code className="cf-num">{season.seed}</code> · seals{' '}
            {new Date(season.endsAt).toLocaleDateString()}
          </p>
        ) : (
          <p className="ah-page-head__meta">
            Your own archipelago. It belongs to no season, so nothing seals it and nothing takes it
            away{viewedSkerry ? ` — raised ${new Date(viewedSkerry.createdAt).toLocaleDateString()}` : ''}.
          </p>
        )}
        {owned.length > 0 && (season !== null || owned.length > 1) && (
          <p className="ah-page-head__meta">
            <label className="ah-world-switch">
              Archipelago{' '}
              <select
                className="cf-input"
                value={viewing ?? ''}
                onChange={(e) => {
                  // Clear the selection with the world: island ids do not cross archipelagos, and
                  // a stale one would leave the panel showing a place that is not on this map.
                  setSelected(null)
                  setFoundNotice(null)
                  setViewing(e.target.value)
                }}
              >
                {season && <option value={season.archipelagoId}>{season.name} — the open season</option>}
                {owned.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — yours
                  </option>
                ))}
              </select>
            </label>
          </p>
        )}
        <p className="ah-page-head__meta">
          Aetherholm is a strategy game about cities that float. You settle a plot on an island,
          work out how to feed it, build airships, and fly them down wind lanes to trade with or
          take from everybody else. A season runs 120 days and then freezes for good in the
          Chronicle, where anybody can read it without an account.
        </p>
        <p className="ah-page-head__meta">
          It is one of the titles inside Forge Worlds, so the account you signed in with also plays
          Emberkin and Tessera. Your inventory, your achievements and the heraldry you win at the
          end of a season follow you between all three. Nothing here is sold for advantage: what a
          city can do is what you built.
        </p>
        <p className="ah-page-head__meta">
          All of it runs on Hearth, a chain with a real EVM behind it — Solidity deploys, and
          MetaMask, ethers, viem, Hardhat and Foundry work against it unmodified. Its currency,
          EMBER, is what the rest of the ecosystem pays in, and you can mine it from a browser tab
          on a key that never leaves your own machine. EMBER carries no monetary value, and nothing
          here is an offer to buy or sell.
        </p>
        <p className="ah-page-head__note ah-legend">
          <span className="ah-legend__item">
            {spireGlyph && <img className="ah-glyph" src={spireGlyph} alt="" aria-hidden="true" />}
            Aether Spire — what the season is fought over
          </span>
          <span className="ah-legend__item">
            {laneGlyph && <img className="ah-glyph" src={laneGlyph} alt="" aria-hidden="true" />}
            A wind lane. Each direction is drawn on its own, because they do not cost the same
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
          {!selectedIsland && !viewedSkerry && (
            <Empty title="Pick an island" hint="Choose one on the map and its winds, its free plots and the form to settle there appear here." />
          )}
          {!selectedIsland && viewedSkerry && (
            /*
              `splashes/private-skerry` — "a small private archipelago at lantern-lit evening …
              intimate and calm, far from any war" (its own prompt, public/art/MANIFEST.json). It
              was held out of this bundle since the art set landed, for a reason that was true when
              it was written: the mechanic was built and sold and no route could hand a client the
              id of one. That route exists now (micro-org#332) and this is the screen the picture
              was waiting for — the panel a skerry's owner reads before they have chosen anywhere
              to settle. It is hung on the world it depicts, not on an unrelated screen, which is
              the rule `UNSHIPPED` in tools/sync-art.mjs states and test/art.test.ts enforces.

              The island count is READ, never asserted: the service seeds twelve
              (`aetherholm/src/world.ts`), and a number written here would be this client keeping a
              private copy of a constant it is already being told.
            */
            <Empty
              title={viewedSkerry.name}
              hint={`Your own archipelago: ${islands.length} islands and their own winds, seeded from the purchase itself, so this map is yours and no one else's. Pick an island to settle it.`}
              art={splash('private-skerry')}
            />
          )}
          {selectedIsland && (
            <>
              {/*
                ═══════════════════════════════════════════════════════════════════════════════
                THE BAND IS DATA. THE BIOME IS ILLUSTRATION. THE CAPTION SAYS SO, AND MUST.

                `islandArt` picks `<band>_<biome>` from the twelve archetype paintings. The band
                comes off the wire and is constrained at the database
                (`aetherholm/src/migrations.ts`). The biome does NOT exist: no route, no
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
                    A {selectedIsland.band} island. The game keeps no terrain of its own, so the{' '}
                    {islandBiome(selectedIsland.idx)} scene above was picked from this island&apos;s
                    number to give it a face. Enjoy it; do not plan around it.
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
                  {founding ? 'Settling…' : 'Settle here'}
                </button>
                <p className="ah-dim">
                  Settle and nobody can attack you for seven days. That protection comes with the city, costs nothing, and is not for sale at any price to anybody.
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
