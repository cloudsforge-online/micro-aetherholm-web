# micro-aetherholm-web

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
> (`aetherholm/src/server.ts:649`) and nothing in `src/` holds a combat rule, a seeded PRNG or a
> hash. It **creates no community**: an alliance IS a `micro-community` community, and founding
> one sends the id of a community that already exists (`aetherholm/src/server.ts:719-726`) — a
> "create community" control here would be the second governance system the design forbids. It
> **mutates no history**: the chronicle wrappers are GET-only by test and by CI rule, matching
> the database triggers that refuse UPDATE and DELETE on sealed rows
> (`aetherholm/src/migrations.ts:667`, `:679`). And it **sells nothing**: no surface implies a
> purchasable advantage, the aegis is stated on the founding form to be never sold, and CI greps
> the stripped source for purchasable-power vocabulary.

## The surface it is built against

Every call goes through `src/lib/aetherholm.ts`, where each wrapper cites the
`aetherholm/src/server.ts` line it was verified against — read out of the service's source, not
its README (the README's table was re-verified line by line against `src/server.ts` and found
accurate; the lines below are the measurement, not the copy). `test/aetherholm.test.ts` re-reads
a real `micro-aetherholm` checkout and fails if a route is not registered at the cited line or
authenticates by a different mechanism; CI then bends one citation and one mechanism and
requires the suite to go red, deriving the line from the table rather than hardcoding it.

Mechanisms, recorded per route (never a boolean — the three queue handlers delegate their
authentication to `queueRoute`, `aetherholm/src/server.ts:866`, and a boolean grep would call
them public):

| Mechanism | Meaning |
| --- | --- |
| `none` | no principal read; public |
| `bearer` | any user token; a service needs `aetherholm:read` |
| `owner` | bearer, then owner-or-admin for users; service reads with `aetherholm:read` |
| `user` | `requireUser`: a user acts as themselves; a service needs `aetherholm:write` **and** an `x-user-id` (`aetherholm/src/server.ts:934-943`) |
| `user-queue` | `user`, via `queueRoute`, which also refuses a submission without an `Idempotency-Key` (`aetherholm/src/server.ts:875-878`) |
| `provision` | service token with `aetherholm:provision` only; user tokens refused outright |
| `sealed-public` | public once the season is sealed; participants-or-admin while live |

Called (23):

| Method | Path | Mechanism | Idempotency-Key | Verified at |
| --- | --- | --- | --- | --- |
| `GET` | `/readyz` | none | — | `aetherholm/src/server.ts:314` |
| `GET` | `/v1/seasons/current` | bearer | — | `aetherholm/src/server.ts:382` |
| `GET` | `/v1/archipelagos/:id/islands` | bearer | — | `aetherholm/src/server.ts:401` |
| `GET` | `/v1/archipelagos/:id/lanes` | bearer | — | `aetherholm/src/server.ts:518` |
| `GET` | `/v1/content/airships` | none | — | `aetherholm/src/server.ts:490` |
| `POST` | `/v1/cities` | user | — (the partial unique index is the idempotency) | `aetherholm/src/server.ts:415` |
| `GET` | `/v1/cities` | owner | — | `aetherholm/src/server.ts:440` |
| `GET` | `/v1/cities/:id` | owner | — | `aetherholm/src/server.ts:459` |
| `POST` | `/v1/cities/:id/buildings` | user-queue | **required** | `aetherholm/src/server.ts:474` |
| `POST` | `/v1/cities/:id/research` | user-queue | **required** | `aetherholm/src/server.ts:478` |
| `POST` | `/v1/cities/:id/ships` | user-queue | **required** | `aetherholm/src/server.ts:482` |
| `POST` | `/v1/fleets` | user | **required** (inline, `:535-538`) | `aetherholm/src/server.ts:533` |
| `GET` | `/v1/fleets` | owner | — | `aetherholm/src/server.ts:616` |
| `GET` | `/v1/fleets/:id` | owner | — | `aetherholm/src/server.ts:634` |
| `GET` | `/v1/battles/:id` | sealed-public | — | `aetherholm/src/server.ts:649` |
| `POST` | `/v1/alliances` | user | — | `aetherholm/src/server.ts:715` |
| `GET` | `/v1/alliances/:id` | bearer | — | `aetherholm/src/server.ts:742` |
| `POST` | `/v1/alliances/:id/members` | user | — | `aetherholm/src/server.ts:752` |
| `DELETE` | `/v1/alliances/:id/members` | user | — | `aetherholm/src/server.ts:765` |
| `POST` | `/v1/alliances/:id/claims` | user | — | `aetherholm/src/server.ts:778` |
| `GET` | `/v1/chronicle/seasons` | none — **anonymous by design** | — | `aetherholm/src/server.ts:800` |
| `GET` | `/v1/chronicle/seasons/:id` | none | — | `aetherholm/src/server.ts:816` |
| `GET` | `/v1/chronicle/seasons/:id/battles` | none | — | `aetherholm/src/server.ts:833` |

Declined (4), with the reasons in the header of `src/lib/aetherholm.ts`:

