/**
 * THE SHELL'S HEAD AND THE RUNNING PAGE'S HEAD SAY THE SAME THING.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THERE ARE TWO COPIES AT ALL, WHICH IS THE PART THAT LOOKS LIKE A MISTAKE
 *
 * `index.html` carries a `<title>`, a description and an Open Graph card, and
 * `DocumentMeta` in `src/components/shell.tsx` writes all three again on every navigation from
 * `surfaceMeta('aetherholm')`. That is deliberate and it is not redundancy: this is a
 * single-page application with one HTML file, the runtime layer is what a browser and the
 * crawlers that execute JavaScript see, and the STATIC tags are what the link-preview fetchers
 * used by chat clients get — those generally do not run scripts. Neither copy can be deleted.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * AND WHY THAT NEEDS A TEST
 *
 * Because the estate has already paid for this exact drift once. `@cloudsforge/ui/seo` opens by
 * recording it: `site/index.html`'s description disagreed with its application's for as long as
 * it took somebody to open the served HTML rather than the rendered page, and every search result
 * in between carried a sentence the owner had asked to have removed. Two copies of a string can
 * only agree by somebody remembering, so this file is the mechanism instead — the shell's tags are
 * treated as GENERATED OUTPUT that happens to live in an HTML file.
 *
 * This surface had that drift in miniature on the day this was written: the `description` and the
 * `og:description` in the same file were two DIFFERENT sentences about the same game, so a search
 * engine and a chat client were told different things by one document.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { surfaceMeta } from '@cloudsforge/ui/seo'
import { NAV, ROUTES } from '../src/lib/routes.ts'
import { PRODUCT, SURFACE } from '../src/lib/hosts.ts'

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

/** A meta tag's content, by `name=` or `property=`, whichever this tag uses. */
function meta(kind: 'name' | 'property', key: string): string {
  const pattern = new RegExp(
    `<meta\\s+${kind}="${key}"\\s+content="([^"]*)"|<meta\\s*\\n\\s*${kind}="${key}"\\s*\\n\\s*content="([^"]*)"`,
  )
  const found = pattern.exec(HTML)
  assert.ok(found, `index.html has no <meta ${kind}="${key}">`)
  return found[1] ?? found[2] ?? ''
}

const REGISTRY = surfaceMeta(SURFACE, {})

describe('the surface key the head is derived from', () => {
  it('is the title’s own row, not the platform it is played through', () => {
    /*
     * THE ONE DECISION IN THIS WHOLE LAYER THAT IS EASY TO GET WRONG AND SILENT WHEN IT IS.
     *
     * `PRODUCT` is `worlds`, because the shared bar marks the platform a player plays THROUGH and
     * a title claims no switcher slot of its own. Handing that key to `surfaceMeta` — the obvious
     * thing to do, since it is the constant the shell already imports — would title every screen
     * of this game "Forge Worlds" and describe it with Forge Worlds' blurb. The page would render
     * perfectly; only the tab, the search result and the link preview would be wrong.
     */
    assert.equal(SURFACE, 'aetherholm')
    assert.equal(PRODUCT, 'worlds')
    assert.equal(REGISTRY.title, 'Aetherholm')
    assert.notEqual(surfaceMeta(PRODUCT, {}).title, REGISTRY.title)
    assert.notEqual(surfaceMeta(PRODUCT, {}).description, REGISTRY.description)
  })

  it('is the key the shell actually passes', () => {
    const shell = readFileSync(new URL('../src/components/shell.tsx', import.meta.url), 'utf8')
    assert.match(shell, /surfaceMeta\(SURFACE,/, 'the shell derives its head from another key')
  })
})

describe('the static tags in index.html', () => {
  it('carry the registry’s title, byte for byte', () => {
    const title = /<title>([^<]*)<\/title>/.exec(HTML)?.[1]
    assert.equal(title, REGISTRY.title)
  })

  it('carry the registry’s description, byte for byte', () => {
    assert.equal(meta('name', 'description'), REGISTRY.description)
  })

  it('say the same thing to a chat client as to a search engine', () => {
    // The drift that was live in this file: `description` and `og:description` were two different
    // sentences, and `applyHead` writes ONE into both on every navigation — so the shell and the
    // running page disagreed the moment React mounted.
    assert.equal(meta('property', 'og:description'), REGISTRY.description)
    assert.equal(meta('property', 'og:title'), REGISTRY.title)
  })

  it('name no hostname, so one bundle serves localhost, a preview and the apex', () => {
    for (const key of ['og:image'] as const) {
      assert.doesNotMatch(meta('property', key), /^https?:\/\//)
    }
    assert.equal(meta('property', 'og:image'), REGISTRY.image)
  })
})

describe('the analytics measurement ID, and the tag that must not be here', () => {
  it('is a meta tag rather than a build-time constant', () => {
    assert.match(HTML, /<meta name="cf-analytics" content="G-[A-Z0-9]{4,20}" \/>/)
  })

  it('is accompanied by NO third-party script tag anywhere in the shell', () => {
    /*
     * The whole point of `@cloudsforge/ui/consent`: the tag is injected from exactly one call
     * site, `grantConsent`, reachable only from the Accept button. A `<script src>` here would set
     * `_ga` on load — before the banner is drawn, let alone answered — which is an ePrivacy
     * Art. 5(3) violation that a banner underneath it does not cure.
     *
     * Checked as "no external script at all" rather than by naming the tag's domain, so that the
     * domain does not appear in this repository and a grep for it stays honest.
     */
    const external = [...HTML.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1] ?? '')
    assert.deepEqual(
      external.filter((src) => !src.startsWith('/')),
      [],
      'index.html loads a script from another origin',
    )
  })
})

describe('the per-address head', () => {
  it('reads its page names off the route table rather than typing them again', () => {
    // The shell composes `surfaceMeta(SURFACE, { title: route.nav, … })`. `nav` is the label the
    // navigation strip already renders, so a renamed screen is renamed in one place.
    for (const entry of NAV) {
      assert.ok(entry.nav !== null)
      assert.equal(surfaceMeta(SURFACE, { title: entry.nav }).title, `${entry.nav} — Aetherholm`)
    }
  })

  it('refuses a crawler on every gated address, and invites one on every public address', () => {
    /*
     * The directive is derived from `protected`, which the router already reads to place
     * `ProtectedRoute`. `nginx.conf`'s sitemap lists the exact complement; `test/sitemap.test.ts`
     * asserts the other half of the agreement.
     */
    const gated = ROUTES.filter((r) => r.protected)
    const open = ROUTES.filter((r) => !r.protected)
    assert.ok(gated.length === 4 && open.length === 2, 'the route table changed shape')
    for (const route of open) {
      assert.equal(
        surfaceMeta(SURFACE, { path: route.path }).robots,
        'index, follow, max-image-preview:large',
        `${route.path} is public and the registry would still refuse a crawler`,
      )
    }
  })
})
