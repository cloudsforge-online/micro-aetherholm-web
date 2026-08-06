/**
 * EVERY `--cf-*` AND EVERY `cf-` CLASS THIS APP NAMES IS DEFINED BY THE DESIGN SYSTEM.
 *
 * Copied from `micro-explorer-web/test/tokens.test.ts` INCLUDING its class-existence half, which
 * is the part the estate learnt last: an undefined custom property invalidates its whole
 * declaration silently (`micro-mint-web` ships ten of them across 72 declarations), and a class
 * the design system does not declare — `.cf-btn--primary`, which does not exist; the one solid
 * call to action is `.cf-btn--ember` — fails exactly as quietly, rendering browser chrome on a
 * dark substrate with nothing reported anywhere.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const at = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url))

/**
 * The stylesheet with its comments stripped: the file's own header names the classes it must not
 * invent, in order to explain why, and a scan over the raw text would fail the explanation.
 */
const CSS = readFileSync(at('src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Where a micro-ui checkout is, in the order CI and a developer's machine put it. */
const UI_ROOT = [process.env['CLOUDSFORGE_UI_DIR'], at('../ui')]
  .filter((v): v is string => Boolean(v))
  .find((p) => existsSync(`${p}/packages/ui/src/tokens.css`))

/** Every `--cf-*` the stylesheet READS. */
function referenced(): string[] {
  return [...new Set([...CSS.matchAll(/var\((--cf-[a-z0-9-]+)/g)].map((m) => m[1] ?? ''))].sort()
}

/** Every `cf-`-prefixed class name this bundle puts in a `className` or a stylesheet selector. */
function classesUsed(): string[] {
  const found = new Set<string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (extname(entry.name) === '.tsx' || extname(entry.name) === '.ts') {
        const text = readFileSync(full, 'utf8')
        for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          for (const cls of `${m[1] ?? ''} ${m[2] ?? ''}`.split(/[\s${}]+/)) {
            if (cls.startsWith('cf-')) found.add(cls)
          }
        }
      }
    }
  }
  walk(at('src'))
  // …and any `cf-` class this stylesheet tries to restyle, which would be the same mistake with
  // the arrow pointing the other way.
  for (const m of CSS.matchAll(/\.(cf-[a-z0-9_-]+)/g)) found.add(m[1] ?? '')
  return [...found].sort()
}

