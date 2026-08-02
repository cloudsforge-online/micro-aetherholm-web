/**
 * THE REQUEST, ASSERTED. Every call this client makes to `micro-aetherholm`.
 *
 * Clients in this estate have shipped calling routes that did not exist, and their tests passed
 * because they stubbed `fetch` and asserted the RESPONSE — which the test itself had written.
 * Every test below asserts the request instead: the URL, the method, the headers and the body,
 * against the route table in `aetherholm/src/server.ts`. The service is not running; the point
 * is that it does not need to be, because what these tests check is the half of the conversation
 * this repository owns. (`test/aetherholm.test.ts` is the other half: it reads the real service
 * checkout and verifies the citations and mechanisms.)
 */
import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, describe, it } from 'node:test'
import {
  installFetch,
  installStorage,
  installWindow,
  json,
  removeStorage,
  removeWindow,
  type FetchCall,
} from './browser-stubs.ts'
import { ApiError, __resetAuth, setTokens } from '../src/lib/api.ts'
import {
  assertUuid,
  claimIsland,
  fetchAirships,
  fetchAlliance,
  fetchBattle,
  fetchChronicle,
  fetchChronicleBattles,
  fetchChronicleSeasons,
  fetchCities,
  fetchCity,
  fetchCurrentSeason,
  fetchFleet,
  fetchFleets,
  fetchIslands,
  fetchLanes,
  fetchReadiness,
  foundAlliance,
  foundCity,
  joinAlliance,
  launchFleet,
  leaveAlliance,
  newIdempotencyKey,
  queueBuilding,
  queueResearch,
  queueShip,
} from '../src/lib/aetherholm.ts'

/** The dev-port base every call must land on: 4120, the port the service binds
 *  (`aetherholm/src/env.ts:105`), pinned by the registry (`ui/packages/ui/src/surfaces.ts:434`). */
const BASE = 'http://localhost:4120'

const ID = '11111111-1111-4111-8111-111111111111'
const ID2 = '22222222-2222-4222-8222-222222222222'

let stub: ReturnType<typeof installFetch>

function lastCall(): FetchCall {
  const call = stub.calls[stub.calls.length - 1]
  assert.ok(call, 'no request was made — a test that asserts nothing is not a test')
  return call
}

function bodyOf(call: FetchCall): Record<string, unknown> {
  assert.ok(call.body, `${call.method} ${call.url} was sent with no body`)
  return JSON.parse(call.body) as Record<string, unknown>
}

beforeEach(() => {
  // The page is on 5171 (vite.config.ts) and the service on 4120; a relative URL would hit the
  // static file server.
  installWindow('http://localhost:5171/')
  installStorage()
  __resetAuth()
  setTokens({ accessToken: 'access-token', refreshToken: 'refresh-token' })
})

afterEach(() => {
  stub?.restore()
  removeStorage()
  removeWindow()
})

after(() => {
  __resetAuth()
})

/* ==================================================================== the base */

describe('every request goes to micro-aetherholm', () => {
  it('addresses the service, not the page origin', async () => {
    stub = installFetch(() => json(200, { airships: {} }))
    await fetchAirships()
    assert.equal(lastCall().url, `${BASE}/v1/content/airships`)
    assert.notEqual(new URL(lastCall().url).port, '5171')
  })

  it('carries the bearer token on an authenticated route', async () => {
    stub = installFetch(() => json(200, { cities: [] }))
    await fetchCities()
    assert.equal(lastCall().headers['authorization'], 'Bearer access-token')
  })

  it('does NOT carry a token on the public content route', async () => {
    // `aetherholm/src/server.ts:490` takes no principal. A token on a route that cannot read it
    // is a needless credential on the wire.
    stub = installFetch(() => json(200, { airships: {} }))
    await fetchAirships()
    assert.equal(lastCall().headers['authorization'], undefined)
  })
})

/* ==================================================================== the world, read */

