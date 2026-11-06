/**
 * 台數計算與付款，規則見 docs/RULES.md 第 7、8 節。
 */
import { decompose, isLiguLigu, isStandardWin, setsNeeded, waits, type Decomposition } from './hand'
import {
  DRAGONS,
  FLOWER_SETS,
  WINDS,
  WIND_NAMES,
  isDragon,
  isHonor,
  isWind,
  seatFlowers,
  suitOf,
  tileName,
  toCounts,
  windTile,
  type Tile,
} from './tiles'

export type MeldType = 'chow' | 'pung' | 'minkan' | 'kakan' | 'ankan'

export interface Meld {
  type: MeldType
  /** 順子／刻子 3 張，槓 4 張。 */
  tiles: Tile[]
  /** 吃碰明槓的牌來自哪個座位。 */
  fromSeat?: number
  /** 這組是在他打了幾張牌的時候吃碰槓的（讀牌用：之前打的牌，之後可能又需要）。 */
  riverIndex?: number
}

export const isExposedMeld = (m: Meld) => m.type !== 'ankan'
export const isKong = (m: Meld) => m.type === 'minkan' || m.type === 'kakan' || m.type === 'ankan'

export interface RuleConfig {
  base: number
  perTai: number
  allowLiguLigu: boolean
  /**
   * 一條龍（同花色 123、456、789 三組順子）的台數；0 = 不算。
   * 台灣麻將原本沒有這個台型，本遊戲採用國際（國標）麻將「清龍」的 16 台。
   */
  straightTai: number
}

export const DEFAULT_RULES: RuleConfig = {
  base: 100,
  perTai: 20,
  allowLiguLigu: true,
  straightTai: 16,
}

export interface WinContext {
  /** 胡牌時的暗手，含胡的那一張（3n+2 張）。 */
  concealed: Tile[]
  melds: Meld[]
  winningTile: Tile
  selfDrawn: boolean
  flowers: Tile[]
  /** 門風 0–3（莊家固定為東=0）。 */
  seatWind: number
  /** 圈風 0–3。 */
  roundWind: number
  lastTile?: boolean
  afterKong?: boolean
  robbingKong?: boolean
  heavenly?: boolean
  earthly?: boolean
  humanly?: boolean
  special?: 'eightFlowers' | 'sevenRobOne'
}

export interface TaiItem {
  name: string
  tai: number
}

export interface ScoreResult {
  valid: boolean
  pattern: 'standard' | 'liguligu' | 'eightFlowers' | 'sevenRobOne' | 'none'
  tai: number
  items: TaiItem[]
}

const total = (items: TaiItem[]) => items.reduce((a, b) => a + b.tai, 0)

function flowerItems(flowers: Tile[], seatWind: number): TaiItem[] {
  const items: TaiItem[] = []
  const own = seatFlowers(seatWind)
  for (const { tiles: set, label } of FLOWER_SETS) {
    if (set.every((f) => flowers.includes(f))) {
      items.push({ name: `花槓（${label}）`, tai: 2 })
    } else {
      for (const f of own) if (set.includes(f) && flowers.includes(f)) items.push({ name: `正花（${tileName(f)}）`, tai: 1 })
    }
  }
  return items
}

/** 與拆法無關的台數。 */
function situationItems(ctx: WinContext, waitCount: number): TaiItem[] {
  const items: TaiItem[] = []
  const exposed = ctx.melds.some(isExposedMeld)
  const allExposed = ctx.melds.length === 5 && ctx.melds.every(isExposedMeld)

  if (!exposed && ctx.selfDrawn) items.push({ name: '門清自摸', tai: 3 })
  else if (!exposed) items.push({ name: '門清', tai: 1 })
  else if (ctx.selfDrawn) items.push({ name: '自摸', tai: 1 })

  if (allExposed && !ctx.selfDrawn) items.push({ name: '全求人', tai: 2 })
  else if (waitCount === 1) items.push({ name: '獨聽', tai: 1 })

  if (ctx.afterKong && ctx.selfDrawn) items.push({ name: '槓上開花', tai: 1 })
  if (ctx.lastTile && ctx.selfDrawn) items.push({ name: '海底撈月', tai: 1 })
  if (ctx.lastTile && !ctx.selfDrawn) items.push({ name: '河底撈魚', tai: 1 })
  if (ctx.robbingKong) items.push({ name: '搶槓', tai: 1 })
  if (ctx.heavenly) items.push({ name: '天胡', tai: 24 })
  if (ctx.earthly) items.push({ name: '地胡', tai: 16 })
  if (ctx.humanly) items.push({ name: '人胡', tai: 16 })
  return items
}

