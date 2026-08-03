/**
 * EVERY `path:line` IN THIS REPOSITORY NAMES A LINE THAT EXISTS.
 *
 * `test/aetherholm.test.ts` proves the ROUTE citations are exactly right — it reads the handler
 * at each cited line and matches its `define(...)` and its mechanism. That is the strong check,
 * and it covers twenty-seven routes. This repository carries many other citations: into
 * `aetherholm`'s domain files (`fleets.ts`, `economy.ts`, `content.ts`, `migrations.ts`,
 * `sealing.ts`, `env.ts`), the registry (`ui/packages/ui/src/surfaces.ts`), identity, and
 * worlds' title client.
 *
 * A citation is the estate's unit of evidence and it decays silently — a file grows or shrinks
 * under a line number nobody re-read. This sweep is the cheap, total check under the strong,
 * narrow one. It cannot tell whether a citation MEANS what the sentence around it says; what it
 * catches is the failure that actually happens. When a sibling is not checked out, its citations
 * are REPORTED as unchecked rather than passed over in silence, and CI — where every sibling IS
 * checked out — makes an UNCHECKED line fatal.
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

/** A citation: a repository-relative path, a colon, and one line number or a range. */
const CITATION = /\b((?:[a-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:ts|tsx|css|yml|md))\/?:(\d+)(?:-(\d+))?/g

interface Citation {
  readonly from: string
  readonly path: string
  readonly first: number
  readonly last: number
}

function collect(): Citation[] {
  const out: Citation[] = []
  for (const file of sourceFiles(here)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CITATION)) {
      const path = m[1] ?? ''
      const first = Number(m[2])
      out.push({ from: relative(here, file), path, first, last: m[3] ? Number(m[3]) : first })
    }
  }
  return out
}

/** Resolve a citation's path to a file on disk, or null when its repository is not checked out. */
function resolve(path: string): string | null {
  const [head, ...rest] = path.split('/')
  const root = siblingRoot(head ?? '')
  if (root === undefined) {
    // Not a sibling: a path inside THIS repository.
    const local = join(here, path)
    return existsSync(local) ? local : null
  }
  if (!existsSync(root)) return null
  const full = join(root, rest.join('/'))
  return existsSync(full) ? full : null
}

const CITATIONS = collect()

describe('every citation names a line that exists', () => {
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

  it('names a line INSIDE that file', () => {
    const broken: string[] = []
    for (const c of CITATIONS) {
      const file = resolve(c.path)
      if (file === null) continue
      if (!statSync(file).isFile()) continue
      const lineCount = readFileSync(file, 'utf8').split('\n').length
      if (c.first < 1 || c.last > lineCount || c.last < c.first) {
        broken.push(`${c.from} cites ${c.path}:${c.first}-${c.last}, but that file has ${lineCount} lines`)
      }
    }
    assert.deepEqual(broken, [])
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
