/**
 * 「有台的組合」提示：找出已經成形、胡牌時會加台的牌組，畫面上用金框標示並說明原因。
 *
 * 副露與花牌是公開資訊，所有人的都可以標；暗手只分析自己的。
 * 台數依 docs/RULES.md，與 engine/scoring.ts 一致。
 */
import {
  DEFAULT_RULES,
  WIND_NAMES,
  isDragon,
  isWind,
  seatFlowers,
  tileName,
  toCounts,
  windTile,
  type Meld,
  type RuleConfig,
  type Tile,
} from '../engine'
import type { PlayerView } from '../game'

export interface TaiNote {
  name: string
  tai: number
  reason: string
}

export interface TaiHint extends TaiNote {
  /** 暗手中相關的牌（含重複）。 */
  tiles: Tile[]
  /** 相關的副露（索引）。 */
  meldIdx: number[]
  /** 相關的花牌。 */
  flowers: Tile[]
  /** true = 要胡牌時才算（例如暗手中的刻子可能被拆掉）；false = 已經確定（亮出來的副露、花牌）。 */
  whenWin: boolean
}

const SUIT_NAMES = ['萬', '筒', '條']

/** 字牌刻子（或槓）的台：三元牌、門風、圈風。 */
export function honorPungNotes(tile: Tile, seatWind: number, roundWind: number): TaiNote[] {
  const notes: TaiNote[] = []
  if (isDragon(tile)) {
    notes.push({ name: `三元刻（${tileName(tile)}）`, tai: 1, reason: '中、發、白的刻子或槓，每組 1 台' })
  }
  if (isWind(tile) && tile === windTile(seatWind)) {
    notes.push({ name: `門風刻（${WIND_NAMES[seatWind]}）`, tai: 1, reason: `門風是${WIND_NAMES[seatWind]}，${tileName(tile)}的刻子或槓 1 台` })
  }
  if (isWind(tile) && tile === windTile(roundWind)) {
    notes.push({ name: `圈風刻（${WIND_NAMES[roundWind]}）`, tai: 1, reason: `現在是${WIND_NAMES[roundWind]}風圈，${tileName(tile)}的刻子或槓 1 台` })
  }
  return notes
}

/** 亮出來的副露有沒有台（暗槓別人看不到時不算）。 */
export function meldNotes(meld: Meld & { hidden?: boolean }, seatWind: number, roundWind: number): TaiNote[] {
  if (meld.hidden || meld.type === 'chow') return []
  return honorPungNotes(meld.tiles[0], seatWind, roundWind)
}

/** 每張花牌的台：正花 1 台；集齊一整套是花槓 2 台（取代那一套的正花）。 */
export function flowerNotes(flowers: Tile[], seatWind: number): Map<Tile, TaiNote> {
  const out = new Map<Tile, TaiNote>()
  const own = seatFlowers(seatWind)
  const sets: [Tile[], string][] = [
    [[34, 35, 36, 37], '春夏秋冬'],
    [[38, 39, 40, 41], '梅蘭竹菊'],
  ]
  for (const [set, label] of sets) {
    if (set.every((f) => flowers.includes(f))) {
      for (const f of set) out.set(f, { name: `花槓（${label}）`, tai: 2, reason: `集齊${label}一整套，花槓 2 台（這一套不再另算正花）` })
      continue
    }
    for (const f of own) {
      if (set.includes(f) && flowers.includes(f)) {
        out.set(f, {
          name: `正花（${tileName(f)}）`,
          tai: 1,
          reason: `門風${WIND_NAMES[seatWind]}對應的花是${own.map(tileName).join('、')}，每張 1 台`,
        })
      }
    }
  }
  return out
}

