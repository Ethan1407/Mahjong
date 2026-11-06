import { describe, expect, it } from 'vitest'
import { createRng, parseTiles } from '../../engine'
import { randomBot, efficiencyBot } from '../bots'
import { applyAction, applyIfLegal, canDouble, doubleStakes, legalActions, seatsToAct, startRound } from '../round'
import type { RoundState } from '../types'
import { getView, visibleCounts } from '../view'
import { stackedRound, tile } from './helpers'

// 兩家同時聽紅中的牌局
const TWO_WAITING = [
  '123m 456m 789m 123p 456p 9s 5z', // 0 莊家
  '111s 234s 567s 789s 234p 5z', // 1 聽紅中
  '1199m 1199p 22334466z', // 2
  '345m 678m 345p 678p 666s 5z', // 3 也聽紅中
]

// 吃碰優先順序的牌局：莊家打三萬
const CHOW_PUNG = [
  '3m 456m 789m 123p 456p 789p 5z', // 0 莊家
  '124m 111s 222s 333s 444s 6z', // 1 下家，可以吃
  '33m 555s 666s 777s 888s 17z', // 2 可以碰
  '12m 999p 999s 111z 222z 34z', // 3 有一二萬，但不是下家
]

describe('胡牌與截胡', () => {
  it('兩家都能胡時，由打牌者下一家最近的人胡（截胡）', () => {
    let s = stackedRound({ hands: TWO_WAITING })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('5z') })
    expect(s.phase).toBe('claim')
    expect(seatsToAct(s).sort()).toEqual([1, 3])
    s = applyAction(s, { type: 'ron', seat: 3 })
    expect(s.phase).toBe('claim') // 還在等座位 1
    s = applyAction(s, { type: 'ron', seat: 1 })
    expect(s.phase).toBe('ended')
    const r = s.result!
    expect(r.type === 'win' && r.winner).toBe(1)
  })

  it('有人能胡時先問他；他胡了，能碰、能吃的人都不用再決定', () => {
    const hands = [...CHOW_PUNG]
    hands[3] = '12m 999p 999s 111z 222z 44z' // 聽三萬（邊張）
    let s = stackedRound({ hands })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('3m') })
    expect(seatsToAct(s)).toEqual([3])
    expect(legalActions(s, 1)).toEqual([])
    expect(legalActions(s, 2)).toEqual([])
    s = applyAction(s, { type: 'ron', seat: 3 })
    expect(s.phase).toBe('ended')
  })

  it('能胡的人不胡，才輪到碰，再輪到吃', () => {
    const hands = [...CHOW_PUNG]
    hands[3] = '12m 999p 999s 111z 222z 44z'
    let s = stackedRound({ hands, front: '2p' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('3m') })
    s = applyAction(s, { type: 'pass', seat: 3 })
    expect(seatsToAct(s)).toEqual([2])
    s = applyAction(s, { type: 'pass', seat: 2 })
    expect(seatsToAct(s)).toEqual([1])
  })

  it('較近的人不胡，就輪到下一個；人胡、放槍者付錢', () => {
    let s = stackedRound({ hands: TWO_WAITING })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('5z') })
    s = applyAction(s, { type: 'pass', seat: 1 })
    s = applyAction(s, { type: 'ron', seat: 3 })
    const r = s.result!
    if (r.type !== 'win') throw new Error('應該胡牌')
    expect(r.winner).toBe(3)
    expect(r.discarder).toBe(0)
    expect(r.score.items.map((i) => i.name)).toContain('人胡')
    expect(r.payments.payments.map((p) => p.payer)).toEqual([0])
    expect(r.payments.deltas.reduce((a, b) => a + b, 0)).toBe(0)
    // 胡的那張進到贏家手上，牌河標記為被拿走
    expect(s.players[3].hand).toHaveLength(17)
    expect(s.players[0].river.at(-1)!.claimed).toBe(true)
  })

  it('自摸：第一次摸牌就自摸是地胡、門清自摸', () => {
    let s = stackedRound({ hands: TWO_WAITING, front: '5z' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('9s') })
    // 座位 1 有 78 條可以吃九條，選擇不吃
    s = applyAction(s, { type: 'pass', seat: 1 })
    expect(s.turn).toBe(1)
    expect(s.lastDrawn).toBe(tile('5z'))
    expect(legalActions(s, 1).some((a) => a.type === 'tsumo')).toBe(true)
    s = applyAction(s, { type: 'tsumo', seat: 1 })
    const r = s.result!
    if (r.type !== 'win') throw new Error('應該胡牌')
    expect(r.selfDrawn).toBe(true)
    expect(r.score.items.map((i) => i.name)).toEqual(expect.arrayContaining(['門清自摸', '地胡', '獨聽']))
    expect(r.payments.payments).toHaveLength(3)
  })

  it('天胡：莊家開局就胡', () => {
    const s = stackedRound({
      hands: ['123m 456m 789m 123p 456p 11s', ...TWO_WAITING.slice(1).map((h) => h.replace('5z', '7z'))],
    })
    expect(legalActions(s, 0).some((a) => a.type === 'tsumo')).toBe(true)
    const done = applyAction(s, { type: 'tsumo', seat: 0 })
    const r = done.result!
    expect(r.type === 'win' && r.score.items.map((i) => i.name)).toContain('天胡')
  })
})

