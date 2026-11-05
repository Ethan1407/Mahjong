import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRng, randomSeed } from '../engine'
import {
  applyAction,
  efficiencyBot,
  getView,
  nextHand,
  seatsToAct,
  startMatch,
  type Action,
  type Bot,
  type MatchState,
} from '../game'
import type { Difficulty } from '../difficulty'

/** 真人玩家固定坐座位 0（畫面下方）。 */
export const HUMAN = 0

/** 機器人出牌前的停頓（毫秒），讓玩家看得清楚。 */
const DISCARD_DELAY = 650
const CLAIM_DELAY = 300

/** 階段 4 會依難度換成不同的機器人，目前都用只看牌效率的暫時版本。 */
function botFor(_difficulty: Difficulty): Bot {
  return efficiencyBot
}

function newMatch(): MatchState {
  const seed = randomSeed()
  return startMatch({ seed, winds: 4, firstDealer: seed % 4 })
}

export function useGame(difficulty: Difficulty) {
  const [match, setMatch] = useState<MatchState>(newMatch)
  const rngRef = useRef(createRng(match.config.seed))
  const bot = useMemo(() => botFor(difficulty), [difficulty])
  const round = match.round
  const view = useMemo(() => (round ? getView(round, HUMAN) : null), [round])

  // 輪到機器人時，停頓一下再讓它行動
  useEffect(() => {
    if (!round || round.phase === 'ended') return
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
  }, [round, bot])

  const act = useCallback((action: Action) => {
    setMatch((m) => (m.round ? { ...m, round: applyAction(m.round, action) } : m))
  }, [])

  const next = useCallback(() => setMatch((m) => nextHand(m)), [])

  const restart = useCallback(() => {
    const m = newMatch()
    rngRef.current = createRng(m.config.seed)
    setMatch(m)
  }, [])

  return { match, round, view, act, next, restart }
}
