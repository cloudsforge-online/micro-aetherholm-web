/**
 * The art set, the catalogue, the files on disk, and the game's own vocabularies — all four
 * against each other.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE FAILURE THIS FILE EXISTS TO PREVENT IS NOT A BROKEN `<img>`.
 *
 * `micro-aetherholm-assets` produced 101 images and this client referenced NONE of them — no tag,
 * no background, no fetch (micro-org#175). Nothing was broken; the wiring was simply never done,
 * and no test anywhere could have said so, because there is no assertion that a product uses the
 * art it was given. That is the same shape as the defect that let Tessera serve 392 sprites to
 * nobody (micro-org#173): everything green, nothing on screen.
 *
 * So this file asserts COVERAGE, in the direction that catches an omission:
 *
 *   * every building type the schema names has a sprite,
 *   * every resource has an icon,
 *   * every airship class has a profile AND an icon,
 *   * every band × biome archetype exists,
 *   * every queue kind resolves through the one table where a slug and a key are spelled
 *     differently,
 *
 * and — the load-bearing one — that the manifest's 101 assets are TOTALLY PARTITIONED into
 * served, root chrome and deliberately-unshipped. An asset cannot fall out of this client by
 * being forgotten. It can only fall out by being named in `UNSHIPPED` with a reason, which is a
 * thing a person writes and another person can argue with.
 *
 * What this file CANNOT prove is that the bytes reach a browser. `<img src>` in a bundle is not a
 * picture on a screen; the estate has the receipts. That is `micro-beacon`'s browser tier, which
 * drives the real gateway and asserts `naturalWidth`, and the `imagery` this surface declares
 * there is the other half of this file.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { ART } from '../src/art/catalogue.ts'
import {
  BIOMES,
  accentFor,
  buildingArt,
  islandArt,
  islandBiome,
  keyart,
  queueIcon,
  resourceIcon,
  shipIcon,
  shipProfile,
  slugsIn,
  splash,
  statusIcon,
  titleArt,
  uiIcon,
} from '../src/lib/art.ts'
import { RESOURCES } from '../src/lib/format.ts'
// @ts-expect-error — a .mjs tool with no type declarations, imported so that the test re-derives
// the catalogue from the manifest rather than re-implementing the derivation and agreeing with
// itself.
// Kept on ONE line: the directive above suppresses the next line, and the error TypeScript
// reports is on the module specifier — so a wrapped import puts the specifier out of its reach
// and the directive itself becomes unused, which is also an error.
import { MECHANIC_CLAIMS, ROOT_CHROME, UNSHIPPED, catalogueFrom, render, shipped } from '../tools/sync-art.mjs'

const root = new URL('../', import.meta.url)
const at = (p: string): string => fileURLToPath(new URL(p, root))
const read = (p: string): string => readFileSync(at(p), 'utf8')

interface ManifestAsset {
  readonly set: string
  readonly slug: string
  readonly path: string
  readonly deliveredSize?: string
  readonly declaredSize?: string
}
const manifest = JSON.parse(read('public/art/MANIFEST.json')) as {
  assetCount: number
  disclosure: string
  licence: string
  assets: ManifestAsset[]
}

/**
 * The 20 building types, spelled as `aetherholm/src/content.ts` spells them.
 *
 * A SECOND COPY OF THE LIST IN `src/pages/cities.tsx`, ON PURPOSE. That page's copy is what the
 * queue form offers; this one is what the art is checked against. If they drift, the sprite check
 * below is checking a list nobody renders — so the first assertion in this file's building block
 * is that the two agree, read out of the page's source rather than imported, because importing it
 * would make one list satisfy itself.
 */
const BUILDING_TYPES = [
  'skyhall', 'well_rig', 'cloudstone_quarry', 'skysteel_forge', 'terrace_farm',
  'warehouse', 'vault', 'residences', 'aerodock', 'launch_rails',
  'windworks', 'academy', 'watchspire', 'storm_anchor', 'bulwark_ring',
  'trade_gantry', 'guild_beacon', 'charthouse', 'infirmary', 'hall_of_banners',
] as const

