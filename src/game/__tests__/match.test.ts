import { describe, expect, it } from 'vitest'
import { efficiencyBot } from '../bots'
import { dealerFromDice, nextHand, playOutMatch, rollOpening, startMatch, type MatchState } from '../match'
import type { RoundResult } from '../types'

function endWith(m: MatchState, result: RoundResult): MatchState {
  return { ...m, round: { ...m.round!, phase: 'ended', result } }
}

const winBy = (winner: number, deltas: number[]): RoundResult => ({
  type: 'win',
  winner,
  discarder: null,
  tile: 0,
  selfDrawn: true,
  score: { valid: true, pattern: 'standard', tai: 0, items: [] },
  payments: { deltas, payments: [] },
})

describe('擲骰定莊', () => {
  it('從擲骰的人開始逆時針數，自己算 1', () => {
    expect([1, 5, 9, 13, 17].map((n) => dealerFromDice(0, n))).toEqual([0, 0, 0, 0, 0])
    expect([2, 6, 10, 14, 18].map((n) => dealerFromDice(0, n))).toEqual([1, 1, 1, 1, 1])
    expect([3, 7, 11, 15].map((n) => dealerFromDice(0, n))).toEqual([2, 2, 2, 2])
    expect([4, 8, 12, 16].map((n) => dealerFromDice(0, n))).toEqual([3, 3, 3, 3])
  })

  it('沒指定莊家時，第一局的莊家由骰子決定', () => {
    for (let seed = 0; seed < 20; seed++) {
      const m = startMatch({ seed, winds: 1 })
      const o = rollOpening(seed)
      expect(m.opening).toEqual(o)
      expect(o.dice.every((d) => d >= 1 && d <= 6)).toBe(true)
      expect(m.dealer).toBe(o.dealer)
      expect(m.round!.config.dealer).toBe(o.dealer)
    }
  })
})

describe('一將的流程', () => {
  it('莊家胡或流局連莊，閒家胡下莊', () => {
    let m = startMatch({ seed: 1, winds: 1, firstDealer: 0 })
    m = nextHand(endWith(m, { type: 'exhaustive' }))
    expect([m.dealer, m.dealerStreak]).toEqual([0, 1])
    m = nextHand(endWith(m, winBy(0, [300, -100, -100, -100])))
    expect([m.dealer, m.dealerStreak]).toEqual([0, 2])
    m = nextHand(endWith(m, winBy(2, [-100, -100, 300, -100])))
    expect([m.dealer, m.dealerStreak]).toEqual([1, 0])
    expect(m.scores).toEqual([200, -200, 200, -200])
    expect(m.history).toHaveLength(3)
  })

  it('莊家輪完四人就換圈，打完設定的圈數就結束', () => {
    let m = startMatch({ seed: 1, winds: 2 })
    for (let i = 0; i < 4; i++) m = nextHand(endWith(m, winBy((m.dealer + 1) % 4, [0, 0, 0, 0])))
    expect(m.roundWind).toBe(1)
    expect(m.finished).toBe(false)
    for (let i = 0; i < 4; i++) m = nextHand(endWith(m, winBy((m.dealer + 1) % 4, [0, 0, 0, 0])))
    expect(m.finished).toBe(true)
    expect(m.round).toBeNull()
  })

  it('同一個種子可以完整重播', () => {
    const a = playOutMatch({ seed: 5, winds: 1 }, [efficiencyBot, efficiencyBot, efficiencyBot, efficiencyBot])
    const b = playOutMatch({ seed: 5, winds: 1 }, [efficiencyBot, efficiencyBot, efficiencyBot, efficiencyBot])
    expect(a.scores).toEqual(b.scores)
    expect(a.history.length).toBe(b.history.length)
  })

  it('機器人打完 4 將（每將四圈），分數總和為 0', { timeout: 30000 }, () => {
    const bots = [efficiencyBot, efficiencyBot, efficiencyBot, efficiencyBot]
    for (let seed = 0; seed < 4; seed++) {
      const m = playOutMatch({ seed, winds: 4 }, bots)
      expect(m.finished).toBe(true)
      expect(m.history.length).toBeGreaterThanOrEqual(16)
      expect(m.scores.reduce((a, b) => a + b, 0)).toBe(0)
    }
  })
})
