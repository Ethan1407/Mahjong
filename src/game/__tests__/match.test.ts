import { describe, expect, it } from 'vitest'
import { efficiencyBot } from '../bots'
import { nextHand, playOutMatch, startMatch, type MatchState } from '../match'
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

describe('一將的流程', () => {
  it('莊家胡或流局連莊，閒家胡下莊', () => {
    let m = startMatch({ seed: 1, winds: 1 })
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
