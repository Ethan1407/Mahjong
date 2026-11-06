import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { botFor, type BotLevel } from '../ai'
import { createRng, randomSeed, rollDie } from '../engine'
import {
  applyAction,
  canDouble,
  doubleStakes,
  getView,
  nextHand,
  seatsToAct,
  startMatch,
  type Action,
  type MatchState,
  type OpeningDice,
} from '../game'
import type { Stake } from '../wallet'

/** 真人玩家固定坐座位 0（畫面下方），開局也由你擲骰。 */
export const HUMAN = 0

/** 依相對位置命名：自己、下家（右）、對家（上）、上家（左）。 */
const REL_NAMES = ['你', '下家', '對家', '上家']
export const seatName = (seat: number) => REL_NAMES[(seat - HUMAN + 4) % 4]

/** 機器人出牌前的停頓（毫秒），讓玩家看得清楚。 */
const DISCARD_DELAY = 650
const CLAIM_DELAY = 300

/**
 * 發牌動畫：一張接一張連續發，四家同時進牌，共 16 張；
 * 最後多停一拍（莊家多拿 1 張並補花），然後才開始打牌。
 */
export const DEAL_STEPS = 16
const DEAL_STEP_MS = 75

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function newMatch(stake: Stake): MatchState {
  return startMatch({ seed: randomSeed(), winds: 4, diceRoller: HUMAN, rules: { base: stake.base, perTai: stake.perTai } })
}

export function useGame(level: BotLevel, stake: Stake) {
  const [match, setMatch] = useState<MatchState>(() => newMatch(stake))
  /** 擲骰定莊的畫面關掉後才開始打牌。 */
  const [started, setStarted] = useState(false)
  const rngRef = useRef(createRng(match.config.seed))
  const bot = useMemo(() => botFor(level), [level])
  const round = match.round
  const view = useMemo(() => (round ? getView(round, HUMAN) : null), [round])

  // 發牌動畫：每一局開始時跑一次
  const handKey = `${match.config.seed}:${match.handNumber}`
  const [dealtKey, setDealtKey] = useState('')
  const [dealStep, setDealStep] = useState(0)
  const dealing = started && round !== null && dealtKey !== handKey
  useEffect(() => {
    if (!started) return
    if (prefersReducedMotion()) {
      setDealtKey(handKey)
      return
    }
    let step = 0
    setDealStep(0)
    const id = setInterval(() => {
      step++
      if (step > DEAL_STEPS + 2) {
        clearInterval(id)
        setDealtKey(handKey)
      } else {
        setDealStep(Math.min(step, DEAL_STEPS))
      }
    }, DEAL_STEP_MS)
    return () => clearInterval(id)
  }, [started, handKey])

  // 輪到機器人時，停頓一下再讓它行動（發牌動畫結束後才開始）
  useEffect(() => {
    if (!started || dealing || !round || round.phase === 'ended') return
    const botSeats = seatsToAct(round).filter((s) => s !== HUMAN)
    if (botSeats.length === 0) return
    const seat = botSeats[0]
    const id = setTimeout(
      () => {
        const action = bot(getView(round, seat), rngRef.current)
        setMatch((m) => (m.round === round ? { ...m, round: applyAction(round, action) } : m))
      },
      round.phase === 'discard' ? DISCARD_DELAY : CLAIM_DELAY,
    )
    return () => clearTimeout(id)
  }, [started, dealing, round, bot])

  const act = useCallback((action: Action) => {
    setMatch((m) => (m.round ? { ...m, round: applyAction(m.round, action) } : m))
  }, [])

  const next = useCallback(() => {
    setDealStep(0)
    setMatch((m) => nextHand(m))
  }, [])

  const start = useCallback(() => setStarted(true), [])

  /**
   * 按下「擲骰子」時才真正擲：三顆骰子各自用密碼學亂數擲出，和牌局種子無關，
   * 再依點數重新決定第一局的莊家（還沒開始打，所以可以重建這一將）。
   */
  const rollDice = useCallback((): OpeningDice => {
    const dice = [rollDie(), rollDie(), rollDie()]
    const m = startMatch({ ...match.config, openingDice: dice })
    setMatch(m)
    return m.opening!
  }, [match.config])

  /** 你決定這一局台數加倍（所有玩家都適用）。 */
  const double = useCallback((factor: number) => {
    setMatch((m) => (m.round && canDouble(m.round) ? { ...m, round: doubleStakes(m.round, HUMAN, factor) } : m))
  }, [])

  const restart = useCallback(() => {
    const m = newMatch(stake)
    rngRef.current = createRng(m.config.seed)
    setStarted(false)
    setDealStep(0)
    setMatchStartedAt(null)
    setMatch(m)
  }, [stake])

  /** 發牌中：每人已經發到幾張（0–16）；發完為 null。 */
  const dealProgress = dealing ? dealStep : null

  // 計時：整將從擲完骰開始算；每一局從發完牌開始算，到胡牌（或流局）為止
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null)
  const [handStartedAt, setHandStartedAt] = useState<number | null>(null)
  const [handSeconds, setHandSeconds] = useState<number | null>(null)
  useEffect(() => {
    if (started) setMatchStartedAt((t) => t ?? Date.now())
  }, [started])
  useEffect(() => {
    if (started && !dealing) {
      setHandStartedAt(Date.now())
      setHandSeconds(null)
    }
  }, [started, dealing, handKey])
  const ended = round?.phase === 'ended'
  useEffect(() => {
    if (ended && handStartedAt !== null) setHandSeconds(Math.round((Date.now() - handStartedAt) / 1000))
  }, [ended, handStartedAt])

  return { match, round, view, started, start, rollDice, dealProgress, act, next, restart, double, matchStartedAt, handSeconds }
}
