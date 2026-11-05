import { describe, expect, it } from 'vitest'
import { analyzeDiscards, isFlower, isWinningHand, parseTiles, scoreHand, toCounts, type Meld } from '../engine'
import { TUTORIALS, type ActionStep } from './index'
import { TAIWAN16_LESSONS } from './taiwan16'

/** 用台灣十六張的規則引擎檢查每一步：張數、動作是否真的能做、示範的台型是否真的有。 */
function check(step: ActionStep) {
  const hand = parseTiles(step.hand)
  const meldTiles = (step.melds ?? []).map(parseTiles)
  const melds: Meld[] = meldTiles.map((tiles) => ({ type: tiles.length === 4 ? 'ankan' : 'pung', tiles }))
  const ev = step.event
  const tile = parseTiles(ev.tile)[0]
  const counts = toCounts(hand)
  const isDraw = ev.type === 'draw'

  // 等別人打牌時暗手 = 16 − 3 × 副露組數
  expect(hand.length).toBe(16 - 3 * melds.length)

  const after = [...counts]
  after[tile]++
  const wins = !isFlower(tile) && isWinningHand(after, melds.length)

  switch (step.expect) {
    case 'discard': {
      expect(isDraw).toBe(true)
      const best = analyzeDiscards(after, melds.length)[0]
      expect(best.tile).toBe(parseTiles(step.discard!)[0])
      break
    }
    case 'flower':
      expect(isDraw && isFlower(tile)).toBe(true)
      break
    case 'chow': {
      expect(ev.type === 'discard' && ev.from === 'upper').toBe(true)
      const withTiles = parseTiles(step.chowWith!)
      expect(withTiles.every((t) => counts[t] > 0)).toBe(true)
      const seq = [...withTiles, tile].sort((a, b) => a - b)
      expect(seq[0] < 27 && Math.floor(seq[0] / 9) === Math.floor(seq[2] / 9)).toBe(true)
      expect(seq[1] - seq[0] === 1 && seq[2] - seq[1] === 1).toBe(true)
      break
    }
    case 'pass':
      // 用來教「不是上家不能吃」：這張牌也不能碰、不能胡
      expect(ev.type === 'discard' && ev.from !== 'upper').toBe(true)
      expect(counts[tile]).toBeLessThan(2)
      break
    case 'pung':
      expect(ev.type).toBe('discard')
      expect(counts[tile]).toBe(2)
      break
    case 'kong':
      expect(ev.type).toBe('discard')
      expect(counts[tile]).toBe(3)
      break
    case 'ankan':
      expect(isDraw).toBe(true)
      expect(counts[tile]).toBe(3)
      break
    case 'kakan':
      expect(isDraw).toBe(true)
      expect(meldTiles.some((m) => m.length === 3 && m.every((t) => t === tile))).toBe(true)
      break
    case 'ron':
      expect(ev.type === 'discard' || ev.type === 'kakan').toBe(true)
      expect(wins).toBe(true)
      break
    case 'tsumo':
      expect(isDraw).toBe(true)
      expect(wins).toBe(true)
      break
  }

  // 除了胡牌的步驟，其餘步驟不應該剛好也能胡，免得教錯重點
  if (step.expect !== 'ron' && step.expect !== 'tsumo') expect(wins).toBe(false)

  if (step.teachesTai) {
    const score = scoreHand({
      concealed: [...hand, tile],
      melds,
      winningTile: tile,
      selfDrawn: step.expect === 'tsumo',
      flowers: [],
      seatWind: 1,
      roundWind: 0,
      afterKong: ev.type === 'draw' && ev.replacement,
      lastTile: ev.type !== 'kakan' && ev.lastTile,
      robbingKong: ev.type === 'kakan',
    })
    expect(score.items.map((i) => i.name)).toContain(step.teachesTai)
  }
}

describe('教學課程：各玩法分開', () => {
  it('台灣十六張有課程，日麻、三麻的教學另外建立', () => {
    expect(TUTORIALS.taiwan16.length).toBeGreaterThan(0)
    expect(Object.keys(TUTORIALS).sort()).toEqual(['riichi', 'sanma', 'taiwan16'])
  })
})

describe('台灣十六張教學劇本', () => {
  it('課程 id 不重複，三個程度都有課程', () => {
    const ids = TAIWAN16_LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(TAIWAN16_LESSONS.map((l) => l.level))).toEqual(new Set(['intro', 'basic', 'advanced']))
  })

  for (const lesson of TAIWAN16_LESSONS) {
    describe(lesson.title, () => {
      lesson.steps.forEach((step, i) => {
        it(`第 ${i + 1} 步：${step.title}`, () => {
          if (step.kind === 'info') {
            for (const group of (step.tiles ?? '').split('|')) expect(() => parseTiles(group)).not.toThrow()
            return
          }
          check(step)
        })
      })
    })
  }

  it('牌型範例真的是胡牌', () => {
    const examples: Record<string, number> = { 胡牌的目標: 0, '碰碰胡（4 台）': 0, '嚦咕嚦咕（8 台）': 0 }
    for (const lesson of TAIWAN16_LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind === 'info' && step.title in examples) {
          const tiles = parseTiles(step.tiles!.replace(/\|/g, ''))
          expect(isWinningHand(toCounts(tiles), 0), step.title).toBe(true)
          examples[step.title]++
        }
      }
    }
    expect(Object.values(examples).every((n) => n === 1)).toBe(true)
  })
})
