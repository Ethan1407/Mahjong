import { useEffect, useMemo, useState } from 'react'
import { WIND_NAMES, analyzeDiscards, tileName, toCounts, type Tile as TileId } from '../engine'
import {
  describeEventFor,
  roundName,
  visibleCounts,
  type Action,
  type MatchState,
  type PlayerView,
  type RoundResult,
  type RoundState,
  type SeatView,
} from '../game'
import { DIFFICULTIES, type Difficulty } from '../difficulty'
import { Tile, TileRow } from './Tile'
import { HUMAN, useGame } from './useGame'
import './table.css'

/** 依相對位置命名：0 = 自己（下方）、1 = 下家（右）、2 = 對家（上）、3 = 上家（左）。 */
const REL_NAMES = ['你', '下家', '對家', '上家']
const REL_POS = ['bottom', 'right', 'top', 'left'] as const
const rel = (seat: number) => (seat - HUMAN + 4) % 4
const seatName = (seat: number) => REL_NAMES[rel(seat)]

const SHANTEN_TEXT = (n: number) => (n <= 0 ? (n < 0 ? '胡牌' : '聽牌') : `${n} 向聽`)

export function TableScreen({ difficulty, onExit }: { difficulty: Difficulty; onExit: () => void }) {
  const { match, round, view, act, next, restart } = useGame(difficulty)
  const difficultyName = DIFFICULTIES.find((d) => d.id === difficulty)!.name

  if (match.finished || !round || !view) {
    return <MatchSummary match={match} onRestart={restart} onExit={onExit} />
  }

  return (
    <div className="table-page">
      <header className="table-header">
        <button type="button" className="link-button" onClick={onExit}>
          ← 離開
        </button>
        <span className="table-title">
          {roundName(match.roundWind, match.dealerChanges)}
          {match.dealerStreak > 0 && `（連 ${match.dealerStreak}）`}
        </span>
        <span className="table-meta">機器人：{difficultyName}</span>
      </header>

      <div className="table">
        {[2, 3, 1].map((r) => {
          const seat = (HUMAN + r) % 4
          return <OpponentArea key={seat} sv={view.seats[seat]} view={view} match={match} />
        })}
        <Center view={view} match={match} round={round} />
        <PlayerArea view={view} match={match} act={act} />
      </div>

      {round.result && <ResultDialog result={round.result} round={round} onNext={next} />}
    </div>
  )
}

// ─────────────────────────── 座位資訊 ───────────────────────────

function SeatBadge({ sv, view, match }: { sv: SeatView; view: PlayerView; match: MatchState }) {
  const isDealer = sv.seat === view.dealer
  const active = view.phase === 'discard' && view.turn === sv.seat
  return (
    <div className={`seat-badge${active ? ' active' : ''}`}>
      <span className="seat-wind">{WIND_NAMES[sv.seatWind]}</span>
      <span className="seat-name">{seatName(sv.seat)}</span>
      {isDealer && <span className="dealer-chip">莊{view.dealerStreak > 0 ? ` 連${view.dealerStreak}` : ''}</span>}
      <span className="seat-score">{match.scores[sv.seat] >= 0 ? '+' : ''}{match.scores[sv.seat]}</span>
    </div>
  )
}

function Melds({ sv, size }: { sv: SeatView; size: 'sm' | 'xs' }) {
  if (sv.melds.length === 0 && sv.flowers.length === 0) return null
  return (
    <div className="melds">
      {sv.melds.map((m, i) => (
        <span className="meld" key={i} title={m.type === 'ankan' ? '暗槓' : undefined}>
          {m.hidden
            ? [0, 1, 2, 3].map((k) => <Tile key={k} back size={size} />)
            : m.tiles.map((t, k) => <Tile key={k} tile={t} size={size} dim={m.type === 'ankan' && (k === 0 || k === 3)} />)}
        </span>
      ))}
      {sv.flowers.length > 0 && (
        <span className="meld flowers" title="花牌">
          {sv.flowers.map((f) => (
            <Tile key={f} tile={f} size="xs" />
          ))}
        </span>
      )}
    </div>
  )
}

function OpponentArea({ sv, view, match }: { sv: SeatView; view: PlayerView; match: MatchState }) {
  const pos = REL_POS[rel(sv.seat)]
  return (
    <section className={`seat-area seat-${pos}`} aria-label={seatName(sv.seat)}>
      <SeatBadge sv={sv} view={view} match={match} />
      <div className="hand-count">
        <Tile back size="xs" /> × {sv.handCount}
      </div>
      <Melds sv={sv} size="xs" />
    </section>
  )
}

// ─────────────────────────── 中央：牌河與局況 ───────────────────────────

function River({ sv, view }: { sv: SeatView; view: PlayerView }) {
  const pos = REL_POS[rel(sv.seat)]
  const lastIdx = sv.river.length - 1
  // 正在等人回應的那張牌特別標示
  const isLast = (i: number) => view.pending?.kind === 'discard' && view.pending.from === sv.seat && i === lastIdx
  return (
    <div className={`river river-${pos}`} aria-label={`${seatName(sv.seat)}的牌河`}>
      {sv.river.map((r, i) => (
        <Tile key={i} tile={r.tile} size="xs" dim={r.claimed} highlight={isLast(i)} />
      ))}
    </div>
  )
}

