import { describe, expect, it } from 'vitest'
import { createRng, parseTiles, sortTiles } from '../../engine'
import { applyAction, getView, seatsToAct, startRound, type RoundState } from '../../game'
import { stackedRound, tile } from '../../game/__tests__/helpers'
import { decide, type BotLevel } from '../brains'
import { likelyNeeds, readOpponent, tileDanger } from '../danger'

/**
 * 座位 1 看起來快聽牌了：吃碰了 4 組、打了 12 張。
 * 座位 0（自己）手牌很散，輪到自己打牌。
 */
function dangerousTable(myHand = '19m 19p 19s 1234567z 25m 36p'): RoundState {
  const s = startRound({ seed: 1, dealer: 0, dealerStreak: 0, roundWind: 0 })
  s.players[0].hand = sortTiles(parseTiles(myHand))
  s.players[1].melds = [
    { type: 'pung', tiles: parseTiles('222p'), fromSeat: 2 },
    { type: 'pung', tiles: parseTiles('444p'), fromSeat: 3 },
    { type: 'chow', tiles: parseTiles('567p'), fromSeat: 0 },
    { type: 'pung', tiles: parseTiles('888p'), fromSeat: 2 },
  ]
  s.players[1].hand = parseTiles('9p')
  s.players[1].river = parseTiles('7z 6z 9s 1s 8m 2s 3m 4m 5s 6m 7s 8s').map((t) => ({ tile: t, claimed: false }))
  s.turn = 0
  s.phase = 'discard'
  s.drewThisTurn = true
  return s
}

describe('放槍危險度', () => {
  it('吃碰很多組、打很多張的人，聽牌機率高', () => {
    const view = getView(dangerousTable(), 0)
    expect(readOpponent(view, 1).tenpai).toBeGreaterThan(0.6)
    expect(readOpponent(view, 2).tenpai).toBeLessThan(0.3)
  })

  it('他打過的牌比沒打過的牌安全（但台灣沒有振聽，不是零）', () => {
    const view = getView(dangerousTable(), 0)
    const discarded = tileDanger(view, tile('7z')).risk
    const fresh = tileDanger(view, tile('1z')).risk
    expect(discarded).toBeGreaterThan(0)
    expect(discarded).toBeLessThan(fresh)
  })

  it('筋牌比較安全：他打過四萬，一萬比一筒安全', () => {
    const s = dangerousTable()
    s.players[1].melds = s.players[1].melds.slice(0, 2).map((m) => ({ ...m, tiles: parseTiles('111z') }))
    const view = getView(s, 0)
    expect(tileDanger(view, tile('1m')).risk).toBeLessThan(tileDanger(view, tile('1p')).risk)
  })

  it('懷疑在做一色：那個花色特別危險', () => {
    const view = getView(dangerousTable(), 0)
    expect(readOpponent(view, 1).flushSuit).toBe(1) // 筒子
    expect(tileDanger(view, tile('3p')).risk).toBeGreaterThan(tileDanger(view, tile('3s')).risk)
  })

  it('推測可能需要的牌：在做筒子一色的人，大多是筒子，並附上依據', () => {
    const view = getView(dangerousTable(), 0)
    const needs = likelyNeeds(view, 1)
    expect(needs.tiles.length).toBeGreaterThan(0)
    expect(needs.tiles.filter((t) => t >= 9 && t < 18).length).toBeGreaterThanOrEqual(needs.tiles.length - 1)
    expect(needs.basis.join()).toContain('一色')
    // 他打過的牌不會排在最前面
    expect(view.seats[1].river.map((r) => r.tile)).not.toContain(needs.tiles[0])
  })

  it('開局資訊太少時不下判斷', () => {
    const s = startRound({ seed: 5, dealer: 0, dealerStreak: 0, roundWind: 0 })
    s.players[1].river = parseTiles('1z 9m').map((t) => ({ tile: t, claimed: false }))
    const view = getView(s, 0)
    expect(readOpponent(view, 1).enoughInfo).toBe(false)
    const needs = likelyNeeds(view, 1)
    expect(needs.enoughInfo).toBe(false)
    expect(needs.tiles).toEqual([])
  })

  it('很早打過的牌不如最近打的安全；打完又吃碰過，更不可靠', () => {
    const s = dangerousTable()
    s.players[1].melds = s.players[1].melds.map((m) => ({ ...m, riverIndex: 0 }))
    const view = getView(s, 0)
    // 白板是他第 1 張打的，八條是最近打的
    const early = tileDanger(view, tile('7z')).perSeat.find((p) => p.seat === 1)!
    const recent = tileDanger(view, tile('8s')).perSeat.find((p) => p.seat === 1)!
    expect(early.reasons[0]).toContain('較早打過')
    expect(recent.reasons[0]).toContain('最近才打過')
    // 同一張牌：打完之後又吃碰過，參考價值變低（風險變高）
    const s2 = dangerousTable()
    s2.players[1].melds = s2.players[1].melds.map((m) => ({ ...m, riverIndex: 11 }))
    const changed = tileDanger(getView(s2, 0), tile('7z')).perSeat.find((p) => p.seat === 1)!
    expect(changed.risk).toBeGreaterThan(early.risk)
  })

  it('從動作推測：剛碰的牌與花色偏好', () => {
    const s = dangerousTable()
    s.players[1].melds[3].riverIndex = 12
    const hints = readOpponent(getView(s, 0), 1).hints.join('|')
    expect(hints).toContain('剛剛碰了八筒')
    expect(hints).toContain('幾乎不打筒子')
  })

  it('字牌四張都看得到就完全安全', () => {
    const s = dangerousTable('19m 19p 19s 1111z 2345z 25m 36p')
    s.players[1].river = []
    const view = getView(s, 0)
    expect(tileDanger(view, tile('1z')).risk).toBe(0)
  })
})

