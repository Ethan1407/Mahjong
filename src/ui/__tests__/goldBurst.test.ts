import { describe, expect, it } from 'vitest'
import { burstFor } from '../GoldBurst'

describe('吃碰槓胡的金字', () => {
  it('每種動作都有對應的字，並寫出是誰', () => {
    expect(burstFor({ type: 'pung', seat: 1, from: 0, tiles: [0, 0, 0] })).toEqual({ text: '碰！', sub: '下家' })
    expect(burstFor({ type: 'chow', seat: 0, from: 3, tiles: [0, 1, 2] })).toEqual({ text: '吃！', sub: '你' })
    expect(burstFor({ type: 'minkan', seat: 2, from: 1, tiles: [5, 5, 5, 5] })?.text).toBe('槓！')
    expect(burstFor({ type: 'kakan', seat: 3, tile: 5 })?.text).toBe('加槓！')
    expect(burstFor({ type: 'ankan', seat: 3, tile: 5 })?.text).toBe('暗槓！')
    expect(burstFor({ type: 'win', seat: 2, from: 0, tile: 3 })).toEqual({ text: '胡！', sub: '對家' })
    expect(burstFor({ type: 'win', seat: 0, from: null, tile: 3 })).toEqual({ text: '自摸！', sub: '你' })
  })

  it('摸牌、打牌、補花不顯示', () => {
    expect(burstFor({ type: 'discard', seat: 0, tile: 3 })).toBeNull()
    expect(burstFor({ type: 'draw', seat: 0, tile: 3, replacement: false })).toBeNull()
    expect(burstFor({ type: 'flower', seat: 0, tile: 34 })).toBeNull()
  })
})
