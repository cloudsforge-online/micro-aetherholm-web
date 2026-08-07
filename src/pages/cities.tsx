/**
 * The city view: live stocks, the queues, the shipyard.
 *
 * STOCKS TICK WITHOUT A REQUEST. The service's economy is lazy — no tick, computed on read from
 * `(lastSettledAt, rates, caps)` (`aetherholm/src/economy.ts`) — and the city view it returns
 * carries all of those fields (`aetherholm/src/cities.ts`). So this page projects the
 * stocks forward every second with the SAME floor arithmetic (`projectStocks`, mirrored from
 * `aetherholm/src/economy.ts`) instead of polling. The interval below repaints a number;
 * it does no domain work, fetches nothing, and the server's own settlement remains the truth the
 * moment any write answers.
 *
 * The forms show REAL costs now: `GET /v1/content/buildings` and `/v1/content/research`
 * (`aetherholm/src/server.ts`) serve values computed by the exact functions the
 * engine charges from, closing the gap this header used to record below. The old text, kept for
 * the reasoning it carried:
 *
 * WHAT THE FORMS DID NOT SHOW: building and research costs. The service serves content for
 * airships only (`GET /v1/content/airships`, `aetherholm/src/server.ts`); building and
 * research cost curves live server-side (`aetherholm/src/content.ts`) with no route. A
 * cost this client computed from a private copy would drift the day the curves move to the
 * assets repository, so the forms say "charged at queue time" and the reply's settled stocks
 * show exactly what it cost. Recorded in the README's known gaps; ship costs ARE served, so the
 * shipyard shows them.
 *
 * The type/node/class vocabularies below are the CONTRACT counts of doc §4 — 20 buildings, 32
 * nodes, 10 classes — spelled as `aetherholm/src/content.ts` spells them; the
 * shipyard's list comes from the content route at runtime, never from here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import {
  fetchAirships,
  fetchCities,
  newIdempotencyKey,
  queueBuilding,
  queueResearch,
  queueShip,
  type AirshipSpec,
  type City,
  fetchBuildingContent,
  fetchResearchContent,
  type BuildingContent,
  type ResearchContent,
} from '../lib/aetherholm.ts'
import {
  RESOURCES,
  formatAmount,
  formatDuration,
  groupDigits,
  projectStocks,
  secondsUntil,
  toBigInt,
} from '../lib/format.ts'
import { Empty, Failed, Forbidden, Loading } from '../components/states.tsx'
import { buildingArt, queueIcon, resourceIcon, shipIcon, statusIcon } from '../lib/art.ts'

/** The 20 building types, as the schema spells them (`aetherholm/src/content.ts`). */
const BUILDING_TYPES = [
  'skyhall', 'well_rig', 'cloudstone_quarry', 'skysteel_forge', 'terrace_farm',
  'warehouse', 'vault', 'residences', 'aerodock', 'launch_rails',
  'windworks', 'academy', 'watchspire', 'storm_anchor', 'bulwark_ring',
  'trade_gantry', 'guild_beacon', 'charthouse', 'infirmary', 'hall_of_banners',
] as const

/** The 32 research nodes in their 4 branches (`aetherholm/src/content.ts`). */
const RESEARCH_NODES: Readonly<Record<string, readonly string[]>> = {
  economy: ['well_lore', 'cistern_craft', 'quarry_songs', 'ledger_discipline', 'terraced_bounty', 'vault_locks', 'guild_charters', 'deep_veins'],
  aeronautics: ['gasbag_trim', 'keel_balance', 'wind_reading', 'lift_theory', 'aether_burners', 'storm_rigging', 'long_hauls', 'flagship_doctrine'],
  warfare: ['boarding_drills', 'gun_carriages', 'armour_plating', 'initiative_drills', 'siege_breakers', 'watch_networks', 'bulwark_engineering', 'banner_command'],
  statecraft: ['well_meetings', 'trade_pacts', 'charter_law', 'beacon_diplomacy', 'chronicle_keeping', 'heraldry', 'alliance_bonds', 'season_rites'],
}