describe('fetchCurrentSeason — GET /v1/seasons/current (server.ts:382)', () => {
  it('gets exactly that path, with the token', async () => {
    stub = installFetch(() => json(200, seasonBody()))
    await fetchCurrentSeason()
    assert.equal(lastCall().url, `${BASE}/v1/seasons/current`)
    assert.equal(lastCall().method, 'GET')
    assert.equal(lastCall().headers['authorization'], 'Bearer access-token')
  })

  it('maps the 404 no_open_season (server.ts:386) to null — an answer, not an error', async () => {
    stub = installFetch(() => json(404, { error: { code: 'no_open_season', message: 'no season is open yet' } }))
    assert.equal(await fetchCurrentSeason(), null)
  })

  it('keeps the seed a string — it is 64-bit and not a JSON number (server.ts:393)', async () => {
    stub = installFetch(() => json(200, seasonBody({ seed: '18446744073709551615' })))
    const season = await fetchCurrentSeason()
    assert.equal(season?.seed, '18446744073709551615')
    assert.notEqual(String(Number('18446744073709551615')), '18446744073709551615')
  })

  it('still throws on a 500 — only the 404 is expected', async () => {
    stub = installFetch(() => json(500, { error: { code: 'internal', message: 'nope' } }))
    await assert.rejects(() => fetchCurrentSeason(), (err: unknown) => err instanceof ApiError && err.status === 500)
  })
})

describe('islands and lanes — GET /v1/archipelagos/:id/{islands,lanes} (server.ts:401, :518)', () => {
  it('gets the islands of exactly that archipelago', async () => {
    stub = installFetch(() => json(200, { islands: [] }))
    await fetchIslands(ID)
    assert.equal(lastCall().url, `${BASE}/v1/archipelagos/${ID}/islands`)
  })

  it('gets the lanes of exactly that archipelago', async () => {
    stub = installFetch(() => json(200, { lanes: [] }))
    await fetchLanes(ID)
    assert.equal(lastCall().url, `${BASE}/v1/archipelagos/${ID}/lanes`)
  })

  it('refuses a malformed archipelago id BEFORE the wire', async () => {
    stub = installFetch(() => json(200, { islands: [] }))
    await assert.rejects(
      async () => fetchIslands('not-a-uuid'),
      (err: unknown) => err instanceof ApiError && err.status === 0 && err.code === 'malformed_id',
    )
    assert.deepEqual(stub.calls, [], 'a request went out with a malformed id in the path')
  })

  it('accepts a real uuid, so the guard is not simply refusing everything', () => {
    assert.equal(assertUuid(ID, 'id'), ID)
  })
})

/* ==================================================================== city play */

describe('foundCity — POST /v1/cities (server.ts:415)', () => {
  it('posts islandId, plot as a NUMBER (server.ts:421), and name', async () => {
    stub = installFetch(() => json(201, { city: cityBody() }))
    await foundCity({ islandId: ID, plot: 7, name: 'Skyhold' })
    assert.equal(lastCall().url, `${BASE}/v1/cities`)
    assert.equal(lastCall().method, 'POST')
    const body = bodyOf(lastCall())
    assert.deepEqual(body, { islandId: ID, plot: 7, name: 'Skyhold' })
    assert.strictEqual(typeof body['plot'], 'number')
  })

  it('sends NO Idempotency-Key: the partial unique index is the idempotency on this route', async () => {
    stub = installFetch(() => json(201, { city: cityBody() }))
    await foundCity({ islandId: ID, plot: 1, name: 'Skyhold' })
    assert.equal(lastCall().headers['idempotency-key'], undefined)
  })
})

describe('the queue submissions — POST /v1/cities/:id/{buildings,research,ships} (server.ts:474-482)', () => {
  it('queueBuilding posts {type} with the Idempotency-Key (a 400 without it, server.ts:875-878)', async () => {
    stub = installFetch(() => json(200, queueBody()))
    await queueBuilding(ID, 'well_rig', 'key-1')
    assert.equal(lastCall().url, `${BASE}/v1/cities/${ID}/buildings`)
    assert.equal(lastCall().headers['idempotency-key'], 'key-1')
    assert.deepEqual(bodyOf(lastCall()), { type: 'well_rig' })
  })

  it('queueResearch posts {node}', async () => {
    stub = installFetch(() => json(200, queueBody()))
    await queueResearch(ID, 'well_lore', 'key-2')
    assert.equal(lastCall().url, `${BASE}/v1/cities/${ID}/research`)
    assert.deepEqual(bodyOf(lastCall()), { node: 'well_lore' })
  })

  it('queueShip posts {class}', async () => {
    stub = installFetch(() => json(200, queueBody()))
    await queueShip(ID, 'skiff', 'key-3')
    assert.equal(lastCall().url, `${BASE}/v1/cities/${ID}/ships`)
    assert.deepEqual(bodyOf(lastCall()), { class: 'skiff' })
  })

  it('re-sends the key on the retry after a token refresh', async () => {
    // The header is built inside `send()`, so the second attempt carries it too. A refreshed
    // retry that dropped the key would charge the treasury a second time — exactly what the key
    // exists to prevent.
    let first = true
    stub = installFetch((call) => {
      if (call.url.endsWith('/auth/refresh')) {
        return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' })
      }
      if (first) {
        first = false
        return json(401, { error: { code: 'unauthenticated', message: 'expired' } })
      }
      return json(200, queueBody())
    })
    await queueBuilding(ID, 'warehouse', 'key-retry')
    const submissions = stub.calls.filter((c) => c.url.endsWith('/buildings'))
    assert.equal(submissions.length, 2)
    for (const call of submissions) assert.equal(call.headers['idempotency-key'], 'key-retry')
  })

  it('surfaces `replayed`, so the UI can say a retry charged nothing', async () => {
    stub = installFetch(() => json(200, queueBody({ replayed: true })))
    const reply = await queueBuilding(ID, 'vault', 'k')
    assert.equal(reply.replayed, true)
  })
})

