/**
 * 打牌分析（階段 5）：輪到你出牌時，每一種可以打的牌都算出
 *   1. 進攻效率：打完幾向聽、有效進張幾種幾張
 *   2. 機會成本：比最好的打法少多少進張、慢幾步；會不會拆掉有台的組合
 *   3. 放槍風險：估計放槍的機率，以及可能胡這張的人
 *   4. 他人需求：哪位對手可能需要這張（就算現在沒聽牌，打給他也是幫他）
 * 再用困難機器人的判斷，給一個「綜合建議」。
 *
 * 全部只用你的視角（PlayerView）看得到的資訊：自己的手牌、牌河、吃碰槓、花牌。
 */
import { WIND_NAMES, analyzeDiscards, createRng, toCounts, type DiscardOption, type RuleConfig, type Tile } from '../engine'
import { visibleCounts, type Action, type PlayerView } from '../game'
import { decide, likelyNeeds, readOpponents, tileDanger, type OpponentRead, type TileDanger } from '../ai'
import { myTaiHints, type TaiHint } from './taiHints'

/** 他人需求：每位對手列出最可能的幾種牌。 */
const NEED_COUNT = 4
/** 他人需求：對手的聽牌可能至少要這麼高才列出。 */
const NEED_MIN_TENPAI = 0.2

export interface Needer {
  seat: number
  /** 為什麼覺得他需要。 */
  why: string
}

export interface DiscardReport extends DiscardOption {
  danger: TileDanger
  /** 可能需要這張牌的對手。 */
  needers: Needer[]
  /** 打掉這張會拆掉的有台組合。 */
  lostTai: TaiHint[]
  /** 和牌效最好的打法相比：慢幾步（向聽數差）。 */
  shantenLoss: number
  /** 和牌效最好的打法相比：少幾張進張（只在向聽數相同時有意義）。 */
  effectiveLoss: number
  /** 牌效是不是最好的之一。 */
  isBestEfficiency: boolean
}

export interface Recommendation {
  /** 建議打的牌；建議暗槓、加槓、自摸時為 null。 */
  tile: Tile | null
  action: Action
  /** 理由（座位用「下家、對家、上家」稱呼）。 */
  reason: string
}

export interface DiscardAnalysis {
  /** 每一種可以打的牌，依牌效排列（不會把建議的牌排第一）。 */
  reports: DiscardReport[]
  /** 牌效最好的那一種。 */
  best: DiscardReport
  recommendation: Recommendation
  /** 三位對手的讀牌。 */
  reads: OpponentRead[]
  /** 有沒有任何對手資訊足夠判斷。 */
  enoughInfo: boolean
}

/** 機器人理由裡用「東家」這種門風稱呼，換成你習慣的「下家、對家、上家」。 */
function renameSeats(text: string, view: PlayerView, seatName: (seat: number) => string): string {
  let out = text
  for (const sv of view.seats) {
    if (sv.seat === view.seat) continue
    out = out.split(`${WIND_NAMES[sv.seatWind]}家`).join(seatName(sv.seat))
  }
  return out
}

/** 打掉一張牌之後的視角（用來比較台數組合有沒有被拆掉）。 */
function withoutTile(view: PlayerView, tile: Tile): PlayerView {
  const hand = [...view.hand]
  hand.splice(hand.indexOf(tile), 1)
  return { ...view, hand }
}

export function analyzeTurn(
  view: PlayerView,
  rules: RuleConfig,
  seatName: (seat: number) => string,
): DiscardAnalysis | null {
  const meldCount = view.seats[view.seat].melds.length
  const options = analyzeDiscards(toCounts(view.hand), meldCount, visibleCounts(view))
  if (options.length === 0) return null

  const reads = readOpponents(view)
  // 每位對手只取最可能的 4 種；太早（聽牌機率很低）的不列，免得幾乎每張牌都「有人要」
  const needs = reads
    .filter((r) => r.tenpai >= NEED_MIN_TENPAI)
    .map((r) => ({ read: r, guess: likelyNeeds(view, r.seat, NEED_COUNT, r) }))
  const hintsNow = myTaiHints(view, rules)
  const top = options[0]

  const reports: DiscardReport[] = options.map((o) => {
    const danger = tileDanger(view, o.tile, reads)
    const needers: Needer[] = []
    for (const { read, guess } of needs) {
      if (!guess.enoughInfo || !guess.tiles.includes(o.tile)) continue
      const seatRisk = danger.perSeat.find((d) => d.seat === read.seat)
      needers.push({
        seat: read.seat,
        why: guess.basis[0] ?? (seatRisk?.reasons[0] ? `這張${seatRisk.reasons[0]}` : '從他打出的牌看，這張附近的牌他都還沒打過'),
      })
    }
    const hintsAfter = myTaiHints(withoutTile(view, o.tile), rules).map((h) => h.name)
    const lostTai = hintsNow.filter((h) => h.tiles.includes(o.tile) && !hintsAfter.includes(h.name))
    const shantenLoss = o.shanten - top.shanten
    return {
      ...o,
      danger,
      needers,
      lostTai,
      shantenLoss,
      effectiveLoss: shantenLoss === 0 ? Math.max(0, top.effectiveCount - o.effectiveCount) : 0,
      isBestEfficiency: shantenLoss === 0 && o.effectiveCount >= top.effectiveCount,
    }
  })

  // 綜合建議：用困難機器人的判斷（同時考慮牌效、牌型價值和放槍風險）
  const decision = decide(view, createRng(1), 'hard')
  const recTile = decision.action.type === 'discard' ? decision.action.tile : null
  const recommendation: Recommendation = {
    tile: recTile,
    action: decision.action,
    // 畫面上已經會顯示建議的那張牌，理由開頭的「打紅中：」就不用重複
    reason: renameSeats(decision.reason, view, seatName).replace(recTile !== null ? /^打[^：]{1,4}：/ : /$^/, ''),
  }

  // 排序：牌效（向聽、進張）優先，再來是安全度。不把建議的牌排第一，免得直接洩漏答案
  const order = (r: DiscardReport) => r.shanten * 1e6 - r.effectiveCount * 100 + r.danger.risk * 50
  reports.sort((a, b) => order(a) - order(b))

  const best = reports.find((r) => r.tile === top.tile)!
  return { reports, best, recommendation, reads, enoughInfo: reads.some((r) => r.enoughInfo) }
}

/** 一句話的評語。 */
export function verdictOf(r: DiscardReport, a: DiscardAnalysis): { text: string; tone: 'best' | 'ok' | 'warn' } {
  if (r.tile === a.recommendation.tile) return { text: '建議打這張', tone: 'best' }
  if (r.danger.level === 'high') return { text: '放槍風險高', tone: 'warn' }
  if (r.shantenLoss > 0) return { text: '會慢一步', tone: 'warn' }
  if (r.lostTai.length > 0) return { text: '會拆掉有台的組合', tone: 'warn' }
  if (r.isBestEfficiency) return { text: '牌效最好之一', tone: 'ok' }
  return { text: '可以，但不是最好', tone: 'ok' }
}
