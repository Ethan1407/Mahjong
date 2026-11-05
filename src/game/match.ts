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
  /** 第一局的莊家。 */
  firstDealer?: Seat
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

export interface MatchState {
  config: MatchConfig
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

export function startMatch(config: MatchConfig): MatchState {
  const base = {
    config,
    scores: [0, 0, 0, 0],
    roundWind: 0,
    dealer: config.firstDealer ?? 0,
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