/**
 * The 10 airship classes (`aetherholm/src/content.ts`).
 *
 * This client deliberately holds NO runtime copy — the class table arrives from
 * `GET /v1/content/airships` and `shipProfile`/`shipIcon` take whatever string it sent. The list
 * exists only here, in the test, so that "every class has art" is an assertion about the game
 * rather than about whatever the art set happens to contain.
 */
const AIRSHIP_CLASSES = [
  'skiff', 'cutter', 'corvette', 'gunship', 'frigate',
  'ironclad', 'breaker', 'hauler', 'grand_hauler', 'flagship',
] as const

/** The three altitude bands, constrained at `aetherholm/src/migrations.ts`. */
const BANDS = ['shallows', 'midreach', 'highwind'] as const

describe('the manifest', () => {
  it('is the whole set, not a subset — 101 assets', () => {
    assert.equal(manifest.assets.length, manifest.assetCount)
    assert.equal(manifest.assetCount, 101)
  })

  it('carries the AI disclosure, which travels with the pictures', () => {
    assert.ok(manifest.disclosure.length > 0)
    assert.match(manifest.disclosure, /AI-generated/i)
  })

  it('carries a licence', () => {
    assert.ok(manifest.licence.length > 0)
  })

  it('is SERVED whole, so the disclosure covers the assets this client does not ship either', () => {
    // The file under public/ is what nginx serves at /art/MANIFEST.json. If a future change ever
    // trims it to the shipped subset, the provenance of the other 27 leaves with it.
    assert.equal(manifest.assets.length, 101)
  })
})

