/**
 * EVERY CALL THIS CLIENT MAKES TO `micro-aetherholm`, and every route it declines.
 *
 * A route string here is a claim about a specific line of another repository, read out of
 * `aetherholm/src/server.ts` — not out of that service's README, which was written before this
 * client and whose lines could have moved (they had not, but that is a measurement, not an
 * assumption). `test/aetherholm.test.ts` re-reads the service from a real checkout and fails if
 * any citation below stops naming the line that registers the route, or if a route authenticates
 * by a different MECHANISM than the one recorded here.
 *
 * ── The surface, called (23 routes) ───────────────────────────────────────────────────────────
 *
 *   GET    /readyz                            aetherholm/src/server.ts:314
 *   GET    /v1/seasons/current                aetherholm/src/server.ts:382
 *   GET    /v1/archipelagos/:id/islands       aetherholm/src/server.ts:401
 *   GET    /v1/archipelagos/:id/lanes         aetherholm/src/server.ts:518
 *   GET    /v1/content/airships               aetherholm/src/server.ts:490
 *   POST   /v1/cities                         aetherholm/src/server.ts:415
 *   GET    /v1/cities                         aetherholm/src/server.ts:440
 *   GET    /v1/cities/:id                     aetherholm/src/server.ts:459
 *   POST   /v1/cities/:id/buildings           aetherholm/src/server.ts:474   Idempotency-Key
 *   POST   /v1/cities/:id/research            aetherholm/src/server.ts:478   Idempotency-Key
 *   POST   /v1/cities/:id/ships               aetherholm/src/server.ts:482   Idempotency-Key
 *   POST   /v1/fleets                         aetherholm/src/server.ts:533   Idempotency-Key
 *   GET    /v1/fleets                         aetherholm/src/server.ts:616
 *   GET    /v1/fleets/:id                     aetherholm/src/server.ts:634
 *   GET    /v1/battles/:id                    aetherholm/src/server.ts:649
 *   POST   /v1/alliances                      aetherholm/src/server.ts:715
 *   GET    /v1/alliances/:id                  aetherholm/src/server.ts:742
 *   POST   /v1/alliances/:id/members          aetherholm/src/server.ts:752
 *   DELETE /v1/alliances/:id/members          aetherholm/src/server.ts:765
 *   POST   /v1/alliances/:id/claims           aetherholm/src/server.ts:778
 *   GET    /v1/chronicle/seasons              aetherholm/src/server.ts:800
 *   GET    /v1/chronicle/seasons/:id          aetherholm/src/server.ts:816
 *   GET    /v1/chronicle/seasons/:id/battles  aetherholm/src/server.ts:833
 *
 * ── Declined, with reasons (4 routes) ─────────────────────────────────────────────────────────
 *
 *   GET  /livez      aetherholm/src/server.ts:312 — the orchestrator's probe. It answers whether
 *                    the process exists, not whether the game works; the one health read a page
 *                    has a use for is /readyz, and this client reads that instead.
 *   GET  /metrics    aetherholm/src/server.ts:319 — Prometheus text for a scraper. A browser
 *                    parsing an exposition format would be reimplementing a scrape pipeline that
 *                    already exists, badly, on a phone.
 *   GET  /v1/title   aetherholm/src/server.ts:334 — the title descriptor is `worlds`' bridge's
 *                    read (worlds/src/titleclient.ts:122): a capability statement for
 *                    provisioning. This client learns nothing from it that the page it is
 *                    rendering does not already prove.
 *   POST /v1/provision  aetherholm/src/server.ts:336 — service-token only, scope
 *                    `aetherholm:provision`, and refused for user tokens outright
 *                    (server.ts:338-343). A browser must never hold that credential; a client
 *                    that could provision worlds would be a free-worlds endpoint with a UI.
 *
 * ── The one rule with a body count ────────────────────────────────────────────────────────────
 *
 * BATTLES ARE NEVER RESOLVED HERE. `micro-emberkin-web` deleted its inherited client-side battle
 * engine and wrote down why: a client that can resolve a battle can lie about one. The same rule,
 * same reason: this file fetches the server's STORED report — `result`, `digest` and both orders
 * of battle exactly as `GET /v1/battles/:id` returns them — and the pages render that. Nothing in
 * this repository knows the combat rules; there is no PRNG, no initiative table, no damage
 * arithmetic. The digest is displayed because it IS the determinism claim
 * (docs/ecosystem/20-aetherholm.md §4): anyone holding the stored inputs can re-derive it, and a
 * client that recomputed outcomes instead of showing the sealed ones would make that claim
 * unverifiable exactly where players read it.
 *
 * The one calculation this client DOES make before the wire is the launch preview — Aether lift
 * and travel time, shown before commit — in ./lattice.ts, from the same content constants the
 * server serves at `GET /v1/content/airships` and the same lanes it serves at
 * `GET /v1/archipelagos/:id/lanes`. That is a price tag, not a resolution: the server recomputes
 * and charges its own number at launch (`aetherholm/src/fleets.ts:291-296`, `:332-336`), and the
 * preview being wrong loses nobody anything but surprise.
 */
