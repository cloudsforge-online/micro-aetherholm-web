/**
 * A battle report, rendered FROM THE STORE — never recomputed.
 *
 * The rule is Emberkin's, inherited with its reasoning: a client that can resolve a battle can
 * lie about one. This page holds no combat rules; it shows the stored report exactly as
 * `GET /v1/battles/:id` returns it (`aetherholm/src/server.ts`) — both orders of battle, the
 * result object verbatim, and THE DIGEST, displayed in full. The digest is the determinism claim
 * (docs/ecosystem/20-aetherholm.md §4, §9.1): sha256 over the canonicalised inputs and result,
 * pinned append-only at the database (`aetherholm/src/migrations.ts`). Showing it is what
 * makes "the same battle re-resolves to the same bytes" a thing a player can quote, not a thing
 * they are asked to believe.
 *
 * Reports open from YOUR HISTORY now — `GET /v1/battles` (`aetherholm/src/server.ts`)
 * closed the listing gap this header used to record — or by pasted id, which stays because a
 * sealed battle is public history anyone may cite. Live battles are the participants' own;
 * sealed ones open without a session.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import { fetchBattle, listBattles, type Battle, type BattleSummary } from '../lib/aetherholm.ts'
import { formatMultiplier } from '../lib/format.ts'
import { splash, uiIcon } from '../lib/art.ts'
import { Empty, Failed, Forbidden, Loading } from '../components/states.tsx'

const label = (snake: string): string => snake.replace(/_/g, ' ')

/** An order of battle as the service stores it: class → count, or something older. Rendered
 *  defensively — the shape belongs to the server. */
function OobTable({ title, oob }: { title: string; oob: unknown }) {
  if (typeof oob !== 'object' || oob === null) {
    return (
      <div>
        <h3>{title}</h3>
        <pre className="ah-json">{JSON.stringify(oob, null, 2)}</pre>
      </div>
    )
  }
  const entries = Object.entries(oob as Record<string, unknown>)
  return (
    <div>
      <h3>{title}</h3>
      <ul className="ah-garrison">
        {entries.map(([key, value]) => (
          <li key={key}>
            {label(key)}:{' '}
            <code className="cf-num">
              {typeof value === 'number' || typeof value === 'string' ? String(value) : JSON.stringify(value)}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BattlesPage() {
  const [params, setParams] = useSearchParams()
  const [history, setHistory] = useState<BattleSummary[] | null>(null)
  const [historyNotice, setHistoryNotice] = useState<ErrorNotice | null>(null)
  useEffect(() => {
    listBattles()
      .then(setHistory)
      .catch((err: unknown) => setHistoryNotice(noticeFor(err, 'Your battle history could not be loaded.')))
  }, [])
  const requested = params.get('id') ?? ''
  const [input, setInput] = useState(requested)
  const [battle, setBattle] = useState<Battle | null>(null)
  const [notice, setNotice] = useState<ErrorNotice | null>(null)
  const [loading, setLoading] = useState(false)
  const battleGlyph = uiIcon('battle')

  const load = useCallback((id: string) => {
    setLoading(true)
    setNotice(null)
    setBattle(null)
    fetchBattle(id)
      .then(setBattle)
      .catch((err: unknown) => setNotice(noticeFor(err, 'That report could not be read.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (requested) {
      setInput(requested)
      load(requested)
    }
  }, [requested, load])

  return (
    <div className="ah-battles">
      <header className="ah-page-head ah-page-head--glyphed">
        {battleGlyph && <img className="ah-page-head__glyph" src={battleGlyph} alt="" aria-hidden="true" />}
        <h1>Battle reports</h1>
        <p className="ah-page-head__meta">
          Rendered from the server’s stored report and digest — this client holds no combat rules
          and resolves nothing.
        </p>
      </header>

      <section className="ah-history" aria-label="Your battles">
        <h2>Your battles</h2>
        {historyNotice ? (
          <p className="ah-note" role="status">{historyNotice.message}</p>
        ) : history === null ? (
          <p className="ah-note">Loading your history…</p>
        ) : history.length === 0 ? (
          <p className="ah-note">No battles yet. A fleet that never launched has a perfect record.</p>
        ) : (
          <ul className="ah-history__list">
            {history.map((b) => (
              <li key={b.id}>
                <button type="button" className="cf-btn" onClick={() => setParams({ id: b.id })}>
                  {b.mission} — {b.outcome}
                </button>{' '}
                <span className="cf-num ah-history__when">{new Date(b.occurredAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="ah-form ah-form--inline"
        onSubmit={(e) => {
          e.preventDefault()
          if (input) setParams({ id: input })
        }}
      >
        <label>
          Report id
          <input
            className="cf-input cf-input--mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="a battle uuid, from a notification or the chronicle"
          />
        </label>
        <button type="submit" className="cf-btn" disabled={!input || loading}>
          Open
        </button>
      </form>

      {loading && <Loading label="Unsealing the report" />}
      {notice && (notice.forbidden ? (
        <Forbidden
          notice={notice}
          title="A live battle belongs to its participants"
        />
      ) : (
        <Failed notice={notice} />
      ))}
      {!loading && !notice && !battle && !requested && (
        /* `spire-war`: two fleets contesting a spire across a wind lane. A battle page with no
           battle open is the one screen in this client that is ABOUT combat and shows none. */
        <Empty
          title="No report open"
          hint="Paste a battle id. Sealed seasons’ reports open without an account; live ones are the participants’ own."
          art={splash('spire-war')}
        />
      )}

      {battle && (
        <article className="ah-report">
          <h2>
            {battle.mission} at island <code className="cf-num">{battle.islandId}</code>
            {battle.plot !== null && <> · plot {battle.plot}</>}
          </h2>
          <p className="ah-page-head__meta">
            {new Date(battle.occurredAt).toLocaleString()} · wind {formatMultiplier(battle.windBp)} on the
            lane of approach
          </p>

          <div className="ah-report__digest">
            <h3>Digest — the determinism claim</h3>
            <p className="ah-dim">
              sha256 over the canonicalised inputs and result. The same seed and the same orders of
              battle re-resolve to these exact bytes; the database refuses any edit to the report.
            </p>
            <code className="cf-num ah-digest">{battle.digest}</code>
          </div>

          <div className="ah-report__sides">
            <OobTable title={`Attacker (${battle.attackerUserId})`} oob={battle.attackerOob} />
            <OobTable title={`Defender (${battle.defenderUserId})`} oob={battle.defenderOob} />
          </div>

          <h3>Result, as stored</h3>
          <pre className="ah-json">{JSON.stringify(battle.result, null, 2)}</pre>
        </article>
      )}
    </div>
  )
}
