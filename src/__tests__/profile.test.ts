import { beforeEach, describe, expect, it } from 'vitest'
import { addPlaySeconds, loadStats, recordHandOutcome, recordMatchStart, recordStakeFee, resetStats } from '../profile'

beforeEach(() => {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

describe('個人中心的遊玩數據', () => {
  it('記錄胡牌、自摸、放槍，同一局不重複記', () => {
    recordMatchStart()
    recordHandOutcome({ match: 1, hand: 0, level: 'normal', kind: 'win', tsumo: true, tai: 5, items: ['自摸'], turn: 7 })
    recordHandOutcome({ match: 1, hand: 0, level: 'normal', kind: 'win', tsumo: true, tai: 5 }) // 重複
    recordHandOutcome({ match: 1, hand: 1, level: 'normal', kind: 'dealIn' })
    recordHandOutcome({ match: 1, hand: 2, level: 'normal', kind: 'draw' })
    const s = loadStats()
    expect(s.matchesStarted).toBe(1)
    expect(s.hands).toBe(3)
    expect(s.wins).toBe(1)
    expect(s.tsumo).toBe(1)
    expect(s.dealIns).toBe(1)
    expect(s.draws).toBe(1)
    expect(s.best?.tai).toBe(5)
    expect(s.fastestTurn).toBe(7)
    expect(s.byLevel.normal).toEqual({ hands: 3, wins: 1, dealIns: 1 })
  })

  it('遊玩時間累加，存起來之後再讀還在；可以清除', () => {
    addPlaySeconds(5)
    addPlaySeconds(7)
    expect(loadStats().playSeconds).toBe(12)
    resetStats()
    expect(loadStats().playSeconds).toBe(0)
  })

  it('各入場金額分開記場數、局數和輸贏', () => {
    const a = { key: 's50', label: '50 / 20' }
    const c = { key: 'custom:40/15', label: '40 / 15（自行設定）' }
    recordMatchStart(a)
    recordHandOutcome({ match: 1, hand: 0, level: 'hard', kind: 'win', tai: 2, stake: a, delta: 270 })
    recordMatchStart(a)
    recordMatchStart(c)
    recordHandOutcome({ match: 3, hand: 0, level: 'hard', kind: 'dealIn', stake: c, delta: -85 })
    recordStakeFee(c, 40)
    const s = loadStats()
    expect(s.byStake.s50).toEqual({ label: '50 / 20', matches: 2, hands: 1, wins: 1, net: 270 })
    expect(s.byStake['custom:40/15']).toMatchObject({ matches: 1, hands: 1, wins: 0, net: -125 })
  })
})