function Center({ view, match, round }: { view: PlayerView; match: MatchState; round: RoundState }) {
  const log = round.log.slice(-6).map((e) => describeEventFor(e, HUMAN, seatName))
  return (
    <div className="center">
      {view.seats.map((sv) => (
        <River key={sv.seat} sv={sv} view={view} />
      ))}
      <div className="center-info">
        <div className="wall-left">
          剩 <strong>{view.wallDrawable}</strong> 張
        </div>
        <div className="center-round">
          {WIND_NAMES[match.roundWind]}風圈 · 第 {match.handNumber + 1} 局
        </div>
        <ol className="event-log" aria-live="polite">
          {log.map((line, i) => (
            <li key={round.log.length - log.length + i}>{line}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ─────────────────────────── 自己的手牌與操作 ───────────────────────────

function PlayerArea({ view, match, act }: { view: PlayerView; match: MatchState; act: (a: Action) => void }) {
  const me = view.seats[HUMAN]
  const [selected, setSelected] = useState<TileId | null>(null)
  const myTurn = view.phase === 'discard' && view.turn === HUMAN
  const canDiscard = myTurn && view.legal.some((a) => a.type === 'discard')

  // 手牌變了就取消選取
  const handKey = view.hand.join(',')
  useEffect(() => setSelected(null), [handKey, view.phase])

  // 摸進來的牌放在最右邊、隔開一點
  const drawn = myTurn ? view.lastDrawn : null
  const handTiles = useMemo(() => {
    const tiles = [...view.hand]
    if (drawn !== null) tiles.splice(tiles.indexOf(drawn), 1)
    return tiles
  }, [view.hand, drawn])

  const clickTile = (t: TileId) => {
    if (!canDiscard) return
    if (selected === t) act({ type: 'discard', seat: HUMAN, tile: t })
    else setSelected(t)
  }

  return (
    <section className="seat-area seat-bottom" aria-label="你的手牌">
      <SeatBadge sv={me} view={view} match={match} />
      <Melds sv={me} size="sm" />
      <div className="my-hand">
        {handTiles.map((t, i) => (
          <Tile key={`${t}-${i}`} tile={t} size="lg" selected={selected === t} onClick={canDiscard ? () => clickTile(t) : undefined} />
        ))}
        {drawn !== null && (
          <span className="drawn-slot">
            <Tile tile={drawn} size="lg" selected={selected === drawn} onClick={canDiscard ? () => clickTile(drawn) : undefined} />
          </span>
        )}
      </div>
      <ActionBar view={view} selected={selected} act={act} />
      {canDiscard && selected !== null && <DiscardHint view={view} tile={selected} />}
    </section>
  )
}

const CLAIM_LABEL: Partial<Record<Action['type'], string>> = {
  ron: '胡',
  pung: '碰',
  minkan: '槓',
  tsumo: '自摸',
  pass: '過',
}

function ActionBar({ view, selected, act }: { view: PlayerView; selected: TileId | null; act: (a: Action) => void }) {
  const legal = view.legal
  const pending = view.pending

  if (view.phase === 'discard' && view.turn === HUMAN) {
    const special = legal.filter((a) => a.type !== 'discard')
    return (
      <div className="action-bar">
        {special.map((a, i) => (
          <button key={i} type="button" className={a.type === 'tsumo' ? 'action win' : 'action'} onClick={() => act(a)}>
            {a.type === 'tsumo' && '自摸'}
            {a.type === 'ankan' && `暗槓 ${tileName(a.tile)}`}
            {a.type === 'kakan' && `加槓 ${tileName(a.tile)}`}
          </button>
        ))}
        {selected !== null ? (
          <button type="button" className="action primary" onClick={() => act({ type: 'discard', seat: HUMAN, tile: selected })}>
            打出 {tileName(selected)}
          </button>
        ) : (
          <span className="action-hint">輪到你：點一張牌看分析，再點一次（或按「打出」）就會打出去</span>
        )}
      </div>
    )
  }

  if (legal.length > 0 && pending) {
    const fromName = seatName(pending.from)
    return (
      <div className="action-bar">
        <span className="action-hint">
          {fromName}
          {pending.kind === 'kakan' ? '要加槓' : '打出'} <Tile tile={pending.tile} size="sm" />
        </span>
        {legal.map((a, i) => (
          <button
            key={i}
            type="button"
            className={a.type === 'ron' ? 'action win' : a.type === 'pass' ? 'action subtle' : 'action'}
            onClick={() => act(a)}
          >
            {a.type === 'chow' ? (
              <>
                吃 <TileRow tiles={[...a.tiles, pending.tile].sort((x, y) => x - y)} size="xs" />
              </>
            ) : (
              CLAIM_LABEL[a.type]
            )}
          </button>
        ))}
      </div>
    )
  }

  const waitingFor = view.phase === 'discard' ? `等待${seatName(view.turn)}出牌…` : '等待其他人決定…'
  return (
    <div className="action-bar">
      <span className="action-hint">{view.phase === 'ended' ? '這局結束了' : waitingFor}</span>
    </div>
  )
}

/** 選了一張牌時的基本分析（完整的放槍風險分析在階段 5 加入）。 */
function DiscardHint({ view, tile }: { view: PlayerView; tile: TileId }) {
  const options = useMemo(
    () => analyzeDiscards(toCounts(view.hand), view.seats[HUMAN].melds.length, visibleCounts(view)),
    [view],
  )
  const mine = options.find((o) => o.tile === tile)
  const best = options[0]
  if (!mine) return null
  const isBest = mine.shanten === best.shanten && mine.effectiveCount >= best.effectiveCount
  return (
    <div className={`discard-hint${isBest ? ' good' : ''}`} aria-live="polite">
      <strong>打出 {tileName(tile)}：</strong>
      {SHANTEN_TEXT(mine.shanten)}，有效進張 {mine.effective.length} 種、還剩 {mine.effectiveCount} 張
      {mine.effective.length > 0 && (
        <span className="hint-tiles">
          <TileRow tiles={mine.effective} size="xs" />
        </span>
      )}
      <div className="hint-compare">
        {isBest
          ? '這是目前牌效最好的打法之一。'
          : `比較：打 ${tileName(best.tile)} 是 ${SHANTEN_TEXT(best.shanten)}，還剩 ${best.effectiveCount} 張進張。`}
      </div>
    </div>
  )
}

// ─────────────────────────── 結算 ───────────────────────────

function ResultDialog({ result, round, onNext }: { result: RoundResult; round: RoundState; onNext: () => void }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
        {result.type === 'exhaustive' ? (
          <>
            <h2 id="result-title">流局</h2>
            <p>牌摸完了，沒有人胡牌。莊家連莊。</p>
          </>
        ) : (
          <WinDetail result={result} round={round} />
        )}
        <div className="dialog-actions">
          <button type="button" className="action primary" onClick={onNext} autoFocus>
            下一局
          </button>
        </div>
      </div>
    </div>
  )
}

function WinDetail({ result, round }: { result: Extract<RoundResult, { type: 'win' }>; round: RoundState }) {
  const winner = round.players[result.winner]
  const how =
    result.score.pattern === 'eightFlowers' || result.score.pattern === 'sevenRobOne'
      ? ''
      : result.discarder === null
        ? '自摸'
        : `胡${seatName(result.discarder)}的牌`
  const iWon = result.winner === HUMAN
  return (
    <>
      <h2 id="result-title">
        {seatName(result.winner)} {how}！{iWon ? '🎉' : ''}
      </h2>
      <div className="result-hand">
        {winner.melds.map((m, i) => (
          <span className="meld" key={i}>
            {m.tiles.map((t, k) => (
              <Tile key={k} tile={t} size="sm" />
            ))}
          </span>
        ))}
        <span className="meld">
          {winner.hand.map((t, k) => (
            <Tile key={k} tile={t} size="sm" highlight={t === result.tile && k === winner.hand.lastIndexOf(t)} />
          ))}
        </span>
        {winner.flowers.length > 0 && <TileRow tiles={winner.flowers} size="xs" />}
      </div>
      <table className="tai-table">
        <tbody>
          {result.score.items.map((item, i) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td>{item.tai} 台</td>
            </tr>
          ))}
          {result.score.items.length === 0 && (
            <tr>
              <td>無台（屁胡）</td>
              <td>0 台</td>
            </tr>
          )}
          <tr className="total">
            <td>牌型合計</td>
            <td>{result.score.tai} 台</td>
          </tr>
        </tbody>
      </table>
      <ul className="payments">
        {result.payments.payments.map((p) => (
          <li key={p.payer}>
            {seatName(p.payer)} 付 <strong>{p.amount}</strong>（{p.tai} 台{p.dealerTai > 0 ? `，含莊家相關 ${p.dealerTai} 台` : ''}）
          </li>
        ))}
      </ul>
    </>
  )
}

function MatchSummary({ match, onRestart, onExit }: { match: MatchState; onRestart: () => void; onExit: () => void }) {
  const ranking = [0, 1, 2, 3].sort((a, b) => match.scores[b] - match.scores[a])
  const wins = [0, 1, 2, 3].map((s) => match.history.filter((h) => h.result.type === 'win' && h.result.winner === s).length)
  return (
    <main className="setup">
      <header className="setup-header">
        <h1>一將結束</h1>
        <p>共打了 {match.history.length} 局。</p>
      </header>
      <table className="tai-table ranking">
        <thead>
          <tr>
            <th>名次</th>
            <th>玩家</th>
            <th>胡牌</th>
            <th>分數</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((s, i) => (
            <tr key={s} className={s === HUMAN ? 'me' : undefined}>
              <td>{i + 1}</td>
              <td>{seatName(s)}</td>
              <td>{wins[s]} 次</td>
              <td>{match.scores[s]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="setup-actions">
        <button type="button" onClick={onExit}>
          返回
        </button>
        <button type="button" className="primary" onClick={onRestart}>
          再來一將
        </button>
      </div>
    </main>
  )
}
