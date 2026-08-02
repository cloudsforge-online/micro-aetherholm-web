/**
 * The rule this template exists to keep: NOTHING IN THE BUNDLE KNOWS WHICH ENVIRONMENT IT IS IN.
 *
 * A `VITE_` variable is read at build time and frozen into the artefact. An artefact with an
 * environment frozen into it has to be rebuilt to be promoted, which means the thing that
 * reaches production is not the thing that passed CI — and the estate has already lost an
 * afternoon to a staging bundle serving production traffic against a staging API.
 *
 * COMMENTS ARE STRIPPED FIRST, because this repository's own prose names the thing it is denying
 * — the estate has hit a guard failing on its own rationale six times now. The rule is about
 * CODE.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Assembled rather than written out, so this file does not match its own search. */
const ENV_PREFIX = `VITE${'_'}`
const ENV_OBJECT = `import.meta${'.'}env`

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

describe('no build-time configuration', () => {
  const files = [...sourceFiles(join(root, 'src')), join(root, 'index.html')]

  it('finds source files to check', () => {
    assert.ok(files.length >= 10, `expected the source tree, found ${files.length} files`)
  })

  /** Source with its comments removed — line, block and HTML. See the header. */
  const code = (file: string): string =>
    readFileSync(file, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('no file references a build-time environment variable', () => {
    const offenders = files.filter((f) => code(f).includes(ENV_PREFIX)).map((f) => relative(root, f))
    assert.deepEqual(offenders, [], `these reference a ${ENV_PREFIX} variable: ${offenders.join(', ')}`)
  })

  it('no file reads the build-time env object', () => {
    const offenders = files.filter((f) => code(f).includes(ENV_OBJECT)).map((f) => relative(root, f))
    assert.deepEqual(offenders, [], `these read ${ENV_OBJECT}: ${offenders.join(', ')}`)
  })

  it('is stripping comments, not stripping everything', () => {
    // Without this, a `code()` that returned '' would make both assertions above pass for the
    // worst possible reason.
    const hostsFile = code(join(root, 'src/lib/hosts.ts'))
    assert.ok(hostsFile.includes('cloudsforgeHosts'), 'comment stripping ate the code')
    assert.ok(!hostsFile.includes('reads a build-time constant'), 'comment stripping left prose behind')
  })

  it('the Vite config defines no constants and reads no env prefix', () => {
    const config = readFileSync(join(root, 'vite.config.ts'), 'utf8')
    assert.equal(/^\s*define\s*:/m.test(config), false, 'vite.config.ts declares define')
    assert.equal(/^\s*envPrefix\s*:/m.test(config), false, 'vite.config.ts declares envPrefix')
  })

  it('there is no .env file to read one from', () => {
    const entries = readdirSync(root)
    const envFiles = entries.filter((e) => e === '.env' || e.startsWith('.env.'))
    assert.deepEqual(envFiles, [], `unexpected env files: ${envFiles.join(', ')}`)
  })
})
