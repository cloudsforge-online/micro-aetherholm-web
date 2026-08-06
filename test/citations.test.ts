/**
 * EVERY CITATION IN THIS REPOSITORY NAMES A FILE THAT EXISTS, AND NAMES NO LINE.
 *
 * `test/aetherholm.test.ts` proves the ROUTE citations are exactly right — it finds each route's
 * `define(...)` in the service and checks its mechanism. That is the strong check, and it covers
 * twenty-seven routes. This repository carries many other citations: into `aetherholm`'s domain
 * files (`fleets.ts`, `economy.ts`, `content.ts`, `migrations.ts`, `sealing.ts`, `env.ts`), the
 * registry (`ui/packages/ui/src/surfaces.ts`), identity, and worlds' title client.
 *
 * This file used to check that each cited line was IN RANGE. That was the wrong property to
 * enforce, because a line number names a position in a file another repository owns and is free to
 * edit: micro-identity gained email verification and password reset, `/auth/me` moved, and every
 * citation to it across the estate broke while nothing in any client was wrong. Nothing runs a
 * frontend's suite when a service changes, so it surfaced during a release — seven of nineteen CI
 * failures in one day were this one shape.
 *
 * So the rule is now the opposite, and it is ENFORCED rather than described: a citation names a
 * file, and carrying a line number is itself the failure. Cite the file and, if a reader needs the
 * exact place, name the SYMBOL — `queueRoute()`, `verifyEventSignature` — which moves with the
 * code. When a sibling is not checked out, its citations are REPORTED as unchecked rather than
 * passed over in silence, and CI — where every sibling IS checked out — makes that fatal.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const here = fileURLToPath(new URL('..', import.meta.url))

/**
 * Every sibling repository a citation in this repository reaches into. Enumerated rather than
 * globbed: a citation into a repository nobody listed here would otherwise resolve as a local
 * path, fail to exist, and be reported as broken — or a repository added later would go silently
 * unchecked. The estate checks each `micro-<name>` out as `<name>`; both spellings resolve to
 * the same directory.
 */
const SIBLINGS: readonly string[] = [
  'aetherholm',
  'ui',
  'identity',
  'worlds',
  'contracts',
  // The browser telemetry sink. `src/lib/obs.ts` cites its record shape — `fromWire`, `RUM_KINDS`
  // and the migration's CHECK constraint — because that contract is the reason every event this
  // bundle sent was silently discarded, and a contract quoted from memory is how it went wrong.
  'lantern',
  // The estate's own tooling. `.github/workflows/ci.yml` cites `org/tools/registry.ts` for how a
  // release manifest derives this repository's image name and `org/tools/cfctl.ts` for the
  // generator and the `--verify` gate, because the `publish` job exists to satisfy them. Without
  // this entry those three citations were read as paths inside THIS repository and reported
  // missing — the same list micro-trade-web, micro-explorer-web, micro-network-site and
  // micro-devportal-web already carry `org` in.
  'org',
]

/** Where a sibling is checked out. `micro-aetherholm` and `aetherholm` are the same directory. */
function siblingRoot(name: string): string | undefined {
  const bare = name.startsWith('micro-') ? name.slice('micro-'.length) : name
  if (!SIBLINGS.includes(bare)) return undefined
  if (bare === 'aetherholm') {
    const configured = process.env['CLOUDSFORGE_AETHERHOLM_DIR']
    // The env var names the server FILE, for the route test. Its repository is two levels up.
    if (configured) return join(configured, '../..')
    return join(here, '../aetherholm')
  }
  if (bare === 'ui') {
    const configured = process.env['CLOUDSFORGE_UI_DIR']
    if (configured) return configured
  }
  return join(here, `../${bare}`)
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.md', '.yml', '.html'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) out.push(full)
  }
  return out
}

/**
 * A citation: a repository-relative path to a file. NO LINE NUMBER.
 *
 * It used to require one, and requiring one is what this file is now the record of.
 *
 * The lookbehind is what keeps a RELATIVE MODULE SPECIFIER out of the sweep. Without it
 * `'../../src/content/pages.ts'` — an illustration inside a comment in test/journeys/scenario.ts —
 * matched from `src` onward and was reported as a citation to a directory this repository does not
 * have. A citation is rooted at a repository name or at the top of this one; a path that begins
 * `./` or `../` is a module reference TypeScript already resolves.
 */
