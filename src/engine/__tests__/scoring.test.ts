import { describe, expect, it } from 'vitest'
import { computePayments, scoreHand, type Meld, type WinContext } from '../scoring'
import { parseTiles } from '../tiles'

const t = (s: string) => parseTiles(s)[0]

function ctx(partial: Partial<Omit<WinContext, 'concealed'>> & { concealed: string; win: string }): WinContext {
  const { concealed, win, ...rest } = partial
  return {
    melds: [],
    selfDrawn: false,
    flowers: [],
    seatWind: 0,
    roundWind: 0,
    ...rest,
    concealed: parseTiles(concealed),
    winningTile: t(win),
  }
}

const names = (r: ReturnType<typeof scoreHand>) => r.items.map((i) => i.name)

describe('台數', () => {
  it('平胡 + 門清', () => {
    const r = scoreHand(ctx({ concealed: '123m 456m 678p 234p 678s 55p', win: '8s' }))
    expect(r.valid).toBe(true)
    expect(names(r).sort()).toEqual(['平胡', '門清'].sort())
    expect(r.tai).toBe(3)
  })

  it('門清自摸取代門清與自摸，自摸不算平胡', () => {
    const r = scoreHand(ctx({ concealed: '123m 456m 678p 234p 678s 55p', win: '8s', selfDrawn: true }))
    expect(names(r)).toEqual(['門清自摸'])
    expect(r.tai).toBe(3)
  })

  it('清一色', () => {
    const r = scoreHand(ctx({ concealed: '111m 234m 345m 666m 789m 99m', win: '5m' }))
    expect(names(r)).toContain('清一色')
  })

  it('碰碰胡 + 三暗刻 + 獨聽（單吊）', () => {
    const melds: Meld[] = [
      { type: 'pung', tiles: parseTiles('555p'), fromSeat: 1 },
      { type: 'pung', tiles: parseTiles('777s'), fromSeat: 2 },
    ]
    const r = scoreHand(ctx({ concealed: '111m 999m 222z 33s', win: '3s', melds }))
    expect(names(r).sort()).toEqual(['三暗刻', '獨聽', '碰碰胡'].sort())
    expect(r.tai).toBe(7)
  })

  it('胡別人的牌成刻子，那組不算暗刻', () => {
    const melds: Meld[] = [
      { type: 'pung', tiles: parseTiles('555p'), fromSeat: 1 },
      { type: 'pung', tiles: parseTiles('777s'), fromSeat: 2 },
    ]
    const r = scoreHand(ctx({ concealed: '111m 999m 222z 33s', win: '9m', melds }))
    expect(names(r)).toEqual(['碰碰胡'])
    // 自摸則三組都是暗刻
    const r2 = scoreHand(ctx({ concealed: '111m 999m 222z 33s', win: '9m', melds, selfDrawn: true }))
    expect(names(r2)).toContain('三暗刻')
  })

  it('大三元取代三元刻', () => {
    const r = scoreHand(ctx({ concealed: '555z 666z 777z 123m 456p 11p', win: '1p' }))
    expect(names(r)).toContain('大三元')
    expect(names(r).some((n) => n.startsWith('三元刻'))).toBe(false)
    expect(r.tai).toBe(1 + 8 + 1 + 2) // 門清 + 大三元 + 獨聽 + 三暗刻
  })

  it('門風與圈風相同時兩台都算', () => {
    const r = scoreHand(ctx({ concealed: '111z 123m 456m 789m 234p 55s', win: '5s' }))
    expect(names(r)).toContain('門風刻（東）')
    expect(names(r)).toContain('圈風刻（東）')
  })

  it('正花與花槓', () => {
    const base = { concealed: '123m 456m 678p 234p 678s 55p', win: '8s', seatWind: 1 }
    const r1 = scoreHand(ctx({ ...base, flowers: parseTiles('1f 2f 6f') }))
    expect(names(r1).filter((n) => n.includes('花'))).toEqual(['正花（夏）', '正花（蘭）'])
    const r2 = scoreHand(ctx({ ...base, flowers: parseTiles('1234f 6f') }))
    expect(names(r2).filter((n) => n.includes('花'))).toEqual(['花槓（春夏秋冬）', '正花（蘭）'])
  })

  it('嚦咕嚦咕', () => {
    const r = scoreHand(ctx({ concealed: '1122m 3344p 5566s 77z 111z', win: '7z' }))
    expect(r.pattern).toBe('liguligu')
    expect(names(r).sort()).toEqual(['嚦咕嚦咕', '獨聽'].sort())
  })

  it('一條龍：採用國際麻將的 16 台，可關閉', () => {
    const hand = { concealed: '123456789m 345p 678s 99p', win: '9p' }
    expect(scoreHand(ctx(hand)).items).toContainEqual({ name: '一條龍', tai: 16 })
    const off = scoreHand(ctx(hand), { base: 100, perTai: 20, allowLiguLigu: true, straightTai: 0 })
    expect(names(off)).not.toContain('一條龍')
    // 吃出來的順子也算
    const melds: Meld[] = [{ type: 'chow', tiles: parseTiles('123s'), fromSeat: 3 }]
    expect(names(scoreHand(ctx({ concealed: '456s 789s 111m 234p 55z', win: '5z', melds })))).toContain('一條龍')
  })

  it('不是胡牌就無效', () => {
    expect(scoreHand(ctx({ concealed: '123m 456m 789m 123p 456p 12s', win: '2s' })).valid).toBe(false)
  })

  it('八仙過海只算此項', () => {
    const r = scoreHand(ctx({ concealed: '', win: '1m', special: 'eightFlowers' }))
    expect(r.tai).toBe(8)
  })
})

describe('付款', () => {
  it('放槍：只有放槍者付，莊家放槍要加莊家與連莊台', () => {
    const r = computePayments({ winner: 2, discarder: 0, dealer: 0, dealerStreak: 1, handTai: 3 })
    expect(r.payments).toEqual([{ payer: 0, tai: 6, amount: 220, dealerTai: 3 }])
    expect(r.deltas).toEqual([-220, 0, 220, 0])
  })

  it('莊家自摸：三家都加莊家台', () => {
    const r = computePayments({ winner: 0, discarder: null, dealer: 0, dealerStreak: 0, handTai: 3 })
    expect(r.deltas).toEqual([540, -180, -180, -180])
  })

  it('閒家自摸：只有莊家那份加莊家台', () => {
    const r = computePayments({ winner: 2, discarder: null, dealer: 0, dealerStreak: 0, handTai: 3 })
    expect(r.deltas).toEqual([-180, -160, 500, -160])
  })
})