describe('吃、碰、槓', () => {
  it('只有下家能吃', () => {
    let s = stackedRound({ hands: CHOW_PUNG, front: '2p' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('3m') })
    // 先問能碰的座位 2；他不要之後才輪到下家決定要不要吃
    expect(legalActions(s, 1)).toEqual([])
    s = applyAction(s, { type: 'pass', seat: 2 })
    const chows = legalActions(s, 1).filter((a) => a.type === 'chow')
    expect(chows).toHaveLength(2) // 一二萬吃、二四萬吃
    expect(legalActions(s, 3)).toEqual([]) // 座位 3 有一二萬，但不是下家
  })

  it('碰優先於吃：能碰的人先決定，碰了就不用再問吃', () => {
    let s = stackedRound({ hands: CHOW_PUNG, front: '2p' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('3m') })
    expect(seatsToAct(s)).toEqual([2])
    s = applyAction(s, { type: 'pung', seat: 2 })
    expect(s.turn).toBe(2)
    expect(s.phase).toBe('discard')
    expect(s.drewThisTurn).toBe(false)
    expect(s.players[2].melds).toEqual([{ type: 'pung', tiles: parseTiles('333m'), fromSeat: 0, riverIndex: 0 }])
    expect(s.players[1].melds).toEqual([])
    // 牌河記下被誰、怎麼拿走
    expect(s.players[0].river[0]).toEqual({ tile: tile('3m'), claimed: true, claimedBy: { seat: 2, how: 'pung' } })
    // 碰完不能自摸，也不能槓，只能打牌
    expect(legalActions(s, 2).every((a) => a.type === 'discard')).toBe(true)
  })

  it('碰的人不要，下家就吃得到', () => {
    let s = stackedRound({ hands: CHOW_PUNG, front: '2p' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('3m') })
    s = applyAction(s, { type: 'pass', seat: 2 })
    s = applyAction(s, { type: 'chow', seat: 1, tiles: [tile('2m'), tile('4m')] })
    expect(s.turn).toBe(1)
    expect(s.players[1].melds[0].tiles).toEqual(parseTiles('234m'))
    expect(s.players[1].hand).toHaveLength(14)
  })

  it('沒人要就換下家摸牌，摸到花自動補花', () => {
    let s = stackedRound({ hands: CHOW_PUNG, front: '1f', back: '6p' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('5z') })
    expect(s.turn).toBe(1)
    expect(s.players[1].flowers).toEqual([tile('1f')])
    expect(s.lastDrawn).toBe(tile('6p'))
    expect(s.log.some((e) => e.type === 'flower' && e.seat === 1)).toBe(true)
  })

  it('暗槓後從牌尾補牌', () => {
    let s = stackedRound({
      hands: ['5555m 123p 456p 789p 123s 9s', ...CHOW_PUNG.slice(1)],
      back: '7p',
    })
    s = applyAction(s, { type: 'ankan', seat: 0, tile: tile('5m') })
    expect(s.players[0].melds[0].type).toBe('ankan')
    expect(s.lastDrawn).toBe(tile('7p'))
    expect(s.afterKong).toBe(true)
    // 別人看不到暗槓的牌
    const other = getView(s, 1).seats[0].melds[0]
    expect(other.hidden).toBe(true)
    expect(other.tiles).toEqual([])
  })
})

