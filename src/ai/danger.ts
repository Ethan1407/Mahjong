/**
 * 讀牌：估計對手是否聽牌、可能需要哪些牌、某張牌打出去有多危險。
 * 機器人防守、牌桌的「對手分析」、以及階段 5 的打牌分析共用。
 *
 * 原則：只根據「桌上看得到的東西」判斷——對手打出的牌、吃碰槓、花牌、牌牆剩幾張。
 * 不使用對手的手牌（玩家視角 PlayerView 本來就看不到）。
 *
 *   1. 估計對手「已經聽牌」的機率（打了幾張、吃碰幾組、牌局進度、最近打出的牌）
 *   2. 估計「假如他聽牌，這張牌剛好是他要的」的機率（他打過什麼、筋、壁、字牌出現幾張、偏好的花色）
 *   3. 兩者相乘就是放槍給他的風險
 *
 * 時間很重要：他很早打過的牌，之後可能摸到別的牌又需要它（台灣也沒有振聽，打過的牌照樣能胡），
 * 所以越早打的牌、或打完之後他又吃碰過（手牌變了），參考價值越低。
 */
import { WIND_NAMES, isHonor, rankOf, tileName, type Tile } from '../engine'
import { visibleCounts, type PlayerView, type SeatView } from '../game'

export interface OpponentRead {
  seat: number
  /** 估計已經聽牌的機率 0–1。 */
  tenpai: number
  /** 資訊是否足夠下判斷（打出的牌太少又沒吃碰時為 false）。 */
  enoughInfo: boolean
  /** 疑似在做一色的花色（0 萬、1 筒、2 條），沒有則為 null。 */
  flushSuit: number | null
  /** 聽牌機率的判斷依據。 */
  reasons: string[]
  /** 從他最近的動作（打牌、吃碰）推測的想法。 */
  hints: string[]
}

export interface SeatDanger {
  seat: number
  /** 放槍給這個人的估計機率。 */
  risk: number
  reasons: string[]
}

export type DangerLevel = 'safe' | 'low' | 'mid' | 'high'

export interface TileDanger {
  tile: Tile
  /** 放槍給任何一家的估計機率。 */
  risk: number
  level: DangerLevel
  perSeat: SeatDanger[]
}

const SUIT_NAMES = ['萬', '筒', '條']
const MELD_VERB: Record<string, string> = { chow: '吃', pung: '碰', minkan: '槓', kakan: '加槓', ankan: '暗槓' }
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const suitOfTile = (t: Tile) => Math.floor(t / 9)
const isMiddle = (t: Tile) => !isHonor(t) && rankOf(t) >= 3 && rankOf(t) <= 7

/** 打出的牌少於這個數、又沒吃碰時，資訊不足，不下判斷。 */
export const MIN_DISCARDS_TO_READ = 5

// ─────────────────────────── 對手的狀態 ───────────────────────────

function detectFlush(sv: SeatView): number | null {
  const meldSuits = sv.melds.filter((m) => !m.hidden).flatMap((m) => m.tiles.filter((t) => !isHonor(t)).map(suitOfTile))
  if (sv.melds.length < 2 || meldSuits.length === 0) return null
  const suit = meldSuits[0]
  if (!meldSuits.every((s) => s === suit)) return null
  // 牌河裡幾乎不打這個花色
  const riverSuited = sv.river.filter((r) => !isHonor(r.tile))
  const sameSuit = riverSuited.filter((r) => suitOfTile(r.tile) === suit).length
  if (riverSuited.length >= 4 && sameSuit / riverSuited.length > 0.2) return null
  return suit
}

/** 他打牌的花色偏好：幾乎不打的花色，可能是他在收集的。 */
function rareSuit(sv: SeatView): number | null {
  const suited = sv.river.filter((r) => !isHonor(r.tile))
  if (suited.length < 6) return null
  const counts = [0, 1, 2].map((s) => suited.filter((r) => suitOfTile(r.tile) === s).length)
  const min = Math.min(...counts)
  const idx = counts.indexOf(min)
  return min / suited.length < 0.12 ? idx : null
}

