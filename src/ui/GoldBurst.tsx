/**
 * 金色大字動畫：在畫面中間放大並淡出。用在「台數 ×N」和所有玩家的吃、碰、槓、胡、自摸。
 *
 * 想改文字、要不要顯示、或動畫長短，改這個檔案最上面的設定就好：
 * - CALL_TEXT：每種動作顯示的字（設成 null 就不顯示那種動作）
 * - BURST_MS：動畫長度（也要同步改 table.css 裡 .gold-burst 的 animation 秒數）
 */
import { useEffect, useRef, useState } from 'react'
import type { GameEvent, RoundState } from '../game'
import { seatName } from './useGame'

/** 動畫長度（毫秒）。 */
export const BURST_MS = 1300

/** 每種動作顯示的字；null = 這種動作不顯示動畫。 */
export const CALL_TEXT: Record<'chow' | 'pung' | 'minkan' | 'kakan' | 'ankan' | 'ron' | 'tsumo', string | null> = {
  chow: '吃',
  pung: '碰',
  minkan: '槓',
  kakan: '加槓',
  ankan: '暗槓',
  ron: '胡',
  tsumo: '自摸',
}

export interface Burst {
  /** 大字。 */
  text: string
  /** 大字上方的小字（例如誰做的）。 */
  sub?: string
  key: number
}

/** 把一個事件變成要顯示的金字；不需要顯示就回傳 null。 */
export function burstFor(e: GameEvent): Omit<Burst, 'key'> | null {
  if (e.type === 'chow' || e.type === 'pung' || e.type === 'minkan' || e.type === 'kakan' || e.type === 'ankan') {
    const text = CALL_TEXT[e.type]
    return text ? { text: `${text}！`, sub: seatName(e.seat) } : null
  }
  if (e.type === 'win') {
    const text = CALL_TEXT[e.from === null ? 'tsumo' : 'ron']
    return text ? { text: `${text}！`, sub: seatName(e.seat) } : null
  }
  return null
}

/**
 * 看這一局的紀錄，有人吃、碰、槓、胡時回傳要顯示的金字。
 * handKey 換了（新的一局）就從頭算，不會把上一局的動作再播一次。
 */
export function useCallBursts(round: RoundState | null, handKey: string): [Burst | null, () => void] {
  const [burst, setBurst] = useState<Burst | null>(null)
  const seen = useRef({ key: handKey, len: round?.log.length ?? 0 })

  useEffect(() => {
    if (!round) return
    if (seen.current.key !== handKey) seen.current = { key: handKey, len: 0 }
    const fresh = round.log.slice(seen.current.len)
    seen.current.len = round.log.length
    // 同時有好幾個動作時，只播最後一個
    for (let i = fresh.length - 1; i >= 0; i--) {
      const b = burstFor(fresh[i])
      if (b) {
        setBurst({ ...b, key: Date.now() + i })
        break
      }
    }
  }, [round, handKey])

  return [burst, () => setBurst(null)]
}

/** 金色大字本身。 */
export function GoldBurst({ text, sub, onDone }: { text: string; sub?: string; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    // 保險：動畫事件沒觸發（例如減少動態效果）也會收掉
    const id = setTimeout(() => done.current(), BURST_MS + 300)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="gold-burst" aria-live="assertive" onAnimationEnd={(e) => e.target === e.currentTarget && done.current()}>
      <div className="gold-burst-inner">
        {sub && <span className="gold-burst-sub">{sub}</span>}
        <span className="gold-burst-text">{text}</span>
      </div>
    </div>
  )
}
