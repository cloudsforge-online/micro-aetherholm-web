/**
 * Fleet control: compose from the ten classes, see the Aether cost BEFORE the commit, watch
 * arrivals.
 *
 * The price tag is the rule here (docs/ecosystem/20-aetherholm.md §5): the launch button stays
 * disabled until a preview exists, and the preview — travel time each way, the round-trip Aether
 * lift, the cargo hold — is computed in src/lib/lattice.ts from the same served constants the
 * server charges by. When the server answers, its OWN `aetherLift` is shown on the fleet row;
 * if the two ever disagree, the server's number is the bill and the preview was the estimate.
 *
 * No battle is fought here. A raid or siege resolves server-side when the fleet arrives, as a
 * leased job; this page shows the flight. Reports are read on the Battles page, by id — the
 * service exposes no route listing a player's battles (README, known gaps), so the id arrives by
 * notification or from the sealed chronicle.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import {
  fetchAirships,
  fetchCities,
  fetchCurrentSeason,
  fetchIslands,
  fetchLanes,
  fetchFleets,
  launchFleet,
  newIdempotencyKey,
  type AirshipSpec,
  type City,
  type Fleet,
  type Island,
  type Lane,
  type Mission,
} from '../lib/aetherholm.ts'
import { previewLaunch } from '../lib/lattice.ts'
import {
  RESOURCES,
  formatAmount,
  formatDuration,
  groupDigits,
  secondsUntil,
  toBigInt,
} from '../lib/format.ts'
import { Empty, Failed, Forbidden, Loading } from '../components/states.tsx'
import { shipProfile, splash, uiIcon } from '../lib/art.ts'

const label = (snake: string): string => snake.replace(/_/g, ' ')

export function FleetsPage() {
  const [fleets, setFleets] = useState<Fleet[] | undefined>(undefined)
  const [cities, setCities] = useState<City[]>([])
  const [islands, setIslands] = useState<Island[]>([])
  const [lanes, setLanes] = useState<Lane[]>([])
  const [airships, setAirships] = useState<Record<string, AirshipSpec>>({})
  const [notice, setNotice] = useState<ErrorNotice | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(() => {
    setNotice(null)
    setFleets(undefined)
    Promise.all([fetchFleets(), fetchCities(), fetchAirships(), fetchCurrentSeason()])
      .then(async ([mine, owned, classes, season]) => {
        setFleets(mine)
        setCities(owned)
        setAirships(classes)
        if (season) {
          const [isles, winds] = await Promise.all([
            fetchIslands(season.archipelagoId),
            fetchLanes(season.archipelagoId),
          ])
          setIslands(isles)
          setLanes(winds)
        }
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'Your fleets could not be loaded.')))
  }, [])

  useEffect(load, [load])

  // Display clock: repaints countdowns. No fetch, no domain work.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (notice) {
    return notice.forbidden ? <Forbidden notice={notice} /> : <Failed notice={notice} onRetry={load} />
  }
  if (fleets === undefined) return <Loading label="Sighting the sky" />

  const fleetGlyph = uiIcon('fleet')

  return (
    <div className="ah-fleets">
      <header className="ah-page-head ah-page-head--glyphed">
        {fleetGlyph && <img className="ah-page-head__glyph" src={fleetGlyph} alt="" aria-hidden="true" />}
        <h1>Fleets</h1>
      </header>

      {fleets.length === 0 && (
        /* `trade-flotilla`: a convoy of freight haulers riding a lane. The one splash in the set
           that paints what this page is for, on the one screen where a player has none of it. */
        <Empty
          title="Nothing in the air"
          hint="Compose a fleet below. The cost shows before you commit."
          art={splash('trade-flotilla')}
        />
      )}
      {fleets.length > 0 && (
        <div className="ah-scroll">
          <table className="ah-table">
            <thead>
              <tr>
                <th scope="col">Mission</th>
                <th scope="col">Ships</th>
                <th scope="col">Status</th>
                <th scope="col" className="ah-num">Aether lift paid</th>
                <th scope="col">Arrives</th>
                <th scope="col">Returns</th>
              </tr>
            </thead>
            <tbody>
              {fleets.map((fleet) => (
                <tr key={fleet.id}>
                  <th scope="row">{fleet.mission}</th>
                  <td>
                    {Object.entries(fleet.ships)
                      .map(([cls, count]) => `${label(cls)}×${count}`)
                      .join(', ')}
                  </td>
                  <td>{fleet.status}</td>
                  <td className="ah-num">
                    <code className="cf-num">{groupDigits(fleet.aetherLift)}</code>
                  </td>
                  <td>{arrival(fleet.arrivesAt, now)}</td>
                  <td>{fleet.returnsAt ? arrival(fleet.returnsAt, now) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cities.length > 0 ? (
        <Composer cities={cities} islands={islands} lanes={lanes} airships={airships} onLaunched={load} />
      ) : (
        <p className="ah-dim">Found a city first; a fleet needs a harbour.</p>
      )}
    </div>
  )
}

function arrival(iso: string, now: Date): string {
  const seconds = secondsUntil(iso, now)
  return seconds === 0 ? 'due' : `in ${formatDuration(seconds)}`
}

function Composer({
  cities,
  islands,
  lanes,
  airships,
  onLaunched,
}: {
  cities: City[]
  islands: Island[]
  lanes: Lane[]
  airships: Record<string, AirshipSpec>
  onLaunched: () => void
}) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? '')
  const [mission, setMission] = useState<Mission>('transfer')
  const [targetIslandId, setTargetIslandId] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cargo, setCargo] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const origin = cities.find((c) => c.id === cityId) ?? null
  const garrison = useMemo(() => {
    const held = new Map<string, bigint>()
    for (const s of origin?.ships ?? []) held.set(s.class, toBigInt(s.count, 'garrison'))
    return held
  }, [origin])

  const ships = useMemo(
    () => Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)),
    [counts],
  )

  const preview = useMemo(() => {
    if (!origin || !targetIslandId || Object.keys(ships).length === 0) return null
    return previewLaunch(lanes, airships, ships, origin.islandId, targetIslandId)
  }, [origin, targetIslandId, ships, lanes, airships])

  const cargoTotal = useMemo(() => {
    let total = 0n
    for (const value of Object.values(cargo)) {
      if (/^\d+$/.test(value)) total += BigInt(value)
    }
    return total
  }, [cargo])

  const overHold = preview !== null && cargoTotal > preview.cargoHold
  const canLaunch = preview !== null && !busy && !overHold

  async function onLaunch() {
    if (!origin || !preview) return
    setBusy(true)
    setMessage(null)
    try {
      const sending = Object.fromEntries(Object.entries(cargo).filter(([, v]) => /^\d+$/.test(v) && v !== '0'))
      const reply = await launchFleet(
        {
          cityId: origin.id,
          mission,
          targetIslandId,
          ships,
          ...(mission === 'transfer' && Object.keys(sending).length > 0 ? { cargo: sending } : {}),
        },
        newIdempotencyKey(),
      )
      setMessage(
        reply.replayed
          ? 'That launch was already recorded; nothing was charged twice.'
          : `Launched. The treasury was charged ${groupDigits(reply.fleet.aetherLift)} Aether lift.`,
      )
      setCounts({})
      setCargo({})
      onLaunched()
    } catch (err) {
      setMessage(noticeFor(err, 'The launch was refused.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ah-composer">
      <h2>Compose a launch</h2>
      <form
        className="ah-form"
        onSubmit={(e) => {
          e.preventDefault()
          void onLaunch()
        }}
      >
        <div className="ah-form__row">
          <label>
            From
            <select className="cf-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mission
            <select
              className="cf-select"
              value={mission}
              onChange={(e) => setMission(e.target.value as Mission)}
            >
              <option value="transfer">transfer</option>
              <option value="raid">raid</option>
              <option value="siege">siege</option>
            </select>
          </label>
          <label>
            To island
            <select
              className="cf-select"
              value={targetIslandId}
              onChange={(e) => setTargetIslandId(e.target.value)}
              required
            >
              <option value="" disabled>
                Choose…
              </option>
              {islands
                .filter((i) => i.id !== origin?.islandId)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    island {i.idx} ({i.band})
                  </option>
                ))}
            </select>
          </label>
        </div>

        <fieldset className="ah-ships">
          <legend>Ships — your garrison is the ceiling</legend>
          {/*
            THE SIDE PROFILES, WHICH IS THE WHOLE REASON THE `ships` SET IS 1024×512 AND NOT
            SQUARE. Ten hulls, drawn broadside, and this is the screen where a player chooses
            between them — the class table on /cities prices them and this one is where the
            silhouette does work no number can: a skiff and a flagship are two words and two very
            different shapes. The 256² `shipicons` are used instead wherever the ship is a row in
            a table rather than a thing being picked.

            Keyed on the class string the SERVICE sent (`GET /v1/content/airships`), never on a
            list spelled here, and `shipProfile` answers null for a hull the art set predates.
          */}
          {Object.entries(airships).map(([cls, spec]) => {
            const held = garrison.get(cls) ?? 0n
            const profile = shipProfile(cls)
            return (
              <label key={cls} className="ah-ships__row">
                {profile && (
                  <img
                    className="ah-ships__profile"
                    src={profile}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span>
                  {label(cls)} <span className="ah-dim">({spec.role}, holds {groupDigits(spec.cargo)})</span>
                </span>
                <input
                  className="cf-input cf-input--mono"
                  type="number"
                  min={0}
                  max={Number(held > 9999n ? 9999n : held)}
                  value={counts[cls] ?? 0}
                  onChange={(e) =>
                    setCounts((prev) => ({ ...prev, [cls]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  disabled={held === 0n}
                />
                <span className="ah-dim">of {groupDigits(held.toString())}</span>
              </label>
            )
          })}
        </fieldset>

        {mission === 'transfer' && (
          <fieldset className="ah-cargo">
            <legend>Cargo — decimal amounts, carried in freight holds only</legend>
            {RESOURCES.map((resource) => (
              <label key={resource} className="ah-ships__row">
                <span>{resource}</span>
                <input
                  className="cf-input cf-input--mono"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cargo[resource] ?? ''}
                  placeholder="0"
                  onChange={(e) => setCargo((prev) => ({ ...prev, [resource]: e.target.value }))}
                />
              </label>
            ))}
          </fieldset>
        )}

        <div className="ah-preview" aria-live="polite">
          {preview === null && (
            <p className="ah-dim">
              Pick ships and a destination to price the launch. No route, no price, no button.
            </p>
          )}
          {preview !== null && (
            <>
              <p className="ah-preview__cost">
                Aether cost: <code className="cf-num">{formatAmount(preview.aetherLift)}</code> — charged
                at launch for the whole round trip.
              </p>
              <p>
                Out {formatDuration(preview.travelSeconds)} · back {formatDuration(preview.returnSeconds)} ·
                hold <code className="cf-num">{formatAmount(preview.cargoHold)}</code>
                {overHold && <strong className="ah-warn"> — cargo exceeds the hold; the launch would be refused</strong>}
              </p>
              <p className="ah-dim">
                Priced from the served class table and lanes, the same constants the server charges
                by. Alliance shared lanes can only make the true cost lower, never higher.
              </p>
            </>
          )}
        </div>

        <button type="submit" className="cf-btn cf-btn--ember" disabled={!canLaunch}>
          {busy ? 'Launching…' : 'Launch — the cost above is the commitment'}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  )
}
