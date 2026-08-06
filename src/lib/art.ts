/**
 * Finding a picture.
 *
 * `micro-aetherholm-assets` shipped 101 FLUX 2 Pro images and this client referenced NONE of
 * them: no `<img>`, no `background-image`, no fetch (micro-org#175). The art was not broken and
 * was never wired, so the game read as a plain data application. This module is the only thing in
 * the app that turns a domain key into a URL, so a missing picture is a missing picture in one
 * place rather than in forty `<img>` tags.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * `null`, NEVER A PLACEHOLDER PATH.
 *
 * Every lookup here answers `null` when the set has no picture for a key, and every caller renders
 * the label alone. The alternative — a generic "no image" file — RENDERS AS ART: the page looks
 * finished, the gap is invisible, and nobody reports it. That is precisely how the estate served
 * 392 sprites to nobody for as long as the mount existed. `test/art.test.ts` asserts that every
 * building type, every resource, every airship class and every band the game names resolves, so a
 * `null` reaching production means the SERVICE knows a key this bundle predates — which is exactly
 * the thing worth saying out loud rather than papering over.
 *
 * The rule is `micro-emberkin-web/src/lib/art.ts`'s, inherited with its reasoning.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS NOT HERE: the twenty-seven assets this bundle does not serve. Five are browser chrome
 * addressed by `index.html` directly; twenty-two are named, with a reason each, in `UNSHIPPED` in
 * `tools/sync-art.mjs`. None of them was deleted — the art is permanent.
 */
import { ART, type ArtEntry } from '../art/catalogue.ts'
import type { Resource } from './format.ts'

/** Indexed once at module load: a linear scan of seventy-four entries per table row is silly. */
const bySet = new Map<string, Map<string, ArtEntry>>()
for (const entry of ART) {
  let set = bySet.get(entry.set)
  if (!set) {
    set = new Map()
    bySet.set(entry.set, set)
  }
  // One entry per (set, slug) in this set — unlike Emberkin's, which carries two sizes per
  // species. `test/art.test.ts` asserts the uniqueness rather than assuming it.
  if (!set.has(entry.slug)) set.set(entry.slug, entry)
}

function lookup(set: string, slug: string): ArtEntry | null {
  return bySet.get(set)?.get(slug) ?? null
}

/* ---- the game's own vocabularies ------------------------------------- */

/**
 * A building's sprite, by the type the schema spells (`aetherholm/src/content.ts`).
 *
 * Twenty types, twenty sprites, and the slugs are IDENTICAL to the type names — the asset set was
 * planned from `content.ts` itself rather than from a copy of it (`micro-aetherholm-assets`
 * README §2, "the doc-20 inversion"), so there is no translation table to get wrong.
 */
export function buildingArt(type: string): string | null {
  return lookup('buildings', type)?.path ?? null
}

/** A resource's icon. Four of them, `RESOURCES` in ./format.ts, prefixed `resource-` in the set. */
export function resourceIcon(resource: Resource | string): string | null {
  return lookup('icons', `resource-${resource}`)?.path ?? null
}

/**
 * An airship's side profile, 1024×512, by class.
 *
 * The ten classes are the service's (`aetherholm/src/content.ts`) and this client never
 * hard-codes them — the class table arrives from `GET /v1/content/airships` at runtime. So this
 * takes whatever string the service sent and answers `null` for a class the art set predates,
 * which is the honest behaviour when the game grows an eleventh hull.
 */
export function shipProfile(airshipClass: string): string | null {
  return lookup('ships', airshipClass)?.path ?? null
}

/** An airship's flat class icon, 256², for tables and lists. Same keying as `shipProfile`. */
export function shipIcon(airshipClass: string): string | null {
  return lookup('shipicons', airshipClass)?.path ?? null
}

/* ---- interface glyphs ------------------------------------------------ */

/** A status glyph. `aegis` is a city's founding grace; `spire` is the season's objective. */
export function statusIcon(what: 'aegis' | 'spire'): string | null {
  return lookup('icons', `status-${what}`)?.path ?? null
}

/** A UI glyph, by the name the set gives it (`battle`, `chronicle`, `fleet`, `wind-lane`…). */
export function uiIcon(what: string): string | null {
  return lookup('icons', `ui-${what}`)?.path ?? null
}