const CITATION = /(?<![\w./\\-])((?:[a-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|css|yml|md))\b/g

/** The same citation with a line number stuck to it — the thing this file now FORBIDS. */
const CITATION_WITH_LINE = /\b((?:[a-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|css|yml|md))\/?:(\d+)(?:-(\d+))?/g

interface Citation {
  readonly from: string
  readonly path: string
}

/**
 * Directories inside THIS repository that a citation may be rooted at.
 *
 * Without this the sweep matches every relative import (`lib/routes.ts`), every package specifier
 * (`@cloudsforge/ui/tokens.css`) and every URL that happens to end in a source extension, and then
 * reports all of them as citations to files that do not exist. A citation is rooted either at a
 * sibling repository or at the top of this one; anything else is a module reference, which
 * TypeScript already resolves and does not need a second, worse checker.
 */
const LOCAL_ROOTS: readonly string[] = ['src', 'test', 'public', 'scripts', '.github']

/**
 * `docs/` is the ESTATE's, not this repository's. The ecosystem documents live one level up beside
 * every repository, so a citation to `docs/ecosystem/…` resolves there or nowhere.
 */
const ESTATE_ROOTS: readonly string[] = ['docs']

function collect(): Citation[] {
  const out: Citation[] = []
  for (const file of sourceFiles(here)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CITATION)) {
      const path = m[1] ?? ''
      const head = path.split('/')[0] ?? ''
      const bare = head.startsWith('micro-') ? head.slice('micro-'.length) : head
      if (!SIBLINGS.includes(bare) && !LOCAL_ROOTS.includes(head) && !ESTATE_ROOTS.includes(head))
        continue
      out.push({ from: relative(here, file), path })
    }
  }
  return out
}

/** Resolve a citation's path to a file on disk, or null when its repository is not checked out. */
function resolve(path: string): string | null {
  const [head, ...rest] = path.split('/')
  const root = siblingRoot(head ?? '')
  if (root === undefined) {
    if (ESTATE_ROOTS.includes(head ?? '')) {
      const estate = join(here, '..', path)
      return existsSync(estate) ? estate : null
    }
    // Not a sibling: a path inside THIS repository.
    const local = join(here, path)
    return existsSync(local) ? local : null
  }
  if (!existsSync(root)) return null
  const full = join(root, rest.join('/'))
  return existsSync(full) ? full : null
}

const CITATIONS = collect()

describe('every citation names a file that exists', () => {
  it('finds citations at all, so this cannot pass on an empty sweep', () => {
    // A regex that stopped matching would make this whole file a no-op that reads as a
    // guarantee.
    assert.ok(CITATIONS.length >= 80, `found only ${CITATIONS.length} citations`)
  })

  it('cites more than one repository, because a client that only cites itself proves nothing', () => {
    const repos = new Set(CITATIONS.map((c) => c.path.split('/')[0]))
    assert.ok(repos.size >= 3, `citations reach only ${[...repos].join(', ')}`)
  })

  it('names a file that exists, wherever the repository is checked out', () => {
    const missing = CITATIONS.filter((c) => {
      const root = siblingRoot(c.path.split('/')[0] ?? '')
      // A sibling that is not checked out is UNCHECKED, not broken. Reported below.
      if (root !== undefined && !existsSync(root)) return false
      return resolve(c.path) === null
    })
    assert.deepEqual(
      missing.map((c) => `${c.from} cites ${c.path}, which does not exist`),
      [],
    )
  })

  it('names a FILE and not a directory, so a citation always points at readable bytes', () => {
    const notFiles: string[] = []
    for (const c of CITATIONS) {
      const file = resolve(c.path)
      if (file === null) continue
      if (!statSync(file).isFile()) notFiles.push(`${c.from} cites ${c.path}, which is not a file`)
    }
    assert.deepEqual(notFiles, [])
  })

  it('carries no line numbers, because a line number in another repository cannot be kept true', () => {
    // The rule, enforced rather than described. A service path with a line stuck to it is a claim
    // about a file this repository does not own and does not watch; it goes stale silently and then
    // fails a
    // build that has nothing to do with it. Cite the file and, if a reader needs the exact place,
    // name the symbol — `queueRoute()`, `verifyEventSignature` — which moves with the code.
    const withLines: string[] = []
    for (const file of sourceFiles(here)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(CITATION_WITH_LINE)) {
        withLines.push(`${relative(here, file)} cites ${m[1]}:${m[2]} — cite the file or the symbol`)
      }
    }
    assert.deepEqual(withLines, [])
  })

  it('reports which repositories were NOT available, rather than passing quietly', () => {
    // Not a failure: `pnpm test` has to work for somebody who cloned only this repository. But
    // an unmeasured citation must never look like a verified one, so the absence is printed and
    // the CI job that has every sibling checked out is where it becomes fatal.
    const absent = SIBLINGS.filter((name) => {
      const root = siblingRoot(name)
      return root === undefined || !existsSync(root)
    })
    if (absent.length > 0) {
      console.log(`UNCHECKED: citations into ${absent.join(', ')} — those repositories are not checked out`)
    }
    assert.ok(true)
  })
})
