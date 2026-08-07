/**
 * The sitemap and robots.txt nginx serves for this surface.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE BODIES ARE IN nginx.conf AT ALL
 *
 * A sitemap must carry ABSOLUTE URLs — the spec requires it and a crawler discards a relative
 * `<loc>` — and nothing built in this repository may name a hostname, because one image is served
 * from localhost, from a preview deployment and from the apex. `test/no-build-time-config.test.ts`
 * is the rule; this is the one document that cannot obey it and be useful at the same time.
 *
 * nginx is the component that can. It has `$host` on every request, so the addresses are composed
 * per request and the artefact stays environment-free.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * AND WHY THIS SURFACE DOES NOT USE `sitemapXml()` FROM THE DESIGN SYSTEM
 *
 * THE SHARED GENERATOR IS FOR THE APEX. It composes each sibling surface as `<subdomain>.$host`,
 * which is right on the marketing site, where `$host` IS the apex. Here `$host` is already
 * `aetherholm.<apex>`, so the same call would emit `worlds.aetherholm.<apex>` — the two-label
 * shape `@cloudsforge/ui/surfaces.ts` records at length as unreachable, because the edge's
 * Universal SSL is a one-label wildcard and every two-label name fails the handshake.
 *
 * So this surface publishes ITS OWN public routes, derived from the same `ROUTES` table the
 * navigation, the router and nginx's enumerated locations all come from — and `robots.txt`, which
 * has no such problem, IS generated from the design system and compared byte for byte.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * AND WHY EITHER NEEDS A TEST
 *
 * A body pasted into a config file is a copy, and this estate has been bitten by exactly one of
 * those: `site/index.html`'s title drifted from its application's, the suite stayed green, and
 * every search result carried a sentence the owner had asked to have removed until somebody opened
 * the served HTML rather than the page. The block is therefore treated as GENERATED OUTPUT that
 * happens to live in a config file.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { ENV_LABELS } from '@cloudsforge/ui'
import { robotsTxt } from '@cloudsforge/ui/sitemap'
import { ROUTES } from '../src/lib/routes.ts'

const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8')

/**
 * Every address of this surface a crawler should be handed, DERIVED rather than restated.
 *
 * `protected` is the field that decides it, and it is already on every route because
 * `src/app.tsx` reads it to place `ProtectedRoute`. A gated address answers a visitor without a
 * session by sending them to hub's login, so listing one in a sitemap hands a crawler a redirect
 * to a wall — the "dead URL" failure the module header above is about, in its politest form.
 *
 * On this surface that leaves `/battles` and `/chronicle`: a sealed season is public history
 * anyone may read (`aetherholm/src/server.ts`) and a sealed battle report opens without a
 * session (`aetherholm/src/server.ts`). Which SEASON and which BATTLE are query strings on
 * those two addresses — one per report, minted by the service — and an unbounded family of them
 * pasted into a config file would be stale the moment a fleet launched.
 */
const PUBLIC_PATHS: readonly string[] = ROUTES.filter((r) => !r.protected).map((r) => r.path)

/** The single-quoted body of a `return 200 '…';` inside an exact-match location. */
function servedBody(path: string): string {
  const block = new RegExp(`location = ${path.replace('.', '\\.')} \\{([\\s\\S]*?)\\n    \\}`).exec(
    nginx,
  )
  assert.ok(block, `nginx.conf has no exact-match location for ${path}`)
  // Anchored to a `return` at the start of its own line: `/robots.txt` also carries a CONDITIONAL
  // `if ($cf_env) { return 200 '…'; }` above it, and a regex that took the first match would read
  // the non-mainnet body and report the mainnet one as drifted.
  const body = /\n {8}return 200 '([\s\S]*?)';/.exec(block[1] ?? '')
  assert.ok(body, `the ${path} location does not return an unconditional literal body`)
  return body[1] ?? ''
}