function suitItems(allTiles: Tile[]): TaiItem[] {
  const suits = new Set(allTiles.filter((t) => !isHonor(t)).map(suitOf))
  const hasHonor = allTiles.some(isHonor)
  if (suits.size === 0) return [{ name: '字一色', tai: 16 }]
  if (suits.size === 1 && !hasHonor) return [{ name: '清一色', tai: 8 }]
  if (suits.size === 1 && hasHonor) return [{ name: '混一色', tai: 4 }]
  return []
}

interface FullSet {
  kind: 'chow' | 'pung'
  tile: Tile
  concealed: boolean
}

function decompositionItems(ctx: WinContext, d: Decomposition, waitCount: number, rules: RuleConfig): TaiItem[] {
  const items: TaiItem[] = []
  const sets: FullSet[] = [
    ...d.sets.map((s) => ({ ...s, concealed: true })),
    ...ctx.melds.map((m) => ({
      kind: m.type === 'chow' ? ('chow' as const) : ('pung' as const),
      tile: Math.min(...m.tiles),
      concealed: m.type === 'ankan',
    })),
  ]

  // 胡別人的牌：若胡的那張只能放在刻子裡，那組刻子不算暗刻
  let concealedPungs = sets.filter((s) => s.kind === 'pung' && s.concealed).length
  if (!ctx.selfDrawn) {
    const w = ctx.winningTile
    const inPairOrChow =
      d.pair === w || d.sets.some((s) => s.kind === 'chow' && w >= s.tile && w <= s.tile + 2)
    if (!inPairOrChow && d.sets.some((s) => s.kind === 'pung' && s.tile === w)) concealedPungs--
  }
  if (concealedPungs >= 5) items.push({ name: '五暗刻', tai: 8 })
  else if (concealedPungs === 4) items.push({ name: '四暗刻', tai: 5 })
  else if (concealedPungs === 3) items.push({ name: '三暗刻', tai: 2 })

  const pungTiles = sets.filter((s) => s.kind === 'pung').map((s) => s.tile)
  if (pungTiles.length === 5) items.push({ name: '碰碰胡', tai: 4 })

  if (rules.straightTai > 0) {
    const chows = sets.filter((s) => s.kind === 'chow').map((s) => s.tile)
    if ([0, 9, 18].some((b) => [b, b + 3, b + 6].every((t) => chows.includes(t)))) {
      items.push({ name: '一條龍', tai: rules.straightTai })
    }
  }

  if (
    sets.every((s) => s.kind === 'chow') &&
    !isHonor(d.pair) &&
    ctx.flowers.length === 0 &&
    !ctx.selfDrawn &&
    waitCount >= 2
  ) {
    items.push({ name: '平胡', tai: 2 })
  }

  // 三元牌
  const dragonPungs = DRAGONS.filter((t) => pungTiles.includes(t))
  if (dragonPungs.length === 3) items.push({ name: '大三元', tai: 8 })
  else if (dragonPungs.length === 2 && isDragon(d.pair)) items.push({ name: '小三元', tai: 4 })
  else for (const t of dragonPungs) items.push({ name: `三元刻（${tileName(t)}）`, tai: 1 })

  // 風牌
  const windPungs = WINDS.filter((t) => pungTiles.includes(t))
  if (windPungs.length === 4) items.push({ name: '大四喜', tai: 16 })
  else if (windPungs.length === 3 && isWind(d.pair)) items.push({ name: '小四喜', tai: 8 })
  else {
    if (windPungs.includes(windTile(ctx.seatWind) as (typeof WINDS)[number]))
      items.push({ name: `門風刻（${WIND_NAMES[ctx.seatWind]}）`, tai: 1 })
    if (windPungs.includes(windTile(ctx.roundWind) as (typeof WINDS)[number]))
      items.push({ name: `圈風刻（${WIND_NAMES[ctx.roundWind]}）`, tai: 1 })
  }
  return items
}