/** 從他最近的動作推測（只看打出的牌與吃碰）。 */
function actionHints(sv: SeatView, flushSuit: number | null): string[] {
  const hints: string[] = []
  const river = sv.river.map((r) => r.tile)
  const lastMeld = [...sv.melds].filter((m) => !m.hidden).sort((a, b) => (b.riverIndex ?? 0) - (a.riverIndex ?? 0))[0]
  if (lastMeld) {
    const ago = river.length - (lastMeld.riverIndex ?? 0)
    const when = ago <= 1 ? '剛剛' : `${ago} 巡前`
    const t = lastMeld.tiles[0]
    const what = lastMeld.type === 'chow' ? lastMeld.tiles.map(tileName).join('') : tileName(t)
    let why = '手牌往前推進了一步'
    if (isHonor(t)) why = '字牌刻子有台，也讓他離胡牌更近'
    else if (flushSuit !== null && suitOfTile(t) === flushSuit) why = `繼續收集${SUIT_NAMES[flushSuit]}子`
    hints.push(`${when}${MELD_VERB[lastMeld.type]}了${what}：${why}`)
  }
  if (river.length >= 6) {
    const recent = river.slice(-3)
    const early = river.slice(0, 4)
    if (recent.every(isMiddle)) hints.push('最近連續打出中張：不要的牌已經清完，手牌可能已經成形')
    else if (recent.every(isHonor) && river.length >= 9) hints.push('到後面還在打字牌：可能手牌還沒整理好，或是在打安全牌防守')
    if (early.filter((t) => isHonor(t) || rankOf(t) === 1 || rankOf(t) === 9).length >= 3) {
      hints.push('一開始先打字牌、么九牌：照一般順序整理手牌')
    }
  }
  const rare = rareSuit(sv)
  if (rare !== null) hints.push(`幾乎不打${SUIT_NAMES[rare]}子：可能在收集${SUIT_NAMES[rare]}子`)
  return hints
}

export function readOpponent(view: PlayerView, seat: number): OpponentRead {
  const sv = view.seats[seat]
  const turns = sv.river.length
  const melds = sv.melds.length
  const reasons: string[] = []
  const enoughInfo = turns >= MIN_DISCARDS_TO_READ || melds > 0

  let tenpai = clamp((turns - 3) * 0.045, 0, 0.5)
  if (turns >= 8) reasons.push(`已經打了 ${turns} 張牌，牌局過了一半`)
  tenpai += melds * 0.13
  if (melds > 0) reasons.push(`已經吃碰槓 ${melds} 組，手上剩的牌少`)
  if (melds >= 4) {
    tenpai = Math.max(tenpai, 0.75)
    reasons.push('只剩一兩張牌在手上，隨時可能胡')
  }
  if (view.wallDrawable < 24) {
    tenpai += 0.08
    reasons.push('牌牆剩不多，大家都接近聽牌')
  }
  const recent = sv.river.slice(-3).map((r) => r.tile)
  if (turns >= 6 && recent.length === 3 && recent.every(isMiddle)) {
    tenpai += 0.08
    reasons.push('最近連續打出中張，手牌可能已經成形')
  }
  const flushSuit = detectFlush(sv)
  if (flushSuit !== null) {
    tenpai += 0.1
    reasons.push(`吃碰的都是${SUIT_NAMES[flushSuit]}子，可能在做一色`)
  }
  return {
    seat,
    tenpai: clamp(tenpai, 0.02, 0.95),
    enoughInfo,
    flushSuit,
    reasons,
    hints: actionHints(sv, flushSuit),
  }
}

export function readOpponents(view: PlayerView): OpponentRead[] {
  return [0, 1, 2, 3].filter((s) => s !== view.seat).map((s) => readOpponent(view, s))
}

// ─────────────────────────── 某張牌對某人的危險度 ───────────────────────────

/**
 * 他打過某張牌，現在還有多少參考價值（乘在危險度上，越小越安全）。
 * 越早打的越不可靠；打完之後又吃碰過，手牌變了，也比較不可靠。
 */
function discardFactor(sv: SeatView, idx: number, near: number, far: number): number {
  const age = sv.river.length - 1 - idx
  let f = age <= 2 ? near : age <= 6 ? (near + far) / 2 : far
  const changedSince = sv.melds.some((m) => (m.riverIndex ?? 0) > idx)
  if (changedSince) f = Math.min(0.9, f + 0.2)
  return f
}

