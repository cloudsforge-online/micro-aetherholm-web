/**
 * Host resolution, straight from the registry — and the proof this client needs no workaround.
 *
 * `micro-emberkin-web` shipped with a derivation layer because the registry had no entry for its
 * surface; the registry has since grown both titles, and this suite pins the fact this client
 * depends on: the `aetherholm` entry exists, resolves per environment, and its devPort is the
 * port the service actually binds — 4120, `aetherholm/src/env.ts`, pinned in
 * `ui/packages/ui/src/surfaces.ts`. That devPort class has been wrong three times in this
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
    // NO subdomain since the nesting: the title is a folder under the catalogue. The devPort is
    // untouched by that — a mount is a fact about an address, a port a fact about a service.
    assert.equal(entry.subdomain, '')
    assert.equal(entry.basePath, '/worlds/aetherholm')
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
    installWindow('https://example.com/worlds/aetherholm/fleets')
    assert.equal(apiBase(), 'https://example.com/worlds/aetherholm')
  })

  it('resolves the same host when the page is served from another estate surface', () => {
    removeWindow()
    // `<apex>/worlds`, not `worlds.<apex>`. Forge Worlds became a folder on the apex in wave 3e of
    // the consolidation, so `worlds.` stopped being a subdomain `cloudsforgeHosts()` strips — and
    // a page opened on the old hostname would make the WHOLE name the apex, resolving this
    // surface to `<this>.worlds.example.com`, one label too deep.
    //
    // The scenario is unchanged and is the reason this fixture exists: a reader arrives here FROM
    // Forge Worlds, so the page is served from another estate surface, and this surface's own host
    // must still resolve to its own hostname rather than to something under the referrer's.
    installWindow('https://example.com/worlds/')
    assert.equal(apiBase(), 'https://example.com/worlds/aetherholm')
  })

  it('is re-read per call, not cached in a module constant', () => {
    assert.equal(apiBase(), 'http://localhost:4120')
    removeWindow()
    installWindow('https://example.com/worlds/aetherholm/')
    assert.equal(apiBase(), 'https://example.com/worlds/aetherholm')
  })

  it('leaves an unknown prefix alone on a preview deployment', () => {
    removeWindow()
    installWindow('https://pr-42.example.dev/')
    // The registry deliberately treats the whole hostname as the apex when no known subdomain
    // leads it — so a preview gets the preview's own apex, and since the nesting the MOUNT under
    // it rather than a label in front of it. `aetherholm.pr-42.example.dev` would have been a
    // hostname nobody provisioned; `pr-42.example.dev/worlds/aetherholm` is the same shape the
    // real estate serves, which is what makes a preview worth having.
    assert.equal(apiBase(), 'https://pr-42.example.dev/worlds/aetherholm')
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