describe('newIdempotencyKey', () => {
  it('is different every time — the key is per submission, not per body', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()))
    assert.equal(keys.size, 200)
  })

  it('fits the 1..200 character bound server.ts:876 enforces', () => {
    const key = newIdempotencyKey()
    assert.ok(key.length >= 1 && key.length <= 200, `key length ${key.length} is out of range`)
  })
})

/* ==================================================================== fleets */

describe('launchFleet — POST /v1/fleets (server.ts:533)', () => {
  const ships = { skiff: 2, hauler: 1 }

  it('posts to exactly /v1/fleets with the Idempotency-Key (server.ts:535-538)', async () => {
    stub = installFetch(() => json(201, launchBody()))
    await launchFleet({ cityId: ID, mission: 'transfer', targetIslandId: ID2, ships }, 'key-l')
    assert.equal(lastCall().url, `${BASE}/v1/fleets`)
    assert.equal(lastCall().method, 'POST')
    assert.equal(lastCall().headers['idempotency-key'], 'key-l')
  })

  it('sends ship counts as NUMBERS — server.ts:561 tests typeof', async () => {
    stub = installFetch(() => json(201, launchBody()))
    await launchFleet({ cityId: ID, mission: 'raid', targetIslandId: ID2, ships }, 'k')
    const sent = bodyOf(lastCall())['ships'] as Record<string, unknown>
    assert.strictEqual(sent['skiff'], 2)
    assert.strictEqual(typeof sent['hauler'], 'number')
  })

  it('sends cargo as DECIMAL STRINGS — a float is a 400 at server.ts:573-574', async () => {
    stub = installFetch(() => json(201, launchBody()))
    await launchFleet(
      { cityId: ID, mission: 'transfer', targetIslandId: ID2, ships, cargo: { aether: '9007199254740993' } },
      'k',
    )
    const cargo = bodyOf(lastCall())['cargo'] as Record<string, unknown>
    // Above 2^53: the string survives exactly; a Number() round trip would have corrupted it.
    assert.strictEqual(cargo['aether'], '9007199254740993')
  })

  it('refuses a non-decimal cargo amount before the wire', async () => {
    stub = installFetch(() => json(201, launchBody()))
    await assert.rejects(
      async () =>
        launchFleet(
          { cityId: ID, mission: 'transfer', targetIslandId: ID2, ships, cargo: { aether: '1.5' } },
          'k',
        ),
      (err: unknown) => err instanceof ApiError && err.code === 'malformed_amount',
    )
    assert.deepEqual(stub.calls, [], 'a float went out on the wire')
  })

  it('omits targetCityId entirely when there is none', async () => {
    stub = installFetch(() => json(201, launchBody()))
    await launchFleet({ cityId: ID, mission: 'siege', targetIslandId: ID2, ships }, 'k')
    assert.equal('targetCityId' in bodyOf(lastCall()), false)
  })

  it('keeps aetherLift a string in the reply — the server charged BigInt, the client renders it', async () => {
    stub = installFetch(() => json(201, launchBody({ aetherLift: '18446744073709551615' })))
    const reply = await launchFleet({ cityId: ID, mission: 'transfer', targetIslandId: ID2, ships }, 'k')
    assert.strictEqual(reply.fleet.aetherLift, '18446744073709551615')
  })
})

describe('fleet reads — GET /v1/fleets, GET /v1/fleets/:id (server.ts:616, :634)', () => {
  it('lists own fleets with no userId parameter — naming another player is an admin read', async () => {
    stub = installFetch(() => json(200, { fleets: [] }))
    await fetchFleets()
    assert.equal(lastCall().url, `${BASE}/v1/fleets`)
  })

  it('gets one fleet by uuid', async () => {
    stub = installFetch(() => json(200, { fleet: launchBody().fleet }))
    await fetchFleet(ID)
    assert.equal(lastCall().url, `${BASE}/v1/fleets/${ID}`)
  })
})

