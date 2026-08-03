/**
 * Group I of docs/ecosystem/22-browser-journeys.md — Aetherholm — plus the estate-wide floor.
 *
 * ── What "it renders" has to mean on a game surface ───────────────────────────────────────────
 *
 * This is one of the two surfaces where "renders" and "works" come apart hardest. A strategy map
 * whose SVG draws no islands, a battle report whose digest is missing, a launch button that is
 * live before a cost has been quoted — every one of those leaves a page that is structurally
 * perfect. `assertMounted`'s floor (content, console, failed requests) catches a blank page and
 * nothing else, so the assertions below are about the things a player would notice and a
 * structural check would not:
 *
 *   * the map has as many click targets as the service returned islands, each with a label;
 *   * the battle report shows the DIGEST, in full, and nothing on the page is recomputed;
 *   * the launch control is disabled until a preview exists, and the preview names a cost;
 *   * the alliance screen never offers to create a community.
 *
 * ── The layer boundary ────────────────────────────────────────────────────────────────────────
 *
 * None of these asserts a game rule. A client that can resolve a battle can lie about one, which
 * is exactly why the battle page holds no combat rules — so the scenario asserts that the numbers
 * on screen are the ones the response carried, and never that they are the right numbers.
 */
import assert from 'node:assert/strict'
import { assertMounted, renderOnlyWithStubbedNetwork, type Stubs } from './browser.ts'
import {
  assertAxeClean,
  assertKnownStillBroken,
  assertLandmarks,
  assertSkipLink,
  type KnownViolation,
} from './axe.ts'
import type { Scenario } from './scenario.ts'

/**
 * Nothing, and the empty list is kept rather than the two calls unwired.
 *
 * This surface sets `data-cf-substrate="cool"`, and on that substrate `--cf-fg-mute` resolved to
 * `#63757a` — 3.54:1 on the panel `#151d21`, under the 4.5:1 WCAG 2.2 AA floor for normal text.
 * That was a `micro-ui` token, so it was recorded here rather than forked locally.
 *
 * `micro-ui` `2f990be` retuned the cool ramp — `--cf-khaki` `#63757a` → `#7d9399` (5.29:1), with
 * `--cf-bone-dim` `#96a5a6` → `#abbcbd` (8.67:1) so the muted step did not close on the dimmed
 * one — and this suite went red exactly as `assertKnownStillBroken` promises, naming the entry to
 * delete. Deleted after watching that happen, not on the strength of the upstream commit message.
 *
 * The list stays, empty: `assertAxeClean` then tolerates nothing at all, which is the stronger
 * assertion, and a future exclusion is one array entry rather than a re-plumbing. An entry costs a
 * `rule` and an `owner` naming who can fix it — and must never be added without first watching it
 * fail, because an unearned exclusion silently suppresses that rule wherever it next appears.
 */
const KNOWN_A11Y: readonly KnownViolation[] = []

const SIGNED_IN = { 'cf.accessToken': 'test-access', 'cf.refreshToken': 'test-refresh' }
const ME = { user: { id: 'u_1', handle: 'captain', roles: ['user'] }, session: {}, organisations: [] }
const SIGNIN_STANDIN = {
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><title>stand-in</title><body>sign-in stand-in</body>',
}

const SEASON = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'The Long Gale',
  seed: '18446744073709551615',
  status: 'open',
  openedAt: '2026-07-01T00:00:00.000Z',
  endsAt: '2026-10-01T00:00:00.000Z',
  archipelagoId: '11111111-1111-4111-8111-111111111111',
}

/*
 * Nine islands across the three altitude bands, which is what the map lays out on three rings.
 *
 * THE IDS ARE REAL UUIDs, and that is not decoration. `src/lib/aetherholm.ts` runs `assertUuid`
 * on every path parameter before it builds a URL, so a readable fixture id (`isl-1`) makes the
 * CLIENT throw before any request is made — and the page then renders its failure state, which
 * looks exactly like the service being down. The first version of this file used friendly ids and
 * the map scenario failed with "0 island targets", which is true and points at the wrong thing.
 */