describe('the sitemap nginx serves', () => {
  it('names no hostname — every address is composed from $host', () => {
    /*
     * THE ASSERTION THAT KEEPS THE ARTEFACT ENVIRONMENT-FREE, and the reason a document with
     * absolute URLs in it is allowed here at all. A single literal apex would make the image wrong
     * on a preview deployment and on testnet, silently, in the one document a crawler treats as
     * authoritative.
     */
    const xml = servedBody('/sitemap.xml')
    assert.ok(!xml.includes('cloudsforge.online'), 'the sitemap names the production apex')
    assert.ok(!xml.includes('localhost'), 'the sitemap names localhost')
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? '')
    assert.ok(locs.length > 0, 'the sitemap lists nothing at all')
    for (const loc of locs) {
      // No subdomain is composed here, unlike the apex's sitemap: `$host` IS this surface.
      assert.match(loc, /^\$scheme:\/\/\$host(\/|$)/, `a <loc> is not composed: ${loc}`)
    }
  })

  it('lists every PUBLIC route this surface offers, so a crawler is not left to guess', () => {
    const xml = servedBody('/sitemap.xml')
    for (const path of PUBLIC_PATHS) {
      const address = path === '/' ? '$scheme://$host' : `$scheme://$host${path}`
      assert.ok(xml.includes(`<loc>${address}</loc>`), `${path} is missing from the sitemap`)
    }
  })

  it('lists nothing else, and in particular not one gated screen', () => {
    // The other direction, and the one that matters more. A sitemap entry for /cities is an
    // invitation to an address that answers a stranger with a redirect to somebody else's login.
    const xml = servedBody('/sitemap.xml')
    const listed = [...xml.matchAll(/<loc>\$scheme:\/\/\$host([^<]*)<\/loc>/g)].map((m) =>
      m[1] === '' ? '/' : (m[1] ?? ''),
    )
    assert.deepEqual([...listed].sort(), [...PUBLIC_PATHS].sort())
    for (const gated of ROUTES.filter((r) => r.protected)) {
      assert.ok(!xml.includes(`>${gated.path}<`), `the sitemap lists the gated ${gated.path}`)
    }
  })

  it('agrees with the shell about which addresses a crawler is invited to', () => {
    /*
     * A sitemap is an INVITATION and a robots meta tag is an INSTRUCTION, and the two must never
     * disagree: an address that is listed here and marked `noindex` in the head is this repository
     * contradicting itself in public. `DocumentMeta` in src/components/shell.tsx derives the
     * directive from the same `protected` field this file derives the list from — asserted here by
     * reading that file, so that a future edit which hard-codes the rule in one place goes red.
     */
    const shell = readFileSync(new URL('../src/components/shell.tsx', import.meta.url), 'utf8')
    assert.match(shell, /!route\.protected/, 'the shell no longer derives robots from `protected`')
    assert.match(shell, /'noindex, nofollow'/, 'the shell emits no noindex directive at all')
  })

  it('is a well-formed urlset in the only schema crawlers implement', () => {
    const xml = servedBody('/sitemap.xml')
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/)
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    assert.match(xml, /<\/urlset>$/)
  })

  it('is served as XML, because a sitemap sent as text/html is a sitemap nobody reads', () => {
    // `types { }` as well as `default_type`: without emptying the table for this location, nginx
    // maps the `.xml` in the URI to `text/xml` from its own mime types and `default_type` never
    // applies.
    assert.match(
      nginx,
      /location = \/sitemap\.xml \{[\s\S]*?types \{ \}[\s\S]*?default_type application\/xml;/,
    )
  })

  it('is derived from the route table rather than typed a fifth time', () => {
    // `src/lib/routes.ts` already decides the router, the navigation and nginx's enumerated
    // locations. This asserts the derivation above is real: the two public routes appear and the
    // four gated ones stay out, by virtue of a field the router already reads.
    assert.deepEqual([...PUBLIC_PATHS].sort(), ['/battles', '/chronicle'])
    assert.deepEqual(
      ROUTES.filter((r) => r.protected).map((r) => r.path).sort(),
      ['/', '/alliance', '/cities', '/fleets'],
    )
  })
})