/** 計算一手胡牌的牌型台數（不含莊家、連莊，那兩項在付款時依付款人加上）。 */
export function scoreHand(ctx: WinContext, rules: RuleConfig = DEFAULT_RULES): ScoreResult {
  if (ctx.special === 'eightFlowers') {
    const items = [{ name: '八仙過海', tai: 8 }]
    return { valid: true, pattern: 'eightFlowers', tai: 8, items }
  }
  if (ctx.special === 'sevenRobOne') {
    const items = [{ name: '七搶一', tai: 8 }]
    return { valid: true, pattern: 'sevenRobOne', tai: 8, items }
  }

  const invalid: ScoreResult = { valid: false, pattern: 'none', tai: 0, items: [] }
  const counts = toCounts(ctx.concealed)
  if (ctx.concealed.length !== setsNeeded(ctx.melds.length) * 3 + 2) return invalid

  const before = [...counts]
  before[ctx.winningTile]--
  if (before[ctx.winningTile] < 0) return invalid
  const waitCount = waits(before, ctx.melds.length, { allowLiguLigu: rules.allowLiguLigu }).length

  const allTiles = [...ctx.concealed, ...ctx.melds.flatMap((m) => m.tiles)]
  const common = [...situationItems(ctx, waitCount), ...suitItems(allTiles), ...flowerItems(ctx.flowers, ctx.seatWind)]

  let best: ScoreResult = invalid
  if (isStandardWin(counts)) {
    for (const d of decompose(counts)) {
      const items = [...common, ...decompositionItems(ctx, d, waitCount, rules)]
      const tai = total(items)
      if (!best.valid || tai > best.tai) best = { valid: true, pattern: 'standard', tai, items }
    }
  }

  if (rules.allowLiguLigu && ctx.melds.length === 0 && isLiguLigu(counts)) {
    // 嚦咕嚦咕取代門清／門清自摸；自摸另加 1 台
    const items = [
      { name: '嚦咕嚦咕', tai: 8 },
      ...(ctx.selfDrawn ? [{ name: '自摸', tai: 1 }] : []),
      ...common.filter((i) => i.name !== '門清' && i.name !== '門清自摸' && i.name !== '平胡'),
    ]
    const tai = total(items)
    if (!best.valid || tai > best.tai) best = { valid: true, pattern: 'liguligu', tai, items }
  }
  return best
}

// ─────────────────────────── 付款 ───────────────────────────

export interface PaymentInput {
  winner: number
  /** 放槍者座位；自摸為 null。 */
  discarder: number | null
  dealer: number
  /** 連莊次數（第一次當莊為 0）。 */
  dealerStreak: number
  /** scoreHand 算出的牌型台數。 */
  handTai: number
}

export interface Payment {
  payer: number
  tai: number
  amount: number
  dealerTai: number
}

export interface PaymentResult {
  /** 依座位的輸贏金額，總和為 0。 */
  deltas: number[]
  payments: Payment[]
}

export function computePayments(input: PaymentInput, rules: RuleConfig = DEFAULT_RULES): PaymentResult {
  const payers =
    input.discarder === null ? [0, 1, 2, 3].filter((s) => s !== input.winner) : [input.discarder]
  const deltas = [0, 0, 0, 0]
  const payments: Payment[] = payers.map((payer) => {
    const dealerTai = payer === input.dealer || input.winner === input.dealer ? 1 + 2 * input.dealerStreak : 0
    const tai = input.handTai + dealerTai
    const amount = rules.base + tai * rules.perTai
    deltas[payer] -= amount
    deltas[input.winner] += amount
    return { payer, tai, amount, dealerTai }
  })
  return { deltas, payments }
}
