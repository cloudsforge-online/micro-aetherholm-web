/**
 * The chronicle browser: sealed seasons, anonymous — the only unauthenticated data this game
 * serves.
 *
 * Every read on this page goes out with `auth: false` (src/lib/aetherholm.ts): sealed seasons
 * are public history (`aetherholm/src/server.ts`), and sending a token to a route that
 * cannot use one would be a needless credential on the wire. A signed-out visitor gets the whole
 * page, which is the point — the chronicle is the game showing itself to people who have not
 * installed it (docs/ecosystem/20-aetherholm.md §10.1).
 *
 * A SEALED SEASON IS HISTORY. There is no button on this page that writes, because there is
 * nothing to write to: the service serves no mutation for sealed data, and the database refuses
 * UPDATE and DELETE by trigger even to a caller holding a connection
 * (`aetherholm/src/migrations.ts`). The digests are displayed in full — the season's
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
import { keyart, splash, uiIcon } from '../lib/art.ts'
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

  const chronicleGlyph = uiIcon('chronicle')

  if (notice) return <Failed notice={notice} onRetry={load} />
  if (seasons === undefined) return <Loading label="Opening the chronicle" />

  const hero = keyart('hero')

  return (
    <div className="ah-chronicle">
      {/*
        THE HERO GOES HERE AND NOWHERE ELSE, and the reason is which page a stranger lands on.

        The chronicle is this game's one anonymous surface — every read on it goes out with
        `auth: false`, and doc 20 §10.1 calls it "the game showing itself to people who have not
        installed it". Every other route in this client is behind `ProtectedRoute`, so a visitor
        with no session never reaches one: putting the 1920×768 key art on the archipelago screen
        would have shown it only to players who are already playing.

        It is `<img>` rather than a CSS background so that beacon's decoded-image tier can see it
        on the one page it can load without signing in.
      */}
      {hero && (
        <img className="ah-chronicle__hero" src={hero} alt="" aria-hidden="true" fetchPriority="high" />
      )}
      <header className="ah-page-head ah-page-head--glyphed">
        {chronicleGlyph && <img className="ah-page-head__glyph" src={chronicleGlyph} alt="" aria-hidden="true" />}
        <h1>The chronicle</h1>
        <p className="ah-page-head__meta">
          Finished seasons, open to everyone and fixed for good. You need no account to read any
          of it. Once a season is sealed nobody can alter a line of it, including us: the database
          refuses the edit.
        </p>
      </header>

      {seasons.length === 0 && (
        /* `season-seal`: the archipelago caught mid-freeze, turning to amber glass. It paints the
           exact event this page exists to list, on the run where none has happened yet. */
        <Empty
          title="No season has finished"
          hint="On day 120 the archipelago freezes exactly as it stands, and the whole of it lands here."
          art={splash('season-seal')}
        />
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
        title="No finished season with that id"
        hint="A season still being played never shows up here, however you ask for it. This page is history only."
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
          Taken over the summary at the instant the season closed. The row it signs cannot be
          changed or deleted: the database itself refuses, which is a good deal stronger than a
          rule somebody promises to follow.
        </p>
        <code className="cf-num ah-digest">{chronicle.digest}</code>
      </div>

      <h2>The season, exactly as it froze</h2>
      <pre className="ah-json">{JSON.stringify(chronicle.summary, null, 2)}</pre>

      <h2>Every battle, verbatim ({battles.length})</h2>
      {battles.length === 0 && <p className="ah-dim">A peaceful one. Nobody fought anybody.</p>}
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
