/**
 * 選了一張牌時的打牌分析卡（浮在手牌上方）：
 * 綜合建議、進攻效率、機會成本、放槍風險、他人需求，以及「比較所有打法」表格。
 */
import { useState } from 'react'
import { tileName, type Tile as TileId } from '../engine'
import type { DangerLevel } from '../ai'
import { verdictOf, type DiscardAnalysis, type DiscardReport } from '../analysis/discardAnalysis'
import { Tile, TileRow } from './Tile'
import { seatName } from './useGame'

const RISK_TEXT: Record<DangerLevel, string> = { safe: '很低', low: '低', mid: '中', high: '高' }
const pct = (x: number) => (x < 0.01 ? '不到 1%' : `約 ${Math.round(x * 100)}%`)
const SHANTEN_TEXT = (n: number) => (n <= 0 ? (n < 0 ? '胡牌' : '聽牌') : `${n} 向聽`)

export function DiscardHint({ analysis, tile, onPick }: { analysis: DiscardAnalysis; tile: TileId; onPick: (t: TileId) => void }) {
  const [showAll, setShowAll] = useState(false)
  const r = analysis.reports.find((x) => x.tile === tile)
  if (!r) return null
  const rec = analysis.recommendation
  const verdict = verdictOf(r, analysis)

  return (
    <div className={`discard-hint tone-${verdict.tone} risk-${r.danger.level}`} aria-live="polite">
      <div className="hint-head">
        <strong>打出 {tileName(tile)}</strong>
        <span className={`verdict-chip ${verdict.tone}`}>{verdict.text}</span>
      </div>

      {/* 綜合建議 */}
      {/* 不直接告訴你該打哪張：只有你選到系統建議的那張時，才顯示「建議打這張」和理由 */}
      {rec.tile === tile && <div className="hint-rec">系統也建議打這張：{rec.reason}</div>}
      {rec.tile === null && <div className="hint-rec">建議：{rec.reason}</div>}

      <dl className="hint-grid">
        <dt>進攻</dt>
        <dd>
          {SHANTEN_TEXT(r.shanten)}，有效進張 {r.effective.length} 種、還剩 {r.effectiveCount} 張
          {r.effective.length > 0 && (
            <span className="hint-tiles">
              <TileRow tiles={r.effective} size="xs" />
            </span>
          )}
        </dd>

        <dt>機會成本</dt>
        <dd>
          <OpportunityCost r={r} best={analysis.best} />
        </dd>

        <dt>放槍風險</dt>
        <dd>
          <span className={`risk-chip ${r.danger.level}`}>
            {RISK_TEXT[r.danger.level]}（{pct(r.danger.chance)}）
          </span>
          <RiskDetail r={r} analysis={analysis} />
        </dd>

        <dt>他人需求</dt>
        <dd>
          {!analysis.enoughInfo ? (
            <span className="hint-muted">大家打出的牌還少，看不出誰需要什麼。</span>
          ) : r.needers.length === 0 ? (
            <span className="hint-muted">從牌河和吃碰看，沒有人特別需要這張。</span>
          ) : (
            <ul className="hint-list">
              {r.needers.map((n) => (
                <li key={n.seat}>
                  {seatName(n.seat)}可能需要：{n.why}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>

      <button type="button" className="link-button hint-toggle" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
        {showAll ? '收起比較表 ▲' : `比較所有打法（${analysis.reports.length} 種）▼`}
      </button>
      {showAll && <CompareTable analysis={analysis} selected={tile} onPick={onPick} />}

      <div className="hint-note">放槍風險和他人需求只根據大家打出的牌和吃碰推測，不看別人的手牌。</div>
    </div>
  )
}

function OpportunityCost({ r, best }: { r: DiscardReport; best: DiscardReport }) {
  const parts: React.ReactNode[] = []
  if (r.shantenLoss > 0) {
    parts.push(
      <li key="s">
        會慢 {r.shantenLoss} 步：打 {tileName(best.tile)} 是 {SHANTEN_TEXT(best.shanten)}，打這張是 {SHANTEN_TEXT(r.shanten)}。
      </li>,
    )
  } else if (r.effectiveLoss > 0) {
    parts.push(
      <li key="e">
        比打 {tileName(best.tile)} 少 {r.effectiveLoss} 張進張（{r.effectiveCount} 對 {best.effectiveCount}）。
      </li>,
    )
  }
  for (const h of r.lostTai) {
    parts.push(
      <li key={h.name}>
        會拆掉「{h.name}」，少 {h.tai} 台。
      </li>,
    )
  }
  if (parts.length === 0) return <span className="hint-muted">沒有損失：牌效是最好的之一，也沒有拆掉有台的組合。</span>
  return <ul className="hint-list">{parts}</ul>
}

function RiskDetail({ r, analysis }: { r: DiscardReport; analysis: DiscardAnalysis }) {
  if (!analysis.enoughInfo) return <span className="hint-muted"> 大家打出的牌還少，看不出誰聽牌。</span>
  const threats = r.danger.perSeat.filter((d) => d.chance >= 0.01).sort((a, b) => b.chance - a.chance)
  if (threats.length === 0) return <span className="hint-muted"> 從牌河看，不太會有人胡這張。</span>
  return (
    <ul className="hint-list">
      {threats.map((d) => {
        const read = analysis.reads.find((x) => x.seat === d.seat)!
        return (
          <li key={d.seat}>
            {seatName(d.seat)}（{pct(d.chance)}）：{d.reasons.length > 0 ? d.reasons.join('、') : '這張沒有特別安全的跡象'}
            {read.reasons[0] ? `。他${read.reasons[0].replace(/^他/, '')}` : ''}
          </li>
        )
      })}
    </ul>
  )
}

/** 所有打法的比較表：點一列就改選那張牌。 */
function CompareTable({ analysis, selected, onPick }: { analysis: DiscardAnalysis; selected: TileId; onPick: (t: TileId) => void }) {
  return (
    <div className="compare-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th>打</th>
            <th>向聽</th>
            <th>進張</th>
            <th>放槍</th>
            <th>有人要</th>
            <th>拆台</th>
          </tr>
        </thead>
        <tbody>
          {analysis.reports.map((r) => (
            <tr
              key={r.tile}
              className={r.tile === selected ? 'sel' : undefined}
              onClick={() => onPick(r.tile)}
            >
              <td>
                <Tile tile={r.tile} size="xs" />
                {r.tile === selected && r.tile === analysis.recommendation.tile && <span className="rec-mark">建議</span>}
              </td>
              <td>{SHANTEN_TEXT(r.shanten)}</td>
              <td>{r.effectiveCount}</td>
              <td>
                <span className={`risk-dot ${r.danger.level}`} />
                {pct(r.danger.chance)}
              </td>
              <td>{r.needers.length > 0 ? r.needers.map((n) => seatName(n.seat)).join('、') : '—'}</td>
              <td>{r.lostTai.length > 0 ? r.lostTai.map((h) => `−${h.tai}`).join(' ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