describe('fetchBattle — GET /v1/battles/:id (server.ts:649)', () => {
  it('gets exactly that path and renders what it is given — no recomputation exists to test', async () => {
    stub = installFetch(() => json(200, { battle: battleBody() }))
    const battle = await fetchBattle(ID)
    assert.equal(lastCall().url, `${BASE}/v1/battles/${ID}`)
    // The digest comes through untouched: it is displayed, never derived here.
    assert.equal(battle.digest, battleBody().digest)
  })
})

/* ==================================================================== alliances */

describe('alliances (server.ts:715-792)', () => {
  it('foundAlliance posts archipelagoId, communityId and name — and NEVER creates a community', async () => {
    stub = installFetch(() => json(201, { alliance: allianceBody() }))
    await foundAlliance({ archipelagoId: ID, communityId: ID2, name: 'The Windward Compact' })
    assert.equal(lastCall().url, `${BASE}/v1/alliances`)
    // The body carries the id of an EXISTING community (server.ts:719-726); there is no name,
    // no description, no member list — nothing a community-creation call would need.
    assert.deepEqual(bodyOf(lastCall()), {
      archipelagoId: ID,
      communityId: ID2,
      name: 'The Windward Compact',
    })
  })

  it('never addresses micro-community at all', async () => {
    stub = installFetch(() => json(201, { alliance: allianceBody() }))
    await foundAlliance({ archipelagoId: ID, communityId: ID2, name: 'x' })
    for (const call of stub.calls) {
      assert.ok(call.url.startsWith(BASE), `${call.url} left the game service`)
    }
  })

  it('joins by POST to /v1/alliances/:id/members', async () => {
    stub = installFetch(() => json(200, { joined: true }))
    await joinAlliance(ID)
    assert.equal(lastCall().url, `${BASE}/v1/alliances/${ID}/members`)
    assert.equal(lastCall().method, 'POST')
  })

  it('leaves by DELETE to the same path — the method is the difference', async () => {
    stub = installFetch(() => json(200, { left: true }))
    await leaveAlliance(ID)
    assert.equal(lastCall().url, `${BASE}/v1/alliances/${ID}/members`)
    assert.equal(lastCall().method, 'DELETE')
  })

  it('claims by POST with the islandId in the body', async () => {
    stub = installFetch(() => json(201, { claimed: true }))
    await claimIsland(ID, ID2)
    assert.equal(lastCall().url, `${BASE}/v1/alliances/${ID}/claims`)
    assert.deepEqual(bodyOf(lastCall()), { islandId: ID2 })
  })

  it('reads an alliance by id', async () => {
    stub = installFetch(() => json(200, { alliance: allianceBody() }))
    await fetchAlliance(ID)
    assert.equal(lastCall().url, `${BASE}/v1/alliances/${ID}`)
  })
})

/* ==================================================================== the chronicle */

describe('the chronicle — anonymous, exercised as such (server.ts:800-841)', () => {
  it('lists sealed seasons WITHOUT a token, even while holding one', async () => {
    // The session holds tokens (beforeEach), and the request still goes out bare: the
    // chronicle's anonymity is asserted on every page view, not merely believed.
    stub = installFetch(() => json(200, { seasons: [] }))
    await fetchChronicleSeasons()
    assert.equal(lastCall().url, `${BASE}/v1/chronicle/seasons`)
    assert.equal(lastCall().headers['authorization'], undefined)
  })

  it('reads one sealed season without a token, and maps its 404 to null', async () => {
    stub = installFetch(() => json(200, chronicleBody()))
    await fetchChronicle(ID)
    assert.equal(lastCall().url, `${BASE}/v1/chronicle/seasons/${ID}`)
    assert.equal(lastCall().headers['authorization'], undefined)

    stub.restore()
    stub = installFetch(() => json(404, { error: { code: 'not_found', message: 'no sealed season with that id' } }))
    assert.equal(await fetchChronicle(ID), null)
  })

  it('reads a sealed season’s battles without a token', async () => {
    stub = installFetch(() => json(200, { battles: [] }))
    await fetchChronicleBattles(ID)
    assert.equal(lastCall().url, `${BASE}/v1/chronicle/seasons/${ID}/battles`)
    assert.equal(lastCall().headers['authorization'], undefined)
  })

  it('only ever GETs the chronicle — there is no mutation to make', async () => {
    stub = installFetch(() => json(200, { seasons: [], battles: [], summary: {}, digest: 'd', sealedAt: new Date().toISOString() }))
    await fetchChronicleSeasons()
    await fetchChronicle(ID)
    await fetchChronicleBattles(ID)
    for (const call of stub.calls) {
      assert.equal(call.method, 'GET', `${call.method} ${call.url}: a sealed season is history`)
    }
  })
})