import { ApiError, aetherholm } from './api.ts'

/* ---- guards -------------------------------------------------------- */

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Refuse a malformed id BEFORE the wire.
 *
 * Every `:id` route on the service validates with the same pattern and answers 400
 * (`aetherholm/src/server.ts:140`, e.g. `:462`), so nothing catastrophic happens without this —
 * but this client's addresses ARE these ids, and a typo that becomes a round trip and a 400 reads
 * as "the server rejected me" rather than "I mistyped". Thrown synchronously, so the test can
 * assert no request existed.
 */
export function assertUuid(value: string, what: string): string {
  if (!UUID.test(value)) {
    throw new ApiError(0, `${what} must be a uuid`, 'malformed_id')
  }
  return value
}

/**
 * A fresh Idempotency-Key per submission — never per body. Two identical build orders queued on
 * purpose are two orders; one order retried after a timeout is one. Only the caller knows which,
 * so the key is minted where the intent is.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Amounts are decimal strings on the wire, always. A float here would be the defect the
 *  service's whole bigint discipline exists to prevent. */
const DECIMAL = /^\d+$/

export function assertDecimalString(value: string, what: string): string {
  if (!DECIMAL.test(value)) throw new ApiError(0, `${what} must be a decimal string`, 'malformed_amount')
  return value
}

/* ---- wire types ---------------------------------------------------- */

/** Stocks as the service sends them: decimal strings, one per resource. Never Number() these —
 *  render through BigInt (src/lib/format.ts). */
export type WireStocks = Record<string, string>

export interface Season {
  id: string
  name: string
  /** The season seed, as a decimal string: it is a 64-bit value and not a JSON number. */
  seed: string
  status: string
  openedAt: string
  endsAt: string
  archipelagoId: string
}

export interface Island {
  id: string
  idx: number
  band: string
  plots: number
  freePlots: number
}

export interface Lane {
  id: string
  fromIslandId: string
  toIslandId: string
  /** The direction multiplier, in basis points. A→B and B→A are separate lanes with separate
   *  rolls — that asymmetry is the game (docs/ecosystem/20-aetherholm.md §2). */
  multiplierBp: number
  travelSeconds: number
}

export interface AirshipSpec {
  role: string
  initiative: number
  attack: string
  hull: string
  speedBp: number
  cargo: string
  liftPerHour: string
  aerodock: number
  cost: WireStocks
  buildSeconds: number
}

export interface QueueItem {
  id: string
  kind: 'building' | 'research' | 'ship'
  target: string
  status?: 'queued' | 'done'
  startedAt: string
  completesAt: string
}

