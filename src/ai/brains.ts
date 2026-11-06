/**
 * 三種難度的機器人。每個決定都附上理由（「有理有據」），畫面上可以選擇顯示。
 *
 * 簡單：只看自己的手牌算牌效，約三成機率選到次佳的牌，不防守，吃碰很隨性。
 * 中等：牌效扣掉場上看得到的牌；只有能前進才吃碰；有人可能聽牌而自己還很遠時改打安全牌。
 * 困難：再加上牌型價值（三元牌、門風圈風、一色）；快聽牌時依「手牌價值」對「放槍代價」調整攻守力道。
 *
 * 機器人只拿得到 PlayerView，不會偷看別人的手牌或牌牆。
 *
 * 調整紀錄：曾試過完整的期望值模型（胡牌機率 × 收入 − 放槍機率 × 代價），
 * 模擬結果反而比中等弱（胡牌機率估得不準，容易拆掉聽牌），所以改用目前較穩定的做法。
 * 修改後請用 `npm run simulate -- --bots hard,normal,hard,normal` 比較，確認困難仍然最強。
 */
import {
  analyzeDiscards,
  effectiveTiles,
  isHonor,
  shanten,
  tileName,
  toCounts,
  windTile,
  type DiscardOption,
  type Rng,
  type Tile,
} from '../engine'
import { visibleCounts, type Action, type Bot, type PlayerView } from '../game'
import { readOpponents, tileDanger, windName, type OpponentRead } from './danger'

export type BotLevel = 'easy' | 'normal' | 'hard'

export interface Decision {
  action: Action
  reason: string
}

export type Brain = (view: PlayerView, rng: Rng) => Decision

/** 「打完聽牌」「打完 2 向聽」 */
const afterText = (n: number) => (n < 0 ? '胡牌' : n === 0 ? '打完聽牌' : `打完 ${n} 向聽`)

/** 風險差距超過這個值，才在理由裡說「比較安全」。 */
const NOTABLE_RISK = 0.02

// ─────────────────────────── 共用計算 ───────────────────────────

interface Ctx {
  view: PlayerView
  counts: number[]
  meldCount: number
  exposed: boolean
  visible: number[]
  reads: OpponentRead[]
  threat: OpponentRead
}

function makeCtx(view: PlayerView): Ctx {
  const me = view.seats[view.seat]
  const reads = readOpponents(view)
  return {
    view,
    counts: toCounts(view.hand),
    meldCount: me.melds.length,
    exposed: me.melds.some((m) => m.type !== 'ankan'),
    visible: visibleCounts(view),
    reads,
    threat: reads.reduce((a, b) => (b.tenpai > a.tenpai ? b : a)),
  }
}

const remainingOf = (tiles: Tile[], visible: number[]) => tiles.reduce((a, t) => a + Math.max(0, 4 - visible[t]), 0)

/** 碰出來有台的字牌：三元牌、自己門風、本圈風。 */
function isValueHonor(view: PlayerView, t: Tile): boolean {
  return t >= 31 || t === windTile(view.seats[view.seat].seatWind) || t === windTile(view.roundWind)
}

/** 手上（含副露）有一種花色佔絕大多數時，回傳該花色，準備做一色。 */
function flushPlan(ctx: Ctx): number | null {
  const tiles = [...ctx.view.hand, ...ctx.view.seats[ctx.view.seat].melds.flatMap((m) => m.tiles)]
  const suited = tiles.filter((t) => !isHonor(t))
  const bySuit = [0, 1, 2].map((s) => suited.filter((t) => Math.floor(t / 9) === s).length)
  const best = bySuit.indexOf(Math.max(...bySuit))
  const others = suited.length - bySuit[best]
  return bySuit[best] >= 9 && others <= 4 ? best : null
}

interface ClaimEval {
  action: Action
  before: number
  after: number
  afterEffective: number
}

/** 評估吃碰槓之後的向聽數與進張。 */
function evalClaim(ctx: Ctx, action: Action, tile: Tile): ClaimEval {
  const before = shanten(ctx.counts, ctx.meldCount)
  const c = [...ctx.counts]
  if (action.type === 'pung') c[tile] -= 2
  else if (action.type === 'minkan') c[tile] -= 3
  else if (action.type === 'chow') action.tiles.forEach((t) => c[t]--)
  const melds = ctx.meldCount + 1
  if (action.type === 'minkan') {
    const after = shanten(c, melds)
    return { action, before, after, afterEffective: remainingOf(effectiveTiles(c, melds), ctx.visible) }
  }
  const best = analyzeDiscards(c, melds, ctx.visible)[0]
  return { action, before, after: best.shanten, afterEffective: best.effectiveCount }
}