/* ==================================================================== readyz */

describe('fetchReadiness — GET /readyz (server.ts:314)', () => {
  it('gets /readyz, unauthenticated', async () => {
    stub = installFetch(() => json(200, { ready: true }))
    await fetchReadiness()
    assert.equal(lastCall().url, `${BASE}/readyz`)
    assert.equal(lastCall().headers['authorization'], undefined)
  })

  it('reads the 503 body as not-ready rather than throwing (server.ts:316)', async () => {
    stub = installFetch(() => json(503, { ready: false, checks: [] }))
    assert.deepEqual(await fetchReadiness(), { ready: false })
  })

  it('reports not-ready when the service cannot be reached at all', async () => {
    stub = installFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    assert.deepEqual(await fetchReadiness(), { ready: false })
  })
})

/* ==================================================================== the negative test */

describe('the routes this client must NOT call', () => {
  const KNOWN: readonly string[] = [
    '/readyz',
    '/v1/seasons/current',
    `/v1/archipelagos/${ID}/islands`,
    `/v1/archipelagos/${ID}/lanes`,
    '/v1/content/airships',
    '/v1/cities',
    `/v1/cities/${ID}`,
    `/v1/cities/${ID}/buildings`,
    `/v1/cities/${ID}/research`,
    `/v1/cities/${ID}/ships`,
    '/v1/fleets',
    `/v1/fleets/${ID}`,
    `/v1/battles/${ID}`,
    '/v1/alliances',
    `/v1/alliances/${ID}`,
    `/v1/alliances/${ID}/members`,
    `/v1/alliances/${ID}/claims`,
    '/v1/chronicle/seasons',
    `/v1/chronicle/seasons/${ID}`,
    `/v1/chronicle/seasons/${ID}/battles`,
  ]

  it('exercises every wrapper and every path is in the service’s route table', async () => {
    stub = installFetch((call) => {
      if (call.url.includes('/islands')) return json(200, { islands: [] })
      if (call.url.includes('/lanes')) return json(200, { lanes: [] })
      if (call.url.includes('/airships')) return json(200, { airships: {} })
      if (call.url.includes('/seasons/current')) return json(200, seasonBody())
      if (call.url.includes('/chronicle/seasons') && call.url.endsWith('/battles')) return json(200, { battles: [] })
      if (call.url.endsWith('/chronicle/seasons')) return json(200, { seasons: [] })
      if (call.url.includes('/chronicle/seasons/')) return json(200, chronicleBody())
      if (call.url.includes('/battles/')) return json(200, { battle: battleBody() })
      if (call.url.includes('/buildings') || call.url.includes('/research') || call.url.endsWith('/ships')) {
        return json(200, queueBody())
      }
      if (call.url.endsWith('/v1/fleets') && call.method === 'POST') return json(201, launchBody())
      if (call.url.includes('/fleets')) return json(200, call.url.endsWith('/v1/fleets') ? { fleets: [] } : { fleet: launchBody().fleet })
      if (call.url.includes('/alliances') && call.url.endsWith('/members')) return json(200, { joined: true, left: true })
      if (call.url.endsWith('/claims')) return json(201, { claimed: true })
      if (call.url.includes('/alliances')) return json(200, { alliance: allianceBody() })
      if (call.url.includes('/cities')) return json(200, { cities: [], city: cityBody() })
      if (call.url.includes('/readyz')) return json(200, { ready: true })
      return json(200, {})
    })

    await fetchReadiness()
    await fetchCurrentSeason()
    await fetchIslands(ID)
    await fetchLanes(ID)
    await fetchAirships()
    await foundCity({ islandId: ID, plot: 1, name: 'x' })
    await fetchCities()
    await fetchCity(ID)
    await queueBuilding(ID, 'well_rig', 'k')
    await queueResearch(ID, 'well_lore', 'k')
    await queueShip(ID, 'skiff', 'k')
    await launchFleet({ cityId: ID, mission: 'transfer', targetIslandId: ID2, ships: { skiff: 1 } }, 'k')
    await fetchFleets()
    await fetchFleet(ID)
    await fetchBattle(ID)
    await foundAlliance({ archipelagoId: ID, communityId: ID2, name: 'x' })
    await fetchAlliance(ID)
    await joinAlliance(ID)
    await leaveAlliance(ID)
    await claimIsland(ID, ID2)
    await fetchChronicleSeasons()
    await fetchChronicle(ID)
    await fetchChronicleBattles(ID)

    assert.equal(stub.calls.length, 23, 'every wrapper must be exercised by this test')
    for (const call of stub.calls) {
      const path = new URL(call.url).pathname.replace(new RegExp(ID2, 'g'), ID)
      assert.ok(KNOWN.includes(path), `${path} is not a route aetherholm/src/server.ts defines`)
    }
  })

  it('never calls a /v1 path outside the six families the service serves', async () => {
    stub = installFetch(() => json(200, { airships: {} }))
    await fetchAirships()
    const path = new URL(lastCall().url).pathname
    assert.ok(
      ['/v1/seasons', '/v1/archipelagos', '/v1/content', '/v1/cities', '/v1/fleets', '/v1/battles', '/v1/alliances', '/v1/chronicle'].some(
        (family) => path.startsWith(family),
      ) || !path.startsWith('/v1'),
    )
  })
})