describe('the partition of the set is total', () => {
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════════
   * THE ASSERTION THAT MAKES THE REST OF THIS FILE MEAN SOMETHING.
   *
   * Served + root chrome + unshipped = every asset, with no overlaps. Without it, "74 of 101 are
   * catalogued" is a number with no property attached: the missing 27 could be 22 reasoned
   * decisions and 5 oversights, or 27 oversights, and nothing would tell them apart. With it, an
   * asset can only leave this client through a table that names it and says why.
   * ══════════════════════════════════════════════════════════════════════════════════════════════
   */
  it('every asset is served, root chrome, or unshipped — exactly one of the three', () => {
    const served = new Set((shipped(manifest) as ManifestAsset[]).map((a) => a.path))
    const chrome = new Set(Object.keys(ROOT_CHROME as Record<string, string>))
    const held = new Set(Object.keys(UNSHIPPED as Record<string, string>))

    const uncounted = manifest.assets
      .map((a) => a.path)
      .filter((p) => !served.has(p) && !chrome.has(p) && !held.has(p))
    assert.deepEqual(uncounted, [], `in the set and in no table: ${uncounted.join(', ')}`)

    const overlaps = [...served].filter((p) => chrome.has(p) || held.has(p))
    assert.deepEqual(overlaps, [], `served AND held out: ${overlaps.join(', ')}`)

    assert.equal(served.size + chrome.size + held.size, manifest.assetCount)
  })

  it('names nothing that is not in the set — a stale table is a lie about a decision', () => {
    const known = new Set(manifest.assets.map((a) => a.path))
    const strays = [...Object.keys(UNSHIPPED as object), ...Object.keys(ROOT_CHROME as object)].filter(
      (p) => !known.has(p),
    )
    assert.deepEqual(strays, [], `named in a table, absent from the manifest: ${strays.join(', ')}`)
  })

  it('gives every unshipped asset a reason a person can read', () => {
    for (const [path, why] of Object.entries(UNSHIPPED as Record<string, string>)) {
      assert.ok(why.length > 20, `${path} is held out with no reason worth the name`)
    }
  })

  it('holds out exactly the twenty-two recorded in micro-org#175', () => {
    // A number rather than a list, so that adding a twenty-third is a deliberate edit here as well
    // as there. Sixteen heraldry, two icons and one splash for mechanics the service does not
    // have, one splash for a mechanic it has and no route lets a client find, two derivation
    // sources. The block below re-measures the last four rather than trusting this sentence.
    assert.equal(Object.keys(UNSHIPPED as object).length, 22)
  })
})

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE REASON A PICTURE IS HELD OUT IS A CLAIM ABOUT ANOTHER REPOSITORY, SO MEASURE IT THERE.
 *
 * micro-org#186 reports six assets that "illustrate mechanics the built game does not have". The
 * partition above proves each one is named with a reason; it cannot tell whether the reason is
 * still TRUE, because a reason is prose and prose is not re-read. Two failures hide in that gap
 * and they point opposite ways:
 *
 *   * the game grows the mechanic and the picture stays withheld — micro-org#175 again, a good
 *     asset held back from a screen that now has data for it;
 *   * the reason was wrong when it was written, and every later reader inherits it.
 *
 * The second one is what this block found on 2026-08-10. `private-skerry` was held out under
 * "the built game has no such thing", citing `archipelagos.kind` in a migration as though a CHECK
 * constraint were the whole of it. It is not: `provisioning.ts` provisions a skerry against a
 * paid entitlement, `world.ts` seeds its twelve islands from `skerrySeed(entitlementId)`,
 * `server.ts` serves the title contract's provision route, and a `skerry.provisioned` event goes
 * out. The mechanic is BUILT and sold. What is missing is a way for a client to find one: no
 * route lists the archipelagos a subject owns, so this bundle has no id to ask
 * `GET /v1/archipelagos/:id/islands` for. That is a real reason to hold the splash back and a
 * completely different reason from the one on the label.
 *
 * So `MECHANIC_CLAIMS` records the word each asset turns on and whether the service has it, and
 * this block re-derives both directions from a sibling checkout. It reads the service's own
 * source rather than a description of it, for the reason test/aetherholm.test.ts gives at length.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('a mechanic a held-out picture names is measured in the service, not remembered', () => {
  interface Claim {
    readonly word: string
    readonly built: boolean
  }
  const claims = MECHANIC_CLAIMS as Readonly<Record<string, Claim>>

  /** Where a micro-aetherholm checkout is, in the order CI and a developer's machine put it. */
  const roots = [
    process.env['CLOUDSFORGE_AETHERHOLM_SRC'],
    at('../aetherholm/src'),
    at('.aetherholm/src'),
  ].filter((v): v is string => Boolean(v))
  const src = roots.find((p) => existsSync(p))

  /**
   * Every `.ts` under the service's `src`, EXCLUDING its own tests. A test file is not the
   * service: micro-aetherholm's suite mentions `population` nowhere but names `skerry` dozens of
   * times, and counting either would answer a question about the suite rather than about what the
   * game does.
   */
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name)
      if (e.isDirectory()) return sources(full)
      return e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [full] : []
    })

  const body = src ? sources(src).map((f) => readFileSync(f, 'utf8')).join('\n') : ''
  const mentions = (word: string): boolean => new RegExp(`\\b${word}\\b`, 'i').test(body)

  it('claims a state for every held-out asset that is not somebody else\'s and not a source', () => {
    // Total, like the partition above: the twenty-two are sixteen heraldry components, the two
    // sources their own derivatives superseded, and four claims about the game. An asset that
    // slips out of all three would be held out for a reason nothing here re-reads.
    const derivedSources = new Set(
      manifest.assets
        .map((a) => (a as { derivedFrom?: string }).derivedFrom)
        .filter((p): p is string => Boolean(p)),
    )
    const unaccounted = Object.keys(UNSHIPPED as object).filter(
      (p) => !p.startsWith('assets/heraldry/') && !derivedSources.has(p) && !(p in claims),
    )
    assert.deepEqual(unaccounted, [], `held out with an unmeasured reason: ${unaccounted.join(', ')}`)
  })

  it('names only assets that really are held out', () => {
    const strays = Object.keys(claims).filter((p) => !(p in (UNSHIPPED as object)))
    assert.deepEqual(strays, [], `claimed about, but shipped or unknown: ${strays.join(', ')}`)
  })

  if (!src) {
    it('SKIPPED: no micro-aetherholm checkout — CI checks one out and requires this to run', () => {
      console.log('UNCHECKED: micro-aetherholm is not checked out; mechanic claims not measured')
      assert.ok(true)
    })
  } else {
    it('holds nothing back for a mechanic the service has since built', () => {
      // The #175 direction. Red here means the picture can come off the bench.
      const grown = Object.entries(claims)
        .filter(([, c]) => !c.built && mentions(c.word))
        .map(([path, c]) => `${path} (micro-aetherholm names "${c.word}")`)
      assert.deepEqual(grown, [], `held out as unbuilt, but the service has it: ${grown.join('; ')}`)
    })

    it('does not credit the service with a mechanic it has not got', () => {
      // The other direction. Red here means an asset is withheld for a client-shaped reason that
      // is really a game-shaped one, and the honest label is the shorter one.
      const absent = Object.entries(claims)
        .filter(([, c]) => c.built && !mentions(c.word))
        .map(([path, c]) => `${path} (nothing in micro-aetherholm names "${c.word}")`)
      assert.deepEqual(absent, [], `claimed built, and it is not: ${absent.join('; ')}`)
    })

    it('measured the service, rather than an empty string', () => {
      // A recursion that silently returned nothing would make both assertions above vacuous in
      // one direction and unfalsifiable in the other — the estate's most-repeated defect, a check
      // that lost its operand. `city` is in micro-aetherholm's source under every phase it built.
      assert.ok(body.length > 50_000, 'the service source read short; the walk found almost nothing')
      assert.ok(mentions('city'), 'the probe found no "city" in micro-aetherholm; it is not reading it')
    })
  }
})