const ISLANDS = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', idx: 0, band: 'shallows', plots: 6, freePlots: 4 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', idx: 1, band: 'shallows', plots: 6, freePlots: 6 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000003', idx: 2, band: 'shallows', plots: 5, freePlots: 1 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000004', idx: 3, band: 'midreach', plots: 4, freePlots: 4 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000005', idx: 4, band: 'midreach', plots: 4, freePlots: 0 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000006', idx: 5, band: 'midreach', plots: 4, freePlots: 2 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000007', idx: 6, band: 'highwind', plots: 3, freePlots: 3 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000008', idx: 7, band: 'highwind', plots: 3, freePlots: 1 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000009', idx: 8, band: 'highwind', plots: 2, freePlots: 2 },
]

/** Directed: A→B and B→A are separate lanes with separate rolls. That asymmetry is the game. */
const LANES = [
  { id: 'bbbbbbbb-0000-4000-8000-000000000001', fromIslandId: 'aaaaaaaa-0000-4000-8000-000000000001', toIslandId: 'aaaaaaaa-0000-4000-8000-000000000004', multiplierBp: 12_500, travelSeconds: 900 },
  { id: 'bbbbbbbb-0000-4000-8000-000000000002', fromIslandId: 'aaaaaaaa-0000-4000-8000-000000000004', toIslandId: 'aaaaaaaa-0000-4000-8000-000000000001', multiplierBp: 9_000, travelSeconds: 1_100 },
]

const BATTLE = {
  id: '22222222-2222-4222-8222-222222222222',
  islandId: 'aaaaaaaa-0000-4000-8000-000000000005',
  plot: 2,
  mission: 'raid',
  windBp: 10_400,
  attackerUserId: 'u_1',
  defenderUserId: 'u_2',
  attackerOob: { skiff: 4, cutter: 2 },
  defenderOob: { skiff: 1, bastion: 1 },
  result: { outcome: 'attacker', rounds: 3 },
  digest: 'f1e2d3c4b5a6978877665544332211ffeeddccbbaa99887766554433221100ff',
  occurredAt: '2026-08-02T12:00:00.000Z',
}

const CHRONICLE_SEASONS = [
  {
    seasonId: '44444444-4444-4444-8444-444444444444',
    name: 'The Still Year',
    seed: '99887766554433',
    sealedAt: '2026-06-30T00:00:00.000Z',
    digest: 'aa11bb22cc33dd44ee55ff6600778899aabbccddeeff00112233445566778899',
  },
]

const BASE: Stubs = [
  ['GET /auth/me', { json: ME }],
  // `fetchReadiness` runs on boot in this client, and it is the one route here that is NOT under
  // /v1: `GET /readyz` is the platform probe. Answered rather than left to fail, because an
  // unanswered probe would be a failed request the scenario did not arrange, and the harness is
  // right to treat that as a defect.
  ['GET /readyz', { json: { ready: true } }],
  ['GET /v1/seasons/current', { json: SEASON }],
  ['GET /v1/archipelagos/*/islands', { json: { islands: ISLANDS } }],
  ['GET /v1/archipelagos/*/lanes', { json: { lanes: LANES } }],
  ['GET /v1/content/airships', { json: { airships: {} } }],
  ['GET /v1/content/buildings', { json: { buildings: {} } }],
  ['GET /v1/content/research', { json: { research: {} } }],
  ['GET /v1/cities', { json: { cities: [] } }],
  ['GET /v1/fleets', { json: { fleets: [] } }],
  ['GET /v1/battles', { json: { battles: [] } }],
  ['GET /v1/battles/*', { json: { battle: BATTLE } }],
  ['GET /v1/alliances', { json: { alliances: [] } }],
  ['GET /v1/chronicle/seasons', { json: { seasons: CHRONICLE_SEASONS } }],
  ['/account/login', SIGNIN_STANDIN],
]

const OWNED = ['/', '/cities', '/fleets', '/battles', '/alliance', '/chronicle']

