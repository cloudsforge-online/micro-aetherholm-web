/**
 * Regenerate `src/art/catalogue.ts` from `public/art/MANIFEST.json`.
 *
 * `micro-aetherholm-assets` produced 101 FLUX 2 Pro images and this client referenced none of
 * them (micro-org#175). Wiring them meant answering two questions per asset, and this file is
 * where both answers are written down:
 *
 *   1. **Is it served at all?** Three tables below partition the manifest — `UNSHIPPED`,
 *      `ROOT_CHROME` and everything else. `test/art.test.ts` asserts the partition is TOTAL, so
 *      an asset cannot be dropped by being forgotten; it has to be dropped by being named here
 *      with a reason.
 *   2. **Where does it resolve from?** The manifest's paths are repository-relative
 *      (`assets/buildings/academy-512x512.png`). The bundle serves them from `/art/`, and the
 *      swap happens once, here, rather than at forty call sites.
 *
 * WHY A GENERATED FILE AND NOT AN IMPORT. `MANIFEST.json` is 480 kB, most of it the FLUX prompt
 * of every image. Importing it would put half a megabyte of prose into the bundle to answer the
 * question "where is the picture of a skyhall". The catalogue is that answer and nothing else —
 * set, slug, name, path, size, accent — about 15 kB.
 *
 * The provenance is not lost. `MANIFEST.json` is SERVED whole at `/art/MANIFEST.json`, including
 * the entries for the assets this client does NOT ship, so the AI disclosure and the licence
 * travel with the pictures rather than being summarised by the code that displays them.
 *
 *   node tools/sync-art.mjs            regenerate
 *   node tools/sync-art.mjs --check    exit 1 if the committed file is stale
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const MANIFEST = new URL('public/art/MANIFEST.json', root)
const OUT = new URL('src/art/catalogue.ts', root)

/**
 * Assets this client does NOT serve, and why not — twenty-two of the hundred and one.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THIS TABLE IS THE POINT OF THE FILE. An asset set wired by eye leaves the leftovers invisible:
 * nobody can tell a picture that was considered and rejected from one that was overlooked, so the
 * next person re-derives the whole mapping to find out. Every entry here is a decision with a
 * reason attached, and the reasons are of exactly two kinds:
 *
 *   * **It belongs to another product.** Shipping it here would put a second copy of another
 *     repository's art in this bundle and hide the fact that the real consumer still has none.
 *   * **The built game has no such thing.** These are the honest gaps. The art is good and the
 *     mechanic it illustrates does not exist in `aetherholm/src`, so there is no data to key it
 *     on. Inventing a key — hanging "well strain" off a number that means something else — puts a
 *     confidently wrong picture on screen, and a wrong picture is worse than a missing one
 *     because nobody reports it.
 *
 * NOTHING HERE IS DELETED. The files stay in `micro-aetherholm-assets`, permanent, and each is
 * reported in micro-org so the gap is somebody's rather than nobody's.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
export const UNSHIPPED = Object.freeze({
  // ── belongs to another product ──────────────────────────────────────────────────────────────
  // Sixteen: four fields, eight charges, four rank crests. They are the components of `worlds`'
  // sealed-season rank banner, which is minted as a URN — `cf:aetherholm:heraldry:<seasonId>:
  // rank:<n>` — by `worlds/src/heraldry.ts`, whose own header says "first place and fifth place
  // are different artwork, decided by the asset pipeline later" and "the urn is an identity, not
  // a file path". This client has no rank: `Alliance` (src/lib/aetherholm.ts) carries members,
  // claims, beacons and shared lanes, and nothing that could pick a crest tier. Rendering rank 1
  // beside an alliance that placed fourth would be a lie the UI told confidently.
  'assets/heraldry/charge-airship-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-anchor-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-bolt-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-gale-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-spire-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-star-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-tower-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/charge-well-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/crest-rank1-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/crest-rank2-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/crest-rank3-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/crest-rank4-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/field-cloud-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/field-dawn-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/field-night-512x512.png': "worlds' rank banner components; no rank exists in this client",
  'assets/heraldry/field-storm-512x512.png': "worlds' rank banner components; no rank exists in this client",

  // ── the built game has no such thing ────────────────────────────────────────────────────────
  // `grep -rnw population src/` and `grep -rnw strain src/` in `micro-aetherholm` return NOTHING.
  // A city is stocks, rates, a storage cap, buildings, ships and a queue; there is no citizen
  // count and no well-overdraw mechanic. The art set's README lists both under `icons/` because
  // doc 20 §8 planned them, and the phases that were built did not.
  'assets/icons/status-population-512x512.png': 'no city carries a population; the service has no such field',
  'assets/icons/status-strain-512x512.png': 'no well carries a strain; the service has no such mechanic',
  // The splash of an overdrawn well, which is the same absent mechanic painted wide.
  'assets/splashes/storm-surge-1536x640.png': 'illustrates well strain, which the service does not model',
  // ── built, and unreachable from here ────────────────────────────────────────────────────────
  // A DIFFERENT KIND OF GAP FROM THE THREE ABOVE, and it was mislabelled as one of them until
  // 2026-08-10. The Private Skerry is not a plan: `provisioning.ts` raises one against a paid
  // entitlement, `world.ts` seeds its twelve islands from `skerrySeed(entitlementId)` so the same
  // purchase yields the same geography on both sides of a race, `server.ts` serves the title
  // contract's provision route, and `aetherholm.skerry.provisioned` goes out on the bus.
  //
  // What is missing is the way in. Provisioning is a SERVICE act driven by the entitlement bridge
  // — a user token is refused — and no route lists the archipelagos a subject owns. So a player
  // who has bought one cannot be handed an id here, and `GET /v1/archipelagos/:id/islands` wants
  // an id. The splash is held back for want of a screen it could sit on, not for want of a
  // mechanic; the honest fix is a route in micro-aetherholm, and it is a smaller thing than the
  // three above. Recorded in micro-org#186.
  'assets/splashes/private-skerry-1536x640.png':
    'the skerry is built and sold, and no route lists the ones a subject owns — this client cannot find one to show',

  // ── superseded by their own derivatives ─────────────────────────────────────────────────────
  // These two are the SOURCES the shipped cards were cut and composited from (`derivedFrom` on
  // `assets/title/og-1200x630.png` and `assets/title/social-1280x640.png`). Shipping both halves
  // of a derivation would put 2 MB in the image so that nothing could reference it.
  'assets/keyart/og-source-1200x640.png': 'the uncut source of the og card, which is served itself',
  'assets/keyart/social-backdrop-1280x640.png': 'the uncomposited source of the social card, which is served itself',
})

/**
 * Assets served from the SITE ROOT rather than from `/art/`, and the file they are served as.
 *
 * Browser chrome is addressed by convention, not by catalogue: `index.html` names these five, a
 * crawler fetches the og card by its meta tag, and none of them is ever resolved from a domain id
 * at runtime. Putting them in the catalogue would offer `titleArt('favicon')` to a caller who has
 * no reason to want it, so they are held out of it — but held out HERE, in the same partition, so
 * that they still cannot go missing without a test noticing.
 *
 * They were already byte-identical to the asset set before this change: `micro-aetherholm-web`
 * shipped the title's own chrome from the day the art run landed, which is why the imagery audit
 * found the brand layer healthy and the product layer empty. `test/art.test.ts` re-checks the
 * bytes, because "copied once" is not a property that stays true.
 */
