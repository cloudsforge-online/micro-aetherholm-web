# micro-aetherholm-web

[![ci](https://github.com/cloudsforge-online/micro-aetherholm-web/actions/workflows/ci.yml/badge.svg)](https://github.com/cloudsforge-online/micro-aetherholm-web/actions/workflows/ci.yml)
![licence](https://img.shields.io/badge/licence-MIT-97CA00)
![node](https://img.shields.io/badge/node-%3E%3D22-5FA04E?logo=node.js&logoColor=white)
![typescript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![module](https://img.shields.io/badge/module-ESM-F7DF1E?logo=javascript&logoColor=black)
![tests](https://img.shields.io/badge/tests-headless%20Chromium-2EAD33?logo=googlechrome&logoColor=white)

The game client for **Aetherholm**, the third Forge Worlds title
(`docs/ecosystem/20-aetherholm.md` §5 is the design): the archipelago map on the wind lattice,
the city view with live lazy-accrual stocks, fleet control with the Aether cost shown before the
commit, battle reports, the alliance screen, and the chronicle browser. A static SPA — Vite,
React, nginx-unprivileged — cut from `micro-web-template` with the disciplines
`micro-emberkin-web`, `micro-explorer-web` and `micro-devportal-web` earned, each one by a
shipped defect.

> **What it refuses.** This client **resolves no battle**: a client that can resolve a battle
> can lie about one (the rule `micro-emberkin-web` earned by deleting its inherited engine), so
> reports render from the server's stored result and sha256 digest
> (`aetherholm/src/server.ts`) and nothing in `src/` holds a combat rule, a seeded PRNG or a
> hash. It **creates no community**: an alliance IS a `micro-community` community, and founding
> one sends the id of a community that already exists (`aetherholm/src/server.ts`) — a
> "create community" control here would be the second governance system the design forbids. It
> **mutates no history**: the chronicle wrappers are GET-only by test and by CI rule, matching
> the database triggers that refuse UPDATE and DELETE on sealed rows
> (`aetherholm/src/migrations.ts`). And it **sells nothing**: no surface implies a
> purchasable advantage, the aegis is stated on the founding form to be never sold, and CI greps
> the stripped source for purchasable-power vocabulary.

## The surface it is built against

Every call goes through `src/lib/aetherholm.ts`, where each wrapper cites the file it was
verified against — `aetherholm/src/server.ts`, read out of the service's source rather than out
of its README. It used to cite a LINE in that file, and the line is what kept turning this
repository red for an edit made in a different one: a service grows an import near the top and
every route below it moves, so twenty-seven correct citations break at once, during a release,
because nothing runs this suite when that service changes. `test/aetherholm.test.ts` now re-reads
a real `micro-aetherholm` checkout and finds each route by SEARCHING for the `define(` that
registers it, failing if a route is not registered at all or authenticates by a different
mechanism. That is strictly stronger: a route that moves cannot break it, and a route that is
removed still does. CI then renames one route to one the service does not serve, flips one
mechanism, and requires the suite to go red for each.

Mechanisms, recorded per route (never a boolean — the three queue handlers delegate their
authentication to `queueRoute`, `aetherholm/src/server.ts`, and a boolean grep would call
them public):

| Mechanism | Meaning |
| --- | --- |
| `none` | no principal read; public |
| `bearer` | any user token; a service needs `aetherholm:read` |
| `owner` | bearer, then owner-or-admin for users; service reads with `aetherholm:read` |
| `user` | `requireUser`: a user acts as themselves; a service needs `aetherholm:write` **and** an `x-user-id` (`aetherholm/src/server.ts`) |
| `user-queue` | `user`, via `queueRoute`, which also refuses a submission without an `Idempotency-Key` (`aetherholm/src/server.ts`) |
| `provision` | service token with `aetherholm:provision` only; user tokens refused outright |
| `sealed-public` | public once the season is sealed; participants-or-admin while live |

Called (23):

| Method | Path | Mechanism | Idempotency-Key | Verified at |
| --- | --- | --- | --- | --- |
| `GET` | `/readyz` | none | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/seasons/current` | bearer | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/archipelagos/:id/islands` | bearer | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/archipelagos/:id/lanes` | bearer | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/content/airships` | none | — | `aetherholm/src/server.ts` |
| `POST` | `/v1/cities` | user | — (the partial unique index is the idempotency) | `aetherholm/src/server.ts` |
| `GET` | `/v1/cities` | owner | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/cities/:id` | owner | — | `aetherholm/src/server.ts` |
| `POST` | `/v1/cities/:id/buildings` | user-queue | **required** | `aetherholm/src/server.ts` |
| `POST` | `/v1/cities/:id/research` | user-queue | **required** | `aetherholm/src/server.ts` |
| `POST` | `/v1/cities/:id/ships` | user-queue | **required** | `aetherholm/src/server.ts` |
| `POST` | `/v1/fleets` | user | **required** (inline) | `aetherholm/src/server.ts` |
| `GET` | `/v1/fleets` | owner | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/fleets/:id` | owner | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/battles/:id` | sealed-public | — | `aetherholm/src/server.ts` |
| `POST` | `/v1/alliances` | user | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/alliances/:id` | bearer | — | `aetherholm/src/server.ts` |
| `POST` | `/v1/alliances/:id/members` | user | — | `aetherholm/src/server.ts` |
| `DELETE` | `/v1/alliances/:id/members` | user | — | `aetherholm/src/server.ts` |
| `POST` | `/v1/alliances/:id/claims` | user | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/chronicle/seasons` | none — **anonymous by design** | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/chronicle/seasons/:id` | none | — | `aetherholm/src/server.ts` |
| `GET` | `/v1/chronicle/seasons/:id/battles` | none | — | `aetherholm/src/server.ts` |

Declined (4), with the reasons in the header of `src/lib/aetherholm.ts`:

| Method | Path | Why not | Verified at |
| --- | --- | --- | --- |
| `GET` | `/livez` | the orchestrator's probe; the page reads `/readyz` | `aetherholm/src/server.ts` |
| `GET` | `/metrics` | Prometheus text is a scraper's, not a browser's | `aetherholm/src/server.ts` |
| `GET` | `/v1/title` | the descriptor is worlds' bridge's read (`worlds/src/titleclient.ts`) | `aetherholm/src/server.ts` |
| `POST` | `/v1/provision` | service-token only; a browser must never hold `aetherholm:provision` | `aetherholm/src/server.ts` |

The chronicle's anonymity is **exercised, not believed**: the three chronicle wrappers pass
`auth: false`, `test/aetherholm-routes.test.ts` asserts no `authorization` header leaves while a
session is held, and `test/aetherholm.test.ts` asserts every chronicle call site is a GET with
`auth: false` in its option block.

## Honest numbers

Stocks, rates, caps, costs and lift are decimal strings on the wire and **BigInt in this
client** — `Number()` never touches an amount (`src/lib/format.ts`; grouping happens on the
string). The city view ticks its stocks forward locally with the same floor arithmetic as the
server's `accrue` (`aetherholm/src/economy.ts`), property-swept in `test/format.test.ts`
so the projection can never show a value the CHECK constraint would refuse. The launch preview
(`src/lib/lattice.ts`) prices the Aether cost **before the commit** from the same constants the
server charges by — the class table `GET /v1/content/airships` serves
(`aetherholm/src/content.ts`) and the lanes `GET /v1/archipelagos/:id/lanes` serves —
mirroring `aetherholm/src/fleets.ts` ceiling for ceiling, proven by
hand-worked values in `test/lattice.test.ts`. The alliance shared-lane discount
(`aetherholm/src/fleets.ts`, `SHARED_LANE_DISCOUNT_BP`) is deliberately not guessed at: the preview prices the
undiscounted path and says so, so the true cost is never higher than the number shown.

## Running it

```bash
pnpm install        # @cloudsforge/ui resolves from ../ui — clone micro-ui alongside
pnpm dev            # http://localhost:5171 — the port survey is in vite.config.ts
pnpm test           # 197 tests; the cross-repo halves skip without ../aetherholm and ../ui
pnpm typecheck && pnpm build
```

The dev server is 5171 (`vite.config.ts`, with the survey of every sibling's port proving it
free); the service it talks to resolves at runtime to `http://localhost:4120` — the port
`micro-aetherholm` binds (`aetherholm/src/env.ts`), pinned in the registry
(`ui/packages/ui/src/surfaces.ts`). No `VITE_*`, no `.env`, no build-time host: one image
serves every environment, and `test/no-build-time-config.test.ts` plus a CI grep keep it so.

```bash
docker build -t aetherholm-web --build-context uipkg=../ui .
```

nginx enumerates the client routes and answers **404 via `error_page`** for everything else —
never `try_files … /index.html` — so a wrong address returns an honest status while still
rendering the app's own not-found page. CI probes the running container for the deep link
(`/chronicle`, the unprotected route), the honest 404, the security headers on every location,
and the favicons.

## The generated art — 74 of 101 served, and the other 27 named

`micro-aetherholm-assets` produced **101 FLUX 2 Pro images**, and until 2026-08-05 this client
referenced **none of them**: no `<img>`, no `background-image`, no fetch. Nothing was broken —
the pictures were simply never wired, and the game read as a plain data application
(micro-org#175). That is a failure no test in this repository could have reported, because
there is no natural assertion that a product uses art it was given, so the wiring came with
one: `test/art.test.ts`.

Everything is resolved through **one module**, `src/lib/art.ts`, which turns a domain key into a
URL and answers **`null` — never a placeholder path** when the set has no picture for it. A
placeholder renders as art and hides the gap; the rule and the reasoning are
`micro-emberkin-web`'s, inherited.

| Set | Served | Keyed on |
| --- | --- | --- |
| `buildings` | 20 | the building type, verbatim (`aetherholm/src/content.ts`) |
| `ships` | 10 | the airship class the content route sends, as a side profile in the fleet composer |
| `shipicons` | 10 | the same classes, where a ship is a table row rather than a choice |
| `icons` | 14 | the four resources, `aegis`, `spire`, and the seven UI glyphs the pages name |
| `islands` | 12 | `<band>_<biome>` — **read the caveat below** |
| `splashes` | 4 | the empty state each one paints |
| `keyart` | 2 | the chronicle's hero and the title strip's backdrop |
| `title` | 2 | the mark and the wordmark |

plus the **five pieces of browser chrome** served from the site root — favicon 512/192/32, the
og card and the social card — byte-identical to `micro-aetherholm-assets/assets/title/`, which
`test/art.test.ts` re-hashes rather than trusting. The 512 and the social card were shipped and
linked from nowhere until this change.

**THE BAND IS DATA; THE BIOME IS ILLUSTRATION.** The three altitude bands are content,
constrained at `aetherholm/src/migrations.ts`. The four biomes exist in **no source and no
document** — they are authored in the art set's own `ART_BIBLE.md` §3 — so the archetype shown
beside a selected island is chosen from that island's index, stable for every player, and the
caption on screen says exactly that. If that caption is ever dropped, the picture must go with
it; `test/art.test.ts` asserts the sentence.

**What is NOT served, and why.** Twenty-two assets are held out, each named with a reason in
`UNSHIPPED` in `tools/sync-art.mjs`, and `test/art.test.ts` proves the partition is total — an
asset cannot leave this client by being forgotten:

- **16 heraldry** — four fields, eight charges, four rank crests. They are `worlds`' sealed-season
  rank banner components (`worlds/src/heraldry.ts`, `cf:aetherholm:heraldry:<seasonId>:rank:<n>`).
  This client has no rank to key them on, and rendering rank 1 beside an alliance that placed
  fourth would be a lie told confidently. Reported for `worlds`, not fixed here.
- **`icons/status-population`, `icons/status-strain`, `splashes/storm-surge`** — a citizen count
  and a well-overdraw mechanic. `grep -rnw population src/` and `grep -rnw strain src/` in
  `micro-aetherholm` return nothing: the game does not model either.
- **`splashes/private-skerry`** — skerry archipelagos exist in the database
  (`aetherholm/src/migrations.ts`) and on no route and no screen.
- **`keyart/og-source`, `keyart/social-backdrop`** — the uncut sources the two shipped cards were
  derived from. Shipping both halves would put 2 MB in the image for nothing to reference.

Nothing was deleted. The art is permanent and lives in `micro-aetherholm-assets`.

`micro-beacon`'s browser tier declares five of these paths as art this surface cannot work
without, resolved in Chromium from this origin, so an empty `/art/` mount goes red before
anybody opens the page. A catalogue is not a picture on a screen — that distinction is the whole
reason the tier exists.

## Known gaps — this repository's and the service's

Recorded rather than implied. The service defects are **reported, not fixed**: this repository
does not edit `micro-aetherholm`.

Four of the five reported gaps are **closed upstream** the same day, and this client now uses
each: `IslandSummary` serves `spire` (the map marks them — though not until 2026-08-05; see
below), `GET /v1/battles` lists a player's
history (the report screen shows "your battles"), `GET /v1/alliances` is the directory with
`mine` answered in the read, and `GET /v1/content/buildings` + `/research` serve the exact
costs the engine charges — the queue forms show the engine's own numbers, computed nowhere
else. What remains:

- **`aetherholm:write` was not in the auth scope registry** (cross-repo gap, closed
  2026-08-02). The `user` mechanism's service path demands it (`WRITE_SCOPE`,
  `aetherholm/src/server.ts`, gated where the `user` mechanism resolves a service
  caller — this entry used to cite a line, and the line went stale), and until micro-contracts `0287fa1` the registry lacked it, so identity could not
  mint a credential that took that path. The registry is now total against the estate's gates —
  all 39 missing scopes registered with citations — and kept total mechanically: micro-org's
  `service-ci.yml` derives every scope a repository's gates demand and fails its build on one
  the registry lacks. The service lane is mintable. This client is unaffected either way — it
  always acts as the signed-in user.
- **The launch preview ignores the shared-lane discount** (this repository, deliberate). See
  "Honest numbers": the client cannot know claim state at server routing time, so it prices the
  undiscounted path — wrong only in the player's favour, and labelled.
- **The spire flag was served and this client dropped it, for every deploy since the map
  shipped** (this repository, closed 2026-08-05, micro-org#176). The map carried a note on screen
  apologising that "the islands route does not expose the flag the service keeps" and a header
  arguing that marking spires would mean reimplementing world generation. The service had closed
  that gap *because this client reported it* (`aetherholm/src/seasons.ts` says so), and
  the client's `Island` interface never grew the field — so the apology outlived the defect and
  nothing re-read it. The map marks spires now, from the server's flag, never recomputed. The
  lesson is the narrow one: **a gap recorded in prose goes stale silently, because nothing
  re-reads prose.**

## The one temporary thing

`@cloudsforge/ui` is `link:../ui/packages/ui` because the package is unpublished. The bespoke
`check` and `image` CI jobs exist only for that reason and are deleted the day the org's
reusable `web-ci.yml` can resolve the dependency and check out the sibling service for the
citation verification — the calling convention is in the header of `.github/workflows/ci.yml`.

---

## Provenance

The code in this repository was written by **Claude Opus 5** and **Claude Fable 5**, assets
generated with **FLUX 2 Pro**, under human direction and review.
