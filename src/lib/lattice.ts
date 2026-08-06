/**
 * The wind lattice, client-side: pathfinding for the map, and the launch PRICE TAG.
 *
 * The Aether cost of a launch is shown BEFORE the commit (docs/ecosystem/20-aetherholm.md §5),
 * and it is computed here from exactly the inputs the server charges from:
 *
 *   * the lanes, as `GET /v1/archipelagos/:id/lanes` serves them (`aetherholm/src/server.ts`)
 *     — per-direction `travelSeconds`, already rolled from the season seed;
 *   * the class table, as `GET /v1/content/airships` serves it (`aetherholm/src/server.ts`),
 *     which is `AIRSHIPS` in `aetherholm/src/content.ts` verbatim — `speedBp` and
 *     `liftPerHour` are the two numbers this file reads.
 *
 * The arithmetic mirrors `launchFleet` (`aetherholm/src/fleets.ts`, for time and for
 * lift) step for step: the fleet flies at its SLOWEST ship's `speedBp`; each leg
 * is `floor(pathSeconds × speedBp / 10000)` with a 1-second floor; and the lift charge is
 * `ceil(liftPerHourTotal × (outbound + return) / 3600)` in BigInt — the `+ 3599n) / 3600n`
 * ceiling, spelled the same way so the two cannot round apart.
 *
 * WHAT THIS IS NOT: a resolution engine. It prices a plan; the server prices the launch again
 * with its own arithmetic and its own clock, refuses what the treasury cannot cover, and no
 * outcome of any kind is computed here — see the header of ./aetherholm.ts.
 *
 * ONE HONEST GAP: alliance shared lanes. Members fly lanes between two claimed islands at a 10%
 * discount (`aetherholm/src/fleets.ts` `SHARED_LANE_DISCOUNT_BP = 9000`, applied when
 * both ends are claimed).
 * Whether a given lane is shared depends on the alliance's claims at the moment the SERVER
 * routes the fleet, which this client cannot promise to know first. The preview therefore prices
 * the undiscounted path and says so in copy — the true cost is never HIGHER than the number
 * shown, which is the safe direction for a price tag to be wrong in.
 */
import type { AirshipSpec, Lane } from './aetherholm.ts'
import { toBigInt } from './format.ts'

export interface PathResult {
  /** The lanes flown, in order. The LAST one is the lane of approach — the wind the battle
   *  modifier reads. */
  lanes: readonly Lane[]
  seconds: number
}

/**
 * Shortest path by travel time — Dijkstra with the same deterministic tie-break (smaller island
 * id first) as the service's `shortestPath` (`aetherholm/src/lattice.ts`), so the route this
 * client draws is the route the server flies.
 */
export function shortestPath(
  lanes: readonly Lane[],
  fromIslandId: string,
  toIslandId: string,
): PathResult | null {
  if (fromIslandId === toIslandId) return { lanes: [], seconds: 0 }
  const out = new Map<string, Lane[]>()
  for (const lane of lanes) {
    const list = out.get(lane.fromIslandId)
    if (list) list.push(lane)
    else out.set(lane.fromIslandId, [lane])
  }
  const dist = new Map<string, number>([[fromIslandId, 0]])
  const via = new Map<string, Lane>()
  const done = new Set<string>()

  for (;;) {
    let current: string | null = null
    let best = Infinity
    for (const [node, d] of dist) {
      if (done.has(node)) continue
      if (d < best || (d === best && current !== null && node < current)) {
        best = d
        current = node
      }
    }
    if (current === null) return null
    if (current === toIslandId) break
    done.add(current)
    for (const lane of out.get(current) ?? []) {
      const next = (dist.get(current) ?? 0) + lane.travelSeconds
      const existing = dist.get(lane.toIslandId)
      if (existing === undefined || next < existing) {
        dist.set(lane.toIslandId, next)
        via.set(lane.toIslandId, lane)
      }
    }
  }

  const path: Lane[] = []
  let node = toIslandId
  while (node !== fromIslandId) {
    const lane = via.get(node)
    if (!lane) return null
    path.unshift(lane)
    node = lane.fromIslandId
  }
  return { lanes: path, seconds: path.reduce((sum, lane) => sum + lane.travelSeconds, 0) }
}

export interface LaunchPreview {
  /** Outbound leg, seconds, at the fleet's pace. */
  travelSeconds: number
  /** Return leg, seconds — a different number, because the winds are directed. */
  returnSeconds: number
  /** The Aether charged at launch for the whole round trip, as the server would charge it. */
  aetherLift: bigint
  /** Total cargo hold of the composition — what a transfer or a raid can actually carry. */
  cargoHold: bigint
  /** The slowest ship's speed factor, which is the fleet's. */
  speedBp: number
  /** The lane of approach: the last outbound lane, whose wind the battle modifier reads. */
  approach: Lane | null
}

/**
 * Price a launch. Returns null when either leg has no route — which the server would answer with
 * 409 `no_route` (`aetherholm/src/server.ts`), so the composer disables the commit instead
 * of sending a request whose refusal is already known.
 */
export function previewLaunch(
  lanes: readonly Lane[],
  airships: Readonly<Record<string, AirshipSpec>>,
  ships: Readonly<Record<string, number>>,
  fromIslandId: string,
  toIslandId: string,
): LaunchPreview | null {
  const outbound = shortestPath(lanes, fromIslandId, toIslandId)
  const back = shortestPath(lanes, toIslandId, fromIslandId)
  if (!outbound || !back) return null

  let speedBp = 0
  let liftPerHour = 0n
  let cargoHold = 0n
  let any = false
  for (const [cls, count] of Object.entries(ships)) {
    if (count <= 0) continue
    const spec = airships[cls]
    if (!spec) return null
    any = true
    speedBp = Math.max(speedBp, spec.speedBp)
    liftPerHour += toBigInt(spec.liftPerHour, `${cls}.liftPerHour`) * BigInt(count)
    cargoHold += toBigInt(spec.cargo, `${cls}.cargo`) * BigInt(count)
  }
  if (!any) return null

  // The same floors and the same ceiling as `launchFleet` in aetherholm/src/fleets.ts.
  const travelSeconds = Math.max(1, Math.floor((outbound.seconds * speedBp) / 10000))
  const returnSeconds = Math.max(1, Math.floor((back.seconds * speedBp) / 10000))
  const aetherLift = (liftPerHour * BigInt(travelSeconds + returnSeconds) + 3599n) / 3600n

  return {
    travelSeconds,
    returnSeconds,
    aetherLift,
    cargoHold,
    speedBp,
    approach: outbound.lanes[outbound.lanes.length - 1] ?? null,
  }
}
