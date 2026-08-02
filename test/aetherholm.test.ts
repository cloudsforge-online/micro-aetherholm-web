/**
 * THE ROUTE TABLE, CHECKED AGAINST THE SERVICE THAT SERVES IT.
 *
 * Every client in this estate that was built against an imagined surface passed its own tests —
 * that is the whole problem. So this file does not assert paths in the abstract: it reads
 * `aetherholm/src/server.ts` from a sibling checkout and requires that each path and method this
 * bundle calls is REGISTERED there, at the line the citation names, and that each authenticates
 * by the MECHANISM the table records.
 *
 * The four disciplines, each earned by a sibling's defect:
 *
 * **1. Citations.** Each entry in `SURFACE`/`DECLINED` names a line; that line must contain the
 * `define(` that registers exactly that method and path.
 *
 * **2. SHAPES, never prefixes.** `micro-market`'s guard matched `startsWith(prefix)` and
 * `micro-mint-web` shipped exactly the defect it would have passed. `matchesShape` requires the
 * same segment count with every segment agreeing, and `${...}` is exactly one segment.
 *
 * **3. HOW each route authenticates, not whether.** Aetherholm has SIX mechanisms: public
 * routes, plain-bearer routes (user token, or service with `aetherholm:read`), owner routes
 * (owner-or-admin for users), user-act routes (`requireUser`: user token, or service with
 * `aetherholm:write` naming an `x-user-id`), the service-only provision route, and the
 * conditional battle route (public once the season is SEALED, participants-only while live). A
 * boolean "does it authenticate" collapses all six — and the three queue handlers are
 * one-line delegations to `queueRoute`, so a grep for `authenticate(` in THEIR bodies would call
 * the three routes that charge a treasury public. The helper is verified separately below.
 *
 * **4. NO LINE NUMBER IS EVER WRITTEN INSIDE A CHECK.** micro-trade-web hardcoded one and its
 * guard kept passing while grading a different function after the table moved. Every line this
 * file reads comes out of the tables, and the handler-body extractor walks forward from the
 * cited line to the next `define(` (or the end of the route array) rather than to a number.
 *
 * Without the sibling checkout the cross-repository half SKIPS — `pnpm test` must pass for
 * somebody who cloned only this repository — and CI is where absence becomes fatal: the workflow
 * checks the service out and requires the verified-route count in the output.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const here = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url))

/** Where a micro-aetherholm checkout is, in the order CI and a developer's machine put it. */
const CANDIDATES = [
  process.env['CLOUDSFORGE_AETHERHOLM_DIR'],
  here('../aetherholm/src/server.ts'),
  here('.aetherholm/src/server.ts'),
].filter((v): v is string => Boolean(v))

const server = CANDIDATES.find((p) => existsSync(p))

/**
 * How a route establishes its caller. `none` asserts the ABSENCE of every other mechanism's
 * pattern, which is what makes the set exhaustive rather than a list of things somebody happened
 * to check for.
 */
type Auth = 'none' | 'bearer' | 'owner' | 'user' | 'user-queue' | 'provision' | 'sealed-public'

/** What a handler body must contain for each mechanism. `none` is handled separately. */
const MECHANISM: Readonly<Record<Exclude<Auth, 'none'>, RegExp>> = {
  // Any bearer; a service must carry aetherholm:read. No owner check in the body.
  bearer: /await authenticate\(ctx, deps\);\s*\n(?:[\s\S](?!isAdmin))*?requireScope\(principal, READ_SCOPE\)/,
  // Owner-or-admin for users, read scope for services: authenticate AND an isAdmin branch.
  owner: /await authenticate\(ctx, deps\)[\s\S]*isAdmin\(principal\)[\s\S]*requireScope\(principal, READ_SCOPE\)|await authenticate\(ctx, deps\)[\s\S]*requireScope\(principal, READ_SCOPE\)[\s\S]*isAdmin\(principal\)/,
  // A user acting as themselves; a service must carry aetherholm:write and name x-user-id —
  // the whole of that lives in requireUser (aetherholm/src/server.ts:1031-1040).
  user: /await requireUser\(ctx, deps\)/,
  // The three queue routes delegate whole: the auth AND the Idempotency-Key requirement live in
  // queueRoute, which its own tests below verify.
  'user-queue': /return queueRoute\(ctx, deps, '(?:building|research|ship)'\);/,
  // Service token only, exact scope; a user token is refused before the scope is looked at.
  provision: /principal\.kind !== 'service'[\s\S]*requireScope\(principal, PROVISION_SCOPE\)/,
  // Public once sealed; authenticate only on the live branch.
  'sealed-public': /season_status !== 'sealed'[\s\S]*await authenticate\(ctx, deps\)/,
}

