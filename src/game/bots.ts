/**
 * 暫時的機器人，給階段 2 測試與模擬用。真正分難度的機器人在階段 4 實作。
 */
import { analyzeDiscards, toCounts, type Rng } from '../engine'
import type { Action } from './types'
import { visibleCounts, type PlayerView } from './view'

/** 機器人只拿得到自己的視角。 */
export type Bot = (view: PlayerView, rng: Rng) => Action

const find = (view: PlayerView, type: Action['type']) => view.legal.find((a) => a.type === type)

/** 只看牌效率：能胡就胡，不吃碰槓，打出讓向聽數最低、進張最多的牌。 */
export const efficiencyBot: Bot = (view) => {
  const win = find(view, 'tsumo') ?? find(view, 'ron')
  if (win) return win
  if (view.phase !== 'discard') return { type: 'pass', seat: view.seat }
  const me = view.seats[view.seat]
  const best = analyzeDiscards(toCounts(view.hand), me.melds.length, visibleCounts(view))[0]
  return { type: 'discard', seat: view.seat, tile: best.tile }
}

/** 隨機選一個合法動作（能胡一定胡），用來測試各種吃碰槓的情況都不會出錯。 */
export const randomBot: Bot = (view, rng) => {
  const win = find(view, 'tsumo') ?? find(view, 'ron')
  if (win) return win
  return view.legal[Math.floor(rng() * view.legal.length)]
}
