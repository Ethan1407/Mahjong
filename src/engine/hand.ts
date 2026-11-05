/**
 * 手牌分析：胡牌判定、拆牌、向聽數、聽牌、有效進張。
 *
 * 所有函式都以「暗手計數陣列」（長度 34）為輸入，`meldCount` 為已經吃碰槓出去的組數。
 * `totalSets` 為胡牌需要的面子總數：台灣十六張為 5（預設），日麻、三麻等十三張玩法為 4。
 * 暗手需要 `setsNeeded = totalSets - meldCount` 組面子。
 *   - 等待摸牌時暗手有 3n+1 張
 *   - 摸牌後／胡牌時暗手有 3n+2 張
 */
import { TILE_KINDS, type Tile } from './tiles'

export const TOTAL_SETS = 5

export const setsNeeded = (meldCount: number, totalSets = TOTAL_SETS) => totalSets - meldCount

const sum = (c: readonly number[]) => c.reduce((a, b) => a + b, 0)

/** 數牌才能組順子：同一花色且點數 ≤ 7。 */
const canStartChow = (t: number) => t < 27 && t % 9 <= 6

// ─────────────────────────── 胡牌判定 ───────────────────────────

function canFormSets(c: number[], i = 0): boolean {
  while (i < TILE_KINDS && c[i] === 0) i++
  if (i === TILE_KINDS) return true
  if (c[i] >= 3) {
    c[i] -= 3
    const ok = canFormSets(c, i)
    c[i] += 3
    if (ok) return true
  }
  if (canStartChow(i) && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--, c[i + 1]--, c[i + 2]--
    const ok = canFormSets(c, i)
    c[i]++, c[i + 1]++, c[i + 2]++
    if (ok) return true
  }
  return false
}

/** 一般型：n 組面子 + 1 對。 */
export function isStandardWin(counts: readonly number[]): boolean {
  if (sum(counts) % 3 !== 2) return false
  const c = [...counts]
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] < 2) continue
    c[t] -= 2
    const ok = canFormSets(c)
    c[t] += 2
    if (ok) return true
  }
  return false
}

/** 嚦咕嚦咕：門清 17 張 = 7 對 + 1 刻（四張相同算 2 對）。 */
export function isLiguLigu(counts: readonly number[]): boolean {
  if (sum(counts) !== 17) return false
  let pairs = 0
  let triplets = 0
  for (const n of counts) {
    if (n === 0) continue
    if (n === 1) return false
    if (n === 2) pairs++
    else if (n === 3) triplets++
    else if (n === 4) pairs += 2
  }
  return pairs === 7 && triplets === 1
}

export interface WinOptions {
  /** 是否承認嚦咕嚦咕，預設 true。 */
  allowLiguLigu?: boolean
  /** 胡牌需要的面子總數，預設 5（台灣十六張）。 */
  totalSets?: number
}

export function isWinningHand(counts: readonly number[], meldCount: number, opts: WinOptions = {}): boolean {
  if (sum(counts) !== setsNeeded(meldCount, opts.totalSets) * 3 + 2) return false
  if (isStandardWin(counts)) return true
  return (opts.allowLiguLigu ?? true) && meldCount === 0 && isLiguLigu(counts)
}

// ─────────────────────────── 拆牌 ───────────────────────────

export interface ConcealedSet {
  kind: 'chow' | 'pung'
  /** 刻子的牌，或順子最小的那張。 */
  tile: Tile
}

export interface Decomposition {
  pair: Tile
  sets: ConcealedSet[]
}

