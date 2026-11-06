import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../../game'
import { burstFor } from '../GoldBurst'

describe('吃碰槓胡的大字', () => {
  it('每種動作都有對應的字，並寫出是誰', () => {
    expect(burstFor({ type: 'pung', seat: 1, from: 0, tiles: [0, 0, 0], claimed: 0 })).toMatchObject({ text: '碰！', sub: '下家', effect: 'gold' })
    expect(burstFor({ type: 'chow', seat: 0, from: 3, tiles: [0, 1, 2], claimed: 1 })).toMatchObject({ text: '吃！', sub: '你' })
    expect(burstFor({ type: 'minkan', seat: 2, from: 1, tiles: [5, 5, 5, 5], claimed: 5 })?.text).toBe('槓！')
    expect(burstFor({ type: 'kakan', seat: 3, tile: 5 })?.text).toBe('加槓！')
    expect(burstFor({ type: 'ankan', seat: 3, tile: 5 })?.text).toBe('暗槓！')
    expect(burstFor({ type: 'win', seat: 2, from: 0, tile: 3 })).toMatchObject({ text: '胡！', sub: '對家' })
    expect(burstFor({ type: 'win', seat: 0, from: null, tile: 3 })).toMatchObject({ text: '自摸！', sub: '你' })
  })

  it('摸牌、打牌、補花不顯示', () => {
    expect(burstFor({ type: 'discard', seat: 0, tile: 3 })).toBeNull()
    expect(burstFor({ type: 'draw', seat: 0, tile: 3, replacement: false })).toBeNull()
    expect(burstFor({ type: 'flower', seat: 0, tile: 34 })).toBeNull()
  })

  it('你自己的動作用你裝備的特效，機器人的動作一律金光', () => {
    expect(burstFor({ type: 'pung', seat: 0, from: 1, tiles: [0, 0, 0], claimed: 0 }, 'sakura')?.effect).toBe('sakura')
    expect(burstFor({ type: 'win', seat: 0, from: null, tile: 3 }, 'thunder')?.effect).toBe('thunder')
    expect(burstFor({ type: 'pung', seat: 2, from: 1, tiles: [0, 0, 0], claimed: 0 }, 'sakura')?.effect).toBe('gold')
  })

  it('裝備的特效套用到你所有的動作：吃、碰、明槓、加槓、暗槓、胡、自摸', () => {
    const mine: GameEvent[] = [
      { type: 'chow', seat: 0, from: 3, tiles: [0, 1, 2], claimed: 1 },
      { type: 'pung', seat: 0, from: 1, tiles: [5, 5, 5], claimed: 5 },
      { type: 'minkan', seat: 0, from: 2, tiles: [5, 5, 5, 5], claimed: 5 },
      { type: 'kakan', seat: 0, tile: 5 },
      { type: 'ankan', seat: 0, tile: 5 },
      { type: 'win', seat: 0, from: 2, tile: 3 },
      { type: 'win', seat: 0, from: null, tile: 3 },
    ]
    for (const e of mine) expect(burstFor(e, 'fire')?.effect).toBe('fire')
  })

  it('鯨魚用的動作分類與牌：吃的是上家打出的那張，明槓／加槓／暗槓都是槓', () => {
    const cases: [GameEvent, string, number | undefined][] = [
      [{ type: 'chow', seat: 0, from: 3, tiles: [0, 1, 2], claimed: 1 }, 'chow', 1],
      [{ type: 'pung', seat: 0, from: 1, tiles: [5, 5, 5], claimed: 5 }, 'pung', 5],
      [{ type: 'minkan', seat: 0, from: 2, tiles: [7, 7, 7, 7], claimed: 7 }, 'kong', 7],
      [{ type: 'kakan', seat: 0, tile: 8 }, 'kong', 8],
      [{ type: 'ankan', seat: 0, tile: 9 }, 'kong', 9],
      [{ type: 'win', seat: 0, from: 2, tile: 3 }, 'win', 3],
      [{ type: 'win', seat: 0, from: null, tile: null }, 'win', undefined],
    ]
    for (const [e, action, tile] of cases) expect(burstFor(e, 'whale')).toMatchObject({ effect: 'whale', action, tile })
  })
})