describe('機器人的決定', () => {
  const levels: BotLevel[] = ['easy', 'normal', 'hard']

  it('能胡一定胡', () => {
    const s0 = stackedRound({
      hands: [
        '123m 456m 789m 123p 456p 9s 5z',
        '111s 234s 567s 789s 234p 5z',
        '1199m 1199p 22334466z',
        '345m 678m 345p 678p 666s 7z',
      ],
      front: '2p',
    })
    const s = applyAction(s0, { type: 'discard', seat: 0, tile: tile('5z') })
    for (const level of levels) expect(decide(getView(s, 1), createRng(1), level).action.type).toBe('ron')
  })

  it('中等、困難：有人可能聽牌、自己還很遠時，改打最安全的牌（不碰他在做的一色）', () => {
    const view = getView(dangerousTable(), 0)
    const risks = [...new Set(view.hand)].map((t) => tileDanger(view, t).risk)
    for (const level of ['normal', 'hard'] as const) {
      const d = decide(view, createRng(1), level)
      if (d.action.type !== 'discard') throw new Error('應該打牌')
      expect(tileDanger(view, d.action.tile).risk).toBeCloseTo(Math.min(...risks), 5)
      expect(d.action.tile >= 9 && d.action.tile < 18).toBe(false) // 不打筒子
      expect(d.reason).toContain('可能聽牌')
    }
  })

  it('每個決定都附上理由', () => {
    const view = getView(startRound({ seed: 3, dealer: 0, dealerStreak: 0, roundWind: 0 }), 0)
    for (const level of levels) expect(decide(view, createRng(1), level).reason.length).toBeGreaterThan(0)
  })

  it('三種難度混打 60 局，每一步都是合法動作', () => {
    const rng = createRng(42)
    for (let seed = 0; seed < 60; seed++) {
      const seatLevels = [0, 1, 2, 3].map((i) => levels[(i + seed) % 3])
      let s = startRound({ seed, dealer: seed % 4, dealerStreak: 0, roundWind: 0 })
      while (s.phase !== 'ended') {
        for (const seat of seatsToAct(s)) {
          if (s.phase === 'ended') break
          s = applyAction(s, decide(getView(s, seat), rng, seatLevels[seat]).action) // 不合法會丟出錯誤
        }
      }
      expect(s.result).not.toBeNull()
    }
  })
})
