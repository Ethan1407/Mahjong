import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, parseTiles, sortTiles } from '../../engine'
import { getView, startRound, type RoundState } from '../../game'
import { analyzeTurn, verdictOf } from '../discardAnalysis'

const NAMES = ['你', '下家', '對家', '上家']
const seatName = (s: number) => NAMES[s]

/** 自己是座位 0，輪到自己打牌（17 張）。 */
function myTurn(hand: string, setup?: (s: RoundState) => void) {
  const s = startRound({ seed: 1, dealer: 0, dealerStreak: 0, roundWind: 0 })
  s.players[0].hand = sortTiles(parseTiles(hand))
  s.players[0].flowers = []
  s.turn = 0
  s.phase = 'discard'
  s.drewThisTurn = true
  setup?.(s)
  return getView(s, 0)
}

/** 下家看起來在做筒子一色、快聽牌了。 */
function pinThreat(s: RoundState) {
  s.players[1].melds = [
    { type: 'pung', tiles: parseTiles('222p'), fromSeat: 2 },
    { type: 'pung', tiles: parseTiles('444p'), fromSeat: 3 },
    { type: 'chow', tiles: parseTiles('567p'), fromSeat: 0 },
    { type: 'pung', tiles: parseTiles('888p'), fromSeat: 2 },
  ]
  s.players[1].hand = parseTiles('9p')
  s.players[1].river = parseTiles('7z 6z 9s 1s 8m 2s 3m 4m 5s 6m 7s 8s').map((t) => ({ tile: t, claimed: false }))
}

describe('打牌分析', () => {
  it('每一種可以打的牌都有報告，依牌效排列（不把建議的牌硬排第一）', () => {
    const view = myTurn('123m 456m 789p 11s 345s 67s 9m 1z')
    const a = analyzeTurn(view, DEFAULT_RULES, seatName)!
    const kinds = new Set(view.hand)
    expect(a.reports.map((r) => r.tile).sort((x, y) => x - y)).toEqual([...kinds].sort((x, y) => x - y))
    expect(a.reports[0].tile).toBe(a.best.tile)
    expect(a.best.isBestEfficiency).toBe(true)
    const rec = a.reports.find((r) => r.tile === a.recommendation.tile)!
    expect(verdictOf(rec, a).text).toBe('建議打這張')
  })

  it('機會成本：打掉會慢一步或少進張的，會寫出差多少', () => {
    const a = analyzeTurn(myTurn('123m 456m 789p 11s 345s 67s 9m 1z'), DEFAULT_RULES, seatName)!
    // 打掉一萬會拆掉 123m 順子，比打孤張慢
    const r = a.reports.find((x) => x.tile === parseTiles('1m')[0])!
    expect(r.shantenLoss + r.effectiveLoss).toBeGreaterThan(0)
    expect(r.isBestEfficiency).toBe(false)
  })

  it('機會成本：打掉會拆掉有台的組合（紅中刻子）', () => {
    const a = analyzeTurn(myTurn('555z 123m 456m 789p 1s 2s 3s 4s 9p'), DEFAULT_RULES, seatName)!
    const red = a.reports.find((x) => x.tile === parseTiles('5z')[0])!
    expect(red.lostTai.map((h) => h.name)).toContain('三元刻（紅中）')
    const loose = a.reports.find((x) => x.tile === parseTiles('9p')[0])!
    expect(loose.lostTai).toEqual([])
  })

  it('他人需求與放槍風險：在做筒子一色的下家需要筒子', () => {
    const a = analyzeTurn(myTurn('19m 19p 19s 1234567z 25m 36p', pinThreat), DEFAULT_RULES, seatName)!
    expect(a.enoughInfo).toBe(true)
    const pin = a.reports.find((x) => x.tile === parseTiles('3p')[0])!
    expect(pin.needers.map((n) => n.seat)).toContain(1)
    expect(pin.danger.risk).toBeGreaterThan(a.reports.find((x) => x.tile === parseTiles('7z')[0])!.danger.risk)
    // 建議的理由用「下家」稱呼，不是門風
    expect(a.recommendation.reason).not.toMatch(/[東南西北]家/)
    // 理由不再重複「打某某：」
    expect(a.recommendation.reason).not.toMatch(/^打.{1,4}：/)
  })

  it('開局資訊不足時，不判斷他人需求', () => {
    const a = analyzeTurn(myTurn('123m 456m 789p 11s 345s 67s 9m 1z'), DEFAULT_RULES, seatName)!
    expect(a.enoughInfo).toBe(false)
    expect(a.reports.every((r) => r.needers.length === 0)).toBe(true)
  })
})