/**
 * The word each held-out mechanic asset turns on, and whether the SERVICE has it — the claim in
 * the reason above, in a form a test can measure instead of a form a reader has to trust.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A REASON IS A MEASUREMENT WITH A DATE ON IT, AND MEASUREMENTS GO STALE.
 *
 * "The service has no such mechanic" was true of every entry here when it was written. It stays
 * true only until somebody builds one, and the day that happens this table is a picture withheld
 * from a screen that now has data for it — the same defect as micro-org#175 in miniature, and
 * invisible for the same reason: nothing re-reads a comment.
 *
 * So the claim is written down as `built`, and `test/art.test.ts` re-derives it from a sibling
 * `micro-aetherholm` checkout on every run. `false` means the word must return NOTHING from the
 * service's own source; `true` means it must be there, and the asset is held out for a reason
 * that is about this client rather than about the game.
 *
 * The word is the crudest possible probe and that is deliberate: it goes red when somebody merely
 * MENTIONS the mechanic, which is a prompt to say which of the two rows they are now in, not a
 * false alarm. `test/aetherholm.test.ts` makes the same trade for route paths and gives the
 * argument at length.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
export const MECHANIC_CLAIMS = Object.freeze({
  'assets/icons/status-population-512x512.png': { word: 'population', built: false },
  'assets/icons/status-strain-512x512.png': { word: 'strain', built: false },
  'assets/splashes/storm-surge-1536x640.png': { word: 'strain', built: false },
  'assets/splashes/private-skerry-1536x640.png': { word: 'skerry', built: true },
})

export const ROOT_CHROME = Object.freeze({
  'assets/title/favicon-32x32.png': 'favicon-32x32.png',
  'assets/title/favicon-192x192.png': 'favicon-192x192.png',
  'assets/title/favicon-512x512.png': 'favicon-512x512.png',
  'assets/title/og-1200x630.png': 'og-1200x630.png',
  'assets/title/social-1280x640.png': 'social-1280x640.png',
})

/** Fields kept per asset. Everything else — prompt, attempts, checksum, cost — stays in the manifest. */
export function entryFrom(asset) {
  return {
    set: asset.set,
    slug: asset.slug,
    name: asset.name,
    // Served from /art/, so the manifest's repo-relative "assets/…" prefix is swapped for the
    // public one. Doing it here rather than at every call site means one place can be wrong.
    path: `/art/${String(asset.path).replace(/^assets\//, '')}`,
    size: asset.deliveredSize ?? asset.declaredSize,
    accent: asset.accent ?? null,
  }
}

