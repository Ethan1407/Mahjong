/**
 * 一將的流程：連莊、換莊、換圈、累計分數（規則見 docs/RULES.md 第 2 節）。
 */
import { createRng, type RuleConfig, type Rng } from '../engine'
import type { Bot } from './bots'
import { applyAction, seatsToAct, startRound } from './round'
import type { RoundResult, RoundState, Seat } from './types'
import { getView } from './view'

export interface MatchConfig {
  seed: number
  /** 打幾圈：1 = 只打東風圈，4 = 一將。 */
  winds: 1 | 2 | 3 | 4
  /** 指定第一局的莊家（測試用）；不指定就擲骰決定。 */
  firstDealer?: Seat
  /** 擲骰的人，預設座位 0（真人玩家）。 */
  diceRoller?: Seat
  /** 開局擲出的三顆骰子（實際對局在按下「擲骰子」時才用真亂數擲）；不指定就由種子決定。 */
  openingDice?: number[]
  rules?: Partial<RuleConfig>
  reserve?: number
}

export interface HandRecord {
  handNumber: number
  roundWind: number
  dealer: Seat
  dealerStreak: number
  seed: number
  result: RoundResult
  deltas: number[]
}

export interface OpeningDice {
  roller: Seat
  dice: number[]
  total: number
  dealer: Seat
}

export interface MatchState {
  config: MatchConfig
  /** 開局擲骰定莊的結果（指定莊家時為 null）。 */
  opening: OpeningDice | null
  scores: number[]
  roundWind: number
  dealer: Seat
  dealerStreak: number
  /** 這一圈已經換過幾次莊；換滿 4 次就換圈。 */
  dealerChanges: number
  handNumber: number
  history: HandRecord[]
  round: RoundState | null
  finished: boolean
}

/** 每一局的種子由整將的種子推出來，整將可以完整重播。 */
function handSeed(matchSeed: number, handNumber: number): number {
  const rng = createRng((matchSeed ^ Math.imul(handNumber + 1, 0x9e3779b1)) >>> 0)
  return Math.floor(rng() * 2 ** 32)
}

function newRound(m: Omit<MatchState, 'round'>): RoundState {
  return startRound({
    seed: handSeed(m.config.seed, m.handNumber),
    dealer: m.dealer,
    dealerStreak: m.dealerStreak,
    roundWind: m.roundWind,
    rules: m.config.rules,
    reserve: m.config.reserve,
  })
}

/**
 * 擲骰定莊：擲 3 顆骰子，從擲骰的人開始逆時針數（自己算 1）。
 * 1、5、9、13、17 → 自己；2、6、10、14、18 → 下家；3、7、11、15 → 對家；4、8、12、16 → 上家。
 */
export const dealerFromDice = (roller: Seat, total: number): Seat => (roller + total - 1) % 4

export function rollOpening(seed: number, roller: Seat = 0, given?: number[]): OpeningDice {
  const rng = createRng((seed ^ 0x5bd1e995) >>> 0)
  const dice = given ?? [0, 1, 2].map(() => 1 + Math.floor(rng() * 6))
  if (dice.length !== 3 || dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) throw new Error(`骰子點數不合法：${dice}`)
  const total = dice.reduce((a, b) => a + b, 0)
  return { roller, dice, total, dealer: dealerFromDice(roller, total) }
}

export function startMatch(config: MatchConfig): MatchState {
  const opening = config.firstDealer === undefined ? rollOpening(config.seed, config.diceRoller ?? 0, config.openingDice) : null
  const base = {
    config,
    opening,
    scores: [0, 0, 0, 0],
    roundWind: 0,
    dealer: config.firstDealer ?? opening!.dealer,
    dealerStreak: 0,
    dealerChanges: 0,
    handNumber: 0,
    history: [],
    finished: false,
  }
  return { ...base, round: newRound(base) }
}

/** 這一局結束後，結算並開始下一局（或結束整將）。 */
export function nextHand(m: MatchState): MatchState {
  const round = m.round
  if (!round || round.phase !== 'ended' || !round.result) throw new Error('這一局還沒結束')
  const result = round.result
  const deltas = result.type === 'win' ? result.payments.deltas : [0, 0, 0, 0]
  const record: HandRecord = {
    handNumber: m.handNumber,
    roundWind: m.roundWind,
    dealer: m.dealer,
    dealerStreak: m.dealerStreak,
    seed: round.config.seed,
    result,
    deltas,
  }

  // 莊家胡牌或流局 → 連莊；閒家胡牌 → 下莊
  const dealerStays = result.type === 'exhaustive' || result.winner === m.dealer
  let { dealer, dealerStreak, dealerChanges, roundWind } = m
  if (dealerStays) {
    dealerStreak++
  } else {
    dealer = (dealer + 1) % 4
    dealerStreak = 0
    dealerChanges++
    if (dealerChanges === 4) {
      dealerChanges = 0
      roundWind++
    }
  }

  const next = {
    config: m.config,
    opening: m.opening,
    scores: m.scores.map((s, i) => s + deltas[i]),
    roundWind,
    dealer,
    dealerStreak,
    dealerChanges,
    handNumber: m.handNumber + 1,
    history: [...m.history, record],
    finished: roundWind >= m.config.winds,
  }
  return { ...next, round: next.finished ? null : newRound(next) }
}

/** 讓機器人把這一局打完（模擬與測試用）。 */
export function playOutRound(round: RoundState, bots: Bot[], rng: Rng, maxSteps = 5000): RoundState {
  let s = round
  for (let step = 0; step < maxSteps; step++) {
    const seats = seatsToAct(s)
    if (seats.length === 0) return s
    for (const seat of seats) {
      if (s.phase === 'ended') break
      s = applyAction(s, bots[seat](getView(s, seat), rng))
    }
  }
  throw new Error('對局沒有在預期步數內結束')
}

/** 讓機器人把整將打完。 */
export function playOutMatch(config: MatchConfig, bots: Bot[], rng: Rng = createRng(config.seed)): MatchState {
  let m = startMatch(config)
  while (!m.finished) {
    m = { ...m, round: playOutRound(m.round!, bots, rng) }
    m = nextHand(m)
  }
  return m
}
