import { describe, expect, it } from 'vitest'
import { Wall, dealInitial, fullTileSet, replaceFlowers } from '../wall'
import { isFlower, parseTiles } from '../tiles'

describe('牌牆', () => {
  it('一副牌 144 張', () => {
    expect(fullTileSet()).toHaveLength(144)
    expect(fullTileSet().filter(isFlower)).toHaveLength(8)
  })

  it('同一個種子洗出同一副牌', () => {
    const a = Wall.create(42)
    const b = Wall.create(42)
    for (let i = 0; i < 20; i++) expect(a.drawFront()).toBe(b.drawFront())
  })

  it('留牌之後就不能再摸', () => {
    const w = Wall.fromTiles(parseTiles('123456789m'), 7)
    expect(w.drawFront()).not.toBeNull()
    expect(w.drawBack()).not.toBeNull()
    expect(w.drawFront()).toBeNull()
    expect(w.isExhausted).toBe(true)
  })
})

describe('發牌與補花', () => {
  it('莊家 17 張、閒家 16 張，手上沒有花，牌數守恆', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const wall = Wall.create(seed)
      const dealer = seed % 4
      const { hands, flowers } = dealInitial(wall, dealer)
      hands.forEach((h, seat) => {
        expect(h).toHaveLength(seat === dealer ? 17 : 16)
        expect(h.some(isFlower)).toBe(false)
      })
      const used = hands.flat().length + flowers.flat().length
      expect(used + wall.remaining).toBe(144)
    }
  })

  it('補到花會繼續補', () => {
    // 從牌尾補：先補到春、再補到夏、最後補到二萬
    const wall = Wall.fromTiles(parseTiles('2m 2f 1f'), 0)
    const hand = parseTiles('1m 3f')
    const flowers: number[] = []
    expect(replaceFlowers(hand, flowers, wall)).toBe(true)
    expect(hand.some(isFlower)).toBe(false)
    expect(flowers).toHaveLength(3)
  })
})
