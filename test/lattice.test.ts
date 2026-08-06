/**
 * The launch price tag, proven against the server's own formula.
 *
 * `previewLaunch` claims to price a launch "as the server would charge it". That sentence is
 * only worth having if it is checked, so the expected values below are computed BY HAND from
 * `aetherholm/src/fleets.ts` (per-leg time: `max(1, floor(pathSeconds × speedBp/10000))`)
 * and its lift ceiling ( `(liftPerHourTotal × (out + back) + 3599n) / 3600n`) — never by calling the
 * code under test twice.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { previewLaunch, shortestPath } from '../src/lib/lattice.ts'
import type { AirshipSpec, Lane } from '../src/lib/aetherholm.ts'

const lane = (id: string, from: string, to: string, seconds: number, multiplierBp = 10000): Lane => ({
  id,
  fromIslandId: from,
  toIslandId: to,
  multiplierBp,
  travelSeconds: seconds,
})

const spec = (speedBp: number, liftPerHour: string, cargo = '0'): AirshipSpec => ({
  role: 'war',
  initiative: 5,
  attack: '1',
  hull: '10',
  speedBp,
  cargo,
  liftPerHour,
  aerodock: 1,
  cost: { aether: '1', cloudstone: '1', skysteel: '1', provisions: '1' },
  buildSeconds: 60,
})

describe('shortestPath', () => {
  it('finds the cheapest directed route, not the fewest hops', () => {
    const lanes = [
      lane('ab', 'A', 'B', 100),
      lane('bc', 'B', 'C', 100),
      lane('ac', 'A', 'C', 500),
    ]
    const path = shortestPath(lanes, 'A', 'C')
    assert.ok(path)
    assert.equal(path.seconds, 200)
    assert.deepEqual(path.lanes.map((l) => l.id), ['ab', 'bc'])
  })

  it('respects direction: the winds are not symmetric', () => {
    // A→B exists; B→A does not. This asymmetry IS the game (doc §2), and a pathfinder that
    // treated lanes as undirected would price journeys the server refuses.
    const lanes = [lane('ab', 'A', 'B', 100)]
    assert.ok(shortestPath(lanes, 'A', 'B'))
    assert.equal(shortestPath(lanes, 'B', 'A'), null)
  })

  it('answers zero for a journey to where you already are', () => {
    assert.deepEqual(shortestPath([], 'A', 'A'), { lanes: [], seconds: 0 })
  })

  it('reports the LAST lane as the approach — the wind the battle modifier reads', () => {
    const lanes = [lane('ab', 'A', 'B', 100), lane('bc', 'B', 'C', 100)]
    const path = shortestPath(lanes, 'A', 'C')
    assert.equal(path?.lanes[path.lanes.length - 1]?.id, 'bc')
  })
})

describe('previewLaunch — the server’s arithmetic, worked by hand', () => {
  const ring = [
    lane('ab', 'A', 'B', 3600), // out: one hour of lane time
    lane('ba', 'B', 'A', 7200), // back: two — each direction its own roll
  ]

  it('prices time at the SLOWEST ship and lift with the server’s exact ceiling', () => {
    const airships = { skiff: spec(6000, '1'), ironclad: spec(13000, '9') }
    const preview = previewLaunch(ring, airships, { skiff: 2, ironclad: 1 }, 'A', 'B')
    assert.ok(preview)
    // Slowest is the ironclad: 13000 bp. Out: floor(3600 × 13000/10000) = 4680.
    assert.equal(preview.travelSeconds, 4680)
    // Back: floor(7200 × 13000/10000) = 9360.
    assert.equal(preview.returnSeconds, 9360)
    assert.equal(preview.speedBp, 13000)
    // Lift/hour: 2×1 + 1×9 = 11. Charge: 11 × (4680+9360) = 154,440; +3599 = 158,039;
    // integer-divided by 3600 = 43 — which is ceil(154440/3600) = ceil(42.9), the server's
    // exact rounding.
    assert.equal(preview.aetherLift, 43n)
  })

  it('is the ceiling, not the floor: a fraction of an hour still costs a whole unit', () => {
    const airships = { skiff: spec(10000, '1') }
    const short = previewLaunch([lane('ab', 'A', 'B', 1), lane('ba', 'B', 'A', 1)], airships, { skiff: 1 }, 'A', 'B')
    assert.ok(short)
    // Two seconds of travel at 1/hour is 0.0005 of a unit — and the charge is 1, because the
    // server's `(lift × seconds + 3599n) / 3600n` rounds UP. A floor here would price every
    // short hop free, which is a preview lying in the player's favour.
    assert.equal(short.aetherLift, 1n)
  })

  it('sums cargo holds in BigInt — a Grand Hauler convoy cannot round', () => {
    const airships = { grand_hauler: spec(14000, '8', '9007199254740993') }
    const preview = previewLaunch(ring, airships, { grand_hauler: 2 }, 'A', 'B')
    assert.ok(preview)
    assert.equal(preview.cargoHold, 18014398509481986n)
  })

  it('answers null when either leg has no route — the 409 the server would send', () => {
    const airships = { skiff: spec(6000, '1') }
    // Outbound exists, return does not: the server refuses (no_route) because a fleet must come
    // home, and the composer must know BEFORE the wire.
    assert.equal(previewLaunch([lane('ab', 'A', 'B', 100)], airships, { skiff: 1 }, 'A', 'B'), null)
  })

  it('answers null for an empty composition or an unknown class', () => {
    const airships = { skiff: spec(6000, '1') }
    assert.equal(previewLaunch(ring, airships, {}, 'A', 'B'), null)
    assert.equal(previewLaunch(ring, airships, { dreadnought: 1 }, 'A', 'B'), null)
  })

  it('names the lane of approach', () => {
    const airships = { skiff: spec(10000, '1') }
    const preview = previewLaunch(ring, airships, { skiff: 1 }, 'A', 'B')
    assert.equal(preview?.approach?.id, 'ab')
  })
})