describe('搶槓', () => {
  function kakanSetup(): RoundState {
    const s = stackedRound({ hands: CHOW_PUNG, front: '2p', back: '8p' })
    // 直接設定局面：莊家已經碰了五筒，手上又有第四張
    s.players[0].melds = [{ type: 'pung', tiles: parseTiles('555p'), fromSeat: 2 }]
    s.players[0].hand = parseTiles('5p 123m 456m 789m 123s 9s')
    s.players[1].hand = parseTiles('46p 456s 789s 111z 222z 33z') // 聽五筒
    return s
  }

  it('有人聽那張牌就可以搶槓胡', () => {
    let s = kakanSetup()
    s = applyAction(s, { type: 'kakan', seat: 0, tile: tile('5p') })
    expect(s.phase).toBe('robKong')
    s = applyAction(s, { type: 'ron', seat: 1 })
    const r = s.result!
    if (r.type !== 'win') throw new Error('應該胡牌')
    expect(r.score.items.map((i) => i.name)).toContain('搶槓')
    expect(s.players[0].hand).not.toContain(tile('5p'))
  })

  it('沒人搶就完成加槓並補牌', () => {
    let s = kakanSetup()
    s = applyAction(s, { type: 'kakan', seat: 0, tile: tile('5p') })
    s = applyAction(s, { type: 'pass', seat: 1 })
    expect(s.players[0].melds[0].type).toBe('kakan')
    expect(s.players[0].melds[0].tiles).toHaveLength(4)
    expect(s.lastDrawn).toBe(tile('8p'))
  })
})

describe('流局與不合法動作', () => {
  it('牌摸完沒人胡就流局；最後一張打出的牌只能胡', () => {
    let s = stackedRound({ hands: CHOW_PUNG, front: '3m' })
    s = applyAction(s, { type: 'discard', seat: 0, tile: tile('5z') })
    expect(s.wall.isExhausted).toBe(true)
    // 座位 1 摸到最後一張三萬後打出：座位 2 有一對三萬但不能碰；莊家正好聽三萬，可以胡（河底撈魚）
    s = applyAction(s, { type: 'discard', seat: 1, tile: tile('3m') })
    expect(legalActions(s, 2)).toEqual([])
    expect(legalActions(s, 0).map((a) => a.type)).toEqual(['ron', 'pass'])
    s = applyAction(s, { type: 'pass', seat: 0 })
    expect(s.phase).toBe('ended')
    expect(s.result).toEqual({ type: 'exhaustive' })
  })

  it('不是自己的回合不能打牌', () => {
    const s = stackedRound({ hands: CHOW_PUNG })
    expect(() => applyAction(s, { type: 'discard', seat: 1, tile: tile('1m') })).toThrow()
  })
})

// ─────────────────────────── 大量隨機對局 ───────────────────────────