/** 假設對手已經聽牌，這張牌剛好是他要的機率（相對值 0–1）。 */
function waitWeight(view: PlayerView, read: OpponentRead, tile: Tile, visible: number[]): { w: number; reasons: string[] } {
  const sv = view.seats[read.seat]
  const reasons: string[] = []
  const unseen = 4 - visible[tile] // 我看不到的張數（可能在別人手上或牌牆）
  const lastIndexOf = (t: Tile) => sv.river.map((r) => r.tile).lastIndexOf(t)
  let w: number

  if (isHonor(tile)) {
    // 字牌只能單吊或對碰，需要對手手上有這張
    w = [0, 0.15, 0.35, 0.5, 0.5][unseen]
    if (unseen <= 1) reasons.push(`${tileName(tile)}已經出現 ${4 - unseen} 張`)
  } else {
    const r = rankOf(tile)
    const suitBase = tile - (r - 1)
    const at = (rank: number) => suitBase + rank - 1
    const dead = (rank: number) => rank < 1 || rank > 9 || visible[at(rank)] >= 4
    const shapes: { ok: boolean; suji?: number; w: number }[] = [
      { ok: r <= 7 && !dead(r + 1) && !dead(r + 2), suji: r + 3 <= 9 ? r + 3 : undefined, w: 1 }, // 兩面（上）
      { ok: r >= 3 && !dead(r - 1) && !dead(r - 2), suji: r - 3 >= 1 ? r - 3 : undefined, w: 1 }, // 兩面（下）／邊張
      { ok: r >= 2 && r <= 8 && !dead(r - 1) && !dead(r + 1), w: 0.6 }, // 中洞
    ]
    let seq = 0
    let sujiHit = false
    for (const s of shapes) {
      if (!s.ok) continue
      const idx = s.suji !== undefined ? lastIndexOf(at(s.suji)) : -1
      if (idx >= 0) {
        seq += s.w * discardFactor(sv, idx, 0.5, 0.8)
        sujiHit = true
      } else {
        seq += s.w
      }
    }
    seq /= 2.6
    if (sujiHit) reasons.push('筋牌（他打過隔三張的牌）')
    const kabe = [r - 1, r + 1].filter((k) => k >= 1 && k <= 9 && visible[at(k)] >= 4)
    if (kabe.length > 0) reasons.push(`壁：${kabe.map((k) => tileName(at(k))).join('、')}已經出現 4 張`)
    const pair = [0, 0.1, 0.25, 0.35, 0.35][unseen]
    w = 0.75 * seq + 0.25 * pair

    const suit = suitOfTile(tile)
    if (read.flushSuit !== null) {
      if (suit === read.flushSuit) {
        w *= 1.6
        reasons.push(`他可能在做${SUIT_NAMES[read.flushSuit]}子一色`)
      } else {
        w *= 0.3
      }
    } else if (rareSuit(sv) === suit) {
      w *= 1.3
      reasons.push(`他幾乎不打${SUIT_NAMES[suit]}子`)
    }
  }

  // 他打過這張：越近打的越安全；很早打的，之後可能又需要
  const idx = lastIndexOf(tile)
  if (idx >= 0) {
    const f = discardFactor(sv, idx, 0.25, 0.7)
    w *= f
    const age = sv.river.length - 1 - idx
    reasons.unshift(age <= 2 ? '他最近才打過這張' : '他較早打過這張，但之後可能又需要')
  }
  return { w: clamp(w, 0, 1), reasons }
}

export function levelOf(risk: number): DangerLevel {
  if (risk < 0.03) return 'safe'
  if (risk < 0.08) return 'low'
  if (risk < 0.16) return 'mid'
  return 'high'
}

export function tileDanger(view: PlayerView, tile: Tile, reads = readOpponents(view)): TileDanger {
  const visible = visibleCounts(view)
  const perSeat = reads.map((read) => {
    const { w, reasons } = waitWeight(view, read, tile, visible)
    return { seat: read.seat, risk: read.tenpai * w, reasons }
  })
  const risk = 1 - perSeat.reduce((acc, s) => acc * (1 - s.risk), 1)
  return { tile, risk, level: levelOf(risk), perSeat }
}

// ─────────────────────────── 可能需要的牌 ───────────────────────────

export interface NeedsGuess {
  /** 資訊不足時為 false，tiles 為空。 */
  enoughInfo: boolean
  /** 最可能是他要的牌（由高到低）。 */
  tiles: Tile[]
  /** 判斷依據。 */
  basis: string[]
}

/**
 * 推測某位對手「可能需要（在等）哪些牌」：只看他打出的牌與吃碰。
 * 方法和危險度相同：假設他聽牌，算每一種牌是他要的牌的相對機率，取最高的幾張。
 */
export function likelyNeeds(view: PlayerView, seat: number, count = 5, read = readOpponent(view, seat)): NeedsGuess {
  if (!read.enoughInfo) {
    return { enoughInfo: false, tiles: [], basis: ['他打出的牌還太少、也還沒吃碰，看不出來'] }
  }
  const visible = visibleCounts(view)
  const sv = view.seats[seat]
  const scored: { t: Tile; w: number }[] = []
  for (let t = 0; t < 34; t++) {
    const { w } = waitWeight(view, read, t, visible)
    if (w > 0.05) scored.push({ t, w })
  }
  scored.sort((a, b) => b.w - a.w || a.t - b.t)
  const tiles = scored.slice(0, count).map((s) => s.t)

  const basis: string[] = []
  if (read.flushSuit !== null) {
    basis.push(`他吃碰的都是${SUIT_NAMES[read.flushSuit]}子，牌河卻很少打${SUIT_NAMES[read.flushSuit]}子，可能在做一色`)
  } else {
    const rare = rareSuit(sv)
    if (rare !== null) basis.push(`他幾乎不打${SUIT_NAMES[rare]}子，可能在收集`)
  }
  const honors = tiles.filter(isHonor)
  if (honors.length > 0) basis.push(`${honors.map(tileName).join('、')}還有好幾張沒出現，可能是他的對子`)
  return { enoughInfo: true, tiles, basis }
}

export const LEVEL_NAMES: Record<DangerLevel, string> = {
  safe: '安全',
  low: '低',
  mid: '中',
  high: '高',
}

/** 「東家」這類稱呼（以門風命名，給機器人理由用）。 */
export const windName = (view: PlayerView, seat: number) => `${WIND_NAMES[view.seats[seat].seatWind]}家`