const ANY_MECHANISM = [
  /await authenticate\(ctx, deps\)/,
  /await requireUser\(ctx, deps\)/,
  /queueRoute\(ctx, deps/,
  /requireScope\(/,
]

interface Route {
  readonly method: string
  readonly path: string
  readonly line: number
  readonly auth: Auth
  /** True when the service refuses the request without an Idempotency-Key header. */
  readonly idempotent: boolean
}

/**
 * The surface this bundle CALLS, with the line each was read from. Written down as DATA so the
 * checks below can be mechanical: a wrong citation fails and names itself.
 */
export const SURFACE: readonly Route[] = [
  { method: 'GET', path: '/readyz', line: 328, auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/seasons/current', line: 396, auth: 'bearer', idempotent: false },
  { method: 'GET', path: '/v1/archipelagos/:id/islands', line: 415, auth: 'bearer', idempotent: false },
  { method: 'GET', path: '/v1/archipelagos/:id/lanes', line: 572, auth: 'bearer', idempotent: false },
  { method: 'GET', path: '/v1/content/airships', line: 544, auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/content/buildings', line: 508, auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/content/research', line: 526, auth: 'none', idempotent: false },
  { method: 'POST', path: '/v1/cities', line: 429, auth: 'user', idempotent: false },
  { method: 'GET', path: '/v1/cities', line: 454, auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/cities/:id', line: 473, auth: 'owner', idempotent: false },
  { method: 'POST', path: '/v1/cities/:id/buildings', line: 488, auth: 'user-queue', idempotent: true },
  { method: 'POST', path: '/v1/cities/:id/research', line: 492, auth: 'user-queue', idempotent: true },
  { method: 'POST', path: '/v1/cities/:id/ships', line: 496, auth: 'user-queue', idempotent: true },
  { method: 'POST', path: '/v1/fleets', line: 587, auth: 'user', idempotent: true },
  { method: 'GET', path: '/v1/fleets', line: 670, auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/fleets/:id', line: 688, auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/battles', line: 703, auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/battles/:id', line: 737, auth: 'sealed-public', idempotent: false },
  { method: 'GET', path: '/v1/alliances', line: 830, auth: 'bearer', idempotent: false },
  { method: 'POST', path: '/v1/alliances', line: 803, auth: 'user', idempotent: false },
  { method: 'GET', path: '/v1/alliances/:id', line: 839, auth: 'bearer', idempotent: false },
  { method: 'POST', path: '/v1/alliances/:id/members', line: 849, auth: 'user', idempotent: false },
  { method: 'DELETE', path: '/v1/alliances/:id/members', line: 862, auth: 'user', idempotent: false },
  { method: 'POST', path: '/v1/alliances/:id/claims', line: 875, auth: 'user', idempotent: false },
  { method: 'GET', path: '/v1/chronicle/seasons', line: 897, auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/chronicle/seasons/:id', line: 913, auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/chronicle/seasons/:id/battles', line: 930, auth: 'none', idempotent: false },
]

/**
 * The routes `aetherholm` serves that this bundle deliberately does NOT call. Declining is a
 * first-class entry: the "knows about everything it serves" test is satisfied by
 * `SURFACE ∪ DECLINED`, so a route the service grows and nobody reads fails the build instead of
 * going quiet. The REASONS are in the header of src/lib/aetherholm.ts, keyed by these citations.
 */
export const DECLINED: readonly Route[] = [
  { method: 'GET', path: '/livez', line: 326, auth: 'none', idempotent: false },
  { method: 'GET', path: '/metrics', line: 333, auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/title', line: 348, auth: 'none', idempotent: false },
  { method: 'POST', path: '/v1/provision', line: 350, auth: 'provision', idempotent: false },
]

const ALL: readonly Route[] = [...SURFACE, ...DECLINED]

const client = readFileSync(here('src/lib/aetherholm.ts'), 'utf8')

/* ------------------------------------------------ shapes, never prefixes */

/** Same segment count, every segment agrees; a `:param` accepts one non-empty segment. */
function matchesShape(requested: string, pattern: string): boolean {
  const asked = requested.split('/')
  const serves = pattern.split('/')
  if (asked.length !== serves.length) return false
  return serves.every((segment, index) => {
    const mine = asked[index] ?? ''
    return segment.startsWith(':') ? mine.length > 0 : segment === mine
  })
}

/** `${...}` is exactly ONE segment — a helper standing for two is refused, not guessed at. */
const placeholder = (path: string): string => path.replace(/\$\{[^}]*\}/g, 'x')

/**
 * The executable part of the client: prose stripped, so a sentence is never read as a request.
 * This client's own header is a table of every path it calls and declines; without stripping,
 * the "never requests a declined path" check would fail the file that is most careful about it.
 */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

/**
 * One request path as it appears in source: a quoted string starting `/v1/` or `/readyz`. An
 * interpolation is consumed whole — quotes and all — before the closing quote is looked for,
 * because `${encodeURIComponent(assertUuid(id, 'city id'))}` contains quotes of its own.
 */
const PATH_LITERAL = /['"`]((?:\/v1\/(?:\$\{[^}]*\}|[^'"`])*)|\/readyz)['"`]/g

export function requestedPaths(source: string): readonly string[] {
  return [...codeOf(source).matchAll(PATH_LITERAL)].map((m) => m[1] ?? '')
}

/** Every call site as METHOD + path + the option block that follows it. GET is the default
 *  (src/lib/api.ts:270). */
function requestedCalls(source: string): ReadonlyArray<{ method: string; path: string; block: string }> {
  const code = codeOf(source)
  const matches = [...code.matchAll(PATH_LITERAL)]
  return matches.map((match, index) => {
    const from = (match.index ?? 0) + match[0].length
    const to = matches[index + 1]?.index ?? code.length
    const block = code.slice(from, to)
    const method = /method:\s*'([A-Z]+)'/.exec(block)?.[1]
    return { method: method ?? 'GET', path: match[1] ?? '', block }
  })
}

describe('the client calls only routes it has cited', () => {
  it('every path in the client is a WHOLE ROUTE SHAPE the service serves', () => {
    const paths = requestedPaths(client)
    assert.ok(paths.length >= 23, `expected the call sites, found ${paths.length}: ${paths.join(', ')}`)
    for (const path of new Set(paths)) {
      const shape = placeholder(path)
      assert.ok(
        SURFACE.some((r) => matchesShape(shape, r.path)),
        `src/lib/aetherholm.ts requests ${path}, which is not a whole route shape in the verified surface`,
      )
    }
  })

  it('and it never requests a path the service does not serve, including a served PREFIX', () => {
    // The mutation, in the suite: every path below BEGINS with something aetherholm really
    // serves, which is exactly the case a prefix check waves through.
    // Two entries used to be '/v1/alliances' and '/v1/battles' — dead when written, ALIVE since
    // the service grew its directory and history reads. A canary naming something that became
    // real asserts the opposite of the truth (the cf-input lesson, in path form), so each
    // replacement is a shape with no plausible future: a sub-resource the design explicitly
    // refuses or a spelling the router cannot produce.
    const dead = [
      '/v1/cities/${id}/queue',
      '/v1/cities/${id}/buildings/${type}',
      '/v1/fleets/${id}/recall',
      '/v1/alliances/${id}/treasury',
      '/v1/alliances/${id}/claims/${islandId}',
      '/v1/chronicle/seasons/${id}/battles/${battleId}',
      '/v1/${scope}/current',
      '/v1/battles/${id}/replay',
    ]
    for (const path of dead) {
      assert.equal(
        SURFACE.some((r) => matchesShape(placeholder(path), r.path) && r.method === 'GET'),
        false,
        `GET ${path} is not served by micro-aetherholm, but this check accepted it`,
      )
    }
    // And it is not simply refusing everything: every route in the surface matches itself.
    for (const route of SURFACE) {
      assert.ok(matchesShape(route.path, route.path), route.path)
    }
  })

  it('cites a line for every route, called or declined, in the client', () => {
    for (const route of ALL) {
      assert.ok(
        client.includes(`aetherholm/src/server.ts:${route.line}`),
        `${route.method} ${route.path} has no citation in src/lib/aetherholm.ts`,
      )
    }
  })

  it('every call site uses a method the surface table cites for that shape', () => {
    const calls = requestedCalls(client)
    assert.ok(calls.length >= 23, `expected the call sites, found ${calls.length}`)
    for (const call of calls) {
      assert.ok(
        SURFACE.some((r) => r.method === call.method && matchesShape(placeholder(call.path), r.path)),
        `src/lib/aetherholm.ts sends ${call.method} ${call.path}, which is not in the verified surface`,
      )
    }
  })

  it('every declined route says why, and none of them is called', () => {
    const calls = requestedCalls(client)
    for (const route of DECLINED) {
      assert.ok(
        calls.every(
          (call) => !(call.method === route.method && matchesShape(placeholder(call.path), route.path)),
        ),
        `${route.method} ${route.path} is declined but src/lib/aetherholm.ts requests it`,
      )
    }
  })

  it('reaches every route the service serves that it does not decline', () => {
    const calls = requestedCalls(client)
    const unreached = SURFACE.filter(
      (route) =>
        !calls.some(
          (call) => call.method === route.method && matchesShape(placeholder(call.path), route.path),
        ),
    ).map((route) => `${route.method} ${route.path}`)
    assert.deepEqual(unreached, [], 'the surface table names a route no wrapper calls')
  })

  it('sends an Idempotency-Key on exactly the routes the service requires one, and no other', () => {
    // Four routes are a 400 without the header (the three queues via queueRoute, the launch
    // inline); every other mutation reads none, and sending one there would invent a contract.
    const calls = requestedCalls(client)
    for (const call of calls) {
      const route = SURFACE.find(
        (r) => r.method === call.method && matchesShape(placeholder(call.path), r.path),
      )
      if (!route) continue
      const sends = /'idempotency-key': key/.test(call.block)
      assert.equal(
        sends,
        route.idempotent,
        `${route.method} ${route.path}: the client ${sends ? 'sends' : 'does not send'} an ` +
          `Idempotency-Key and the service ${route.idempotent ? 'requires' : 'does not read'} one`,
      )
    }
    const wrapped = SURFACE.filter((r) => r.idempotent).length
    assert.equal(wrapped, 4, `the service requires the header on four routes; the table names ${wrapped}`)
  })

  it('THE CHRONICLE IS READ-ONLY BY CONSTRUCTION: no non-GET request is ever built for it', () => {
    // A sealed season is history. The service serves no mutation, the database refuses one by
    // trigger, and this client must not even own the code shape of one.
    const calls = requestedCalls(client)
    for (const call of calls) {
      if (call.path.includes('/v1/chronicle')) {
        assert.equal(call.method, 'GET', `${call.method} ${call.path}: the chronicle is immutable history`)
      }
    }
    // And anonymously: every chronicle call site opts out of the bearer token.
    for (const call of calls) {
      if (call.path.includes('/v1/chronicle')) {
        assert.match(call.block, /auth:\s*false/, `${call.path} would send a token to the anonymous surface`)
      }
    }
  })
})

describe('the cited lines are the lines that register the routes', () => {
  if (server === undefined) {
    // NOT a silent pass. It says which check did not run, and CI makes the absence fatal.
    it('SKIPPED: no micro-aetherholm checkout — CI checks one out and requires this to run', () => {
      assert.ok(true)
    })
    return
  }

  const source = readFileSync(server, 'utf8')
  const lines = source.split('\n')

  it('reads a server with a route table in it, so this cannot pass on an empty file', () => {
    const defines = lines.filter((l) => /^\s{4}define\('/.test(l))
    assert.ok(defines.length >= 27, `expected aetherholm's route list, found ${defines.length} defines`)
  })

  for (const route of ALL) {
    it(`${route.method} ${route.path} is registered at aetherholm/src/server.ts:${route.line}`, () => {
      const line = lines[route.line - 1] ?? ''
      assert.match(
        line,
        new RegExp(`define\\('${route.method}',\\s*'${route.path.replace(/[/:]/g, '\\$&')}'`),
        `aetherholm/src/server.ts:${route.line} is:\n  ${line.trim()}`,
      )
    })
  }

  it('this bundle knows about every route aetherholm serves — called or declined', () => {
    const registered = lines
      .map((l) => /^\s{4}define\('([A-Z]+)',\s*'([^']+)'/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]} ${m[2]}`)
    const known = ALL.map((r) => `${r.method} ${r.path}`)
    assert.deepEqual(
      registered.filter((r) => !known.includes(r)),
      [],
      'aetherholm serves a route this app has never read. Read it, then add it to SURFACE or DECLINED.',
    )
    assert.equal(registered.length, ALL.length, 'the two tables and the service disagree in size')
  })

  /**
   * Read one handler body: walk forward from the cited line to the next `define(` or the end of
   * the route array (`  ];`). NO LINE NUMBER IS WRITTEN HERE — the start comes from the table
   * and the end is found by scanning, so a table that moves fails rather than grading the wrong
   * function. Stopping at the array's close matters on this service: the auth HELPERS
   * (`authenticate`, `requireUser`) are defined after the routes, and a walk that ran into them
   * would find authentication in the last chronicle handler and wrongly fail its `none`.
   */
  function bodyOf(line: number): string {
    const start = line - 1
    let end = lines.length
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s{4}define\('/.test(lines[i] ?? '') || /^\s{2}\];/.test(lines[i] ?? '')) {
        end = i
        break
      }
    }
    return lines.slice(start, end).join('\n')
  }

  for (const route of ALL) {
    it(`${route.method} ${route.path} authenticates by ${route.auth}`, () => {
      const body = bodyOf(route.line)
      if (route.auth === 'none') {
        for (const pattern of ANY_MECHANISM) {
          assert.doesNotMatch(
            body,
            pattern,
            `${route.method} ${route.path} is treated as public and its handler matches ${pattern}`,
          )
        }
        return
      }
      assert.match(
        body,
        MECHANISM[route.auth],
        `${route.method} ${route.path}: this app treats it as ${route.auth} and the handler disagrees`,
      )
    })
  }

  it('queueRoute — where the three queue routes really authenticate — does what the table claims', () => {
    // The three `user-queue` handlers are one-line delegations, so the mechanism proof lives in
    // the helper: it resolves the caller through requireUser, refuses a submission without an
    // Idempotency-Key, and maps each kind to the body field this client sends.
    const helper = /async function queueRoute\([\s\S]*?\n\}/.exec(source)?.[0]
    assert.ok(helper, 'aetherholm/src/server.ts no longer defines queueRoute; the queue mechanism moved')
    assert.match(helper, /await requireUser\(ctx, deps\)/, 'queueRoute no longer authenticates through requireUser')
    assert.match(helper, /idempotency-key/, 'queueRoute no longer requires an Idempotency-Key')
    assert.match(
      helper,
      /kind === 'building' \? 'type' : kind === 'ship' \? 'class' : 'node'/,
      "the queue body fields moved; this client sends `type`, `node` and `class`",
    )
  })

  it('requireUser is the mechanism the `user` rows describe: user token, or write-scoped service naming x-user-id', () => {
    const helper = /async function requireUser\([\s\S]*?\n\}/.exec(source)?.[0]
    assert.ok(helper, 'aetherholm/src/server.ts no longer defines requireUser')
    assert.match(helper, /principal\.kind === 'user'/, 'requireUser no longer passes a user token through')
    assert.match(helper, /requireScope\(principal, WRITE_SCOPE\)/, 'a service no longer needs aetherholm:write')
    assert.match(helper, /x-user-id/, 'a service no longer names the user it acts for')
  })

  it('the launch requires the Idempotency-Key inline, as the table records', () => {
    const route = SURFACE.find((r) => r.method === 'POST' && r.path === '/v1/fleets')
    assert.ok(route, 'the surface table no longer names the launch route')
    const body = bodyOf(route.line)
    assert.match(body, /idempotency-key/, 'POST /v1/fleets no longer requires the header')
    assert.match(
      body,
      /an Idempotency-Key header is required to launch a fleet/,
      "the launch's refusal message changed; re-read the handler",
    )
  })

  it('the chronicle queries stay scoped to sealed seasons, which is what anonymity rests on', () => {
    // The anonymous surface is safe because a live season CANNOT leak through it even by id —
    // the comment above the routes says so, and the sealing module's queries enforce it. Assert
    // the property in the handler file so a refactor that loosened it fails here.
    assert.match(
      source,
      /Anonymous by design, and ONLY here/,
      'the chronicle block no longer declares its anonymity rule where the routes are',
    )
  })

  it('the battle route is public exactly when the season is sealed, and only then', () => {
    const route = SURFACE.find((r) => r.path === '/v1/battles/:id')
    assert.ok(route)
    const body = bodyOf(route.line)
    // The live branch authenticates and checks participation; the sealed branch never reaches it.
    assert.match(body, /season_status !== 'sealed'/)
    assert.match(body, /attacker_user_id[\s\S]*defender_user_id/)
  })
})
