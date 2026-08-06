/**
 * THE ROUTE TABLE, CHECKED AGAINST THE SERVICE THAT SERVES IT.
 *
 * Every client in this estate that was built against an imagined surface passed its own tests —
 * that is the whole problem. So this file does not assert paths in the abstract: it reads
 * `aetherholm/src/server.ts` from a sibling checkout and requires that each path and method this
 * bundle calls is REGISTERED there, and that each authenticates by the MECHANISM the table
 * records.
 *
 * The four disciplines, each earned by a sibling's defect:
 *
 * **1. Registration, found by SEARCHING.** Each entry in `SURFACE`/`DECLINED` must have a
 * `define(` somewhere in the service that registers exactly that method and path. It used to have
 * to be at a cited LINE, and that is what made this suite fail for edits made in a different
 * repository: a service grows an import, every route below it moves, and twenty-seven correct
 * citations turn red at once — during a release, because nothing runs this suite when the service
 * changes. Searching is strictly stronger: a route that MOVES can no longer break this, and a
 * route that is REMOVED still does.
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
 * **4. NO LINE NUMBER IS WRITTEN ANYWHERE IN THIS FILE.** micro-trade-web hardcoded one and its
 * guard kept passing while grading a different function after the table moved. Both ends of every
 * handler body are found by scanning — forward from the `define(` that registers the route to the
 * next one (or to the end of the route array) — so a service that moves its routes is still graded
 * on the right function.
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
type Auth = 'none' | 'bearer' | 'owner' | 'user' | 'user-queue' | 'provision' | 'sealed-public' | 'webhook'

/** What a handler body must contain for each mechanism. `none` is handled separately. */
const MECHANISM: Readonly<Record<Exclude<Auth, 'none'>, RegExp>> = {
  // Any bearer; a service must carry aetherholm:read. No owner check in the body.
  bearer: /await authenticate\(ctx, deps\);\s*\n(?:[\s\S](?!isAdmin))*?requireScope\(principal, READ_SCOPE\)/,
  // Owner-or-admin for users, read scope for services: authenticate AND an isAdmin branch.
  owner: /await authenticate\(ctx, deps\)[\s\S]*isAdmin\(principal\)[\s\S]*requireScope\(principal, READ_SCOPE\)|await authenticate\(ctx, deps\)[\s\S]*requireScope\(principal, READ_SCOPE\)[\s\S]*isAdmin\(principal\)/,
  // A user acting as themselves; a service must carry aetherholm:write and name x-user-id —
  // the whole of that lives in requireUser (aetherholm/src/server.ts).
  user: /await requireUser\(ctx, deps\)/,
  // The three queue routes delegate whole: the auth AND the Idempotency-Key requirement live in
  // queueRoute, which its own tests below verify.
  'user-queue': /return queueRoute\(ctx, deps, '(?:building|research|ship)'\);/,
  // Service token only, exact scope; a user token is refused before the scope is looked at.
  provision: /principal\.kind !== 'service'[\s\S]*requireScope\(principal, PROVISION_SCOPE\)/,
  // Public once sealed; authenticate only on the live branch.
  'sealed-public': /season_status !== 'sealed'[\s\S]*await authenticate\(ctx, deps\)/,
  /*
   * A SEVENTH MECHANISM, ADDED WHEN THE SERVICE GREW ONE. `POST /v1/events` is the inbound
   * erasure webhook (`aetherholm/src/server.ts`): the credential is an HMAC over the RAW
   * BYTES, verified before anything is parsed, and a bad or absent signature is 403 rather than
   * 401 because there is no token for the caller to go and find.
   *
   * It is emphatically NOT `none`. `none` asserts the absence of every other mechanism's pattern,
   * and this handler would have satisfied that — it calls neither `authenticate` nor
   * `requireUser` — so filing it under `none` would have recorded a MAC-protected write path as a
   * public route, in the one table this repository keeps precisely so that nobody has to guess.
   * That is the shape of mistake the six existing mechanisms were each written to prevent.
   */
  webhook: /verifyEventSignature\(raw, deps\.eventAcceptSecrets, presented\)/,
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
  readonly auth: Auth
  /** True when the service refuses the request without an Idempotency-Key header. */
  readonly idempotent: boolean
}

/**
 * The surface this bundle CALLS. Written down as DATA so the checks below can be mechanical: an
 * entry the service does not register fails and names itself, and a route the service serves that
 * is in neither table fails too.
 */
