/**
 * 對手分析（「機器人思路」開啟時顯示在畫面左側）。
 *
 * 全部只根據桌上看得到的東西推測：對手打出的牌、吃碰槓、牌牆剩幾張。
 * 不看對手的手牌，也不顯示機器人自己的想法（那等於偷看）。
 */
import { useMemo } from 'react'
import { MIN_DISCARDS_TO_READ, likelyNeeds, readOpponent } from '../ai'
import { WIND_NAMES } from '../engine'
import type { PlayerView } from '../game'
import { TileRow } from './Tile'
import { HUMAN, seatName } from './useGame'

function tenpaiLevel(p: number): { text: string; cls: string } {
  if (p >= 0.6) return { text: '高', cls: 'high' }
  if (p >= 0.35) return { text: '中', cls: 'mid' }
  return { text: '低', cls: 'low' }
}

export function OpponentInsights({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  // 依座位順序：下家、對家、上家
  const analyses = useMemo(
    () =>
      [1, 2, 3].map((r) => {
        const seat = (HUMAN + r) % 4
        const read = readOpponent(view, seat)
        return { seat, read, needs: likelyNeeds(view, seat, 5, read) }
      }),
    [view],
  )

  return (
    <aside className="insights" aria-labelledby="insights-title">
      <header className="insights-header">
        <div className="insights-title-row">
          <h2 id="insights-title">機器人思路（讀牌）</h2>
          <button type="button" className="insights-close" onClick={onClose} aria-label="關閉機器人思路">
            關閉 ✕
          </button>
        </div>
        <p>只根據他們打出的牌和吃碰推測，不看他們的手牌。資訊越多，判斷越準。</p>
        <p>
          可能需要的牌，優先挑他最近沒打過、附近也沒打過的中張。他很早打過的牌不一定安全，之後摸到別的牌可能又需要。
        </p>
      </header>
      {analyses.map(({ seat, read, needs }) => {
        const sv = view.seats[seat]
        const level = tenpaiLevel(read.tenpai)
        return (
          <article className="insight-card" key={seat}>
            <h3>
              <span className="seat-wind">{WIND_NAMES[sv.seatWind]}</span> {seatName(seat)}
              <span className="insight-meta">
                打了 {sv.river.length} 張 · 吃碰 {sv.melds.length} 組
              </span>
            </h3>

            {!read.enoughInfo ? (
              <p className="insight-unknown">
                還看不出來：他才打了 {sv.river.length} 張牌、也還沒吃碰，手牌可能好也可能差。
                <br />
                等他打出 {MIN_DISCARDS_TO_READ} 張以上或吃碰之後再判斷。
              </p>
            ) : (
              <>
                <div className="insight-row">
                  <span className="insight-label">聽牌可能</span>
                  <span className={`tenpai-chip ${level.cls}`}>
                    {level.text}（約 {Math.round(read.tenpai * 100)}%）
                  </span>
                </div>
                <ul className="insight-basis">
                  {read.reasons.length > 0 ? read.reasons.map((r) => <li key={r}>{r}</li>) : <li>還沒有明顯的聽牌跡象</li>}
                </ul>

                <div className="insight-row">
                  <span className="insight-label">可能需要的牌</span>
                  <TileRow tiles={needs.tiles} size="xs" />
                </div>
                {needs.basis.length > 0 && (
                  <ul className="insight-basis">
                    {needs.basis.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {read.hints.length > 0 && (
              <div className="insight-thought">
                <span className="insight-label">從他的動作推測</span>
                <ul className="insight-basis">
                  {read.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        )
      })}
    </aside>
  )
}
