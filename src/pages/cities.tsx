/**
 * The city view: live stocks, the queues, the shipyard.
 *
 * STOCKS TICK WITHOUT A REQUEST. The service's economy is lazy — no tick, computed on read from
 * `(lastSettledAt, rates, caps)` (`aetherholm/src/economy.ts:88`) — and the city view it returns
 * carries all of those fields (`aetherholm/src/cities.ts:92-110`). So this page projects the
 * stocks forward every second with the SAME floor arithmetic (`projectStocks`, mirrored from
 * `aetherholm/src/economy.ts:34-39`) instead of polling. The interval below repaints a number;
 * it does no domain work, fetches nothing, and the server's own settlement remains the truth the
 * moment any write answers.
 *
 * WHAT THE FORMS DO NOT SHOW: building and research costs. The service serves content for
 * airships only (`GET /v1/content/airships`, `aetherholm/src/server.ts:490`); building and
 * research cost curves live server-side (`aetherholm/src/content.ts:197-235`) with no route. A
 * cost this client computed from a private copy would drift the day the curves move to the
 * assets repository, so the forms say "charged at queue time" and the reply's settled stocks
 * show exactly what it cost. Recorded in the README's known gaps; ship costs ARE served, so the
 * shipyard shows them.
 *
 * The type/node/class vocabularies below are the CONTRACT counts of doc §4 — 20 buildings, 32
 * nodes, 10 classes — spelled as `aetherholm/src/content.ts:23-44` and `:55-96` spell them; the
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

/** The 20 building types, as the schema spells them (`aetherholm/src/content.ts:23-44`). */
const BUILDING_TYPES = [
  'skyhall', 'well_rig', 'cloudstone_quarry', 'skysteel_forge', 'terrace_farm',
  'warehouse', 'vault', 'residences', 'aerodock', 'launch_rails',
  'windworks', 'academy', 'watchspire', 'storm_anchor', 'bulwark_ring',
  'trade_gantry', 'guild_beacon', 'charthouse', 'infirmary', 'hall_of_banners',
] as const

/** The 32 research nodes in their 4 branches (`aetherholm/src/content.ts:55-96`). */
const RESEARCH_NODES: Readonly<Record<string, readonly string[]>> = {
  economy: ['well_lore', 'cistern_craft', 'quarry_songs', 'ledger_discipline', 'terraced_bounty', 'vault_locks', 'guild_charters', 'deep_veins'],
  aeronautics: ['gasbag_trim', 'keel_balance', 'wind_reading', 'lift_theory', 'aether_burners', 'storm_rigging', 'long_hauls', 'flagship_doctrine'],
  warfare: ['boarding_drills', 'gun_carriages', 'armour_plating', 'initiative_drills', 'siege_breakers', 'watch_networks', 'bulwark_engineering', 'banner_command'],
  statecraft: ['well_meetings', 'trade_pacts', 'charter_law', 'beacon_diplomacy', 'chronicle_keeping', 'heraldry', 'alliance_bonds', 'season_rites'],
}

const label = (snake: string): string => snake.replace(/_/g, ' ')

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

  if (notice) {
    return notice.forbidden ? <Forbidden notice={notice} /> : <Failed notice={notice} onRetry={load} />
  }
  if (cities === undefined) return <Loading label="Settling the ledgers" />
  if (cities.length === 0) {
    return (
      <Empty
        title="You hold no cities this season"
        hint="Found one from the archipelago map. The first seven days are under aegis."
      />
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
          {aegisSeconds > 0 && <> · under aegis for {formatDuration(aegisSeconds)}</>}
        </p>
      </header>

      <h2>Stocks</h2>
      <p className="ah-dim">
        Computed live from the settled position — the same floor arithmetic the server charges by.
        Cap {formatAmount(cap)} per resource.
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
              <th scope="row">{resource}</th>
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
      {pending.length === 0 && <p className="ah-dim">Nothing queued.</p>}
      {pending.length > 0 && (
        <ul className="ah-queue">
          {pending.map((item) => (
            <li key={item.id}>
              <span className="ah-queue__kind">{item.kind}</span> {label(item.target)} — done in{' '}
              {formatDuration(secondsUntil(item.completesAt, now))}
            </li>
          ))}
        </ul>
      )}

      <div className="ah-forms">
        <QueueForm
          title="Queue a building"
          options={BUILDING_TYPES.map((t) => ({ value: t, label: label(t) }))}
          submit={(target, key) => queueBuilding(city.id, target, key)}
          onDone={onChanged}
          note="Cost is charged at queue time from your settled stocks; the reply shows the position after the charge."
        />
        <QueueForm
          title="Queue research"
          options={Object.entries(RESEARCH_NODES).flatMap(([branch, nodes]) =>
            nodes.map((node) => ({ value: node, label: `${branch} — ${label(node)}` })),
          )}
          submit={(target, key) => queueResearch(city.id, target, key)}
          onDone={onChanged}
          note="Cost is charged at queue time; deeper nodes cost and take more."
        />
        <QueueForm
          title="Lay a keel"
          options={Object.entries(airships).map(([cls, spec]) => ({
            value: cls,
            label: `${label(cls)} — needs aerodock ${spec.aerodock}${spec.aerodock > aerodockLevel ? ' (yours is lower)' : ''}`,
          }))}
          submit={(target, key) => queueShip(city.id, target, key)}
          onDone={onChanged}
          note="Ship costs come from the served class table below."
        />
      </div>

      <h2>Garrison</h2>
      {city.ships.length === 0 && <p className="ah-dim">No ships in harbour.</p>}
      {city.ships.length > 0 && (
        <ul className="ah-garrison">
          {city.ships.map((s) => (
            <li key={s.class}>
              {label(s.class)} × <code className="cf-num">{groupDigits(s.count)}</code>
            </li>
          ))}
        </ul>
      )}

      <h2>The class table</h2>
      <p className="ah-dim">As served by the game — amounts are decimal strings, rendered without rounding.</p>
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
                <th scope="row">{label(cls)}</th>
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
      {city.buildings.length === 0 && <p className="ah-dim">Bare plots so far.</p>}
      {city.buildings.length > 0 && (
        <ul className="ah-garrison">
          {city.buildings.map((b) => (
            <li key={b.type}>
              {label(b.type)} · level {b.level}
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
      setMessage(noticeFor(err, 'The queue refused that.').message)
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
        {busy ? 'Queueing…' : 'Queue'}
      </button>
      <p className="ah-dim">{note}</p>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