const label = (snake: string): string => snake.replace(/_/g, ' ')

/**
 * A generated glyph beside a word, or nothing at all.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE `alt` IS EMPTY AND THE WORD IS ALWAYS THERE. Every one of these sits next to the label it
 * illustrates — "aether" beside the aether icon, "skyhall" beside the skyhall sprite — so giving
 * the image its own accessible name would make a screen reader say the same word twice in a row,
 * in every row of a four-row table. The picture is redundant BY DESIGN: it is there so a player
 * can find a row without reading it, which is a service to sighted scanning and to nobody else.
 *
 * `src` is `string | null` from `lib/art.ts`, and `null` renders NOTHING rather than a fallback
 * image. A resource the art set has never heard of shows its name, unadorned, which is what a
 * missing picture should look like.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */
function Glyph({ src, className }: { src: string | null; className: string }) {
  if (!src) return null
  return <img className={className} src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
}

export function CitiesPage() {
  const [cities, setCities] = useState<City[] | undefined>(undefined)
  const [airships, setAirships] = useState<Record<string, AirshipSpec>>({})
  const [notice, setNotice] = useState<ErrorNotice | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(() => {
    setNotice(null)
    setCities(undefined)
    Promise.all([fetchCities(), fetchAirships()])
      .then(([mine, classes]) => {
        setCities(mine)
        setAirships(classes)
        setSelectedId((current) => current ?? mine[0]?.id ?? null)
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'Your cities could not be loaded.')))
  }, [])

  useEffect(load, [load])

  // Display clock only: repaints the projected stocks and countdowns. No fetch, no domain work.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  /*
   * THE PAGE HEAD IS RENDERED IN EVERY STATE, not only when there is a city.
   *
   * It used to be inside the city view alone, so /cities carried NO HEADING AT ALL while it was
   * loading, while it had failed, and for any player who has not founded yet — which is every new
   * player. A page with no heading gives a screen-reader user nothing to navigate by and nothing
   * to confirm which page they are on, and it is invisible to anything that reads the source: the
   * heading is right there, three states away. Found by walking the landmarks of every route in a
   * browser (test/browser-journeys.test.ts, BJ-A11Y-12).
   */
  const head = (
    <header className="ah-page-head">
      <h1>Cities</h1>
    </header>
  )

  if (notice) {
    return (
      <>
        {head}
        {notice.forbidden ? <Forbidden notice={notice} /> : <Failed notice={notice} onRetry={load} />}
      </>
    )
  }
  if (cities === undefined) {
    return (
      <>
        {head}
        <Loading label="Settling the ledgers" />
      </>
    )
  }
  if (cities.length === 0) {
    return (
      <>
        {head}
        <Empty
          title="You hold no cities this season"
          hint="Pick an island on the archipelago map and settle a plot. Nobody can touch you for the first seven days."
        />
      </>
    )
  }

  const city = cities.find((c) => c.id === selectedId) ?? cities[0] ?? null

  return (
    <div className="ah-cities">
      <nav className="ah-city-tabs" aria-label="Your cities">
        {cities.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ah-city-tab${c.id === city?.id ? ' is-active' : ''}`}
            onClick={() => setSelectedId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {city && <CityDetail city={city} airships={airships} now={now} onChanged={load} />}
    </div>
  )
}

function CityDetail({
  city,
  airships,
  now,
  onChanged,
}: {
  city: City
  airships: Record<string, AirshipSpec>
  now: Date
  onChanged: () => void
}) {
  const [buildContent, setBuildContent] = useState<Record<string, BuildingContent>>({})
  const [researchContent, setResearchContent] = useState<Record<string, ResearchContent>>({})
  useEffect(() => {
    fetchBuildingContent().then(setBuildContent).catch(() => setBuildContent({}))
    fetchResearchContent().then(setResearchContent).catch(() => setResearchContent({}))
  }, [])
  const stocks = useMemo(
    () => projectStocks(city.stocks, city.rates, city.storageCap, city.settledAt, now),
    [city, now],
  )
  const cap = toBigInt(city.storageCap, 'storageCap')
  const aegisSeconds = secondsUntil(city.aegisUntil, now)
  const aerodockLevel = city.buildings.find((b) => b.type === 'aerodock')?.level ?? 0
  const pending = city.queue.filter((item) => item.status !== 'done')

  return (
    <section className="ah-city">
      <header className="ah-page-head">
        <h1>{city.name}</h1>
        <p className="ah-page-head__meta">
          Plot {city.plot} · {city.band} band
          {aegisSeconds > 0 && (
            <>
              {' · '}
              <Glyph src={statusIcon('aegis')} className="ah-glyph ah-glyph--inline" />
              under aegis for {formatDuration(aegisSeconds)}
            </>
          )}
        </p>
      </header>

      <h2>Stocks</h2>
      <p className="ah-dim">
        Worked out here as you watch, from your last settled position, using the same rounding the
        server bills by. You can hold {formatAmount(cap)} of each resource before the rest spills.
      </p>
      <table className="ah-table">
        <thead>
          <tr>
            <th scope="col">Resource</th>
            <th scope="col" className="ah-num">In store</th>
            <th scope="col" className="ah-num">Per hour</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => (
            <tr key={resource}>
              <th scope="row" className="ah-cell--glyphed">
                <Glyph src={resourceIcon(resource)} className="ah-glyph" />
                {resource}
              </th>
              <td className="ah-num">
                <code className="cf-num">{formatAmount(stocks[resource])}</code>
              </td>
              <td className="ah-num">
                <code className="cf-num">+{groupDigits(city.rates[resource] ?? '0')}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Queues</h2>
      {pending.length === 0 && <p className="ah-dim">Nothing is being built.</p>}
      {pending.length > 0 && (
        <ul className="ah-queue">
          {pending.map((item) => (
            <li key={item.id}>
              {/* Three kinds, three glyphs, and the mapping is a checked table rather than a
                  template string — see `queueIcon` in lib/art.ts for why that distinction has
                  teeth here and nowhere else in this file. */}
              <Glyph src={queueIcon(item.kind)} className="ah-glyph" />
              <span className="ah-queue__kind">{item.kind}</span> {label(item.target)} — done in{' '}
              {formatDuration(secondsUntil(item.completesAt, now))}
            </li>
          ))}
        </ul>
      )}

      <div className="ah-forms">
        <QueueForm
          title="Put up a building"
          options={BUILDING_TYPES.map((t) => {
            const c = buildContent[t]
            return {
              value: t,
              label: c
                ? `${label(t)} — L1: ${c.baseCost['aether']}⚡ ${c.baseCost['cloudstone']}🪨 (cost × level)`
                : label(t),
            }
          })}
          submit={(target, key) => queueBuilding(city.id, target, key)}
          onDone={onChanged}
          note="These prices come from the engine that charges them: the base cost times the next level. Once it is queued you will see what your stores look like after paying."
        />
        <QueueForm
          title="Research something"
          options={Object.entries(RESEARCH_NODES).flatMap(([branch, nodes]) =>
            nodes.map((node) => {
              const c = researchContent[node]
              return {
                value: node,
                label: c
                  ? `${branch} — ${label(node)} — ${c.cost['aether']}⚡, ${formatDuration(c.durationSeconds)}`
                  : `${branch} — ${label(node)}`,
              }
            }),
          )}
          submit={(target, key) => queueResearch(city.id, target, key)}
          onDone={onChanged}
          note="The costs and times above are the game\u2019s own figures, not something this page worked out."
        />
        <QueueForm
          title="Start a ship"
          options={Object.entries(airships).map(([cls, spec]) => ({
            value: cls,
            label: `${label(cls)} — needs aerodock ${spec.aerodock}${spec.aerodock > aerodockLevel ? ' (yours is lower)' : ''}`,
          }))}
          submit={(target, key) => queueShip(city.id, target, key)}
          onDone={onChanged}
          note="What a ship costs is in the class table further down."
        />
      </div>

      <h2>Garrison</h2>
      {city.ships.length === 0 && <p className="ah-dim">Nothing is moored here.</p>}
      {city.ships.length > 0 && (
        <ul className="ah-garrison">
          {city.ships.map((s) => (
            <li key={s.class}>
              <Glyph src={shipIcon(s.class)} className="ah-glyph" />
              {label(s.class)} × <code className="cf-num">{groupDigits(s.count)}</code>
            </li>
          ))}
        </ul>
      )}

      <h2>The class table</h2>
      <p className="ah-dim">Straight from the game. The figures are shown whole, with nothing rounded off.</p>
      <div className="ah-scroll">
        <table className="ah-table">
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Role</th>
              <th scope="col" className="ah-num">Aether</th>
              <th scope="col" className="ah-num">Cloudstone</th>
              <th scope="col" className="ah-num">Skysteel</th>
              <th scope="col" className="ah-num">Provisions</th>
              <th scope="col" className="ah-num">Hold</th>
              <th scope="col" className="ah-num">Build</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(airships).map(([cls, spec]) => (
              <tr key={cls}>
                <th scope="row" className="ah-cell--glyphed">
                  {/* Keyed on the class the SERVICE sent, never on a list held here — an
                      eleventh hull would arrive with no icon rather than with the wrong one. */}
                  <Glyph src={shipIcon(cls)} className="ah-glyph" />
                  {label(cls)}
                </th>
                <td>{spec.role}</td>
                <td className="ah-num"><code className="cf-num">{groupDigits(spec.cost['aether'] ?? '0')}</code></td>
                <td className="ah-num"><code className="cf-num">{groupDigits(spec.cost['cloudstone'] ?? '0')}</code></td>
                <td className="ah-num"><code className="cf-num">{groupDigits(spec.cost['skysteel'] ?? '0')}</code></td>
                <td className="ah-num"><code className="cf-num">{groupDigits(spec.cost['provisions'] ?? '0')}</code></td>
                <td className="ah-num"><code className="cf-num">{groupDigits(spec.cargo)}</code></td>
                <td className="ah-num">{formatDuration(spec.buildSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Buildings</h2>
      {city.buildings.length === 0 && <p className="ah-dim">Bare ground. Nothing built.</p>}
      {city.buildings.length > 0 && (
        /*
         * The one place in this client where the generated art is the CONTENT rather than a
         * glyph beside a word. Twenty building types, twenty 512² sprites, and the slugs are the
         * type names verbatim — so this list is keyed on `b.type` straight off the wire with no
         * translation step to get wrong. A type the art set does not know renders as its name on
         * a bare tile; see `buildingArt` in lib/art.ts.
         */
        <ul className="ah-buildings">
          {city.buildings.map((b) => (
            <li key={b.type} className="ah-buildings__item">
              <Glyph src={buildingArt(b.type)} className="ah-buildings__sprite" />
              <span className="ah-buildings__name">{label(b.type)}</span>
              <span className="ah-buildings__level">level {b.level}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QueueForm({
  title,
  options,
  submit,
  onDone,
  note,
}: {
  title: string
  options: ReadonlyArray<{ value: string; label: string }>
  submit: (target: string, key: string) => Promise<unknown>
  onDone: () => void
  note: string
}) {
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit() {
    if (!target) return
    setBusy(true)
    setMessage(null)
    try {
      // One key per submission: a retry of THIS click replays, a second click is a second order.
      await submit(target, newIdempotencyKey())
      setMessage('Queued.')
      onDone()
    } catch (err) {
      setMessage(noticeFor(err, 'That was turned down.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="ah-form"
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit()
      }}
    >
      <h3>{title}</h3>
      <select className="cf-select" value={target} onChange={(e) => setTarget(e.target.value)} required>
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" className="cf-btn" disabled={busy || !target}>
        {busy ? 'Starting…' : 'Start it'}
      </button>
      <p className="ah-dim">{note}</p>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