| Method | Path | Why not | Verified at |
| --- | --- | --- | --- |
| `GET` | `/livez` | the orchestrator's probe; the page reads `/readyz` | `aetherholm/src/server.ts:312` |
| `GET` | `/metrics` | Prometheus text is a scraper's, not a browser's | `aetherholm/src/server.ts:319` |
| `GET` | `/v1/title` | the descriptor is worlds' bridge's read (`worlds/src/titleclient.ts:122`) | `aetherholm/src/server.ts:334` |
| `POST` | `/v1/provision` | service-token only; a browser must never hold `aetherholm:provision` | `aetherholm/src/server.ts:336` |

The chronicle's anonymity is **exercised, not believed**: the three chronicle wrappers pass
`auth: false`, `test/aetherholm-routes.test.ts` asserts no `authorization` header leaves while a
session is held, and `test/aetherholm.test.ts` asserts every chronicle call site is a GET with
`auth: false` in its option block.

## Honest numbers

Stocks, rates, caps, costs and lift are decimal strings on the wire and **BigInt in this
client** — `Number()` never touches an amount (`src/lib/format.ts`; grouping happens on the
string). The city view ticks its stocks forward locally with the same floor arithmetic as the
server's `accrue` (`aetherholm/src/economy.ts:34-39`), property-swept in `test/format.test.ts`
so the projection can never show a value the CHECK constraint would refuse. The launch preview
(`src/lib/lattice.ts`) prices the Aether cost **before the commit** from the same constants the
server charges by — the class table `GET /v1/content/airships` serves
(`aetherholm/src/content.ts:302-313`) and the lanes `GET /v1/archipelagos/:id/lanes` serves —
mirroring `aetherholm/src/fleets.ts:294-295` and `:336` ceiling for ceiling, proven by
hand-worked values in `test/lattice.test.ts`. The alliance shared-lane discount
(`aetherholm/src/fleets.ts:53`, `:206`) is deliberately not guessed at: the preview prices the
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
`micro-aetherholm` binds (`aetherholm/src/env.ts:105`), pinned in the registry
(`ui/packages/ui/src/surfaces.ts:434`). No `VITE_*`, no `.env`, no build-time host: one image
serves every environment, and `test/no-build-time-config.test.ts` plus a CI grep keep it so.

```bash
docker build -t aetherholm-web --build-context uipkg=../ui .
```

nginx enumerates the client routes and answers **404 via `error_page`** for everything else —
never `try_files … /index.html` — so a wrong address returns an honest status while still
rendering the app's own not-found page. CI probes the running container for the deep link
(`/chronicle`, the unprotected route), the honest 404, the security headers on every location,
and the favicons.

## Brand chrome, honestly

`micro-aetherholm-assets` does not exist yet — the art run is phase 4
(`docs/ecosystem/20-aetherholm.md` §11) — so `public/` ships the **estate's generic favicons
and og card from `micro-web-template`**, linked in both directions and probed in the image.
The title's real chrome (favicons, og, wordmark — the "Title chrome" row of doc §8) lands with
the assets repository, and swapping the four files is the whole of that change.
`test/brand-chrome.test.ts` is the template's, unweakened.

## Known gaps — this repository's and the service's

Recorded rather than implied. The service defects are **reported, not fixed**: this repository
does not edit `micro-aetherholm`.

- **Spires cannot be marked on the map** (service gap). The design says "spires marked" (doc
  §5); the service keeps the flag (`aetherholm/src/migrations.ts:369` `is_spire`, maintained at
  `aetherholm/src/lattice.ts:80`) but `GET /v1/archipelagos/:id/islands` never selects it —
  `IslandSummary` (`aetherholm/src/seasons.ts:214-220`) carries id, idx, band and plot counts
  only. Recomputing `spireIdxsFor` client-side would be a private copy of world-generation
  logic, so the map says on screen that spires are unmarked, and the fix belongs upstream: add
  `isSpire` to the islands listing.
- **No battle listing for a player** (service gap). `GET /v1/battles/:id` exists; nothing lists
  the battles a player fought, so the report screen opens by pasted id (from a notification or
  the sealed chronicle). An upstream `GET /v1/battles?userId=` — owner-mechanism like
  `/v1/fleets` — would let this client show "your battles".
- **No alliance discovery** (service gap). Nothing lists alliances or answers "which alliance
  am I in" — membership appears in no route but `GET /v1/alliances/:id`. The alliance screen
  therefore opens by id and keeps it only in session state.
- **No content route for buildings or research** (service gap). `/v1/content/airships` serves
  the class table; building and research costs and durations
  (`aetherholm/src/content.ts:197-235`) are served nowhere, so the queue forms honestly say
  "charged at queue time" instead of showing a number this client would have to invent. Ship
  costs are shown, from the served table.
- **The launch preview ignores the shared-lane discount** (this repository, deliberate). See
  "Honest numbers": the client cannot know claim state at server routing time, so it prices the
  undiscounted path — wrong only in the player's favour, and labelled.
- **The brief's screen list assumed spires were markable** — found false against
  `aetherholm/src/seasons.ts:214-220`, which is the direction checking is supposed to run.

## The one temporary thing

`@cloudsforge/ui` is `link:../ui/packages/ui` because the package is unpublished. The bespoke
`check` and `image` CI jobs exist only for that reason and are deleted the day the org's
reusable `web-ci.yml` can resolve the dependency and check out the sibling service for the
citation verification — the calling convention is in the header of `.github/workflows/ci.yml`.
