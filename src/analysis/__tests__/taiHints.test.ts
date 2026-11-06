import { describe, expect, it } from 'vitest'
import { parseTiles, sortTiles } from '../../engine'
import { getView, startRound, type RoundState } from '../../game'
import { flowerNotes, meldNotes, myStatusNotes, myTaiHints } from '../taiHints'

/** 自己是座位 0、莊家（門風東），東風圈。 */
function table(hand: string, setup?: (s: RoundState) => void) {
  const s = startRound({ seed: 1, dealer: 0, dealerStreak: 0, roundWind: 0 })
  s.players[0].hand = sortTiles(parseTiles(hand))
  s.players[0].flowers = []
  setup?.(s)
  return getView(s, 0)
}
const names = (hs: { name: string }[]) => hs.map((h) => h.name)

describe('有台的組合', () => {
  it('碰出來的三元牌、門風、圈風刻子', () => {
    expect(names(meldNotes({ type: 'pung', tiles: parseTiles('555z') }, 1, 0))).toEqual(['三元刻（紅中）'])
    // 東風圈、門風也是東：兩台
    expect(names(meldNotes({ type: 'pung', tiles: parseTiles('111z') }, 0, 0))).toEqual(['門風刻（東）', '圈風刻（東）'])
    // 別人的門風不算
    expect(meldNotes({ type: 'pung', tiles: parseTiles('333z') }, 1, 0)).toEqual([])
    expect(meldNotes({ type: 'chow', tiles: parseTiles('123m') }, 0, 0)).toEqual([])
  })

  it('正花與花槓', () => {
    const n = flowerNotes(parseTiles('1f 5f 2f'), 0) // 東：春、梅
    expect([...n.keys()].sort()).toEqual(parseTiles('1f 5f').sort())
    const full = flowerNotes(parseTiles('1234f'), 1)
    expect(full.size).toBe(4)
    expect(full.get(parseTiles('1f')[0])!.name).toContain('花槓')
  })

  it('還沒胡就已經有一條龍：框出那九張牌', () => {
    const view = table('123456789m 45p 11s 7z 6z 55s')
    const h = myTaiHints(view).find((x) => x.name.startsWith('一條龍'))!
    expect(h.tai).toBe(16)
    expect(h.whenWin).toBe(true)
    expect(sortTiles(h.tiles)).toEqual(parseTiles('123456789m'))
  })

  it('吃出來的順子也能湊一條龍', () => {
    const view = table('456s 789s 11m 23p 55z 9p', (s) => {
      s.players[0].melds = [{ type: 'chow', tiles: parseTiles('123s'), fromSeat: 3 }]
    })
    const h = myTaiHints(view).find((x) => x.name.startsWith('一條龍'))!
    expect(h.meldIdx).toEqual([0])
    expect(h.tiles).toHaveLength(6)
  })

  it('手上的三元牌刻子；湊到小三元時取代個別的三元刻', () => {
    expect(names(myTaiHints(table('555z 123m 456m 789p 1s 2s 3s 4s')))).toContain('三元刻（紅中）')
    const small = names(myTaiHints(table('555z 666z 77z 123m 456p 78s 9s')))
    expect(small).toContain('小三元')
    expect(small.some((n) => n.startsWith('三元刻'))).toBe(false)
  })

  it('三暗刻', () => {
    const h = myTaiHints(table('111m 555p 999s 23m 45p 67s 1z')).find((x) => x.name === '三暗刻')!
    expect(h.tai).toBe(2)
    expect(h.tiles).toHaveLength(9)
  })

  it('目前狀態：門清、混一色、清一色', () => {
    expect(names(myStatusNotes(table('123456789m 11z 2345m 6m')))).toEqual(['門清', '混一色'])
    expect(names(myStatusNotes(table('1112345678999m 234m')))).toEqual(['門清', '清一色'])
  })
})