describe('the stylesheet names only tokens that exist', () => {
  it('references a real number of them, so this cannot pass on an empty match', () => {
    assert.ok(referenced().length >= 20, `found ${referenced().length} token references`)
  })

  if (UI_ROOT === undefined) {
    it('SKIPPED: no micro-ui checkout — CI checks one out and requires this to run', () => {
      assert.ok(true)
    })
  } else {
    const tokens = readFileSync(`${UI_ROOT}/packages/ui/src/tokens.css`, 'utf8')
    const ui = readFileSync(`${UI_ROOT}/packages/ui/src/ui.css`, 'utf8')
    const defined = new Set(
      [...tokens.matchAll(/^\s*(--cf-[a-z0-9-]+)\s*:/gm)].map((m) => m[1] ?? ''),
    )

    it('reads a tokens file with tokens in it', () => {
      assert.ok(defined.size >= 60, `found ${defined.size} definitions in tokens.css`)
    })

    it('every property this stylesheet reads is declared by the design system', () => {
      const undefinedOnes = referenced().filter((name) => !defined.has(name))
      assert.deepEqual(
        undefinedOnes,
        [],
        `src/styles.css reads ${undefinedOnes.join(', ')}, which tokens.css does not define. ` +
          'An undefined custom property invalidates the whole declaration.',
      )
    })

    it('names none of the ten properties micro-mint-web invented', () => {
      const KNOWN_BAD = [
        '--cf-border',
        '--cf-radius-md',
        '--cf-space-1',
        '--cf-space-2',
        '--cf-space-3',
        '--cf-space-4',
        '--cf-space-5',
        '--cf-status-good',
        '--cf-status-warn',
        '--cf-status-crit',
      ]
      for (const bad of KNOWN_BAD) {
        // Boundary-aware: a plain `includes('var(--cf-space-2')` also matches the REAL
        // `var(--cf-space-2xl)`, and a test that fails on a correct token is a test somebody
        // deletes.
        assert.doesNotMatch(
          CSS,
          new RegExp(`var\\(${bad}(?![a-z0-9-])`),
          `src/styles.css uses ${bad}, which does not exist.`,
        )
        assert.ok(!defined.has(bad), `${bad} now exists upstream; this test is out of date`)
      }
    })

    it('the wrong names are not tokens, and the real ones are', () => {
      /*
       * `--cf-critical` WAS ON THIS LIST AND HAS BEEN TAKEN OFF IT, WHICH IS THE INTERESTING PART.
       *
       * This assertion is the guard the list at the top of the file needs: a name asserted to be
       * a typo, which then becomes real upstream, turns every "do not use it" comment in this
       * repository into a lie nobody re-reads. It fired for exactly that reason.
       * @cloudsforge/ui 1.1 introduced a full severity ramp — `--cf-good`/`--cf-warn`/
       * `--cf-critical`, each with an `-ink` step for text laid ON the fill and a `-text` step for
       * the fill's colour used as WORDS — and `--cf-critical` is now the 3:1 fill, defined at
       * `ui/packages/ui/src/tokens.css:360`. So it moved from the wrong list to the right one, and
       * its `-text` sibling moved with it.
       *
       * `--cf-border`, `--cf-warning` and `--cf-font` are still typos and still guarded: they are
       * the three shapes a person reaches for when the real names are `--cf-line`, `--cf-warn` and
       * `--cf-font-sans`.
       */
      for (const wrong of ['--cf-border', '--cf-warning', '--cf-font']) {
        assert.ok(!defined.has(wrong), `${wrong} is defined after all; this comment is wrong`)
      }
      for (const right of [
        '--cf-line',
        '--cf-line-strong',
        '--cf-danger',
        '--cf-warn',
        '--cf-success',
        '--cf-font-sans',
        // The 1.1 text steps. `--cf-accent` is validated at 3:1 (a border or a fill) and these are
        // the 4.5:1 ones this stylesheet now uses for every `color:` — see its header.
        '--cf-accent-text',
        '--cf-warn-text',
        '--cf-critical-text',
        '--cf-critical',
      ]) {
        assert.ok(defined.has(right), `${right} is not defined; the stylesheet is built on it`)
      }
    })

    it('spends the accent ramp the way the design system validated it', () => {
      /*
       * THE HALF OF THE 1.1 SPLIT A TOKEN-EXISTENCE CHECK CANNOT SEE. `--cf-accent` and
       * `--cf-accent-text` are both defined, so a stylesheet using the first as a text colour
       * passes every assertion above while rendering Worlds' green at 3.11:1 on this substrate —
       * under the floor, and looking entirely deliberate.
       *
       * So: no `color:` declaration may name the fill step. Borders, fills, strokes and outlines
       * still may, and do.
       */
      const misuse = [...CSS.matchAll(/(?:^|[;{])\s*color:\s*var\((--cf-[a-z0-9-]+)\)/g)]
        .map((m) => m[1] ?? '')
        .filter((token) => ['--cf-accent', '--cf-warn', '--cf-good', '--cf-critical'].includes(token))
      assert.deepEqual(
        [...new Set(misuse)],
        [],
        'a `color:` uses a 3:1 fill step; the 4.5:1 text step is the same name with `-text`.',
      )
    })

    /* ── the class-existence half ─────────────────────────────────────────────────────────── */

    it('every cf- CLASS this bundle names is declared by the design system', () => {
      const declared = new Set([...ui.matchAll(/\.(cf-[a-z0-9_-]+)/g)].map((m) => m[1] ?? ''))
      const used = classesUsed()
      assert.ok(used.length >= 3, `found ${used.length} cf- classes, which is too few to be right`)
      const missing = used.filter((cls) => !declared.has(cls))
      assert.deepEqual(
        missing,
        [],
        `this bundle uses ${missing.join(', ')}, which ui.css does not declare. ` +
          'A class the design system does not have fails as silently as a token it does not have.',
      )
    })

    it('the shared form controls exist and no local copy shadows them', () => {
      const declared = new Set([...ui.matchAll(/\.(cf-[a-z0-9_-]+)/g)].map((m) => m[1] ?? ''))
      for (const present of ['cf-input', 'cf-select', 'cf-input--mono', 'cf-select--mono']) {
        assert.ok(declared.has(present), `.${present} is missing from ui.css`)
      }
      assert.ok(declared.has('cf-btn'), '.cf-btn is gone; the buttons on this surface are unstyled')
      assert.ok(declared.has('cf-btn--ember'), '.cf-btn--ember is gone')

      // Still absent, and should stay so: `.cf-btn--ember` IS the one solid call to action, and
      // a second name for one thing is how a design system starts to drift.
      assert.ok(!declared.has('cf-btn--primary'), 'use .cf-btn--ember, not a second name for it')

      // No private form control alongside the shared ones: the whole point of cf-input existing
      // is that this file does not invent ah-input.
      assert.doesNotMatch(CSS, /\.ah-input\b/, 'a local form control shadows .cf-input')
      assert.doesNotMatch(CSS, /\.ah-select\b/, 'a local form control shadows .cf-select')
      assert.doesNotMatch(CSS, /\.ah-btn\b/, 'a local button shadows .cf-btn')
    })
  }
})

describe('no hard-coded colour, including one hiding in a fallback', () => {
  it('declares no hex literal', () => {
    const hexes = [...CSS.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])
    assert.deepEqual(hexes, [], `src/styles.css hard-codes ${hexes.join(', ')}`)
  })

  it('declares no rgb/rgba/hsl literal', () => {
    const fns = [...CSS.matchAll(/\b(rgba?|hsla?)\(/g)].map((m) => m[0])
    assert.deepEqual(fns, [], `src/styles.css hard-codes ${fns.join(', ')}`)
  })

  it('uses no var() fallback at all, because a fallback is where a literal hides', () => {
    const fallbacks = [...CSS.matchAll(/var\(--cf-[a-z0-9-]+\s*,/g)].map((m) => m[0])
    assert.deepEqual(fallbacks, [], `src/styles.css uses a var() fallback: ${fallbacks.join(', ')}`)
  })
})
