/**
 * Honest numbers: every stock, rate, cap and cost in this client is a decimal string moved
 * through BigInt, never `Number()`.
 *
 * The service's whole economy is `bigint` with floor arithmetic — "a float near an amount
 * eventually rounds a settlement" (`aetherholm/src/content.ts:12-14`) — and amounts travel as
 * decimal strings on the wire (`aetherholm/src/server.ts:489`, the airships comment; every
 * stocks field). `Number()` is exact only below 2^53; a Grand Hauler convoy's season of Aether
 * can pass that, and the first place the rounding would appear is the one place players check
 * numbers against each other. So: parse with BigInt, add with BigInt, format from BigInt, and
 * the one lossy step — display grouping — happens on a string.
 */
import type { WireStocks } from './aetherholm.ts'

export const RESOURCES = ['aether', 'cloudstone', 'skysteel', 'provisions'] as const
export type Resource = (typeof RESOURCES)[number]

/** Parse a wire decimal string. A malformed amount is a bug upstream and throws loudly. */
export function toBigInt(value: string | undefined, what: string): bigint {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new RangeError(`${what} is not a decimal string: ${String(value)}`)
  }
  return BigInt(value)
}

/** Group a decimal string for display: '1234567' → '1,234,567'. String in, string out — no
 *  Number() anywhere on the path. */
export function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatAmount(value: bigint): string {
  return groupDigits(value.toString())
}

/**
 * What a stock has become `elapsedMs` after `settledAt`, clamped to `[0, cap]`.
 *
 * The same arithmetic as the service's `accrue` (`aetherholm/src/economy.ts:34-39`): floor
 * seconds, floor of rate×seconds/3600, clamp to the cap, and NEGATIVE ELAPSED TIME ACCRUES
 * NOTHING — a client clock behind the server's must not show a stock shrinking. This is a
 * PROJECTION for display between reads; the server settles from its own clock on every write,
 * and its number wins every time one arrives.
 */
export function projectStock(stock: bigint, ratePerHour: bigint, cap: bigint, elapsedMs: number): bigint {
  const seconds = elapsedMs > 0 ? BigInt(Math.floor(elapsedMs / 1000)) : 0n
  const grown = stock + (ratePerHour * seconds) / 3600n
  const clamped = grown > cap ? cap : grown
  return clamped < 0n ? 0n : clamped
}

/** Project all four stocks of a city view forward to `now`. */
export function projectStocks(
  stocks: WireStocks,
  rates: WireStocks,
  cap: string,
  settledAt: string,
  now: Date,
): Record<Resource, bigint> {
  const capN = toBigInt(cap, 'storageCap')
  const elapsed = now.getTime() - new Date(settledAt).getTime()
  const out = {} as Record<Resource, bigint>
  for (const resource of RESOURCES) {
    out[resource] = projectStock(
      toBigInt(stocks[resource] ?? '0', `stocks.${resource}`),
      toBigInt(rates[resource] ?? '0', `rates.${resource}`),
      capN,
      elapsed,
    )
  }
  return out
}

/** Sum decimal-string amounts (e.g. a cost times a count) without leaving BigInt. */
export function scaleAmount(amount: string, count: number): bigint {
  return toBigInt(amount, 'amount') * BigInt(count)
}

/* ---- time ----------------------------------------------------------- */

/** '2h 05m' / '3d 4h' — durations a player plans around. Whole units, floor, never negative. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s}s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes}m ${String(s % 60).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** Seconds until an ISO instant, floored at zero. */
export function secondsUntil(iso: string, now: Date): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now.getTime()) / 1000))
}

/** A lane's direction multiplier for display: 12500 basis points → '×1.25'. Integer maths on the
 *  basis points; the decimal point is typography, not arithmetic. */
export function formatMultiplier(multiplierBp: number): string {
  const whole = Math.floor(multiplierBp / 10000)
  const frac = String(Math.floor((multiplierBp % 10000) / 100)).padStart(2, '0')
  return `×${whole}.${frac}`
}

/** A digest, shortened for a table cell: first 12 hex chars and an ellipsis. The full value is
 *  always available beside it (title attribute or a copy control) — shortening is layout, not
 *  redaction. */
export function shortDigest(digest: string): string {
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest
}
