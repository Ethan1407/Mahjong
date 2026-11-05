/** 把對局事件轉成中文敘述（模擬器與畫面上的對局紀錄共用）。 */
import { WIND_NAMES, tileName, type Tile } from '../engine'
import type { GameEvent, RoundResult, Seat } from './types'

export type SeatNamer = (seat: Seat) => string

export const defaultSeatName: SeatNamer = (seat) => `玩家${seat + 1}`

const names = (tiles: Tile[]) => tiles.map(tileName).join('')

export function describeEvent(e: GameEvent, name: SeatNamer = defaultSeatName): string {
  switch (e.type) {
    case 'deal':
      return `開局，${name(e.dealer)}當莊`
    case 'flower':
      return `${name(e.seat)} 補花：${tileName(e.tile)}`
    case 'draw':
      return `${name(e.seat)} ${e.replacement ? '補牌' : '摸牌'}：${tileName(e.tile)}`
    case 'discard':
      return `${name(e.seat)} 打出 ${tileName(e.tile)}`
    case 'chow':
      return `${name(e.seat)} 吃 ${name(e.from)} 的牌：${names(e.tiles)}`
    case 'pung':
      return `${name(e.seat)} 碰 ${name(e.from)} 的牌：${names(e.tiles)}`
    case 'minkan':
      return `${name(e.seat)} 明槓 ${name(e.from)} 的牌：${names(e.tiles)}`
    case 'ankan':
      return `${name(e.seat)} 暗槓 ${tileName(e.tile)}`
    case 'kakan':
      return `${name(e.seat)} 加槓 ${tileName(e.tile)}`
    case 'win':
      if (e.from === null) return `${name(e.seat)} 自摸${e.tile === null ? '' : ` ${tileName(e.tile)}`}！`
      return `${name(e.seat)} 胡 ${name(e.from)} 的${e.tile === null ? '牌' : ` ${tileName(e.tile)}`}！`
    case 'exhaustive':
      return '牌摸完了，流局'
  }
}

/** 給某個玩家看的版本：別人摸到什麼、暗槓什麼都不顯示。 */
export function describeEventFor(e: GameEvent, viewer: Seat, name: SeatNamer = defaultSeatName): string {
  if (e.type === 'draw' && e.seat !== viewer) return `${name(e.seat)} ${e.replacement ? '補牌' : '摸牌'}`
  if (e.type === 'ankan' && e.seat !== viewer) return `${name(e.seat)} 暗槓`
  return describeEvent(e, name)
}

export function describeResult(r: RoundResult, name: SeatNamer = defaultSeatName): string {
  if (r.type === 'exhaustive') return '流局（莊家連莊）'
  const how = r.discarder === null ? '自摸' : `胡 ${name(r.discarder)}`
  const items = r.score.items.map((i) => `${i.name} ${i.tai}`).join('、')
  const pays = r.payments.payments.map((p) => `${name(p.payer)} 付 ${p.amount}（${p.tai} 台）`).join('，')
  return `${name(r.winner)} ${how}，牌型 ${r.score.tai} 台：${items || '無'}。${pays}`
}

export const roundName = (roundWind: number, dealerChanges: number) =>
  `${WIND_NAMES[roundWind]}風${WIND_NAMES[dealerChanges]}局`