export interface City {
  id: string
  islandId: string
  archipelagoId: string
  band: string
  userId: string
  plot: number
  name: string
  foundedAt: string
  aegisUntil: string
  /** The lazy-accrual fields: stocks as settled at `settledAt`, plus the rates and cap to
   *  project them forward locally. See projectStocks in ./format.ts. */
  stocks: WireStocks
  rates: WireStocks
  storageCap: string
  settledAt: string
  buildings: ReadonlyArray<{ type: string; level: number }>
  ships: ReadonlyArray<{ class: string; count: string }>
  queue: ReadonlyArray<QueueItem>
}

export type Mission = 'transfer' | 'raid' | 'siege'

export interface Fleet {
  id: string
  originCityId: string
  userId: string
  mission: Mission
  status: string
  targetIslandId: string
  targetCityId: string | null
  ships: Record<string, string>
  cargo: Record<string, string>
  aetherLift: string
  departedAt: string
  arrivesAt: string
  returnsAt: string | null
  travelSeconds: number
}

export interface Battle {
  id: string
  islandId: string
  plot: number | null
  mission: string
  windBp: number
  attackerUserId: string
  defenderUserId: string
  attackerOob: unknown
  defenderOob: unknown
  result: unknown
  /** sha256 over the canonicalised inputs and result — the determinism claim, displayed, never
   *  recomputed here. */
  digest: string
  occurredAt: string
}

export interface Alliance {
  id: string
  archipelagoId: string
  communityId: string
  name: string
  foundedBy: string
  createdAt: string
  members: ReadonlyArray<{ userId: string; joinedAt: string }>
  claims: ReadonlyArray<{ islandId: string; claimedBy: string; claimedAt: string }>
  beacons: ReadonlyArray<string>
  sharedLanes: ReadonlyArray<{ laneId: string; fromIslandId: string; toIslandId: string }>
}

export interface ChronicleSeason {
  seasonId: string
  name: string
  seed: string
  sealedAt: string
  digest: string
}

export interface Chronicle {
  summary: Record<string, unknown>
  digest: string
  sealedAt: string
}

export interface SealedBattle {
  id: string
  island_id: string
  plot: number | null
  mission: string
  wind_bp: number
  seed: string
  attacker_oob: unknown
  defender_oob: unknown
  result: unknown
  digest: string
  occurred_at: string
}

/* ---- health -------------------------------------------------------- */

/**
 * GET /readyz (`aetherholm/src/server.ts:314`). Unauthenticated; 503 carries a body and is an
 * ANSWER (not-ready), not a failure — only an unreachable service is.
 */
export async function fetchReadiness(): Promise<{ ready: boolean }> {
  try {
    const body = await aetherholm<{ ready?: boolean }>('/readyz', { auth: false })
    return { ready: body?.ready === true }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) return { ready: false }
    return { ready: false }
  }
}

/* ---- the world, read ----------------------------------------------- */

/**
 * GET /v1/seasons/current (`aetherholm/src/server.ts:382`). Authenticated: a user token passes as
 * itself; the route's `aetherholm:read` scope check is for services. The 404 code
 * `no_open_season` (server.ts:386) is an answer — the world has not opened — not a failure.
 */