const pass = (view: PlayerView, reason: string): Decision => ({ action: { type: 'pass', seat: view.seat }, reason })

// ─────────────────────────── 宣告（吃碰槓） ───────────────────────────

function decideClaim(ctx: Ctx, level: BotLevel, rng: Rng): Decision {
  const { view } = ctx
  const tile = view.pending!.tile
  const name = tileName(tile)
  const evals = view.legal
    .filter((a) => a.type === 'pung' || a.type === 'minkan' || a.type === 'chow')
    .map((a) => evalClaim(ctx, a, tile))
    .sort((a, b) => a.after - b.after || b.afterEffective - a.afterEffective)

  for (const e of evals) {
    const progress = e.after < e.before
    const valueHonor = isValueHonor(view, tile) && (e.action.type === 'pung' || e.action.type === 'minkan')
    let take: boolean
    if (level === 'easy') {
      take = e.action.type === 'minkan' ? rng() < 0.5 : progress && rng() < (e.action.type === 'chow' ? 0.4 : 0.6)
    } else {
      const defending = ctx.threat.tenpai > 0.6 && e.before >= 2
      if (defending) continue
      if (e.action.type === 'minkan') take = e.after <= e.before
      else if (valueHonor) take = e.after <= e.before
      else take = progress
    }
    if (!take) continue
    const verb = e.action.type === 'chow' ? '吃' : e.action.type === 'pung' ? '碰' : '槓'
    const why = valueHonor
      ? `${name}刻子有台`
      : e.after < e.before
        ? `向聽數從 ${e.before} 降到 ${e.after}`
        : '不影響牌效，還能多補一張'
    return { action: e.action, reason: `${verb}${name}：${why}` }
  }

  if (evals.length === 0) return pass(view, '過')
  if (level !== 'easy' && ctx.threat.tenpai > 0.6 && evals[0].before >= 2) {
    return pass(view, `不${evals[0].action.type === 'chow' ? '吃' : '碰'}：有人可能聽牌了，吃碰後要多打一張牌反而危險`)
  }
  return pass(view, `不${evals[0].action.type === 'chow' ? '吃' : '碰'}：拿了也沒有比較快`)
}

// ─────────────────────────── 輪到自己 ───────────────────────────

function decideKong(ctx: Ctx, level: BotLevel, rng: Rng, bestShanten: number): Decision | null {
  for (const a of ctx.view.legal) {
    if (a.type !== 'ankan' && a.type !== 'kakan') continue
    if (level === 'easy') {
      if (rng() < 0.7) return { action: a, reason: `${a.type === 'ankan' ? '暗槓' : '加槓'}${tileName(a.tile)}` }
      continue
    }
    const c = [...ctx.counts]
    let melds = ctx.meldCount
    if (a.type === 'ankan') {
      c[a.tile] -= 4
      melds++
    } else {
      c[a.tile] -= 1
    }
    if (shanten(c, melds) <= bestShanten) {
      return { action: a, reason: `${a.type === 'ankan' ? '暗槓' : '加槓'}${tileName(a.tile)}：不影響牌效，還能多摸一張（有機會槓上開花）` }
    }
  }
  return null
}