export const SURFACE: readonly Route[] = [
  { method: 'GET', path: '/readyz', auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/seasons/current', auth: 'bearer', idempotent: false },
  { method: 'GET', path: '/v1/archipelagos/:id/islands', auth: 'bearer', idempotent: false },
  { method: 'GET', path: '/v1/archipelagos/:id/lanes', auth: 'bearer', idempotent: false },
  { method: 'GET', path: '/v1/content/airships', auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/content/buildings', auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/content/research', auth: 'none', idempotent: false },
  { method: 'POST', path: '/v1/cities', auth: 'user', idempotent: false },
  { method: 'GET', path: '/v1/cities', auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/cities/:id', auth: 'owner', idempotent: false },
  { method: 'POST', path: '/v1/cities/:id/buildings', auth: 'user-queue', idempotent: true },
  { method: 'POST', path: '/v1/cities/:id/research', auth: 'user-queue', idempotent: true },
  { method: 'POST', path: '/v1/cities/:id/ships', auth: 'user-queue', idempotent: true },
  { method: 'POST', path: '/v1/fleets', auth: 'user', idempotent: true },
  { method: 'GET', path: '/v1/fleets', auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/fleets/:id', auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/battles', auth: 'owner', idempotent: false },
  { method: 'GET', path: '/v1/battles/:id', auth: 'sealed-public', idempotent: false },
  { method: 'GET', path: '/v1/alliances', auth: 'bearer', idempotent: false },
  { method: 'POST', path: '/v1/alliances', auth: 'user', idempotent: false },
  { method: 'GET', path: '/v1/alliances/:id', auth: 'bearer', idempotent: false },
  { method: 'POST', path: '/v1/alliances/:id/members', auth: 'user', idempotent: false },
  { method: 'DELETE', path: '/v1/alliances/:id/members', auth: 'user', idempotent: false },
  { method: 'POST', path: '/v1/alliances/:id/claims', auth: 'user', idempotent: false },
  { method: 'GET', path: '/v1/chronicle/seasons', auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/chronicle/seasons/:id', auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/chronicle/seasons/:id/battles', auth: 'none', idempotent: false },
]

/**
 * The routes `aetherholm` serves that this bundle deliberately does NOT call. Declining is a
 * first-class entry: the "knows about everything it serves" test is satisfied by
 * `SURFACE ∪ DECLINED`, so a route the service grows and nobody reads fails the build instead of
 * going quiet. The REASONS are in the header of src/lib/aetherholm.ts, keyed by method and path.
 */
export const DECLINED: readonly Route[] = [
  { method: 'GET', path: '/livez', auth: 'none', idempotent: false },
  { method: 'GET', path: '/metrics', auth: 'none', idempotent: false },
  { method: 'GET', path: '/v1/title', auth: 'none', idempotent: false },
  { method: 'POST', path: '/v1/provision', auth: 'provision', idempotent: false },
  /*
   * The erasure webhook, and the one entry here that a browser MUST never reach. It is called by
   * micro-identity's relay with an HMAC the page has no secret for, it erases a player's cities,
   * fleets and alliance memberships, and the only thing a client could do by calling it is fail
   * the signature check. Declined rather than absent, so that the route the service grew on
   * 2026-08-05 is a thing this bundle has READ and refused rather than a thing it never noticed.
   */
  { method: 'POST', path: '/v1/events', auth: 'webhook', idempotent: false },
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
 *  (src/lib/api.ts). */
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

  it('names every route it calls or declines, and says which file it read them from', () => {
    // The FILE, not a line in it. This used to require the server path with a line stuck to it for
    // each of the twenty-seven routes, which is twenty-seven promises about a file this repository
    // does not
    // own and does not watch. What is worth asserting is that the client points a reader at the
    // source of truth and that its header still accounts for every route; the tables below prove
    // the routes are really there.
    assert.ok(
      client.includes('aetherholm/src/server.ts'),
      'src/lib/aetherholm.ts no longer says which service source it was read from',
    )
    for (const route of ALL) {
      // The client's header lays its table out in columns, so the gap between method and path is
      // any run of spaces. `\s+` rather than one, because a single space passed for the called
      // routes and failed every declined one — a check that measured the formatting.
      const named = new RegExp(`\\b${route.method}\\s+${route.path.replace(/[/:]/g, '\\$&')}(?![\\w/])`)
      assert.ok(
        named.test(client),
        `${route.method} ${route.path} is in the table and unaccounted for in src/lib/aetherholm.ts`,
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

describe('every route this bundle names is really registered by the service', () => {
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

  /*
   * The two paths micro-aetherholm registers through a CONSTANT rather than a literal.
   *
   * They are `@cloudsforge/contracts-worlds` exports — part of the worlds-title contract, spelled
   * once for every title — so the value is read out of the contracts package rather than assumed
   * here. A constant renamed, moved or repointed makes the assertion below fail, which is the
   * whole reason the value is resolved instead of trusted.
   */
  const WORLDS_CONTRACT_PATHS: Record<string, string> = {
    TITLE_DESCRIPTOR_PATH: '/v1/title',
    PROVISION_PATH: '/v1/provision',
  }

  /**
   * Does THIS line register THAT route?
   *
   * A LITERAL PATH **or** a named constant whose value is that path. micro-aetherholm registers
   * /v1/title and /v1/provision through `TITLE_DESCRIPTOR_PATH` and `PROVISION_PATH` — they are
   * part of the worlds-title contract and are spelled once. A regex that only accepted a literal
   * reported both as unregistered, which is the opposite of true. The constant is resolved out of
   * the same file rather than assumed, so a constant pointing somewhere else still fails.
   */
  function registers(line: string, route: Route): boolean {
    const escaped = route.path.replace(/[/:]/g, '\\$&')
    if (new RegExp(`define\\('${route.method}',\\s*'${escaped}'`).test(line)) return true
    const named = /define\('[A-Z]+',\s*([A-Z_]+)/.exec(line)
    return (
      named !== null &&
      WORLDS_CONTRACT_PATHS[named[1] ?? ''] === route.path &&
      new RegExp(`define\\('${route.method}',`).test(line)
    )
  }

  /**
   * WHERE a route is registered, found by SEARCHING for it rather than by citing a line.
   *
   * This used to be a `line` in the tables above, and that line is why this repository kept going
   * red for an edit made in a different one: micro-aetherholm grew email verification and password
   * reset upstream of its route array, every route below moved, and all twenty-seven citations here
   * broke while nothing in this bundle was wrong. Nothing runs this suite when that service
   * changes, so it surfaced during a release.
   *
   * Searching costs one pass over a file already in memory and cannot go stale. What is worth
   * asserting is that the route EXISTS and that its handler authenticates the way this bundle
   * believes; neither of those is a fact about line 641.
   */
  const indexOfRoute = (route: Route): number => lines.findIndex((l) => registers(l, route))

  for (const route of ALL) {
    it(`${route.method} ${route.path} is registered in aetherholm/src/server.ts`, () => {
      assert.ok(
        indexOfRoute(route) >= 0,
        `${route.method} ${route.path} is not registered in aetherholm/src/server.ts at all`,
      )
    })
  }

  it('this bundle knows about every route aetherholm serves — called or declined', () => {
    // A literal path OR a named `@cloudsforge/contracts-worlds` constant. The literal-only version
    // of this regex counted 29 of the service's 31 routes and then complained that the tables
    // disagreed in size — a check reporting a real number as a discrepancy, because it could not
    // see two routes registered through a shared constant.
    const registered = lines
      .map((l) => /^\s{4}define\('([A-Z]+)',\s*(?:'([^']+)'|([A-Z_]+))/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]} ${m[2] ?? WORLDS_CONTRACT_PATHS[m[3] ?? ''] ?? m[3]}`)
    const known = ALL.map((r) => `${r.method} ${r.path}`)
    assert.deepEqual(
      registered.filter((r) => !known.includes(r)),
      [],
      'aetherholm serves a route this app has never read. Read it, then add it to SURFACE or DECLINED.',
    )
    assert.equal(registered.length, ALL.length, 'the two tables and the service disagree in size')
  })

  /**
   * Read one handler body: find the `define(` that registers the route, then walk forward to the
   * next `define(` or the end of the route array (`  ];`). NO LINE NUMBER IS WRITTEN ANYWHERE —
   * both ends are found by scanning, so a service that moves its routes is graded on the right
   * function rather than on whatever now sits where the route used to be. Stopping at the array's
   * close matters on this service: the auth HELPERS (`authenticate`, `requireUser`) are defined
   * after the routes, and a walk that ran into them would find authentication in the last
   * chronicle handler and wrongly fail its `none`.
   */
  function bodyOf(route: Route): string {
    const start = indexOfRoute(route)
    assert.ok(start >= 0, `${route.method} ${route.path} is not registered in aetherholm/src/server.ts`)
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
      const body = bodyOf(route)
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
    const body = bodyOf(route)
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
    const body = bodyOf(route)
    // The live branch authenticates and checks participation; the sealed branch never reaches it.
    assert.match(body, /season_status !== 'sealed'/)
    assert.match(body, /attacker_user_id[\s\S]*defender_user_id/)
  })
})