/* ==================================================================== fixtures */

function seasonBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    name: 'Season of the First Winds',
    seed: '12345678901234567890',
    status: 'open',
    openedAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-09-29T00:00:00.000Z',
    archipelagoId: ID2,
    ...overrides,
  }
}

function cityBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    islandId: ID2,
    archipelagoId: ID2,
    band: 'midreach',
    userId: ID,
    plot: 1,
    name: 'Skyhold',
    foundedAt: '2026-06-02T00:00:00.000Z',
    aegisUntil: '2026-06-09T00:00:00.000Z',
    stocks: { aether: '120', cloudstone: '200', skysteel: '60', provisions: '160' },
    rates: { aether: '4', cloudstone: '8', skysteel: '2', provisions: '6' },
    storageCap: '500',
    settledAt: '2026-06-02T00:00:00.000Z',
    buildings: [],
    ships: [],
    queue: [],
    ...overrides,
  }
}

function queueBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    item: {
      id: ID,
      kind: 'building',
      target: 'well_rig',
      startedAt: '2026-06-02T00:00:00.000Z',
      completesAt: '2026-06-02T00:05:00.000Z',
    },
    replayed: false,
    stocks: { aether: '100', cloudstone: '140', skysteel: '45', provisions: '130' },
    ...overrides,
  }
}

function launchBody(overrides: Record<string, unknown> = {}): { fleet: Record<string, unknown> } & Record<string, unknown> {
  return {
    fleet: {
      id: ID,
      originCityId: ID,
      userId: ID,
      mission: 'transfer',
      status: 'outbound',
      targetIslandId: ID2,
      targetCityId: null,
      ships: { skiff: '1' },
      cargo: {},
      aetherLift: (overrides['aetherLift'] as string) ?? '12',
      departedAt: '2026-06-02T00:00:00.000Z',
      arrivesAt: '2026-06-02T02:00:00.000Z',
      returnsAt: null,
      travelSeconds: 7200,
    },
    replayed: false,
    stocks: { aether: '88', cloudstone: '200', skysteel: '60', provisions: '160' },
  }
}

function battleBody(): Record<string, unknown> {
  return {
    id: ID,
    islandId: ID2,
    plot: 3,
    mission: 'raid',
    windBp: 11000,
    attackerUserId: ID,
    defenderUserId: ID2,
    attackerOob: { skiff: 2 },
    defenderOob: { cutter: 1 },
    result: { rounds: 2, attackerWon: true },
    digest: 'a'.repeat(64),
    occurredAt: '2026-06-03T00:00:00.000Z',
  }
}

function allianceBody(): Record<string, unknown> {
  return {
    id: ID,
    archipelagoId: ID2,
    communityId: ID2,
    name: 'The Windward Compact',
    foundedBy: ID,
    createdAt: '2026-06-02T00:00:00.000Z',
    members: [],
    claims: [],
    beacons: [],
    sharedLanes: [],
  }
}

function chronicleBody(): Record<string, unknown> {
  return {
    summary: { victors: [] },
    digest: 'b'.repeat(64),
    sealedAt: '2026-09-29T00:00:00.000Z',
  }
}