/** The assets this bundle serves from `/art/`: the manifest, less the two named tables. */
export function shipped(manifest) {
  return manifest.assets.filter((a) => !(a.path in UNSHIPPED) && !(a.path in ROOT_CHROME))
}

export function catalogueFrom(manifest) {
  return shipped(manifest)
    .map(entryFrom)
    .sort((a, b) => (a.set === b.set ? a.path.localeCompare(b.path) : a.set.localeCompare(b.set)))
}

export function render(manifest) {
  const entries = catalogueFrom(manifest)
  const lines = entries.map((e) => `  ${JSON.stringify(e)},`).join('\n')
  return `/**
 * Every generated image this bundle serves, and where from. GENERATED — do not edit.
 *
 * Written by \`tools/sync-art.mjs\` from \`public/art/MANIFEST.json\`, which came from
 * \`micro-aetherholm-assets\`. Run \`pnpm sync-art\` after copying a new asset set in;
 * \`test/art.test.ts\` fails if this file and the manifest disagree.
 *
 * ${entries.length} of the set's ${manifest.assetCount}. The other ${manifest.assetCount - entries.length} are the five pieces of browser chrome
 * served from the site root and the ${Object.keys(UNSHIPPED).length} this client does not serve at all — read
 * \`UNSHIPPED\` in the generator for which, and for why each one. They are NOT missing and they
 * were NOT deleted; the art is permanent and lives in \`micro-aetherholm-assets\`.
 *
 * The manifest's own provenance — the FLUX prompt, the model, the checksum, the C2PA state, the
 * licence and the AI disclosure — is deliberately NOT copied here. It is served whole at
 * \`/art/MANIFEST.json\`, for all ${manifest.assetCount}, so the disclosure travels with the images.
 *
 * Generator: ${manifest.generator}
 * Assets in the set: ${manifest.assetCount}
 * Updated: ${manifest.updatedAt}
 */

export interface ArtEntry {
  /** \`buildings\` | \`icons\` | \`islands\` | \`keyart\` | \`shipicons\` | \`ships\` | \`splashes\` | \`title\`. */
  readonly set: string
  /** The domain key. A building type, an airship class, a resource, a \`<band>_<biome>\` archetype. */
  readonly slug: string
  readonly name: string
  /** Absolute, browser-resolvable, served by nginx from \`/art/\`. */
  readonly path: string
  /** \`<w>x<h>\` as delivered. */
  readonly size: string
  /** The hue the picture was PAINTED around, from the manifest. Art direction, never a UI palette. */
  readonly accent: string | null
}

export const ART: readonly ArtEntry[] = [
${lines}
]
`
}

const manifest = JSON.parse(readFileSync(fileURLToPath(MANIFEST), 'utf8'))
const rendered = render(manifest)

if (process.argv.includes('--check')) {
  const current = readFileSync(fileURLToPath(OUT), 'utf8')
  if (current !== rendered) {
    console.error('src/art/catalogue.ts is stale — run `pnpm sync-art`')
    process.exit(1)
  }
  console.log('ok: the art catalogue matches the manifest')
} else {
  writeFileSync(fileURLToPath(OUT), rendered)
  console.log(
    `wrote src/art/catalogue.ts — ${catalogueFrom(manifest).length} served of ${manifest.assetCount} in the set`,
  )
}
