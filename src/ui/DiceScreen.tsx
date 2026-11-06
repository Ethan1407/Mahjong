import { useEffect, useState } from 'react'
import { rollDie } from '../engine'
import type { OpeningDice } from '../game'
import { seatName } from './useGame'

/** 骰子點數的位置（3×3 格，0–8）。 */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <svg className={`die${rolling ? ' rolling' : ''}`} viewBox="0 0 60 60" role="img" aria-label={`${value} 點`}>
      <rect x="3" y="3" width="54" height="54" rx="11" className="die-face" />
      {PIPS[value].map((p) => (
        <circle
          key={p}
          cx={15 + (p % 3) * 15}
          cy={15 + Math.floor(p / 3) * 15}
          r={value === 1 ? 7 : 5.2}
          className={value === 1 || value === 4 ? 'pip red' : 'pip'}
        />
      ))}
    </svg>
  )
}

/** 開局擲骰定莊。 */
export function DiceScreen({
  onRoll,
  onStart,
  onExit,
}: {
  /** 真正擲骰子（按下按鈕的那一刻才擲），回傳結果。 */
  onRoll: () => OpeningDice
  onStart: () => void
  onExit: () => void
}) {
  const [opening, setOpening] = useState<OpeningDice | null>(null)
  const rolled = opening !== null
  // 擲之前也顯示隨機的點數（真正的結果在擲出去時才揭曉）
  const [faces, setFaces] = useState(() => [rollDie(), rollDie(), rollDie()])
  const [done, setDone] = useState(false)

  // 擲骰動畫：快速跳動約 0.8 秒後停在結果
  useEffect(() => {
    if (!opening) return
    let n = 0
    const id = setInterval(() => {
      n++
      if (n >= 10) {
        setFaces(opening.dice)
        setDone(true)
        clearInterval(id)
      } else {
        setFaces([rollDie(), rollDie(), rollDie()])
      }
    }, 80)
    return () => clearInterval(id)
  }, [opening])

  // 從擲骰的人開始逆時針數：你 1、下家 2、對家 3、上家 4、你 5…
  const counting = opening ? Array.from({ length: opening.total }, (_, i) => ({ n: i + 1, seat: (opening.roller + i) % 4 })) : []

  return (
    <div className="table-page dice-page">
      <header className="table-header">
        <button type="button" className="link-button" onClick={onExit}>
          ← 離開
        </button>
        <span className="table-title">擲骰定莊</span>
      </header>
      <main className="dice-main">
        <p className="dice-intro">由你擲 3 顆骰子，從你開始逆時針數（你算 1），數到誰，誰就是第一局的莊家。</p>
        <div className="dice-row">
          {faces.map((f, i) => (
            <Die key={i} value={f} rolling={rolled && !done} />
          ))}
        </div>

        {!rolled && (
          <button type="button" className="action primary big" onClick={() => setOpening(onRoll())} autoFocus>
            擲骰子
          </button>
        )}

        {done && opening && (
          <>
            <p className="dice-total">
              {opening.dice.join(' + ')} = <strong>{opening.total}</strong> 點
            </p>
            <ol className="dice-count" aria-label="數的順序">
              {counting.map(({ n, seat }) => (
                <li key={n} className={n === opening.total ? 'final' : undefined}>
                  <span>{n}</span>
                  {seatName(seat)}
                </li>
              ))}
            </ol>
            <p className="dice-result">
              數到 {opening.total} 是<strong>{seatName(opening.dealer)}</strong>，
              {opening.dealer === opening.roller ? '由你' : `由${seatName(opening.dealer)}`}當莊（坐東）。
            </p>
            <button type="button" className="action primary big" onClick={onStart} autoFocus>
              開始發牌
            </button>
          </>
        )}
      </main>
    </div>
  )
}