export const CATALOGUE: readonly Scenario[] = [
  /* ---- doc 22 §5.1 ---------------------------------------------------- */
  {
    id: 'BJ-AETHERHOLM-404',
    title: 'every route this client owns survives a hard refresh and every other address answers 404',
    tier: 2,
    asserts: 'navigation',
    gate: true,
    expectStatus: 404,
    ownedBy: 'aetherholm-web/test/routes.test.ts#nginx',
    async run(surface) {
      assert.equal(surface.nginx.honest404, true, 'nginx.conf has no error_page 404 /index.html')
      for (const path of OWNED) {
        const { status } = await surface.fetchStatus(path)
        assert.equal(status, 200, `${path} answered ${status}; an owned route must survive a refresh`)
      }
      // No route here takes a parameter — a battle is opened by a query string, not a path — so
      // every address BENEATH an owned route is one the router does not have.
      for (const path of ['/nope', '/battles/22222222-2222-4222-8222-222222222222', '/cities/aaaaaaaa-0000-4000-8000-000000000001', '/chronicle/44444444-4444-4444-8444-444444444444']) {
        const { status } = await surface.fetchStatus(path)
        assert.equal(status, 404, `${path} answered ${status}; it must 404`)
      }

      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/battles/22222222-2222-4222-8222-222222222222', storage: SIGNED_IN, stubs: BASE })
      try {
        assert.equal(session.status, 404)
        await assertMounted(session)
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-AET-01 ------------------------------------------------ */
  {
    id: 'BJ-AET-01',
    title: 'the map draws one labelled click target per island the service returned, as plain SVG',
    tier: 2,
    asserts: 'presentation',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { storage: SIGNED_IN, stubs: BASE })
      try {
        await assertMounted(session)
        // The count is the assertion, against the response in this same run. A map that draws a
        // fixed nine, or none, looks identical in a screenshot of an estate that happens to have
        // nine islands.
        await session.page.waitForSelector('svg circle[role="button"]', { timeout: 10_000 })
        const targets = await session.page.$$eval('svg circle[role="button"]', (nodes) =>
          nodes.map((n) => ({
            label: n.getAttribute('aria-label') ?? '',
            focusable: n.getAttribute('tabindex') !== null,
          })),
        )
        // The COUNT, against the response in this same run. A map that draws a fixed nine, or
        // none, looks identical in a screenshot of an estate that happens to have nine islands.
        assert.equal(
          targets.length,
          ISLANDS.length,
          `${targets.length} island targets drawn for ${ISLANDS.length} islands in the response`,
        )
        // Each carries an accessible name and is reachable by keyboard. An unlabelled shape is a
        // target only a sighted player with a mouse can use, and the geography IS the strategy.
        for (const island of ISLANDS) {
          const target = targets.find((t) => t.label.includes(`Island ${island.idx},`))
          assert.ok(target, `island ${island.id} (idx ${island.idx}) has no labelled target`)
          assert.ok(target.focusable, `island ${island.id} cannot be reached by keyboard`)
          assert.ok(
            target.label.includes(island.band),
            `island ${island.id}'s label does not name its altitude band`,
          )
        }
        // No renderer dependency loads. A strategy map is labels, lines and click targets, and the
        // honest cost of drawing it is zero dependencies — asserted against what the page actually
        // fetched, not against the import graph.
        const heavy = session.collected.requests.filter((r) => /three|babylon|pixi|\.glb$/.test(r.url))
        assert.deepEqual(heavy.map((r) => r.url), [], 'the map pulled in a renderer')
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-AET-05 and BJ-AET-08 ---------------------------------- */
  {
    id: 'BJ-AET-05',
    title: 'the launch control is disabled until a preview exists, and the preview names the round trip’s cost',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    noServerRule:
      'Nothing is sent. The preview is computed in src/lib/lattice.ts from constants the service ' +
      'served, and the assertion is that this client refuses to offer a commit before it has ' +
      'quoted one. What the server charges is the server’s business and is shown separately.',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/fleets', storage: SIGNED_IN, stubs: BASE })
      try {
        const text = await assertMounted(session)
        // The price tag is the rule. With no city and no composed fleet there is no preview, so
        // every launch control on the page must be inoperable — as a property, not as a colour.
        const buttons = await session.page.$$eval('button', (nodes) =>
          nodes
            .filter((n) => /launch/i.test(n.textContent ?? ''))
            .map((n) => ({ label: (n.textContent ?? '').trim().slice(0, 40), disabled: (n as HTMLButtonElement).disabled })),
        )
        for (const button of buttons) {
          assert.equal(button.disabled, true, `"${button.label}" is live with no preview behind it`)
        }
        // doc 22 BJ-AET-08: no battle is fought here. The page shows the flight; reports are read
        // on Battles, by id.
        assert.equal(
          /order of battle|digest|rounds/i.test(text),
          false,
          'the fleets page is rendering a battle report',
        )
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-AET-09 ------------------------------------------------ */
  {
    id: 'BJ-AET-09',
    title: 'a battle report renders the stored result and its digest in full, and recomputes nothing',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, {
        path: '/battles?id=22222222-2222-4222-8222-222222222222',
        storage: SIGNED_IN,
        stubs: BASE,
      })
      try {
        const text = await assertMounted(session)
        // THE DIGEST, IN FULL. It is the determinism claim — sha256 over the canonicalised inputs
        // and result — and a truncated one is a claim a player cannot check. Truncation is the
        // most likely regression, because it looks tidier.
        assert.ok(
          text.includes(BATTLE.digest),
          `the full digest is not on the page. It says: ${text.slice(0, 600)}`,
        )
        // Both orders of battle, verbatim from the response.
        for (const unit of ['skiff', 'cutter', 'bastion']) {
          assert.ok(text.includes(unit), `${unit} is missing from the orders of battle`)
        }
        assert.ok(text.includes('attacker'), 'the stored result is not rendered')
        // A client that can resolve a battle can lie about one, so this page holds no combat
        // rules: the only battle request is the read.
        const writes = session.apiCalls().filter((c) => c.method !== 'GET')
        assert.deepEqual(writes.map((c) => `${c.method} ${c.url}`), [], 'the battle page wrote something')
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-AET-10 ------------------------------------------------ */
  {
    id: 'BJ-AET-10',
    title: 'the alliance screen asks for the id of a community that already exists and says where governance lives',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    serverRule: 'aetherholm requires a communityId and never mints one',
    ownedBy: 'aetherholm-web/src/lib/aetherholm.ts#foundAlliance',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/alliance', storage: SIGNED_IN, stubs: BASE })
      try {
        const text = await assertMounted(session)
        // The founding form takes a community id. A "create community" button here would be the
        // second voting system the design forbids — proposals, votes, officers, timelocks and the
        // treasury all live in micro-community.
        // Read from the LABEL a player sees, because these inputs carry no `name` or `id` — they
        // are wrapped in their <label>. Asserting a selector that does not exist would have been a
        // check that could only ever fail; asserting the accessible name is what a player has.
        const labelled = await session.page.$$eval('form label', (nodes) =>
          nodes.map((n) => (n.textContent ?? '').trim().toLowerCase()),
        )
        assert.ok(
          labelled.some((f) => f.includes('community id')),
          `the founding form asks for no community id. Labels: ${labelled.join(' | ')}`,
        )
        // …and it says, in the field itself, that the community must already exist.
        const placeholders = await session.page.$$eval('form input', (nodes) =>
          nodes.map((n) => n.getAttribute('placeholder') ?? ''),
        )
        assert.ok(
          placeholders.some((p) => /existing/i.test(p)),
          'nothing on the form says the community has to exist already',
        )
        assert.ok(
          /governance|community/i.test(text),
          'the page never says where governance lives',
        )
        // Asserted as the positive fact rather than as a banned word: this page's own prose
        // explains why it does not create one, and a grep for "create a community" would fire on
        // the explanation. What is checked is that no CONTROL offers it.
        const controls = await session.page.$$eval('button, a[href]', (nodes) =>
          nodes.map((n) => (n.textContent ?? '').trim().toLowerCase()),
        )
        assert.deepEqual(
          controls.filter((c) => /^(create|new|found) (a )?community/.test(c)),
          [],
          'the alliance screen offers to create a community',
        )
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-AET-12 ------------------------------------------------ */
  {
    id: 'BJ-AET-12',
    title: 'the chronicle renders sealed seasons for a signed-out visitor and sends no credential',
    tier: 2,
    asserts: 'client-request',
    async run(surface) {
      // No session at all: the chronicle is the game showing itself to people who have not
      // installed it.
      const session = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/chronicle', stubs: BASE })
      try {
        const text = await assertMounted(session)
        assert.ok(text.includes('The Still Year'), 'no sealed season rendered for an anonymous visitor')
        assert.equal(
          session.page.url().includes('/account/login'),
          false,
          'an anonymous visitor was sent to sign in',
        )
      } finally {
        await session.close()
      }

      // …and with a session in hand, the chronicle reads STILL go out without one. Sending a
      // credential to a route that does not read one is the defect: it is a needless token on the
      // wire and in somebody's access log.
      const signedIn = await renderOnlyWithStubbedNetwork(surface.origin, { path: '/chronicle', storage: SIGNED_IN, stubs: BASE })
      try {
        await assertMounted(signedIn)
        const withAuth = signedIn
          .apiCalls()
          .filter((c) => c.url.includes('/v1/chronicle'))
          .filter((c) => Object.keys(c.headers).some((h) => h.toLowerCase() === 'authorization'))
        assert.deepEqual(withAuth.map((c) => c.url), [], 'a chronicle read carried a credential')
      } finally {
        await signedIn.close()
      }
    },
  },

  /* ---- estate-wide, on this surface ------------------------------------ */
  {
    id: 'BJ-ACC-06',
    title: 'the SSO callback code is stripped from the address bar before the exchange is sent',
    tier: 1,
    asserts: 'client-request',
    async run(surface) {
      const session = await renderOnlyWithStubbedNetwork(surface.origin, {
        path: '/#cf_code=handoff-code-123',
        stubs: [['POST /auth/handoff/redeem', { json: { accessToken: 'a', refreshToken: 'r' } }], ...BASE],
      })
      try {
        await assertMounted(session)
        const hash = await session.page.evaluate(() => window.location.hash)
        assert.equal(hash.includes('cf_code'), false, `cf_code is still in the address bar: ${hash}`)
        const redeem = session.apiCalls().find((c) => c.url.includes('/auth/handoff/redeem'))
        assert.ok(redeem, 'the hand-off code was never redeemed')
        assert.ok(redeem.body?.includes('handoff-code-123'), 'the code was not sent in the body')
        assert.equal(redeem.url.includes('handoff-code-123'), false, 'the code was put in a URL')
      } finally {
        await session.close()
      }
    },
  },
  {
    id: 'BJ-A11Y-01',
    title: 'axe finds no serious or critical violation on any route of this client',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const seen = new Set<string>()
      for (const path of [...OWNED, '/nope']) {
        const session = await renderOnlyWithStubbedNetwork(surface.origin, { path, storage: SIGNED_IN, stubs: BASE })
        try {
          await assertMounted(session)
          for (const id of await assertAxeClean(session.page, path, KNOWN_A11Y)) seen.add(id)
        } finally {
          await session.close()
        }
      }
      assertKnownStillBroken(seen, KNOWN_A11Y)
    },
  },
  {
    id: 'BJ-A11Y-12',
    title: 'a reachable skip link, one main landmark, and a heading order with no level skipped',
    tier: 2,
    asserts: 'presentation',
    async run(surface) {
      for (const path of OWNED) {
        const session = await renderOnlyWithStubbedNetwork(surface.origin, { path, storage: SIGNED_IN, stubs: BASE })
        try {
          await assertMounted(session)
          await assertLandmarks(session.page, path)
          await assertSkipLink(session.page, path)
        } finally {
          await session.close()
        }
      }
    },
  },

  /* ---- the degradation banner tells the truth about what it knows -------- */
  {
    id: 'BJ-AET-06',
    title:
      'the degradation banner appears only when the SERVICE said it is degraded, and never merely because the readiness probe could not be reached',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    noServerRule:
      'both outcomes are decisions of this bundle about a response it already has in hand. What ' +
      'micro-aetherholm answers on /readyz is stubbed here in both directions; the assertion is ' +
      'which of them this client turns into a banner, and that rule lives entirely in ' +
      'src/lib/aetherholm.ts and src/components/shell.tsx.',
    async run(surface) {
      const BANNER = 'not answering ready'

      /*
       * BASE's own `GET /readyz` entry is REMOVED rather than shadowed.
       *
       * `renderOnlyWithStubbedNetwork()` walks the stub table in order and the FIRST match answers, so appending an
       * override after BASE does nothing at all — BASE's `{ ready: true }` wins and the page is
       * healthy in every case. The first draft of this scenario did exactly that: the 404 half
       * passed against a page that had never seen a 404, and only the 503 half's failure gave it
       * away. A scenario that arranges a condition it does not actually produce is the same
       * defect as the harness this tier was written to replace.
       */
      const withReadyz = (reply: { status: number; json: unknown }): typeof BASE => [
        ...BASE.filter(([pattern]) => pattern !== 'GET /readyz'),
        ['GET /readyz', reply],
      ]

      // ══════════════════════════════════════════════════════════════════════════════════════
      // THE CASE THAT WAS LIVE ON THE ESTATE. `GET /readyz` is not under `/v1`, and the gateway
      // routes only `PathPrefix(/v1)` to micro-aetherholm — so the probe hit the static file
      // server that serves this very bundle and came back 404. `fetchReadiness` mapped every
      // exception to `{ ready: false }`, so every visitor of a perfectly healthy game was told
      // it was degraded. Neither the DOM tests nor the route tests could see it: one never
      // rendered the shell, the other asserted the request rather than the banner.
      // ══════════════════════════════════════════════════════════════════════════════════════
      const unreachable = await renderOnlyWithStubbedNetwork(surface.origin, {
        storage: SIGNED_IN,
        stubs: withReadyz({ status: 404, json: { error: { code: 'not_found' } } }),
      })
      try {
        const text = await assertMounted(unreachable)
        assert.ok(
          !text.includes(BANNER),
          'a 404 on the readiness probe put a degradation banner on a healthy game — the probe ' +
            'establishes nothing about the service when it never reaches it',
        )
      } finally {
        await unreachable.close()
      }

      // The converse, so this cannot be passing because the banner is simply gone. A 503 IS the
      // service answering, and it must still be shown.
      const degraded = await renderOnlyWithStubbedNetwork(surface.origin, {
        storage: SIGNED_IN,
        stubs: withReadyz({ status: 503, json: { ready: false, checks: [] } }),
      })
      try {
        const text = await assertMounted(degraded)
        assert.ok(
          text.includes(BANNER),
          'the service answered 503 not-ready and the banner did not appear — the warning has ' +
            'been disabled rather than corrected',
        )
      } finally {
        await degraded.close()
      }
    },
  },

  /* ---- specified, and not writable today -------------------------------- */
  {
    id: 'BJ-AET-02',
    title: 'city stocks advance between repaints with no poll, using the same floor arithmetic as the server',
    tier: 2,
    asserts: 'client-request',
    gate: true,
    blocked:
      'The projection needs a CITY, and a city needs a founded plot: `GET /v1/cities` answers an ' +
      'empty list for a fresh account, and the page then renders the found-a-city path rather than ' +
      'the stock ticker. A stub city would have to carry `lastSettledAt`, the full rate table and ' +
      'the caps in the shapes `aetherholm/src/cities.ts` serves, and a fixture written from this ' +
      'side would be this repository’s guess at another service’s response — which is the drift ' +
      'the citation discipline exists to prevent. It needs a captured interaction from ' +
      'micro-conformance, which is what doc 22 §4 says a tier-2 stub source is.',
  },
  {
    id: 'BJ-ADV-16-H1',
    title: 'double-submitting a fleet launch produces one fleet under one idempotency key',
    tier: 1,
    asserts: 'client-request',
    blocked:
      'Blocked behind BJ-AET-05 for the same reason: the launch control cannot be reached without ' +
      'a city and a composed fleet, and both need the same conformance fixture. What IS asserted ' +
      'today is the property underneath the hazard — that the control is inoperable until a ' +
      'preview exists — which is the half this repository owns.',
  },
]
