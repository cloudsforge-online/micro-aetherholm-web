/**
 * Honest numbers, proven: every amount moves through BigInt and the projection can never show a
 * number the server would refuse to settle.
 *
 * The projection mirrors `accrue` (`aetherholm/src/economy.ts:34-39`), whose own properties are
 * "never settle negative or above cap" (docs/ecosystem/20-aetherholm.md §9.2). The same
 * properties are swept here across random rate/cap/elapsed triples, because a display that shows
 * a stock the CHECK constraint would refuse is a display teaching players numbers that are not
 * true.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatAmount,
  formatDuration,
  formatMultiplier,
  groupDigits,
  projectStock,
  projectStocks,
  scaleAmount,
  shortDigest,
  toBigInt,
} from '../src/lib/format.ts'

describe('toBigInt', () => {
  it('parses a decimal string exactly, above 2^53 included', () => {
    // 2^53 + 1 — the first integer Number() cannot represent. The whole reason this module
    // exists.
    assert.equal(toBigInt('9007199254740993', 'x'), 9007199254740993n)
    assert.notEqual(String(Number('9007199254740993')), '9007199254740993')
  })

  it('refuses a float, a sign, an empty string and undefined', () => {
    for (const bad of ['1.5', '-3', '', '1e10', undefined]) {
      assert.throws(() => toBigInt(bad as string | undefined, 'x'), RangeError)
    }
  })
})

describe('groupDigits and formatAmount', () => {
  it('groups without ever passing through Number()', () => {
    assert.equal(groupDigits('1234567'), '1,234,567')
    assert.equal(groupDigits('123'), '123')
    // 2^64 - 1: a value no double can hold, grouped exactly.
    assert.equal(formatAmount(18446744073709551615n), '18,446,744,073,709,551,615')
  })
})

describe('projectStock — the accrual mirror', () => {
  it('matches the server’s floor arithmetic on a worked example', () => {
    // 10/hour for 30 minutes on 100 held: floor(10 × 1800 / 3600) = 5.
    assert.equal(projectStock(100n, 10n, 1000n, 30 * 60 * 1000), 105n)
  })

  it('floors partial seconds away, exactly as the server does', () => {
    // 999ms is zero whole seconds: nothing accrues.
    assert.equal(projectStock(100n, 3600n, 10000n, 999), 100n)
  })

  it('accrues NOTHING when the clock stepped backwards', () => {
    assert.equal(projectStock(100n, 10n, 1000n, -60_000), 100n)
  })

  it('never exceeds the cap and never goes negative — swept across random triples', () => {
    let seed = 42
    const next = () => {
      // Deterministic LCG: the sweep reproduces, which a Math.random() sweep does not.
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed
    }
    for (let i = 0; i < 500; i++) {
      const stock = BigInt(next() % 100000)
      const rate = BigInt(next() % 5000)
      const cap = BigInt(next() % 100000)
      const elapsed = (next() % 100000000) - 50000000
      const projected = projectStock(stock > cap ? cap : stock, rate, cap, elapsed)
      assert.ok(projected >= 0n, `went negative: ${projected}`)
      assert.ok(projected <= cap, `exceeded cap ${cap}: ${projected}`)
    }
  })

  it('projects all four resources against the shared cap', () => {
    const projected = projectStocks(
      { aether: '10', cloudstone: '20', skysteel: '30', provisions: '40' },
      { aether: '3600', cloudstone: '0', skysteel: '3600', provisions: '0' },
      '35',
      '2026-06-01T00:00:00.000Z',
      new Date('2026-06-01T00:00:10.000Z'),
    )
    assert.equal(projected.aether, 20n) // 10 + 10s of 3600/h
    assert.equal(projected.cloudstone, 20n) // no rate
    assert.equal(projected.skysteel, 35n) // clamped at cap
    assert.equal(projected.provisions, 35n) // above cap already: shown AT cap, never above
  })
})

describe('scaleAmount', () => {
  it('multiplies in BigInt', () => {
    assert.equal(scaleAmount('9007199254740993', 2), 18014398509481986n)
  })
})

describe('formatDuration', () => {
  it('renders the units a player plans around', () => {
    assert.equal(formatDuration(45), '45s')
    assert.equal(formatDuration(300), '5m 00s')
    assert.equal(formatDuration(7260), '2h 01m')
    assert.equal(formatDuration(3 * 86400 + 4 * 3600), '3d 4h')
  })

  it('floors a negative duration at zero rather than counting up', () => {
    assert.equal(formatDuration(-5), '0s')
  })
})

describe('formatMultiplier', () => {
  it('renders basis points with integer maths only', () => {
    assert.equal(formatMultiplier(10000), '×1.00')
    assert.equal(formatMultiplier(12500), '×1.25')
    assert.equal(formatMultiplier(9000), '×0.90')
    assert.equal(formatMultiplier(20050), '×2.00')
  })
})

describe('shortDigest', () => {
  it('shortens for layout without pretending the value is shorter', () => {
    const digest = 'abcdef0123456789'.repeat(4)
    assert.equal(shortDigest(digest), `${digest.slice(0, 12)}…`)
    assert.equal(shortDigest('abc'), 'abc')
  })
})
