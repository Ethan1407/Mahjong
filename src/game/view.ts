/**
 * 玩家視角：只包含這個座位看得到的資訊。
 * 機器人只能拿到 PlayerView，所以在程式結構上就不可能偷看別人的手牌或牌牆。
 */
import { emptyCounts, type Meld, type Tile } from '../engine'
import { legalActions, seatWindOf } from './round'
import type { Action, Phase, RiverTile, RoundResult, RoundState, Seat } from './types'

export interface MeldView extends Meld {
  /** 別人的暗槓是蓋著的，看不到是什麼牌（tiles 為空陣列）。 */
  hidden: boolean
}

export interface SeatView {
  seat: Seat
  seatWind: number
  handCount: number
  melds: MeldView[]
  flowers: Tile[]
  river: RiverTile[]
}

export interface PlayerView {
  seat: Seat
  dealer: Seat
  dealerStreak: number
  roundWind: number
  /** 自己的暗手。 */
  hand: Tile[]
  /** 自己剛摸進來的牌。 */
  lastDrawn: Tile | null
  /** 依座位 0–3，包含自己。 */
  seats: SeatView[]
  wallDrawable: number
  phase: Phase
  turn: Seat
  /** 正在等待回應的牌（別人打出的牌，或別人要加槓的牌）。 */
  pending: { tile: Tile; from: Seat; kind: 'discard' | 'kakan' } | null
  legal: Action[]
  result: RoundResult | null
}

export function getView(s: RoundState, seat: Seat): PlayerView {
  const me = s.players[seat]
  return {
    seat,
    dealer: s.config.dealer,
    dealerStreak: s.config.dealerStreak,
    roundWind: s.config.roundWind,
    hand: [...me.hand],
    lastDrawn: s.turn === seat ? s.lastDrawn : null,
    seats: s.players.map((p, i) => ({
      seat: i,
      seatWind: seatWindOf(s, i),
      handCount: p.hand.length,
      melds: p.melds.map((m) => {
        const hidden = m.type === 'ankan' && i !== seat && s.phase !== 'ended'
        return { ...m, tiles: hidden ? [] : [...m.tiles], hidden }
      }),
      flowers: [...p.flowers],
      river: p.river.map((r) => ({ ...r })),
    })),
    wallDrawable: s.wall.drawable,
    phase: s.phase,
    turn: s.turn,
    pending: s.pending && { tile: s.pending.tile, from: s.pending.from, kind: s.pending.kind },
    legal: legalActions(s, seat),
    result: s.result,
  }
}

/**
 * 自己看得到的每種牌張數：自己的手牌、所有牌河（沒被拿走的）、所有亮出的副露。
 * 用來估算某種牌「還剩幾張」。
 */
export function visibleCounts(view: PlayerView): number[] {
  const c = emptyCounts()
  for (const t of view.hand) c[t]++
  for (const sv of view.seats) {
    for (const r of sv.river) if (!r.claimed) c[r.tile]++
    for (const m of sv.melds) for (const t of m.tiles) c[t]++
  }
  // 正在等待回應的牌已經在牌河裡算過；加槓的牌還在對方手上，另外加上
  if (view.pending?.kind === 'kakan') c[view.pending.tile]++
  return c.map((n) => Math.min(4, n))
}