describe('an environment that is not mainnet', () => {
  /**
   * The `map` that decides it, and the alternation of labels inside it.
   *
   * A testnet Aetherholm runs test seasons on a database somebody is free to wipe. Indexed beside
   * the real game, its sealed chronicles are histories that never happened, and nothing on the
   * page says so.
   */
  function alternation(): string[] {
    const map = /map \$host \$cf_env \{[\s\S]*?~\^[^\n]*?\(\?:([^)]*)\)\\\./.exec(nginx)
    assert.ok(map, 'the $cf_env map is missing from nginx.conf')
    return (map[1] ?? '').split('|')
  }

  it('recognises exactly the labels the registry reserves', () => {
    /*
     * ENV_LABELS is the estate's single list — `deploy/scripts/check-apex-prefix.py` reads the
     * same export. An alternation here that had drifted from it would either miss an environment
     * (and index it) or refuse a surface (and de-index a real one), and both fail silently.
     */
    assert.deepEqual(alternation().sort(), [...ENV_LABELS].sort())
  })

  it('refuses every crawler and serves no sitemap', () => {
    // Both halves matter and neither is sufficient: robots.txt stops the fetch, and a sitemap that
    // still answered would be an invitation contradicting the instruction beside it.
    assert.match(nginx, /if \(\$cf_env\) \{ return 200 'User-agent: \*\\nDisallow: \/\\n'; \}/)
    assert.match(nginx, /location = \/sitemap\.xml \{[\s\S]*?if \(\$cf_env\) \{ return 404; \}/)
  })

  it('matches a suffixed subdomain as well as a bare environment apex', () => {
    // The environment is a SUFFIX on the first label now (`aetherholm-testnet.`) and was an apex
    // prefix (`testnet.`) before. Both shapes still resolve — surfaces.ts keeps the old one
    // deliberately — so the pattern has to catch both or half the estate stays indexable.
    const map = /map \$host \$cf_env \{[\s\S]*?\n\}/.exec(nginx)
    assert.ok(map, 'the $cf_env map is missing')
    assert.match(map[0], /\(\?:\[\^\.\]\+-\)\?/, 'the map does not allow a suffixed subdomain')
  })
})

describe('robots.txt', () => {
  it('is exactly what the design system generates', () => {
    // Compared with its trailing newline intact: robots.txt is a line-oriented format and a parser
    // that reads the last line only when it is terminated is a parser that silently loses the
    // Sitemap directive.
    assert.equal(
      servedBody('/robots.txt'),
      robotsTxt({ indexable: true, sitemapUrl: '$scheme://$host/sitemap.xml' }),
    )
  })

  it('points at the sitemap with an absolute address, composed rather than typed', () => {
    // A relative `Sitemap:` line is invalid per the standard and is ignored; a literal one bakes in
    // a hostname. `$scheme://$host` is the only form that is both valid and environment-free.
    assert.match(servedBody('/robots.txt'), /^Sitemap: \$scheme:\/\/\$host\/sitemap\.xml$/m)
  })

  it('does not try to disallow the gated routes, which is the head’s job', () => {
    /*
     * `Disallow: /cities` here would publish the shape of the game's private surface in a file
     * written to be read by anyone, and would additionally stop a crawler from following the
     * chronicle's own links. The refusal is a `noindex` in the document head, where it stops the
     * INDEXING rather than the fetch. Both mechanisms exist; using the wrong one is how an
     * operator console ends up advertised by the file meant to hide it.
     */
    const body = servedBody('/robots.txt')
    for (const gated of ROUTES.filter((r) => r.protected && r.path !== '/')) {
      assert.ok(!body.includes(gated.path), `robots.txt names the gated ${gated.path}`)
    }
  })

  it('is not a static file, which an exact-match location would have shadowed', () => {
    /*
     * `location = /robots.txt` wins over the `location /` prefix that serves the static tree, so a
     * file in `public/` would be deployed, unreachable, and edited by the next reader to no effect
     * — the worst of the three states, worse than either serving it or not having it.
     */
    for (const name of ['robots.txt', 'sitemap.xml']) {
      let present = true
      try {
        readFileSync(new URL(`../public/${name}`, import.meta.url))
      } catch {
        present = false
      }
      assert.equal(present, false, `public/${name} exists, and nginx will never serve it`)
    }
  })
})

describe('the security headers on the documents this file adds', () => {
  it('are repeated in both new locations, because add_header does not accumulate', () => {
    // A location that declares ANY add_header inherits NONE from the server level. Both blocks set
    // Cache-Control, so both have to restate the three security headers or ship without them.
    // `test/routes.test.ts` cannot see these two: its block regex stops at the first `}`, which
    // here is the one inside `types { }`.
    for (const path of ['/sitemap.xml', '/robots.txt']) {
      const block = new RegExp(
        `location = ${path.replace('.', '\\.')} \\{([\\s\\S]*?)\\n    \\}`,
      ).exec(nginx)
      assert.ok(block, `no location for ${path}`)
      const body = block[1] ?? ''
      assert.match(body, /X-Content-Type-Options "nosniff"/)
      assert.match(body, /X-Frame-Options "SAMEORIGIN"/)
      assert.match(body, /Referrer-Policy "strict-origin-when-cross-origin"/)
    }
  })

  it('are repeated in /assets/ and /art/ too, the locations that serve the code and the art', () => {
    for (const prefix of ['/assets/', '/art/']) {
      const block = new RegExp(`location ${prefix} \\{([\\s\\S]*?)\\n    \\}`).exec(nginx)
      assert.ok(block, `no ${prefix} location`)
      assert.match(block[1] ?? '', /X-Content-Type-Options "nosniff"/)
    }
  })
})
