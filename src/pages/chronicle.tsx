/**
 * The chronicle browser: sealed seasons, anonymous — the only unauthenticated data this game
 * serves.
 *
 * Every read on this page goes out with `auth: false` (src/lib/aetherholm.ts): sealed seasons
 * are public history (`aetherholm/src/server.ts:796-798`), and sending a token to a route that
 * cannot use one would be a needless credential on the wire. A signed-out visitor gets the whole
 * page, which is the point — the chronicle is the game showing itself to people who have not
 * installed it (docs/ecosystem/20-aetherholm.md §10.1).
 *
 * A SEALED SEASON IS HISTORY. There is no button on this page that writes, because there is
 * nothing to write to: the service serves no mutation for sealed data, and the database refuses
 * UPDATE and DELETE by trigger even to a caller holding a connection
 * (`aetherholm/src/migrations.ts:667`, `:679`). The digests are displayed in full — the season's
 * over its canonicalised summary, each battle's over its inputs and result — because a chronicle
 * whose digests are hidden is a chronicle you are asked to trust rather than check.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import {
  fetchChronicle,
  fetchChronicleBattles,
  fetchChronicleSeasons,
  type Chronicle,
  type ChronicleSeason,
  type SealedBattle,
} from '../lib/aetherholm.ts'
import { formatMultiplier, shortDigest } from '../lib/format.ts'
import { Empty, Failed, Loading } from '../components/states.tsx'

export function ChroniclePage() {
  const [params, setParams] = useSearchParams()
  const seasonId = params.get('season')

  return seasonId ? (
    <SealedSeason seasonId={seasonId} onBack={() => setParams({})} />
  ) : (
    <SeasonList onOpen={(id) => setParams({ season: id })} />
  )
}

function SeasonList({ onOpen }: { onOpen: (id: string) => void }) {
  const [seasons, setSeasons] = useState<ChronicleSeason[] | undefined>(undefined)
  const [notice, setNotice] = useState<ErrorNotice | null>(null)

  const load = useCallback(() => {
    setNotice(null)
    setSeasons(undefined)
    fetchChronicleSeasons()
      .then(setSeasons)
      .catch((err: unknown) => setNotice(noticeFor(err, 'The chronicle could not be read.')))
  }, [])

  useEffect(load, [load])

  if (notice) return <Failed notice={notice} onRetry={load} />
  if (seasons === undefined) return <Loading label="Opening the chronicle" />

  return (
    <div className="ah-chronicle">
      <header className="ah-page-head">
        <h1>The chronicle</h1>
        <p className="ah-page-head__meta">
          Sealed seasons, public and immutable. No account needed; nothing here can be changed —
          by anyone.
        </p>
      </header>

      {seasons.length === 0 && (
        <Empty title="No season has sealed yet" hint="At day 120 the archipelago freezes and appears here." />
      )}
      {seasons.length > 0 && (
        <div className="ah-scroll">
          <table className="ah-table">
            <thead>
              <tr>
                <th scope="col">Season</th>
                <th scope="col">Sealed</th>
                <th scope="col">Seed</th>
                <th scope="col">Digest</th>
                <th scope="col">
                  <span className="cf-sr">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => (
                <tr key={season.seasonId}>
                  <th scope="row">{season.name}</th>
                  <td>{new Date(season.sealedAt).toLocaleDateString()}</td>
                  <td>
                    <code className="cf-num">{season.seed}</code>
                  </td>
                  <td>
                    <code className="cf-num" title={season.digest}>
                      {shortDigest(season.digest)}
                    </code>
                  </td>
                  <td>
                    <button type="button" className="cf-btn" onClick={() => onOpen(season.seasonId)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SealedSeason({ seasonId, onBack }: { seasonId: string; onBack: () => void }) {
  const [chronicle, setChronicle] = useState<Chronicle | null | undefined>(undefined)
  const [battles, setBattles] = useState<SealedBattle[]>([])
  const [notice, setNotice] = useState<ErrorNotice | null>(null)

  const load = useCallback(() => {
    setNotice(null)
    setChronicle(undefined)
    Promise.all([fetchChronicle(seasonId), fetchChronicleBattles(seasonId)])
      .then(([summary, fought]) => {
        setChronicle(summary)
        setBattles(fought)
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'That sealed season could not be read.')))
  }, [seasonId])

  useEffect(load, [load])

  if (notice) return <Failed notice={notice} onRetry={load} />
  if (chronicle === undefined) return <Loading label="Unsealing the season" />
  if (chronicle === null) {
    return (
      <Empty
        title="No sealed season with that id"
        hint="A live season never appears here, even by id — only history does."
        action={
          <button type="button" className="cf-btn" onClick={onBack}>
            Back to the chronicle
          </button>
        }
      />
    )
  }

  return (
    <div className="ah-chronicle">
      <header className="ah-page-head">
        <button type="button" className="cf-btn" onClick={onBack}>
          ← All sealed seasons
        </button>
        <h1>Sealed {new Date(chronicle.sealedAt).toLocaleDateString()}</h1>
      </header>

      <div className="ah-report__digest">
        <h2>Season digest</h2>
        <p className="ah-dim">
          sha256 over the canonicalised summary, written at the seal. The row it signs cannot be
          updated or deleted — the database refuses, not a policy.
        </p>
        <code className="cf-num ah-digest">{chronicle.digest}</code>
      </div>

      <h2>The summary, as sealed</h2>
      <pre className="ah-json">{JSON.stringify(chronicle.summary, null, 2)}</pre>

      <h2>Every battle, verbatim ({battles.length})</h2>
      {battles.length === 0 && <p className="ah-dim">A quiet season: no battles were fought.</p>}
      {battles.length > 0 && (
        <div className="ah-scroll">
          <table className="ah-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Mission</th>
                <th scope="col">Wind</th>
                <th scope="col">Digest</th>
                <th scope="col">Report</th>
              </tr>
            </thead>
            <tbody>
              {battles.map((battle) => (
                <tr key={battle.id}>
                  <td>{new Date(battle.occurred_at).toLocaleString()}</td>
                  <td>{battle.mission}</td>
                  <td>{formatMultiplier(battle.wind_bp)}</td>
                  <td>
                    <code className="cf-num" title={battle.digest}>
                      {shortDigest(battle.digest)}
                    </code>
                  </td>
                  <td>
                    <a className="ah-link" href={`/battles?id=${battle.id}`}>
                      open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