/** 列出一般型胡牌的所有拆法（計台時取最高分的拆法）。 */
export function decompose(counts: readonly number[]): Decomposition[] {
  const results: Decomposition[] = []
  const seen = new Set<string>()
  const c = [...counts]
  const sets: ConcealedSet[] = []

  const rec = (pair: Tile, i: number) => {
    while (i < TILE_KINDS && c[i] === 0) i++
    if (i === TILE_KINDS) {
      const d = { pair, sets: [...sets] }
      const key = `${pair}|${d.sets.map((s) => s.kind[0] + s.tile).join(',')}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push(d)
      }
      return
    }
    if (c[i] >= 3) {
      c[i] -= 3
      sets.push({ kind: 'pung', tile: i })
      rec(pair, i)
      sets.pop()
      c[i] += 3
    }
    if (canStartChow(i) && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--, c[i + 1]--, c[i + 2]--
      sets.push({ kind: 'chow', tile: i })
      rec(pair, i)
      sets.pop()
      c[i]++, c[i + 1]++, c[i + 2]++
    }
  }

  if (sum(c) % 3 !== 2) return results
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] < 2) continue
    c[t] -= 2
    rec(t, 0)
    c[t] += 2
  }
  return results
}

// ─────────────────────────── 向聽數 ───────────────────────────
//
// 向聽數 = 還差幾張有效牌才能聽牌。-1 = 已胡，0 = 聽牌。
// 公式：2N − 2m − t − h，其中 N=需要的面子數、m=完整面子、t=搭子（兩張的半成品）、h=是否有雀頭；
// 且 m + t ≤ N（多出的搭子沒有用）。
// 做法：萬／筒／條／字四組各自列出所有「不被支配」的 (m, t, h) 組合（有快取），再合併。

interface Block {
  m: number
  t: number
  h: number
}

function pareto(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    if (out.some((o) => o.h === b.h && o.m >= b.m && o.t >= b.t)) continue
    for (let i = out.length - 1; i >= 0; i--) {
      const o = out[i]
      if (o.h === b.h && b.m >= o.m && b.t >= o.t) out.splice(i, 1)
    }
    out.push(b)
  }
  return out
}

const suitCache = new Map<number, Block[]>()
const honorCache = new Map<number, Block[]>()

function solveGroup(arr: number[], allowSeq: boolean, cache: Map<number, Block[]>): Block[] {
  let key = 0
  for (const n of arr) key = key * 5 + n
  const hit = cache.get(key)
  if (hit) return hit

  let i = 0
  while (i < arr.length && arr[i] === 0) i++
  if (i === arr.length) {
    const base = [{ m: 0, t: 0, h: 0 }]
    cache.set(key, base)
    return base
  }

  const cand: Block[] = []
  const tryOption = (take: [number, number][], dm: number, dt: number, dh: number) => {
    for (const [idx, n] of take) arr[idx] -= n
    for (const b of solveGroup(arr, allowSeq, cache)) {
      if (b.h + dh <= 1) cand.push({ m: b.m + dm, t: b.t + dt, h: b.h + dh })
    }
    for (const [idx, n] of take) arr[idx] += n
  }

  const n = arr.length
  if (arr[i] >= 3) tryOption([[i, 3]], 1, 0, 0)
  if (allowSeq && i + 2 < n && arr[i + 1] > 0 && arr[i + 2] > 0) tryOption([[i, 1], [i + 1, 1], [i + 2, 1]], 1, 0, 0)
  if (arr[i] >= 2) {
    tryOption([[i, 2]], 0, 0, 1) // 當雀頭
    tryOption([[i, 2]], 0, 1, 0) // 當對子搭子
  }
  if (allowSeq && i + 1 < n && arr[i + 1] > 0) tryOption([[i, 1], [i + 1, 1]], 0, 1, 0)
  if (allowSeq && i + 2 < n && arr[i + 2] > 0) tryOption([[i, 1], [i + 2, 1]], 0, 1, 0)
  tryOption([[i, 1]], 0, 0, 0) // 孤張

  const result = pareto(cand)
  cache.set(key, result)
  return result
}

/** 一般型的向聽數。 */
export function shanten(counts: readonly number[], meldCount: number, totalSets = TOTAL_SETS): number {
  const N = setsNeeded(meldCount, totalSets)
  let acc: Block[] = [{ m: 0, t: 0, h: 0 }]
  for (let g = 0; g < 4; g++) {
    const start = g * 9
    const len = g === 3 ? 7 : 9
    const blocks = solveGroup(counts.slice(start, start + len), g !== 3, g === 3 ? honorCache : suitCache)
    const next: Block[] = []
    for (const a of acc) {
      for (const b of blocks) {
        if (a.h + b.h <= 1) next.push({ m: a.m + b.m, t: a.t + b.t, h: a.h + b.h })
      }
    }
    acc = pareto(next)
  }
  let best = Infinity
  for (const { m, t, h } of acc) {
    const mm = Math.min(m, N)
    const tt = Math.min(t, N - mm)
    best = Math.min(best, 2 * N - 2 * mm - tt - h)
  }
  return best
}

// ─────────────────────────── 聽牌與進張 ───────────────────────────

/** 暗手 3n+1 張時，摸到哪些牌就胡。已經自己握有 4 張的牌不算（不可能再摸到）。 */
export function waits(counts: readonly number[], meldCount: number, opts: WinOptions = {}): Tile[] {
  const c = [...counts]
  const out: Tile[] = []
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] >= 4) continue
    c[t]++
    if (isWinningHand(c, meldCount, opts)) out.push(t)
    c[t]--
  }
  return out
}

/** 暗手 3n+1 張時，哪些牌能讓向聽數下降（有效進張）。 */
export function effectiveTiles(counts: readonly number[], meldCount: number, totalSets = TOTAL_SETS): Tile[] {
  const c = [...counts]
  const now = shanten(c, meldCount, totalSets)
  const out: Tile[] = []
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] >= 4) continue
    c[t]++
    if (shanten(c, meldCount, totalSets) < now) out.push(t)
    c[t]--
  }
  return out
}

export interface DiscardOption {
  tile: Tile
  /** 打出後的向聽數。 */
  shanten: number
  /** 打出後的有效進張（牌種）。 */
  effective: Tile[]
  /** 有效進張的剩餘張數（扣掉自己看得到的牌）。 */
  effectiveCount: number
}

/**
 * 暗手 3n+2 張時，列出每一種可打的牌及打出後的效率。
 * `visible` 為自己看得到的牌數（自己的手牌、所有牌河、所有人的副露），用來算剩餘張數；
 * 省略時只扣自己的手牌。結果依「向聽數低 → 進張多」排序。
 */
export function analyzeDiscards(
  counts: readonly number[],
  meldCount: number,
  visible?: readonly number[],
  totalSets = TOTAL_SETS,
): DiscardOption[] {
  const seenCounts = visible ?? counts
  const c = [...counts]
  const out: DiscardOption[] = []
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] === 0) continue
    c[t]--
    const s = shanten(c, meldCount, totalSets)
    const effective = effectiveTiles(c, meldCount, totalSets)
    const effectiveCount = effective.reduce((acc, e) => acc + Math.max(0, 4 - seenCounts[e]), 0)
    out.push({ tile: t, shanten: s, effective, effectiveCount })
    c[t]++
  }
  return out.sort((a, b) => a.shanten - b.shanten || b.effectiveCount - a.effectiveCount || a.tile - b.tile)
}