function checkInvariants(s: RoundState) {
  let total = s.wall.remaining
  for (const p of s.players) {
    total += p.hand.length + p.flowers.length
    total += p.melds.reduce((a, m) => a + m.tiles.length, 0)
    total += p.river.filter((r) => !r.claimed).length
  }
  expect(total).toBe(144)
  if (s.phase === 'ended') return
  s.players.forEach((p, seat) => {
    const base = 3 * (5 - p.melds.length) + 1
    const extra = s.phase === 'discard' && seat === s.turn ? 1 : 0
    expect(p.hand.length).toBe(base + extra)
  })
}

describe('隨機對局', () => {
  it('隨機亂打 300 局：牌數守恆、手牌張數正確、輸贏總和為 0', () => {
    const rng = createRng(2026)
    let wins = 0
    let calls = 0
    for (let seed = 0; seed < 300; seed++) {
      let s = startRound({ seed, dealer: seed % 4, dealerStreak: seed % 3, roundWind: seed % 4 })
      checkInvariants(s)
      while (s.phase !== 'ended') {
        for (const seat of seatsToAct(s)) {
          if (s.phase === 'ended') break
          s = applyAction(s, randomBot(getView(s, seat), rng))
          checkInvariants(s)
        }
      }
      calls += s.log.filter((e) => e.type === 'chow' || e.type === 'pung' || e.type.endsWith('kan')).length
      if (s.result!.type === 'win') {
        wins++
        expect(s.result!.score.valid).toBe(true)
        expect(s.result!.payments.deltas.reduce((a, b) => a + b, 0)).toBe(0)
      }
    }
    expect(calls).toBeGreaterThan(100) // 確實測到吃碰槓
    expect(wins).toBeGreaterThan(0)
  })

  it('看得到的牌數不會超過 4 張', () => {
    const rng = createRng(7)
    let s = startRound({ seed: 99, dealer: 0, dealerStreak: 0, roundWind: 0 })
    while (s.phase !== 'ended') {
      for (const seat of seatsToAct(s)) {
        if (s.phase === 'ended') break
        const view = getView(s, seat)
        expect(visibleCounts(view).every((n) => n <= 4)).toBe(true)
        s = applyAction(s, efficiencyBot(view, rng))
      }
    }
  })
})

describe('台數加倍', () => {
  it('前兩圈內可以加倍一次，結算時每台的錢變兩倍', () => {
    const s0 = startRound({ seed: 3, dealer: 0, dealerStreak: 0, roundWind: 0 })
    expect(canDouble(s0)).toBe(true)
    const s1 = doubleStakes(s0, 0)
    expect(s1.rules.perTai).toBe(s0.rules.perTai * 2)
    expect(s1.doubled).toEqual({ by: 0, fromPerTai: s0.rules.perTai, factor: 2 })
    expect(canDouble(s1)).toBe(false)
    // 可以選 2–5 倍
    expect(doubleStakes(s0, 0, 5).rules.perTai).toBe(s0.rules.perTai * 5)
    expect(() => doubleStakes(s0, 0, 6)).toThrow()
    expect(s0.rules.perTai).toBe(20) // 原本的狀態不受影響
  })

  it('超過兩圈就不能加倍', () => {
    const s = startRound({ seed: 3, dealer: 0, dealerStreak: 0, roundWind: 0 })
    s.players.forEach((p) => (p.discards = 2))
    expect(canDouble(s)).toBe(false)
  })
})

describe('過期的動作（畫面用）', () => {
  it('快速連點兩下打牌：第二次已經不合法，忽略而不是丟出錯誤', () => {
    const s0 = stackedRound({ hands: TWO_WAITING })
    const discard = { type: 'discard', seat: 0, tile: tile('5z') } as const
    const s1 = applyIfLegal(s0, discard)
    expect(s1.phase).toBe('claim')
    // 同一個動作再送一次：applyAction 會丟錯誤，applyIfLegal 原封不動回傳
    expect(() => applyAction(s1, discard)).toThrow()
    expect(applyIfLegal(s1, discard)).toBe(s1)
  })
})
