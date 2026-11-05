import { describe, expect, it } from 'vitest'
import {
  analyzeDiscards,
  decompose,
  effectiveTiles,
  isLiguLigu,
  isWinningHand,
  shanten,
  waits,
} from '../hand'
import { parseTiles, toCounts } from '../tiles'

const c = (s: string) => toCounts(parseTiles(s))

describe('胡牌判定', () => {
  it('一般型 5 組面子 + 1 對', () => {
    expect(isWinningHand(c('123m 456m 789m 123p 456p 11s'), 0)).toBe(true)
  })

  it('差一張不是胡', () => {
    expect(isWinningHand(c('123m 456m 789m 123p 456p 12s'), 0)).toBe(false)
  })

  it('有副露時只看暗手需要的組數', () => {
    expect(isWinningHand(c('123m 11s'), 4)).toBe(true)
    expect(isWinningHand(c('123m 11s'), 3)).toBe(false)
  })

  it('嚦咕嚦咕：7 對 + 1 刻', () => {
    const hand = c('1122m 3344p 5566s 77z 111z')
    expect(isLiguLigu(hand)).toBe(true)
    expect(isWinningHand(hand, 0)).toBe(true)
    expect(isWinningHand(hand, 0, { allowLiguLigu: false })).toBe(false)
  })
})

describe('拆牌', () => {
  it('同一手牌列出所有拆法', () => {
    const ds = decompose(c('111222333m 456p 789p 11s'))
    const kinds = ds.map((d) => d.sets.filter((s) => s.kind === 'pung').length).sort()
    expect(kinds).toEqual([0, 3])
  })
})

describe('向聽數', () => {
  it('胡牌 = -1', () => {
    expect(shanten(c('123m 456m 789m 123p 456p 11s'), 0)).toBe(-1)
  })

  it('聽牌 = 0', () => {
    expect(shanten(c('123m 456m 789m 123p 456p 1s'), 0)).toBe(0)
  })

  it('一向聽', () => {
    expect(shanten(c('123m 456m 789m 123p 45p 19s'), 0)).toBe(1)
  })

  it('完全散牌的向聽數合理', () => {
    // 16 張：每種花色都是孤張
    const s = shanten(c('147m 258p 369s 1234567z'), 0)
    expect(s).toBeGreaterThanOrEqual(6)
    expect(s).toBeLessThanOrEqual(10)
  })

  it('有副露時也正確', () => {
    expect(shanten(c('123m 4m'), 4)).toBe(0)
    expect(shanten(c('13m 59p'), 4)).toBe(1)
  })
})

describe('十三張玩法（4 組面子 + 1 對，供日麻、三麻等未來玩法使用）', () => {
  const four = { totalSets: 4 }

  it('14 張胡牌', () => {
    expect(isWinningHand(c('123m 456m 789m 123p 11s'), 0, four)).toBe(true)
    // 同一手牌在十六張規則下張數不對
    expect(isWinningHand(c('123m 456m 789m 123p 11s'), 0)).toBe(false)
  })

  it('向聽數與聽牌', () => {
    expect(shanten(c('123m 456m 789m 123p 1s'), 0, 4)).toBe(0)
    expect(waits(c('1112345678999m'), 0, four)).toEqual(parseTiles('123456789m'))
    expect(effectiveTiles(c('123m 456m 789m 45p 19s'), 0, 4)).toEqual(parseTiles('36p 19s'))
  })
})

describe('聽牌與有效進張', () => {
  it('單吊只聽一張', () => {
    expect(waits(c('123m 456m 789m 123p 456p 1s'), 0)).toEqual(parseTiles('1s'))
  })

  it('九蓮寶燈形聽 1–9 萬', () => {
    expect(waits(c('1112345678999m 123p'), 0)).toEqual(parseTiles('123456789m'))
  })

  it('一向聽的有效進張', () => {
    expect(effectiveTiles(c('123m 456m 789m 123p 45p 19s'), 0)).toEqual(parseTiles('36p 19s'))
  })

  it('打牌分析把最好的選擇排在前面，並扣掉場上看得到的牌', () => {
    // 17 張：1s、9s、北風都是孤張；但北風已經出現 3 張，留著它沒有用
    const hand = c('123m 456m 789m 123p 45p 19s 4z')
    const visible = [...hand]
    visible[parseTiles('4z')[0]] += 3
    const options = analyzeDiscards(hand, 0, visible)
    expect(options[0].tile).toBe(parseTiles('4z')[0])
    expect(options[0].shanten).toBe(1)
    // 打北風後進張 3p、6p、1s、9s，各剩 3、4、3、3 張（手上已有一張 3p）
    expect(options[0].effectiveCount).toBe(13)
    // 打 1s 的話，北風已經沒牌可摸：3p、6p、9s = 3 + 4 + 3
    expect(options.find((o) => o.tile === parseTiles('1s')[0])!.effectiveCount).toBe(10)
  })
})
