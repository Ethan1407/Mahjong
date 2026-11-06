/**
 * 個人中心的籌碼變化圖：單一折線，橫軸是第幾次記帳（每打完一局記一次），縱軸是籌碼。
 * 虛線是起始籌碼；金色圓點是輸光後自動補充。滑鼠移上去有十字線和說明。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { STARTING_BALANCE, formatChips, type ChipPoint } from '../wallet'

const HEIGHT = 240
/** 筆數在這個以內才在每一筆畫點。 */
const MAX_DOTS = 80
const PAD = { top: 16, right: 16, bottom: 28, left: 64 }

/** 取好讀的刻度（1、2、5 × 10^n）。 */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(1, max - min)
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(v)
  return out
}

const timeText = (t: number) =>
  new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function ChipChart({ history }: { history: ChipPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geo = useMemo(() => {
    const values = history.map((p) => p.balance)
    const ticks = niceTicks(Math.min(0, ...values), Math.max(STARTING_BALANCE, ...values))
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const plotW = width - PAD.left - PAD.right
    const plotH = HEIGHT - PAD.top - PAD.bottom
    const n = history.length
    const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH
    // 補充籌碼的那一段不是輸贏，畫成虛線，主線在那裡斷開
    const pt = (i: number) => `${x(i).toFixed(1)},${y(history[i].balance).toFixed(1)}`
    const path = history.map((p, i) => `${i === 0 || p.refill ? 'M' : 'L'}${pt(i)}`).join(' ')
    const refillPath = history.map((p, i) => (p.refill && i > 0 ? `M${pt(i - 1)} L${pt(i)}` : '')).join(' ')
    return { ticks, x, y, path, refillPath, plotW, plotH }
  }, [history, width])

  if (history.length < 2) {
    return (
      <p className="section-note">還沒有籌碼變化。選擇有賭注的對局（不是免費入場），打完一局之後這裡就會畫出籌碼的變化。</p>
    )
  }

  const { ticks, x, y, path, refillPath } = geo
  const n = history.length
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round((px / rect.width) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const hp = hover !== null ? history[hover] : null
  const last = history[n - 1]
  // x 軸只標頭、尾和中間幾個
  const xLabels = [...new Set([0, Math.round((n - 1) / 2), n - 1])]

  return (
    <div className="chip-chart" ref={boxRef}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`籌碼變化圖，共 ${n} 筆，目前 ${formatChips(last.balance)}`}>
        {/* 格線與 y 軸刻度 */}
        {ticks.map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart-axis" x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
              {formatChips(v)}
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={i} className="chart-axis" x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            第 {i + 1} 筆
          </text>
        ))}
        {/* 起始籌碼參考線 */}
        <line className="chart-ref" x1={PAD.left} x2={width - PAD.right} y1={y(STARTING_BALANCE)} y2={y(STARTING_BALANCE)} />

        <path className="chart-line" d={path} />
        {refillPath && <path className="chart-refill-line" d={refillPath} />}

        {/* 折線圖：每一筆都畫一個點（太多筆時點會擠在一起，就只畫線） */}
        {n <= MAX_DOTS &&
          history.map((p, i) =>
            p.refill || i === n - 1 ? null : <circle key={`d${i}`} className="chart-dot" cx={x(i)} cy={y(p.balance)} r={3} />,
          )}
        {/* 自動補充的點 */}
        {history.map((p, i) =>
          p.refill ? <circle key={i} className="chart-refill" cx={x(i)} cy={y(p.balance)} r={5} /> : null,
        )}
        {/* 最新一筆 */}
        <circle className="chart-last" cx={x(n - 1)} cy={y(last.balance)} r={4} />

        {hp && hover !== null && (
          <g pointerEvents="none">
            <line className="chart-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
            <circle className="chart-hover" cx={x(hover)} cy={y(hp.balance)} r={5} />
          </g>
        )}
        <rect
          className="chart-hit"
          x={PAD.left}
          y={PAD.top}
          width={Math.max(1, width - PAD.left - PAD.right)}
          height={HEIGHT - PAD.top - PAD.bottom}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hp && hover !== null && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(x(hover), 90), width - 90), top: Math.max(0, y(hp.balance) - 64) }}
        >
          <strong>{formatChips(hp.balance)}</strong>
          <span>
            第 {hover + 1} 筆 · {timeText(hp.t)}
          </span>
          {hp.refill ? (
            <span>輸光後自動補充</span>
          ) : hp.fee && hover > 0 ? (
            <span>中途離開，扣入場費 {(history[hover - 1].balance - hp.balance).toLocaleString('zh-TW')}</span>
          ) : hover > 0 ? (
            <span>
              這一局 {hp.balance - history[hover - 1].balance >= 0 ? '+' : '−'}
              {Math.abs(hp.balance - history[hover - 1].balance).toLocaleString('zh-TW')}
            </span>
          ) : (
            <span>開始</span>
          )}
        </div>
      )}

      <div className="chart-legend">
        <span>
          <i className="key-line" /> 籌碼
        </span>
        <span>
          <i className="key-ref" /> 起始籌碼
        </span>
        <span>
          <i className="key-refill" /> 輸光後自動補充（虛線那段不算輸贏）
        </span>
      </div>

      <details className="chart-table">
        <summary>看數據表（最近 20 筆）</summary>
        <table className="stat-table">
          <thead>
            <tr>
              <th>筆數</th>
              <th>時間</th>
              <th>變化</th>
              <th>籌碼</th>
            </tr>
          </thead>
          <tbody>
            {history
              .map((p, i) => ({ p, i }))
              .slice(-20)
              .reverse()
              .map(({ p, i }) => {
                const d = i > 0 ? p.balance - history[i - 1].balance : 0
                return (
                  <tr key={i}>
                    <td>第 {i + 1} 筆</td>
                    <td>{timeText(p.t)}</td>
                    <td>{p.refill ? '自動補充' : p.fee ? `入場費 −${Math.abs(d).toLocaleString('zh-TW')}` : i === 0 ? '開始' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('zh-TW')}`}</td>
                    <td>{formatChips(p.balance)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </details>
    </div>
  )
}