/**
 * The glyph for a queue item, by the kind the service sends.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE PLACE WHERE A SLUG AND A DOMAIN KEY ARE SPELLED DIFFERENTLY, AND SO THE ONE PLACE A
 * WIRING MISTAKE COULD HIDE. `QueueItem.kind` is `building | research | ship`
 * (`src/lib/aetherholm.ts`); the icons are `ui-queue-build`, `ui-queue-research` and
 * `ui-queue-shipyard`. Two of the three do not match, so this is a TABLE — three exhaustive
 * entries under a `Record` the compiler checks — rather than a template string that would quietly
 * resolve `ui-queue-building` to nothing and render two icons out of three.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
const QUEUE_GLYPH: Readonly<Record<'building' | 'research' | 'ship', string>> = {
  building: 'queue-build',
  research: 'queue-research',
  ship: 'queue-shipyard',
}

export function queueIcon(kind: 'building' | 'research' | 'ship'): string | null {
  return uiIcon(QUEUE_GLYPH[kind])
}

/* ---- islands --------------------------------------------------------- */

/**
 * The four island biomes, in the order `micro-aetherholm-assets/ART_BIBLE.md` §3 authors them.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * **NO SOURCE NAMES THESE, AND THAT IS WHY THIS FUNCTION TAKES AN INDEX.**
 *
 * The three BANDS are content: `shallows | midreach | highwind`, constrained at the database
 * (`aetherholm/src/migrations.ts`) and carried on every island the islands route returns. The
 * four biomes are not. They exist in no document and no source — the art set's own README says so
 * ("authored in ART_BIBLE.md §3 … until the game grows a biome column") — so there is nothing on
 * the wire to key them on.
 *
 * So the band is DATA and the biome is ILLUSTRATION, and the two must not be conflated on screen.
 * The archetype is chosen from the island's own `idx`, which makes it stable — the same island
 * shows the same picture on every visit and to every player, which is the only property that
 * matters for a decoration — and the caller labels it as an archetype rather than as this
 * island's terrain. That is the same line the map already draws around its ring layout: the
 * geography is the server's, the arrangement is this client's presentation.
 *
 * The alternative was to ship no island art at all. Twelve paintings of the thing the whole game
 * is about, withheld because a column does not exist, is the worse trade — but only while the
 * label stays honest, so if that caption is ever dropped, drop this too.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
export const BIOMES = ['terrace', 'crag', 'grove', 'reef'] as const
export type Biome = (typeof BIOMES)[number]

/** The archetype shown for an island: its real band, and a stable biome from its index. */
export function islandBiome(idx: number): Biome {
  // `idx` is a non-negative integer at the database (`aetherholm/src/migrations.ts`); the
  // guard is for a wire value that is not, which would otherwise index out of the array.
  const safe = Number.isFinite(idx) && idx >= 0 ? Math.floor(idx) : 0
  return BIOMES[safe % BIOMES.length] as Biome
}

/** An island archetype painting, 1024², keyed `<band>_<biome>`. Read `BIOMES` before calling. */
export function islandArt(band: string, idx: number): string | null {
  return lookup('islands', `${band}_${islandBiome(idx)}`)?.path ?? null
}

/* ---- scenes and the title lockup -------------------------------------- */

/**
 * A season or event splash, 1536×640, by slug.
 *
 * Four of the six are wired. `storm-surge` paints well strain and `private-skerry` paints a
 * skerry archipelago; the service models neither on any route, so both are held out of the
 * catalogue rather than hung off an unrelated screen. See `UNSHIPPED` in `tools/sync-art.mjs`.
 */
export function splash(slug: 'season-dawn' | 'season-seal' | 'spire-war' | 'trade-flotilla'): string | null {
  return lookup('splashes', slug)?.path ?? null
}

/** Textless key art: `hero` (1920×768) or `wordmark-backdrop` (1536×512). */
export function keyart(slug: 'hero' | 'wordmark-backdrop'): string | null {
  return lookup('keyart', slug)?.path ?? null
}

/** The title lockup: `mark` (1024²) or `wordmark` (1024×384). The favicons are cut from `mark`
 *  and served from the site root, so they are not in the catalogue — see `ROOT_CHROME`. */
export function titleArt(slug: 'mark' | 'wordmark'): string | null {
  return lookup('title', slug)?.path ?? null
}

/**
 * The art accent recorded for an asset — the hue the picture was actually PAINTED around.
 *
 * IT IS NOT A UI PALETTE. It comes from the manifest, which took it from the prompt that produced
 * the image, so several are indistinguishable as interface colour. Use it to tint a glow behind a
 * sprite; never to distinguish one thing from another.
 */
export function accentFor(set: string, slug: string): string | null {
  return lookup(set, slug)?.accent ?? null
}

/** Every slug the set covers in one of its sets, sorted. For the completeness tests. */
export function slugsIn(set: string): string[] {
  return [...(bySet.get(set)?.keys() ?? [])].sort()
}

/** The whole catalogue, for the completeness test. */
export { ART }