describe('the generated catalogue', () => {
  it('is exactly what tools/sync-art.mjs would write today', () => {
    // A stale catalogue points at pictures that moved. `pnpm sync-art` regenerates it; this fails
    // CI rather than letting the drift ship.
    assert.equal(read('src/art/catalogue.ts'), render(manifest))
  })

  it('has one entry per served asset', () => {
    assert.equal(ART.length, (catalogueFrom(manifest) as unknown[]).length)
    assert.equal(ART.length, 74)
  })

  it('serves every path from /art/, never from the repository-relative assets/', () => {
    for (const entry of ART) {
      assert.ok(entry.path.startsWith('/art/'), `${entry.path} is not served from /art/`)
      assert.ok(!entry.path.startsWith('/art/assets/'), `${entry.path} kept the manifest prefix`)
    }
  })

  it('carries no FLUX prompt — half a megabyte of prose stays out of the bundle', () => {
    const source = read('src/art/catalogue.ts')
    assert.ok(!source.includes('sky-island strategy game'), 'a prompt leaked into the catalogue')
    assert.ok(source.length < 40_000, `the catalogue is ${source.length} bytes; it should be tens of kB`)
  })

  it('has one entry per (set, slug) — the lookup index assumes it', () => {
    const seen = new Set<string>()
    const duplicated: string[] = []
    for (const e of ART) {
      const key = `${e.set}/${e.slug}`
      if (seen.has(key)) duplicated.push(key)
      seen.add(key)
    }
    assert.deepEqual(duplicated, [], `two entries share a key: ${duplicated.join(', ')}`)
  })
})