/** 自己目前有台的組合（含暗手），胡牌時才確定的會標註。 */
export function myTaiHints(view: PlayerView, rules: RuleConfig = DEFAULT_RULES): TaiHint[] {
  const me = view.seats[view.seat]
  const seatWind = me.seatWind
  const roundWind = view.roundWind
  const counts = toCounts(view.hand)
  const hints: TaiHint[] = []
  const base = { tiles: [] as Tile[], meldIdx: [] as number[], flowers: [] as Tile[] }

  // 副露裡的字牌刻子／槓
  me.melds.forEach((m, i) => {
    for (const n of meldNotes(m, seatWind, roundWind)) hints.push({ ...base, ...n, meldIdx: [i], whenWin: false })
  })
  // 暗手裡的字牌刻子
  for (let t = 27; t < 34; t++) {
    if (counts[t] < 3) continue
    for (const n of honorPungNotes(t, seatWind, roundWind)) {
      hints.push({ ...base, ...n, reason: `手上已經有三張${tileName(t)}：${n.reason}`, tiles: [t, t, t], whenWin: true })
    }
  }
  // 花牌
  const fl = flowerNotes(me.flowers, seatWind)
  const flowerGroups = new Map<string, TaiHint>()
  for (const [f, n] of fl) {
    const g = flowerGroups.get(n.name)
    if (g) g.flowers.push(f)
    else flowerGroups.set(n.name, { ...base, ...n, flowers: [f], whenWin: false })
  }
  hints.push(...flowerGroups.values())

  // 三元牌組合：大三元、小三元（取代個別的三元刻）
  const dragonPung = (t: Tile) => counts[t] >= 3 || me.melds.some((m) => m.type !== 'chow' && !m.hidden && m.tiles[0] === t)
  const pungs = [31, 32, 33].filter(dragonPung)
  const pairs = [31, 32, 33].filter((t) => !dragonPung(t) && counts[t] === 2)
  if (pungs.length === 3) {
    hints.push({ ...base, name: '大三元', tai: 8, reason: '中、發、白三組刻子都有了（取代個別的三元刻）', tiles: pungs.flatMap((t) => (counts[t] >= 3 ? [t, t, t] : [])), whenWin: true })
  } else if (pungs.length === 2 && pairs.length === 1) {
    hints.push({
      ...base,
      name: '小三元',
      tai: 4,
      reason: `已經有兩組三元牌刻子，加上一對${tileName(pairs[0])}當眼睛，胡牌時是小三元（取代個別的三元刻）`,
      tiles: [...pungs.flatMap((t) => (counts[t] >= 3 ? [t, t, t] : [])), pairs[0], pairs[0]],
      whenWin: true,
    })
  }

  // 一條龍：同花色 123、456、789（可以是吃出來的順子）
  if (rules.straightTai > 0) {
    for (const s of [0, 1, 2]) {
      const c = [...counts]
      const tiles: Tile[] = []
      const meldIdx: number[] = []
      const ok = [0, 3, 6].every((b) => {
        const start = s * 9 + b
        const mi = me.melds.findIndex((m, i) => m.type === 'chow' && m.tiles[0] === start && !meldIdx.includes(i))
        if (mi >= 0) {
          meldIdx.push(mi)
          return true
        }
        if ([0, 1, 2].every((k) => c[start + k] > 0)) {
          ;[0, 1, 2].forEach((k) => {
            c[start + k]--
            tiles.push(start + k)
          })
          return true
        }
        return false
      })
      if (ok) {
        hints.push({
          ...base,
          name: `一條龍（${SUIT_NAMES[s]}）`,
          tai: rules.straightTai,
          reason: `已經有${SUIT_NAMES[s]}子 1 到 9 三組順子，胡牌時沒拆掉就算（台麻原本沒有，採用國際麻將的台數）`,
          tiles,
          meldIdx,
          whenWin: true,
        })
      }
    }
  }

  // 大三元、小三元取代個別的三元刻（和計台規則一致）
  if (hints.some((h) => h.name === '大三元' || h.name === '小三元')) {
    for (let i = hints.length - 1; i >= 0; i--) if (hints[i].name.startsWith('三元刻')) hints.splice(i, 1)
  }

  // 暗刻：自己摸到的刻子（含暗槓）
  const concealedTriplets: Tile[] = []
  for (let t = 0; t < 34; t++) if (counts[t] >= 3) concealedTriplets.push(t)
  const ankans = me.melds.map((m, i) => (m.type === 'ankan' ? i : -1)).filter((i) => i >= 0)
  const n = concealedTriplets.length + ankans.length
  if (n >= 3) {
    const [name, tai] = n >= 5 ? ['五暗刻', 8] : n === 4 ? ['四暗刻', 5] : ['三暗刻', 2]
    hints.push({
      ...base,
      name: name as string,
      tai: tai as number,
      reason: `已經有 ${n} 組暗刻（自己摸齊的刻子），胡牌時沒拆掉就算；注意：胡別人打的牌湊成的刻子不算暗刻`,
      tiles: concealedTriplets.flatMap((t) => [t, t, t]),
      meldIdx: ankans,
      whenWin: true,
    })
  }
  return hints
}

/** 沒有特定牌組、但目前狀態有台的情況（門清、一色）。 */
export function myStatusNotes(view: PlayerView): TaiNote[] {
  const me = view.seats[view.seat]
  const notes: TaiNote[] = []
  if (!me.melds.some((m) => m.type !== 'ankan')) {
    notes.push({ name: '門清', tai: 1, reason: '還沒吃、碰、明槓：胡別人的牌 1 台，自摸變成「門清自摸」3 台' })
  }
  const tiles = [...view.hand, ...me.melds.flatMap((m) => m.tiles)]
  const suits = new Set(tiles.filter((t) => t < 27).map((t) => Math.floor(t / 9)))
  const hasHonor = tiles.some((t) => t >= 27 && t < 34)
  if (suits.size === 1) {
    const s = SUIT_NAMES[[...suits][0]]
    notes.push(
      hasHonor
        ? { name: '混一色', tai: 4, reason: `目前只有${s}子和字牌：照這樣胡牌是混一色 4 台` }
        : { name: '清一色', tai: 8, reason: `目前全部都是${s}子：照這樣胡牌是清一色 8 台` },
    )
  } else if (suits.size === 0 && tiles.length > 0) {
    notes.push({ name: '字一色', tai: 16, reason: '目前全部都是字牌：照這樣胡牌是字一色 16 台' })
  }
  return notes
}
