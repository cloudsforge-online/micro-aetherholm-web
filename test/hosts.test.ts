/**
 * Host resolution, straight from the registry — and the proof this client needs no workaround.
 *
 * `micro-emberkin-web` shipped with a derivation layer because the registry had no entry for its
 * surface; the registry has since grown both titles, and this suite pins the fact this client
 * depends on: the `aetherholm` entry exists, resolves per environment, and its devPort is the
 * port the service actually binds — 4120, `aetherholm/src/env.ts:105`, pinned in
 * `ui/packages/ui/src/surfaces.ts:434`. That devPort class has been wrong three times in this
 * estate (foresight given beacon's port; emberkin briefly 3014; explorer briefly its own nginx
 * 8080), which is why the value is read out of the registry here rather than trusted.
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installWindow, removeWindow } from './browser-stubs.ts'
import { SURFACES } from '@cloudsforge/ui/surfaces'
import { apiBase, hosts, pageOrigin, PRODUCT } from '../src/lib/hosts.ts'

afterEach(() => {
  removeWindow()
})

describe('the registry entry this client resolves through', () => {
  it('exists, is a service surface, and pins devPort 4120 — the port micro-aetherholm binds', () => {
    const entry = SURFACES.find((s) => s.key === 'aetherholm')
    assert.ok(entry, 'the registry has no aetherholm entry; hosts.ts would need emberkin’s old derivation')
    assert.equal(entry.subdomain, 'aetherholm')
    assert.equal(entry.devPort, 4120)
  })

  it('marks the title as no product of its own: worlds is the switcher entry', () => {
    const entry = SURFACES.find((s) => s.key === 'aetherholm')
    assert.equal(entry?.inSwitcher, false)
    assert.equal(PRODUCT, 'worlds')
  })

  it('wears Worlds’ accent, as a title does', () => {
    const title = SURFACES.find((s) => s.key === 'aetherholm')
    const emberkin = SURFACES.find((s) => s.key === 'emberkin')
    // Both titles carry the same borrowed colour; neither claims its own.
    assert.equal(title?.accent, emberkin?.accent)
  })
})

describe('apiBase', () => {
  beforeEach(() => {
    installWindow('http://localhost:5171/chronicle')
  })

  it('is the service on localhost, NOT the page origin', () => {
    // The page is on 5171 and the service on 4120. A relative URL would hit the static file
    // server, which is what the template's own apiBase() would have produced.
    assert.equal(apiBase(), 'http://localhost:4120')
  })

  it('is never the empty string', () => {
    assert.notEqual(apiBase(), '')
  })

  it('uses the subdomain in production', () => {
    removeWindow()
    installWindow('https://aetherholm.example.com/fleets')
    assert.equal(apiBase(), 'https://aetherholm.example.com')
  })

  it('resolves the same host when the page is served from another estate surface', () => {
    removeWindow()
    installWindow('https://worlds.example.com/')
    assert.equal(apiBase(), 'https://aetherholm.example.com')
  })

  it('is re-read per call, not cached in a module constant', () => {
    assert.equal(apiBase(), 'http://localhost:4120')
    removeWindow()
    installWindow('https://aetherholm.example.com/')
    assert.equal(apiBase(), 'https://aetherholm.example.com')
  })

  it('leaves an unknown prefix alone on a preview deployment', () => {
    removeWindow()
    installWindow('https://pr-42.example.dev/')
    // The registry deliberately treats the whole hostname as the apex when no known subdomain
    // leads it, so the service resolves under the preview's own name.
    assert.equal(apiBase(), 'https://aetherholm.pr-42.example.dev')
  })
})

describe('hosts() and pageOrigin()', () => {
  it('resolves nimbus for the auth client from the same registry', () => {
    installWindow('http://localhost:5171/')
    assert.ok(hosts().nimbus.length > 0)
  })

  it('pageOrigin falls back to a stable placeholder without a window', () => {
    assert.equal(pageOrigin(), 'http://localhost')
  })
})