describe('the files on disk', () => {
  it('holds every picture the catalogue names', () => {
    const missing = ART.filter((e) => !existsSync(at(`public${e.path}`))).map((e) => e.path)
    assert.deepEqual(missing, [], `catalogued but not on disk: ${missing.join(', ')}`)
    assert.ok(ART.length > 70, 'the catalogue is too small for that assertion to have meant anything')
  })

  it('holds nothing under /art/ that the catalogue does NOT name', () => {
    // The other direction, and the one that catches dead weight: a file shipped in a 22 MB image
    // that nothing can reference is indistinguishable, from the outside, from one that works.
    const artRoot = at('public/art')
    const found: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else found.push(`/art/${full.slice(artRoot.length + 1)}`)
      }
    }
    walk(artRoot)
    const catalogued = new Set<string>(ART.map((e) => e.path))
    // The manifest is served alongside the pictures and is not one of them.
    const orphans = found.filter((p) => p !== '/art/MANIFEST.json' && !catalogued.has(p))
    assert.deepEqual(orphans, [], `served from /art/ and referenced by nothing: ${orphans.join(', ')}`)
  })

  it('serves the five pieces of browser chrome from the site root, byte for byte', () => {
    // They were copied from the asset set once. "Copied once" is not a property that stays true:
    // a regenerated card or a hand-edited favicon would drift from the set silently, and the tab
    // icon is the one image nobody looks at twice.
    const digest = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex')
    const setRoot = at('../aetherholm-assets')
    if (!existsSync(setRoot)) {
      // Reported, never passed over in silence — the rule test/citations.test.ts already applies
      // to a sibling that is not checked out. CI checks it out.
      console.log('UNCHECKED: micro-aetherholm-assets is not checked out; chrome bytes not compared')
      return
    }
    for (const [source, servedAs] of Object.entries(ROOT_CHROME as Record<string, string>)) {
      const shipped = at(`public/${servedAs}`)
      assert.ok(existsSync(shipped), `public/${servedAs} is missing`)
      assert.equal(
        digest(shipped),
        digest(join(setRoot, source)),
        `public/${servedAs} has drifted from ${source}`,
      )
    }
  })

  it('links every one of them from index.html', () => {
    const html = read('index.html')
    for (const servedAs of Object.values(ROOT_CHROME as Record<string, string>)) {
      assert.ok(html.includes(`/${servedAs}`), `index.html references nothing at /${servedAs}`)
    }
  })

  it('points every /art/ URL in index.html at a real file', () => {
    const html = read('index.html')
    for (const m of html.matchAll(/href="(\/art\/[^"]+)"/g)) {
      const path = m[1] as string
      assert.ok(existsSync(at(`public${path}`)), `index.html references ${path}, which is missing`)
    }
  })
})

describe('every building type has a sprite', () => {
  it('checks the same twenty the queue form offers', () => {
    // Read out of the page rather than imported: two lists that import each other agree by
    // construction and prove nothing.
    const page = read('src/pages/cities.tsx')
    const block = /const BUILDING_TYPES = \[([\s\S]*?)\] as const/.exec(page)?.[1] ?? ''
    const inPage = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    assert.deepEqual(inPage, [...BUILDING_TYPES], 'cities.tsx and this test disagree about the types')
  })

  it('has twenty of them', () => {
    assert.equal(BUILDING_TYPES.length, 20)
    assert.equal(slugsIn('buildings').length, 20)
  })

  it('resolves every one', () => {
    const missing = BUILDING_TYPES.filter((t) => !buildingArt(t))
    assert.deepEqual([...missing], [], `no sprite: ${missing.join(', ')}`)
  })

  it('has a sprite for exactly those types — no orphan art either way', () => {
    assert.deepEqual(slugsIn('buildings'), [...BUILDING_TYPES].sort())
  })

  it('returns null for a type that does not exist, rather than a placeholder path', () => {
    assert.equal(buildingArt('sky_casino'), null)
  })
})

describe('every resource has an icon', () => {
  it('has four', () => {
    assert.equal(RESOURCES.length, 4)
  })

  it('resolves every one', () => {
    const missing = RESOURCES.filter((r) => !resourceIcon(r))
    assert.deepEqual([...missing], [], `no icon: ${missing.join(', ')}`)
  })

  it('returns null for something that is not a resource', () => {
    assert.equal(resourceIcon('gold'), null)
  })
})

