import { parseTiles, type Tile } from '../../engine'
import { startRound } from '../round'
import type { RoundState } from '../types'

/**
 * 依照想要的手牌排出牌牆（發牌順序與 dealInitial 相同）。
 * hands：依座位 0–3，莊家 17 張、其餘 16 張。
 * front：發牌後依序從牌頭摸到的牌；back：依序從牌尾補到的牌。
 */
export function stackedRound(opts: {
  hands: string[]
  front?: string
  back?: string
  dealer?: number
}): RoundState {
  const dealer = opts.dealer ?? 0
  const hands = opts.hands.map(parseTiles)
  hands.forEach((h, seat) => {
    const want = seat === dealer ? 17 : 16
    if (h.length !== want) throw new Error(`座位 ${seat} 手牌應為 ${want} 張，實際 ${h.length} 張`)
  })
  const tiles: Tile[] = []
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 4; i++) tiles.push(...hands[(dealer + i) % 4].slice(r * 4, r * 4 + 4))
  }
  tiles.push(hands[dealer][16])
  tiles.push(...parseTiles(opts.front ?? ''))
  tiles.push(...parseTiles(opts.back ?? '').reverse())
  return startRound({ seed: 0, dealer, dealerStreak: 0, roundWind: 0, reserve: 0, wallTiles: tiles })
}

export const tile = (s: string) => parseTiles(s)[0]