export async function fetchCurrentSeason(): Promise<Season | null> {
  try {
    return await aetherholm<Season>('/v1/seasons/current')
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** GET /v1/archipelagos/:id/islands (`aetherholm/src/server.ts:401`). */
export async function fetchIslands(archipelagoId: string): Promise<Island[]> {
  const body = await aetherholm<{ islands?: Island[] }>(
    `/v1/archipelagos/${encodeURIComponent(assertUuid(archipelagoId, 'archipelago id'))}/islands`,
  )
  return body?.islands ?? []
}

/**
 * GET /v1/archipelagos/:id/lanes (`aetherholm/src/server.ts:518`). The ask itself backfills a
 * pre-lattice world from its stored seed (server.ts:524, `ensureLattice`), so an empty answer is
 * a 404, never a world quietly without winds.
 */
export async function fetchLanes(archipelagoId: string): Promise<Lane[]> {
  const body = await aetherholm<{ lanes?: Lane[] }>(
    `/v1/archipelagos/${encodeURIComponent(assertUuid(archipelagoId, 'archipelago id'))}/lanes`,
  )
  return body?.lanes ?? []
}

/**
 * GET /v1/content/airships (`aetherholm/src/server.ts:490`). Public — the handler takes no
 * principal — so no token is sent: a credential on a route that cannot read it is a needless
 * credential on the wire. These are the SAME constants the service charges from
 * (`aetherholm/src/content.ts:302-313`, served through server.ts:490-516), which is what makes
 * the launch preview in ./lattice.ts honest.
 */
export async function fetchAirships(): Promise<Record<string, AirshipSpec>> {
  const body = await aetherholm<{ airships?: Record<string, AirshipSpec> }>('/v1/content/airships', {
    auth: false,
  })
  return body?.airships ?? {}
}

/* ---- city play ------------------------------------------------------ */

/**
 * POST /v1/cities (`aetherholm/src/server.ts:415`). No Idempotency-Key: the service reads none on
 * this route — the partial unique index (one city per player per island) IS the idempotency, and
 * a re-found returns the existing city with 200 rather than 201 (server.ts:434).
 */
export async function foundCity(input: { islandId: string; plot: number; name: string }): Promise<City> {
  const body = await aetherholm<{ city: City }>('/v1/cities', {
    method: 'POST',
    body: {
      islandId: assertUuid(input.islandId, 'island id'),
      plot: input.plot,
      name: input.name,
    },
  })
  return body.city
}

/** GET /v1/cities (`aetherholm/src/server.ts:440`). Own list — no `?userId=`: naming another
 *  player is an admin's read and this is a player client. */
export async function fetchCities(): Promise<City[]> {
  const body = await aetherholm<{ cities?: City[] }>('/v1/cities')
  return body?.cities ?? []
}

/** GET /v1/cities/:id (`aetherholm/src/server.ts:459`). 403 to non-owners is deliberate — the
 *  economy is the secret, not the existence (server.ts:466-469). */
export async function fetchCity(cityId: string): Promise<City> {
  const body = await aetherholm<{ city: City }>(
    `/v1/cities/${encodeURIComponent(assertUuid(cityId, 'city id'))}`,
  )
  return body.city
}

export interface QueueReply {
  item: QueueItem
  replayed: boolean
  stocks: WireStocks
}

/**
 * POST /v1/cities/:id/buildings (`aetherholm/src/server.ts:474`). Idempotency-Key REQUIRED — a
 * 400 without it (server.ts:875-878) — and a retry replays rather than double-charges. The field
 * is `type` (server.ts:880).
 */
export async function queueBuilding(cityId: string, type: string, key: string): Promise<QueueReply> {
  return aetherholm<QueueReply>(
    `/v1/cities/${encodeURIComponent(assertUuid(cityId, 'city id'))}/buildings`,
    { method: 'POST', body: { type }, headers: { 'idempotency-key': key } },
  )
}

/** POST /v1/cities/:id/research (`aetherholm/src/server.ts:478`). Same shape; the field is
 *  `node` (server.ts:880). */
export async function queueResearch(cityId: string, node: string, key: string): Promise<QueueReply> {
  return aetherholm<QueueReply>(
    `/v1/cities/${encodeURIComponent(assertUuid(cityId, 'city id'))}/research`,
    { method: 'POST', body: { node }, headers: { 'idempotency-key': key } },
  )
}

/** POST /v1/cities/:id/ships (`aetherholm/src/server.ts:482`). Same shape; the field is `class`
 *  (server.ts:880). */
export async function queueShip(cityId: string, cls: string, key: string): Promise<QueueReply> {
  return aetherholm<QueueReply>(
    `/v1/cities/${encodeURIComponent(assertUuid(cityId, 'city id'))}/ships`,
    { method: 'POST', body: { class: cls }, headers: { 'idempotency-key': key } },
  )
}

/* ---- fleets --------------------------------------------------------- */

export interface LaunchInput {
  cityId: string
  mission: Mission
  targetIslandId: string
  targetCityId?: string | undefined
  /** class → count, plain numbers: the service reads `typeof count !== 'number'`
   *  (server.ts:561). */
  ships: Record<string, number>
  /** resource → decimal string. The service refuses anything that is not `^\d+$`
   *  (server.ts:573-574) — floats never reach the wire from here either. */
  cargo?: Record<string, string> | undefined
}

export interface LaunchReply {
  fleet: Fleet
  replayed: boolean
  stocks: WireStocks
}

/**
 * POST /v1/fleets (`aetherholm/src/server.ts:533`). Idempotency-Key REQUIRED (server.ts:535-538).
 * The Aether cost of this launch was already on screen before this function was called — that is
 * the fleet page's contract, computed in ./lattice.ts from served content — and the service now
 * charges its own arithmetic for the whole round trip (`aetherholm/src/fleets.ts:332-336`),
 * refusing rather than clamping when the treasury cannot cover it (409 `insufficient_stock`).
 */
export async function launchFleet(input: LaunchInput, key: string): Promise<LaunchReply> {
  const cargo = input.cargo
  if (cargo) {
    for (const [resource, amount] of Object.entries(cargo)) {
      assertDecimalString(amount, `cargo.${resource}`)
    }
  }
  return aetherholm<LaunchReply>('/v1/fleets', {
    method: 'POST',
    headers: { 'idempotency-key': key },
    body: {
      cityId: assertUuid(input.cityId, 'city id'),
      mission: input.mission,
      targetIslandId: assertUuid(input.targetIslandId, 'target island id'),
      ...(input.targetCityId ? { targetCityId: assertUuid(input.targetCityId, 'target city id') } : {}),
      ships: input.ships,
      ...(cargo ? { cargo } : {}),
    },
  })
}

/** GET /v1/fleets (`aetherholm/src/server.ts:616`). Own list, same rule as cities. */
export async function fetchFleets(): Promise<Fleet[]> {
  const body = await aetherholm<{ fleets?: Fleet[] }>('/v1/fleets')
  return body?.fleets ?? []
}

/** GET /v1/fleets/:id (`aetherholm/src/server.ts:634`). A fleet in the air is its owner's plan;
 *  403 to everyone else until the battle report says otherwise (server.ts:641-645). */
export async function fetchFleet(fleetId: string): Promise<Fleet> {
  const body = await aetherholm<{ fleet: Fleet }>(
    `/v1/fleets/${encodeURIComponent(assertUuid(fleetId, 'fleet id'))}`,
  )
  return body.fleet
}

/**
 * GET /v1/battles/:id (`aetherholm/src/server.ts:649`). The token is attached as always; whether
 * it is NEEDED depends on the season — a sealed season's battles are public history and the
 * handler authenticates only when the season is still live (server.ts:681-691). The report and
 * its digest are rendered as stored; see the header for why they are never recomputed.
 */
export async function fetchBattle(battleId: string): Promise<Battle> {
  const body = await aetherholm<{ battle: Battle }>(
    `/v1/battles/${encodeURIComponent(assertUuid(battleId, 'battle id'))}`,
  )
  return body.battle
}

/* ---- alliances ------------------------------------------------------ */

/**
 * POST /v1/alliances (`aetherholm/src/server.ts:715`). `communityId` is REQUIRED and never
 * minted: an alliance IS a `micro-community` community (docs/ecosystem/20-aetherholm.md §6), and
 * the service will not paper over its absence (server.ts:719-726). This client asks the founder
 * for the community's id; it does not — and must not — create one.
 */
export async function foundAlliance(input: {
  archipelagoId: string
  communityId: string
  name: string
}): Promise<Alliance> {
  const body = await aetherholm<{ alliance: Alliance }>('/v1/alliances', {
    method: 'POST',
    body: {
      archipelagoId: assertUuid(input.archipelagoId, 'archipelago id'),
      communityId: assertUuid(input.communityId, 'community id'),
      name: input.name,
    },
  })
  return body.alliance
}

/** GET /v1/alliances/:id (`aetherholm/src/server.ts:742`). */
export async function fetchAlliance(allianceId: string): Promise<Alliance> {
  const body = await aetherholm<{ alliance: Alliance }>(
    `/v1/alliances/${encodeURIComponent(assertUuid(allianceId, 'alliance id'))}`,
  )
  return body.alliance
}

/** POST /v1/alliances/:id/members (`aetherholm/src/server.ts:752`). Joining as oneself; a second
 *  banner on the same world is 409 `already_aligned`. */
export async function joinAlliance(allianceId: string): Promise<void> {
  await aetherholm<{ joined: boolean }>(
    `/v1/alliances/${encodeURIComponent(assertUuid(allianceId, 'alliance id'))}/members`,
    { method: 'POST' },
  )
}

/** DELETE /v1/alliances/:id/members (`aetherholm/src/server.ts:765`). */
export async function leaveAlliance(allianceId: string): Promise<void> {
  await aetherholm<{ left: boolean }>(
    `/v1/alliances/${encodeURIComponent(assertUuid(allianceId, 'alliance id'))}/members`,
    { method: 'DELETE' },
  )
}

/** POST /v1/alliances/:id/claims (`aetherholm/src/server.ts:778`). First banner wins — the claims
 *  table's primary key is the island (409 `claim_taken` for the second). */
export async function claimIsland(allianceId: string, islandId: string): Promise<void> {
  await aetherholm<{ claimed: boolean }>(
    `/v1/alliances/${encodeURIComponent(assertUuid(allianceId, 'alliance id'))}/claims`,
    { method: 'POST', body: { islandId: assertUuid(islandId, 'island id') } },
  )
}

/* ---- the chronicle: anonymous, and read-only by CONSTRUCTION --------- */

/**
 * GET /v1/chronicle/seasons (`aetherholm/src/server.ts:800`). `auth: false`, and that is an
 * assertion, not an omission: the chronicle routes are the service's ONLY anonymous data surface
 * (server.ts:796-798) — sealed seasons are public history — and this client sends no token to
 * them, so the anonymity is exercised on every page view rather than merely believed.
 *
 * There is deliberately NO mutation wrapper anywhere near this surface. A sealed season is
 * history: the service serves no write route for it, the database refuses UPDATE and DELETE by
 * trigger even to a caller holding a connection (`aetherholm/src/migrations.ts:667`, `:679`), and
 * this file completes the chain by having nothing to click. `test/aetherholm.test.ts` asserts no
 * non-GET request is ever built for a `/v1/chronicle` path.
 */
export async function fetchChronicleSeasons(): Promise<ChronicleSeason[]> {
  const body = await aetherholm<{ seasons?: ChronicleSeason[] }>('/v1/chronicle/seasons', {
    auth: false,
  })
  return body?.seasons ?? []
}

/** GET /v1/chronicle/seasons/:id (`aetherholm/src/server.ts:816`). Anonymous; 404 unless sealed —
 *  a live season cannot leak through this surface even by id (the query is scoped
 *  `status = 'sealed'`, `aetherholm/src/sealing.ts:301`). */
export async function fetchChronicle(seasonId: string): Promise<Chronicle | null> {
  try {
    return await aetherholm<Chronicle>(
      `/v1/chronicle/seasons/${encodeURIComponent(assertUuid(seasonId, 'season id'))}`,
      { auth: false },
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** GET /v1/chronicle/seasons/:id/battles (`aetherholm/src/server.ts:833`). Anonymous; every
 *  battle verbatim with its digest — the replay browser's data source (doc §10.1). */
export async function fetchChronicleBattles(seasonId: string): Promise<SealedBattle[]> {
  const body = await aetherholm<{ battles?: SealedBattle[] }>(
    `/v1/chronicle/seasons/${encodeURIComponent(assertUuid(seasonId, 'season id'))}/battles`,
    { auth: false },
  )
  return body?.battles ?? []
}