describe('every airship class has both a profile and an icon', () => {
  it('has ten classes', () => {
    assert.equal(AIRSHIP_CLASSES.length, 10)
  })

  it('has a 1024×512 side profile for every one', () => {
    const missing = AIRSHIP_CLASSES.filter((c) => !shipProfile(c))
    assert.deepEqual([...missing], [], `no profile: ${missing.join(', ')}`)
  })

  it('has a 256² class icon for every one', () => {
    const missing = AIRSHIP_CLASSES.filter((c) => !shipIcon(c))
    assert.deepEqual([...missing], [], `no icon: ${missing.join(', ')}`)
  })

  it('keeps the two sets distinct — the composer must not be handed a 256 thumbnail', () => {
    assert.match(shipProfile('flagship') ?? '', /-1024x512\.png$/)
    assert.match(shipIcon('flagship') ?? '', /-256x256\.png$/)
  })

  it('returns null for a hull the art set predates', () => {
    // The service could grow an eleventh class tomorrow; the client takes the string it is sent.
    assert.equal(shipProfile('dreadnought'), null)
    assert.equal(shipIcon('dreadnought'), null)
  })
})

describe('every island archetype exists', () => {
  it('is three bands by four biomes', () => {
    assert.equal(BANDS.length, 3)
    assert.equal(BIOMES.length, 4)
    assert.equal(slugsIn('islands').length, 12)
  })

  it('resolves every band with every biome', () => {
    const missing: string[] = []
    for (const [i, band] of BANDS.entries()) {
      for (const [j] of BIOMES.entries()) {
        // idx chosen so that islandBiome() lands on each biome in turn.
        if (!islandArt(band, j)) missing.push(`${band}_${BIOMES[j]}`)
      }
      void i
    }
    assert.deepEqual(missing, [], `no archetype: ${missing.join(', ')}`)
  })

  it('picks a biome that is stable for an index and covers all four', () => {
    assert.equal(islandBiome(0), islandBiome(0))
    assert.equal(islandBiome(4), islandBiome(0))
    assert.deepEqual([0, 1, 2, 3].map(islandBiome), [...BIOMES])
  })

  it('survives an index the wire should never send', () => {
    assert.ok(BIOMES.includes(islandBiome(-1)))
    assert.ok(BIOMES.includes(islandBiome(Number.NaN)))
  })

  it('returns null for a band the database does not allow', () => {
    assert.equal(islandArt('stratosphere', 0), null)
  })

  it('keeps the caption that makes the picture honest', () => {
    /*
     * THE BIOME IS NOT DATA. The map labels the archetype as art direction chosen from the
     * island's index, because the service ships no terrain. If that sentence is ever deleted, the
     * picture becomes a claim about the world, so the sentence is asserted rather than trusted.
     */
    const page = read('src/pages/map.tsx')
    assert.match(page, /The game keeps no terrain of its own/, 'the archetype caption is gone; so must the art be')
    assert.match(page, /do not plan around it/)
  })
})

describe('the interface glyphs the components ask for', () => {
  it('has one for each of the three queue kinds', () => {
    // The one place a slug and a domain key are spelled differently: `building` -> queue-build,
    // `ship` -> queue-shipyard. A template string would have resolved two of three.
    for (const kind of ['building', 'research', 'ship'] as const) {
      assert.ok(queueIcon(kind), `no glyph for a ${kind} queue item`)
    }
    assert.match(queueIcon('building') ?? '', /ui-queue-build-/)
    assert.match(queueIcon('ship') ?? '', /ui-queue-shipyard-/)
  })

  it('has every glyph a page names', () => {
    const asked = ['battle', 'chronicle', 'fleet', 'wind-lane', 'lane-junction']
    const missing = asked.filter((slug) => !uiIcon(slug))
    assert.deepEqual(missing, [], `asked for by a page, not in the art set: ${missing.join(', ')}`)
  })

  it('has the two status glyphs that have data behind them', () => {
    assert.ok(statusIcon('aegis'))
    assert.ok(statusIcon('spire'))
  })

  it('does NOT ship the two that do not', () => {
    /*
     * `status-population` and `status-strain` are real, good pictures of mechanics the built game
     * does not have: `grep -rnw population src/` and `grep -rnw strain src/` in micro-aetherholm
     * return nothing. They are held out rather than hung off an unrelated number, because a
     * confidently wrong icon is worse than a missing one — nobody reports it.
     */
    assert.equal(uiIcon('population'), null)
    assert.equal(slugsIn('icons').includes('status-population'), false)
    assert.equal(slugsIn('icons').includes('status-strain'), false)
  })
})

