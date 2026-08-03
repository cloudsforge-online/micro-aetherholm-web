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
> (`aetherholm/src/server.ts:737`) and nothing in `src/` holds a combat rule, a seeded PRNG or a
> hash. It **creates no community**: an alliance IS a `micro-community` community, and founding
> one sends the id of a community that already exists (`aetherholm/src/server.ts:807-814`) — a
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
authentication to `queueRoute`, `aetherholm/src/server.ts:963`, and a boolean grep would call
them public):

| Mechanism | Meaning |
| --- | --- |
| `none` | no principal read; public |
| `bearer` | any user token; a service needs `aetherholm:read` |
| `owner` | bearer, then owner-or-admin for users; service reads with `aetherholm:read` |
| `user` | `requireUser`: a user acts as themselves; a service needs `aetherholm:write` **and** an `x-user-id` (`aetherholm/src/server.ts:1031-1040`) |
| `user-queue` | `user`, via `queueRoute`, which also refuses a submission without an `Idempotency-Key` (`aetherholm/src/server.ts:972-975`) |
| `provision` | service token with `aetherholm:provision` only; user tokens refused outright |
| `sealed-public` | public once the season is sealed; participants-or-admin while live |

Called (23):

| Method | Path | Mechanism | Idempotency-Key | Verified at |
| --- | --- | --- | --- | --- |
| `GET` | `/readyz` | none | — | `aetherholm/src/server.ts:328` |
| `GET` | `/v1/seasons/current` | bearer | — | `aetherholm/src/server.ts:396` |
| `GET` | `/v1/archipelagos/:id/islands` | bearer | — | `aetherholm/src/server.ts:415` |
| `GET` | `/v1/archipelagos/:id/lanes` | bearer | — | `aetherholm/src/server.ts:572` |
| `GET` | `/v1/content/airships` | none | — | `aetherholm/src/server.ts:544` |
| `POST` | `/v1/cities` | user | — (the partial unique index is the idempotency) | `aetherholm/src/server.ts:429` |
| `GET` | `/v1/cities` | owner | — | `aetherholm/src/server.ts:454` |
| `GET` | `/v1/cities/:id` | owner | — | `aetherholm/src/server.ts:473` |
| `POST` | `/v1/cities/:id/buildings` | user-queue | **required** | `aetherholm/src/server.ts:488` |
| `POST` | `/v1/cities/:id/research` | user-queue | **required** | `aetherholm/src/server.ts:492` |
| `POST` | `/v1/cities/:id/ships` | user-queue | **required** | `aetherholm/src/server.ts:496` |
| `POST` | `/v1/fleets` | user | **required** (inline, `:535-538`) | `aetherholm/src/server.ts:587` |
| `GET` | `/v1/fleets` | owner | — | `aetherholm/src/server.ts:670` |
| `GET` | `/v1/fleets/:id` | owner | — | `aetherholm/src/server.ts:688` |
| `GET` | `/v1/battles/:id` | sealed-public | — | `aetherholm/src/server.ts:737` |
| `POST` | `/v1/alliances` | user | — | `aetherholm/src/server.ts:803` |
| `GET` | `/v1/alliances/:id` | bearer | — | `aetherholm/src/server.ts:839` |
| `POST` | `/v1/alliances/:id/members` | user | — | `aetherholm/src/server.ts:849` |
| `DELETE` | `/v1/alliances/:id/members` | user | — | `aetherholm/src/server.ts:862` |
| `POST` | `/v1/alliances/:id/claims` | user | — | `aetherholm/src/server.ts:875` |
| `GET` | `/v1/chronicle/seasons` | none — **anonymous by design** | — | `aetherholm/src/server.ts:897` |
| `GET` | `/v1/chronicle/seasons/:id` | none | — | `aetherholm/src/server.ts:913` |
| `GET` | `/v1/chronicle/seasons/:id/battles` | none | — | `aetherholm/src/server.ts:930` |

Declined (4), with the reasons in the header of `src/lib/aetherholm.ts`:

| Method | Path | Why not | Verified at |
| --- | --- | --- | --- |
| `GET` | `/livez` | the orchestrator's probe; the page reads `/readyz` | `aetherholm/src/server.ts:326` |
| `GET` | `/metrics` | Prometheus text is a scraper's, not a browser's | `aetherholm/src/server.ts:333` |
| `GET` | `/v1/title` | the descriptor is worlds' bridge's read (`worlds/src/titleclient.ts:122`) | `aetherholm/src/server.ts:348` |
| `POST` | `/v1/provision` | service-token only; a browser must never hold `aetherholm:provision` | `aetherholm/src/server.ts:350` |

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
the assets repository — **done**: the four files in `public/` are the generated title chrome, byte-identical to `micro-aetherholm-assets/assets/title/`, and the brand-chrome suite verifies them in both directions as before.
`test/brand-chrome.test.ts` is the template's, unweakened.

## Known gaps — this repository's and the service's

Recorded rather than implied. The service defects are **reported, not fixed**: this repository
does not edit `micro-aetherholm`.

Four of the five reported gaps are **closed upstream** the same day, and this client now uses
each: `IslandSummary` serves `spire` (the map marks them), `GET /v1/battles` lists a player's
history (the report screen shows "your battles"), `GET /v1/alliances` is the directory with
`mine` answered in the read, and `GET /v1/content/buildings` + `/research` serve the exact
costs the engine charges — the queue forms show the engine's own numbers, computed nowhere
else. What remains:

- **`aetherholm:write` was not in the auth scope registry** (cross-repo gap, closed
  2026-08-02). The `user` mechanism's service path demands it (`WRITE_SCOPE`,
  `aetherholm/src/server.ts:101`, gated at `:1034` — this entry used to cite `:937`, which was
  stale), and until micro-contracts `0287fa1` the registry lacked it, so identity could not
  mint a credential that took that path. The registry is now total against the estate's gates —
  all 39 missing scopes registered with citations — and kept total mechanically: micro-org's
  `service-ci.yml` derives every scope a repository's gates demand and fails its build on one
  the registry lacks. The service lane is mintable. This client is unaffected either way — it
  always acts as the signed-in user.
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

---

## Provenance

The code in this repository was written by **Claude Opus 5** and **Claude Fable 5**, assets
generated with **FLUX 2 Pro**, under human direction and review.