function decideDiscard(ctx: Ctx, level: BotLevel, rng: Rng): Decision {
  const { view } = ctx
  const discard = (tile: Tile, reason: string): Decision => ({ action: { type: 'discard', seat: view.seat, tile }, reason })

  // 簡單：只看自己的手牌，偶爾失誤
  if (level === 'easy') {
    const options = analyzeDiscards(ctx.counts, ctx.meldCount)
    const kong = decideKong(ctx, level, rng, options[0].shanten)
    if (kong) return kong
    const pick = rng() < 0.3 ? options[Math.floor(rng() * Math.min(4, options.length))] : options[0]
    return discard(pick.tile, `打${tileName(pick.tile)}：${afterText(pick.shanten)}`)
  }

  const options = analyzeDiscards(ctx.counts, ctx.meldCount, ctx.visible)
  const best = options[0]
  const kong = decideKong(ctx, level, rng, best.shanten)
  if (kong) return kong

  const dangers = new Map(options.map((o) => [o.tile, tileDanger(view, o.tile, ctx.reads)]))
  const risk = (t: Tile) => dangers.get(t)!.risk
  const safetyReason = (t: Tile) => dangers.get(t)!.perSeat.find((s) => s.seat === ctx.threat.seat)?.reasons[0]
  const threatName = windName(view, ctx.threat.seat)

  if (level === 'normal') {
    if (ctx.threat.tenpai >= 0.45 && best.shanten >= 2) {
      const safest = [...options].sort((a, b) => risk(a.tile) - risk(b.tile))[0]
      const why = safetyReason(safest.tile)
      return discard(safest.tile, `${threatName}可能聽牌了，自己還差很遠，改打比較安全的${tileName(safest.tile)}${why ? `（${why}）` : ''}`)
    }
    const k = best.shanten <= 0 ? 60 : best.shanten === 1 ? 150 : 40
    const score = (o: DiscardOption) => -o.shanten * 1000 + o.effectiveCount - risk(o.tile) * k
    const pick = [...options].sort((a, b) => score(b) - score(a))[0]
    if (pick.tile !== best.tile && risk(best.tile) - risk(pick.tile) > NOTABLE_RISK) {
      return discard(pick.tile, `打${tileName(pick.tile)}：進張少一點，但比打${tileName(best.tile)}安全`)
    }
    return discard(pick.tile, `打${tileName(pick.tile)}：${afterText(pick.shanten)}，進張 ${pick.effectiveCount} 張`)
  }

  // 困難：
  //   平常全力進攻（向聽數優先，其次進張），牌型價值在進張差不多時拿來取捨。
  //   有人可能聽牌時：自己還很遠就棄胡；快聽牌了就比較「這手牌值多少」和「放槍要賠多少」，
  //   牌越大越敢拚，牌越小越保守。
  const me = view.seats[view.seat]
  const plan = flushPlan(ctx)
  const isDealer = view.dealer === view.seat
  const dealerTai = isDealer ? 1 + 2 * view.dealerStreak : 0
  const estTai = (ctx.exposed ? 0 : 1.5) + (plan !== null ? 4 : 0) + me.flowers.length * 0.3 + dealerTai
  const handValue = 100 + 20 * estTai
  const dealInCost = 100 + 20 * (3 + dealerTai)

  /** 牌型價值調整，單位是「相當於幾張進張」。 */
  const valueAdj = (t: Tile): { pts: number; why?: string } => {
    if (isHonor(t) && isValueHonor(view, t) && ctx.counts[t] >= 2) return { pts: -6, why: `保留${tileName(t)}對子，碰出來有台` }
    if (plan !== null && !isHonor(t)) {
      return Math.floor(t / 9) === plan ? { pts: -4 } : { pts: 4, why: '在做一色，先打掉其他花色' }
    }
    return { pts: 0 }
  }
  const underPressure = ctx.threat.tenpai >= 0.45
  if (underPressure && best.shanten >= 2) {
    const safest = [...options].sort((a, b) => risk(a.tile) - risk(b.tile) || a.shanten - b.shanten)[0]
    const why = safetyReason(safest.tile)
    return discard(safest.tile, `${threatName}可能聽牌了，自己還差很遠，棄胡打${tileName(safest.tile)}${why ? `（${why}）` : ''}`)
  }
  // 防守力道：有壓力時依「放槍代價 ÷ 手牌價值」放大
  const k = underPressure ? (best.shanten <= 0 ? 50 : 130) * (dealInCost / handValue) : 30
  const scored = options.map((o) => {
    const v = valueAdj(o.tile)
    const ev = -o.shanten * 1000 + o.effectiveCount + v.pts - risk(o.tile) * k
    return { o, ev, v }
  })
  scored.sort((a, b) => b.ev - a.ev)
  const pick = scored[0]
  const t = pick.o.tile
  if (risk(t) + NOTABLE_RISK < risk(best.tile) && pick.o.shanten > best.shanten) {
    const why = safetyReason(t)
    return discard(t, `${threatName}危險，硬拚不划算，棄胡打${tileName(t)}${why ? `（${why}）` : ''}`)
  }
  if (risk(t) + NOTABLE_RISK < risk(best.tile)) {
    return discard(t, `打${tileName(t)}：牌效差不多，但比打${tileName(best.tile)}安全`)
  }
  if (pick.v.why && t !== best.tile) return discard(t, `打${tileName(t)}：${pick.v.why}`)
  return discard(t, `打${tileName(t)}：${afterText(pick.o.shanten)}，進張 ${pick.o.effectiveCount} 張`)
}

// ─────────────────────────── 入口 ───────────────────────────

export function decide(view: PlayerView, rng: Rng, level: BotLevel): Decision {
  const win = view.legal.find((a) => a.type === 'tsumo' || a.type === 'ron')
  if (win) return { action: win, reason: win.type === 'tsumo' ? '自摸！' : '胡了！' }
  const ctx = makeCtx(view)
  if (view.phase === 'discard') return decideDiscard(ctx, level, rng)
  return decideClaim(ctx, level, rng)
}

export const brainFor =
  (level: BotLevel): Brain =>
  (view, rng) =>
    decide(view, rng, level)

export const botFor = (level: BotLevel): Bot => (view, rng) => decide(view, rng, level).action