describe('the scenes and the title lockup', () => {
  it('has the four splashes that have a screen', () => {
    for (const slug of ['season-dawn', 'season-seal', 'spire-war', 'trade-flotilla'] as const) {
      assert.ok(splash(slug), `no splash for ${slug}`)
    }
  })

  it('ships four of the six, and the other two are named with reasons', () => {
    assert.equal(slugsIn('splashes').length, 4)
    const held = Object.keys(UNSHIPPED as object)
    assert.ok(held.some((p) => p.includes('storm-surge')))
    assert.ok(held.some((p) => p.includes('private-skerry')))
  })

  it('has the hero and the wordmark backdrop', () => {
    assert.ok(keyart('hero'))
    assert.ok(keyart('wordmark-backdrop'))
  })

  it('has the mark and the wordmark', () => {
    assert.ok(titleArt('mark'))
    assert.ok(titleArt('wordmark'))
  })
})

describe('accents', () => {
  it('reports the hue an asset was painted around', () => {
    assert.equal(accentFor('icons', 'resource-aether'), '#8f7ae8')
  })

  it('is null for something the catalogue does not carry', () => {
    assert.equal(accentFor('icons', 'resource-gold'), null)
  })
})

describe('the pages actually reference the art', () => {
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════════
   * THE ASSERTION THAT WOULD HAVE CAUGHT #175 ON THE DAY THE ASSET SET LANDED.
   *
   * Everything above proves the catalogue is complete and correct. All of it passed, trivially,
   * on a client that rendered not one picture — because a complete catalogue nothing imports is
   * exactly the state this repository was in. So: the modules that turn a domain key into a URL
   * must be REACHED from the screens.
   *
   * It is deliberately a crude check on the source text rather than a render. A render assertion
   * is the strong one and it lives in test/browser-journeys.test.ts and in micro-beacon's tier;
   * this is the cheap total one, and what it catches is the failure that actually happened —
   * nobody wired it at all.
   * ══════════════════════════════════════════════════════════════════════════════════════════════
   */
  it('is imported by every screen that has something to illustrate', () => {
    const pages = ['map', 'cities', 'fleets', 'battles', 'chronicle']
    const unwired = pages.filter((p) => !read(`src/pages/${p}.tsx`).includes("from '../lib/art.ts'"))
    assert.deepEqual(unwired, [], `renders no generated art: ${unwired.join(', ')}`)
  })

  it('is imported by the shell, which carries the title lockup', () => {
    assert.match(read('src/components/shell.tsx'), /from '\.\.\/lib\/art\.ts'/)
  })

  it('never spells an /art/ path by hand outside the generated catalogue', () => {
    // A hand-written path forks the naming contract silently: it keeps working until the asset set
    // is regenerated at a different size, and then it 404s with nothing to point at.
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(at(dir), { withFileTypes: true })) {
        if (entry.name === 'art') continue // the generated catalogue, which is where they belong
        const rel = `${dir}/${entry.name}`
        if (entry.isDirectory()) walk(rel)
        else if (/\.(ts|tsx|css)$/.test(entry.name) && /['"(]\/art\//.test(read(rel))) offenders.push(rel)
      }
    }
    walk('src')
    assert.deepEqual(offenders, [], `spells an /art/ path by hand: ${offenders.join(', ')}`)
  })
})
