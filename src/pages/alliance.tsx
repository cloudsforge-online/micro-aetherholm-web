/**
 * The alliance screen: a `communityId` binding, claims, beacons, shared lanes.
 *
 * THE ONE THING THIS SCREEN MUST NOT DO is create a community. An alliance IS a
 * `micro-community` community (docs/ecosystem/20-aetherholm.md §6): proposals, votes, officers,
 * timelocks and the treasury live there, and the game service stores only the binding —
 * `communityId` is required and never minted (`aetherholm/src/server.ts:825-832`). So the
 * founding form here asks for the id of a community that already exists, says where governance
 * lives, and sends exactly that. A "create community" button on this page would be the second
 * voting system the design forbids.
 *
 * Discovery is the DIRECTORY now — `GET /v1/alliances` (`aetherholm/src/server.ts:848`) lists
 * the world with the caller's own membership marked, closing the gap this header used to
 * record. The by-id lookup stays for a pasted id. After founding or opening
 * one, the screen keeps it for the session in React state only.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { noticeFor, type ErrorNotice } from '../lib/api.ts'
import {
  claimIsland,
  fetchAlliance,
  fetchCurrentSeason,
  fetchIslands,
  foundAlliance,
  joinAlliance,
  leaveAlliance,
  type Alliance,
  type Island,
  type Season,
  listAlliances,
  type AllianceDirectoryEntry,
} from '../lib/aetherholm.ts'
import { useSession } from '../lib/auth.tsx'
import { Empty, Failed, Loading } from '../components/states.tsx'

export function AlliancePage() {
  const { userId } = useSession()
  const [params, setParams] = useSearchParams()
  const requested = params.get('id') ?? ''
  const [season, setSeason] = useState<Season | null | undefined>(undefined)
  const [islands, setIslands] = useState<Island[]>([])
  const [alliance, setAlliance] = useState<Alliance | null>(null)
  const [notice, setNotice] = useState<ErrorNotice | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [lookupId, setLookupId] = useState(requested)
  const [directory, setDirectory] = useState<AllianceDirectoryEntry[] | null>(null)
  useEffect(() => {
    listAlliances()
      .then(setDirectory)
      .catch(() => setDirectory(null))
  }, [alliance])
  const [name, setName] = useState('')
  const [communityId, setCommunityId] = useState('')
  const [claimIslandId, setClaimIslandId] = useState('')

  useEffect(() => {
    fetchCurrentSeason()
      .then(async (open) => {
        setSeason(open)
        if (open) setIslands(await fetchIslands(open.archipelagoId))
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'The season could not be read.')))
  }, [])

  const open = useCallback((id: string) => {
    setNotice(null)
    setMessage(null)
    fetchAlliance(id)
      .then((view) => {
        setAlliance(view)
      })
      .catch((err: unknown) => setNotice(noticeFor(err, 'No alliance answered to that id.')))
  }, [])

  useEffect(() => {
    if (requested) {
      setLookupId(requested)
      open(requested)
    }
  }, [requested, open])

  async function act(work: () => Promise<void>, done: string) {
    setBusy(true)
    setMessage(null)
    try {
      await work()
      setMessage(done)
      if (alliance) open(alliance.id)
    } catch (err) {
      setMessage(noticeFor(err, 'That was refused.').message)
    } finally {
      setBusy(false)
    }
  }

  if (season === undefined && !notice) return <Loading label="Raising the banners" />

  const isMember = alliance !== null && userId !== null && alliance.members.some((m) => m.userId === userId)

  return (
    <div className="ah-alliance">
      <header className="ah-page-head">
        <h1>Alliance</h1>
        <p className="ah-page-head__meta">
          An alliance is a micro-community community wearing a banner. Governance — votes,
          officers, the treasury — happens in Community; this game stores the binding and the play.
        </p>
      </header>

      {notice && <Failed notice={notice} />}

      <section className="ah-directory" aria-label="Alliances of this world">
        <h2>Alliances of this world</h2>
        {directory === null ? (
          <p className="ah-note">The directory could not be loaded.</p>
        ) : directory.length === 0 ? (
          <p className="ah-note">No alliances yet — the first banner is unclaimed.</p>
        ) : (
          <ul className="ah-directory__list">
            {directory.map((a) => (
              <li key={a.id}>
                <button type="button" className="cf-btn" onClick={() => setParams({ id: a.id })}>
                  {a.name}
                </button>{' '}
                <span className="cf-num">{a.memberCount}</span> member{a.memberCount === 1 ? '' : 's'}
                {a.mine ? <strong className="ah-directory__mine"> — yours</strong> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="ah-form ah-form--inline"
        onSubmit={(e) => {
          e.preventDefault()
          if (lookupId) setParams({ id: lookupId })
        }}
      >
        <label>
          Alliance id
          <input
            className="cf-input cf-input--mono"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="an alliance uuid"
          />
        </label>
        <button type="submit" className="cf-btn" disabled={!lookupId}>
          Open
        </button>
      </form>

      {alliance && (
        <section className="ah-alliance__view">
          <h2>{alliance.name}</h2>
          <p className="ah-page-head__meta">
            Community <code className="cf-num">{alliance.communityId}</code> · founded{' '}
            {new Date(alliance.createdAt).toLocaleDateString()}
          </p>

          <div className="ah-alliance__actions">
            {!isMember && (
              <button
                type="button"
                className="cf-btn cf-btn--ember"
                disabled={busy}
                onClick={() => void act(() => joinAlliance(alliance.id), 'Joined. One banner per player per world.')}
              >
                Join
              </button>
            )}
            {isMember && (
              <button
                type="button"
                className="cf-btn"
                disabled={busy}
                onClick={() => void act(() => leaveAlliance(alliance.id), 'Left.')}
              >
                Leave
              </button>
            )}
          </div>

          <h3>Members ({alliance.members.length})</h3>
          <ul className="ah-garrison">
            {alliance.members.map((m) => (
              <li key={m.userId}>
                <code className="cf-num">{m.userId}</code>
                {m.userId === alliance.foundedBy && ' · founder'}
              </li>
            ))}
          </ul>

          <h3>Island claims</h3>
          {alliance.claims.length === 0 && <p className="ah-dim">No claims planted.</p>}
          <ul className="ah-garrison">
            {alliance.claims.map((c) => {
              const island = islands.find((i) => i.id === c.islandId)
              return (
                <li key={c.islandId}>
                  island {island?.idx ?? c.islandId} · claimed {new Date(c.claimedAt).toLocaleDateString()}
                </li>
              )
            })}
          </ul>
          {isMember && (
            <form
              className="ah-form ah-form--inline"
              onSubmit={(e) => {
                e.preventDefault()
                if (claimIslandId) {
                  void act(
                    () => claimIsland(alliance.id, claimIslandId),
                    'Claimed. The first banner planted wins; shared lanes follow the claims.',
                  )
                }
              }}
            >
              <label>
                Claim an island
                <select
                  className="cf-select"
                  value={claimIslandId}
                  onChange={(e) => setClaimIslandId(e.target.value)}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {islands.map((i) => (
                    <option key={i.id} value={i.id}>
                      island {i.idx} ({i.band})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="cf-btn" disabled={busy || !claimIslandId}>
                Plant the banner
              </button>
            </form>
          )}

          <h3>Beacons</h3>
          <p className="ah-dim">
            Islands where a member city flies a Guild Beacon — the alliance’s visible presence.
          </p>
          {alliance.beacons.length === 0 && <p className="ah-dim">None lit.</p>}
          <ul className="ah-garrison">
            {alliance.beacons.map((islandId) => {
              const island = islands.find((i) => i.id === islandId)
              return <li key={islandId}>island {island?.idx ?? islandId}</li>
            })}
          </ul>

          <h3>Shared lanes</h3>
          <p className="ah-dim">Lanes between two claimed islands — members fly them at a discount.</p>
          {alliance.sharedLanes.length === 0 && <p className="ah-dim">None yet; claims come first.</p>}
          <ul className="ah-garrison">
            {alliance.sharedLanes.map((lane) => {
              const from = islands.find((i) => i.id === lane.fromIslandId)
              const to = islands.find((i) => i.id === lane.toIslandId)
              return (
                <li key={lane.laneId}>
                  island {from?.idx ?? '?'} → island {to?.idx ?? '?'}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!alliance && season && (
        <section className="ah-alliance__found">
          <h2>Found an alliance</h2>
          <p className="ah-dim">
            You need a micro-community community FIRST — this client never creates one. Bring its
            id; founding binds the banner to it, and that community’s governance is the alliance’s.
          </p>
          <form
            className="ah-form"
            onSubmit={(e) => {
              e.preventDefault()
              void act(async () => {
                const made = await foundAlliance({ archipelagoId: season.archipelagoId, communityId, name })
                setParams({ id: made.id })
              }, 'Founded.')
            }}
          >
            <label>
              Alliance name
              <input className="cf-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
            </label>
            <label>
              Community id
              <input
                className="cf-input cf-input--mono"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                placeholder="the uuid of an existing micro-community community"
                required
              />
            </label>
            <button type="submit" className="cf-btn cf-btn--ember" disabled={busy || !name || !communityId}>
              Found — binds to the community above
            </button>
          </form>
        </section>
      )}

      {!alliance && season === null && (
        <Empty title="No season is open" hint="Alliances live inside a season’s archipelago." />
      )}

      {message && <p role="status">{message}</p>}
    </div>
  )
}
