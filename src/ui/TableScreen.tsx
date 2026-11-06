import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { WIND_NAMES, tileName, type RuleConfig, type Tile as TileId } from '../engine'
import {
  DOUBLE_DEADLINE_DISCARDS,
  DOUBLE_FACTORS,
  canDouble,
  describeEventFor,
  roundName,
  type Action,
  type MatchState,
  type PlayerView,
  type RoundResult,
  type RoundState,
  type SeatView,
} from '../game'
import type { BotLevel } from '../ai'
import { analyzeTurn } from '../analysis/discardAnalysis'
import { DiscardHint } from './DiscardHint'
import { DIFFICULTIES } from '../difficulty'
import {
  STARTING_BALANCE,
  chargeExitFee,
  exitFeeOf,
  formatChips,
  loadWallet,
  recordHand,
  stakeKey,
  stakeLabel,
  stakeOf,
  type CustomStake,
  type StakeId,
} from '../wallet'
import { recordHandOutcome, recordMatchFinish, recordMatchStart, recordStakeFee, type HandOutcome } from '../profile'
import { usePlayTime } from './usePlayTime'
import { formatDuration } from './format'
import { GoldBurst, useCallBursts, type Burst } from './GoldBurst'
import { flowerNotes, meldNotes, myStatusNotes, myTaiHints, type TaiNote } from '../analysis/taiHints'
import { Tile, TileRow } from './Tile'
import { AssistMenu, useAssist } from './assist'
import { DiceScreen } from './DiceScreen'
import { DecorMenu } from './DecorMenu'
import { useCosmetics } from '../cosmetics'
import { OpponentInsights } from './OpponentInsights'
import { DEAL_STEPS, HUMAN, seatName, useGame } from './useGame'
import './table.css'

/** 依相對位置：0 = 自己（下方）、1 = 下家（右）、2 = 對家（上）、3 = 上家（左）。 */
const REL_POS = ['bottom', 'right', 'top', 'left'] as const
const rel = (seat: number) => (seat - HUMAN + 4) % 4

/** 發牌中顯示幾張：每一步每人 1 張，發完才顯示全部（含莊家多拿的那張）。 */
const dealtCount = (total: number, step: number | null) => (step === null ? total : Math.min(total, step))

const taiTip = (n: TaiNote, suffix = '') => `${n.name}：+${n.tai} 台${suffix}。${n.reason}`

export function TableScreen({
  difficulty,
  stake: stakeId,
  custom,
  onExit,
}: {
  difficulty: BotLevel
  stake: StakeId
  custom?: CustomStake
  onExit: () => void
}) {
  const stake = useMemo(() => stakeOf(stakeId, custom), [stakeId, custom])
  const { match, round, view, started, start, rollDice, dealProgress, act, next, restart, double, matchStartedAt, handSeconds } =
    useGame(difficulty, stake)
  const difficultyName = DIFFICULTIES.find((d) => d.id === difficulty)!.name
  const [assist, updateAssist] = useAssist()

  // 每打完一局就把你的輸贏記進錢包（存在這台裝置）；同一局只記一次
  const [balance, setBalance] = useState(() => loadWallet().balance)
  /** 這一局之後籌碼輸光、自動補充了（結算時告訴你）。 */
  const [refilled, setRefilled] = useState(false)
  const result = round?.result ?? null
  useEffect(() => {
    if (!result) {
      setRefilled(false)
      return
    }
    if (stake.free) return
    const delta = result.type === 'win' ? result.payments.deltas[HUMAN] : 0
    const w = recordHand(match.config.seed, stake, matchStartedAt ?? Date.now(), match.handNumber, delta)
    setBalance(w.balance)
    if (w.refilled) setRefilled(true)
  }, [result, stake, match.config.seed, match.handNumber, matchStartedAt])

  // 個人中心：記錄每一局的結果、開始與打完幾將、各種入場玩了幾場（存在本機）
  const stakeRef = useMemo(() => ({ key: stakeKey(stake), label: stakeLabel(stake) }), [stake])
  const seed = match.config.seed
  const counted = useRef({ start: -1, finish: -1 })
  useEffect(() => {
    if (!started || counted.current.start === seed) return
    counted.current.start = seed
    recordMatchStart(stakeRef)
  }, [started, seed])
  useEffect(() => {
    if (!match.finished || match.history.length === 0 || counted.current.finish === seed) return
    counted.current.finish = seed
    recordMatchFinish()
  }, [match.finished, seed, match.history.length])
  useEffect(() => {
    if (!result || !round) return
    const delta = result.type === 'win' ? result.payments.deltas[HUMAN] : 0
    const base = {
      match: seed,
      hand: match.handNumber,
      level: difficulty,
      stake: stakeRef,
      delta,
    }
    let outcome: HandOutcome
    if (result.type !== 'win') outcome = { ...base, kind: 'draw' }
    else if (result.winner === HUMAN) {
      outcome = {
        ...base,
        kind: 'win',
        tsumo: result.discarder === null,
        tai: result.score.tai,
        items: result.score.items.map((i) => i.name),
        turn: winTurn(result, round),
      }
    } else if (result.discarder === HUMAN) outcome = { ...base, kind: 'dealIn' }
    else if (result.discarder === null) outcome = { ...base, kind: 'tsumoAgainst' }
    else outcome = { ...base, kind: 'otherWin' }
    recordHandOutcome(outcome)
    // 只在這一局有結果時記一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // 台數加倍：選完倍數後播放金色「×N」動畫
  const [burst, setBurst] = useState<Burst | null>(null)
  const { effect: myEffect } = useCosmetics()
  const doubleWithBurst = (factor: number) => {
    if (stake.free) return // 免費入場不能加倍
    double(factor)
    setBurst({ text: `台數 ×${factor}`, effect: myEffect, key: Date.now() })
  }
  const endBurst = useCallback(() => setBurst(null), [])
  // 所有玩家吃、碰、槓、胡、自摸時，也用金色大字顯示（文字在 GoldBurst.tsx 裡改）
  const [callBurst, endCallBurst] = useCallBursts(round, `${match.config.seed}:${match.handNumber}`)

  // 中途離開：有賭注的對局、你出過牌之後，離開要扣入場費（先確認）
  const [confirmExit, setConfirmExit] = useState(false)
  const exitFee = exitFeeOf(stake)
  // 只有「這一局打到一半、你已經出過牌」才要扣；一局結束後、或新的一局你還沒出牌前，都可以免費離開
  const inHandAfterDiscard = round !== null && round.phase !== 'ended' && round.players[HUMAN].discards > 0
  const mustPayToLeave = exitFee > 0 && started && !match.finished && inHandAfterDiscard
  const requestExit = () => (mustPayToLeave ? setConfirmExit(true) : onExit())
  const leaveAndPay = () => {
    chargeExitFee(seed, stake, exitFee)
    recordStakeFee(stakeRef, exitFee, difficulty)
    setConfirmExit(false)
    onExit()
  }

  // 有效遊玩時間：在對局中、網頁在前面、一分鐘內有動作才計時
  const playTime = usePlayTime(started && !match.finished && round !== null, seed)

  // 局名放在最上方橫幅裡，但水平位置對齊對家的名牌（左邊開著機器人思路時，牌桌會往右移）
  const headerRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const align = () => {
      const badge = header.parentElement?.querySelector('.seat-top .seat-badge')
      if (!badge) return
      const b = badge.getBoundingClientRect()
      // 以局名所在的那一塊為基準（手機上局名自己一行，左右有留白）
      const h = (header.querySelector('.round-banner') ?? header).getBoundingClientRect()
      header.style.setProperty('--title-x', `${b.left + b.width / 2 - h.left}px`)
    }
    align()
    window.addEventListener('resize', align)
    const ro = new ResizeObserver(align)
    ro.observe(header)
    const table = header.parentElement?.querySelector('.table')
    if (table) ro.observe(table)
    return () => {
      window.removeEventListener('resize', align)
      ro.disconnect()
    }
  }, [assist.botThoughts, started, round === null])

  if (match.finished || !round || !view) {
    return <MatchSummary match={match} onRestart={restart} onExit={onExit} />
  }
  if (!started && match.opening) {
    return <DiceScreen onRoll={rollDice} onStart={start} onExit={onExit} />
  }

  return (
    <div className="table-page">
      <header className="table-header banner" ref={headerRef}>
        <div className="banner-side">
          <button type="button" className="link-button" onClick={requestExit}>
            ← 離開
          </button>
          <span className="table-meta">
            機器人：{difficultyName} · {stake.free ? '免費入場' : `底 ${stake.base}／每台 ${stake.perTai}`}
          </span>
        </div>
        {/* 最上方橫幅的正中間：現在是哪一局 */}
        <span className="table-title round-banner">
          <span className="round-banner-text">
            {roundName(match.roundWind, match.dealerChanges)}
            {match.dealerStreak > 0 && `（連 ${match.dealerStreak}）`}
            {round.doubled && <span className="doubled-badge">台數 ×{round.doubled.factor}</span>}
          </span>
        </span>
        <div className="banner-side right">
          {stake.free ? (
            // 免費入場不能台數加倍，只顯示分數
            <span className="chips-button static" title="免費入場不能台數加倍">
              分數 <strong>{signed(match.scores[HUMAN])}</strong>
            </span>
          ) : (
            <DoubleMenu round={round} dealing={dealProgress !== null} onDouble={doubleWithBurst} label="籌碼與台數加倍">
              籌碼 <strong>{formatChips(balance)}</strong>
            </DoubleMenu>
          )}
          <DecorMenu onFelt />
          <AssistMenu settings={assist} update={updateAssist} />
        </div>
      </header>

      <div className={`table-layout${assist.botThoughts ? ' with-insights' : ''}`}>
        {assist.botThoughts && <OpponentInsights view={view} onClose={() => updateAssist({ botThoughts: false })} />}
        <div className="table">
          {[2, 3, 1].map((r) => {
            const seat = (HUMAN + r) % 4
            return (
              <OpponentArea
                key={seat}
                sv={view.seats[seat]}
                view={view}
                match={match}
                deal={dealProgress}
                taiOn={assist.taiHints}
              />
            )
          })}
          <Center view={view} match={match} round={round} deal={dealProgress} />
          <PlayerArea
            view={view}
            match={match}
            rules={round.rules}
            act={act}
            showHint={assist.discardHint}
            taiOn={assist.taiHints}
            deal={dealProgress}
            scoreSlot={
              stake.free ? undefined : (
                <DoubleMenu
                  round={round}
                  dealing={dealProgress !== null}
                  onDouble={doubleWithBurst}
                  label="你這將的輸贏與台數加倍"
                  placement="up"
                  className="seat-double"
                >
                  <span className="seat-score">{signed(match.scores[HUMAN])}</span>
                </DoubleMenu>
              )
            }
          />
        </div>
      </div>

      {round.result && (
        <ResultDialog
          result={round.result}
          round={round}
          seconds={handSeconds}
          refilled={refilled}
          onNext={next}
          onLeave={onExit}
        />
      )}
      <PlayClock seconds={playTime.seconds} paused={playTime.paused} />
      {burst && <GoldBurst key={burst.key} text={burst.text} sub={burst.sub} effect={burst.effect} action="win" onDone={endBurst} />}
      {callBurst && !burst && <GoldBurst
          key={callBurst.key}
          text={callBurst.text}
          sub={callBurst.sub}
          effect={callBurst.effect}
          action={callBurst.action}
          tile={callBurst.tile}
          onDone={endCallBurst}
        />}
      {confirmExit && (
        <div className="dialog-backdrop">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="exit-title">
            <h2 id="exit-title">確定要離開嗎？</h2>
            <p>
              這是有賭注的對局（{stake.name}
              ），這一局你已經出過牌了。現在離開會扣掉入場費 <strong>{formatChips(exitFee)}</strong> 籌碼。
              <br />
              等這一局結束、或下一局出牌前離開，就不用扣。
            </p>
            <p className="result-time">
              目前籌碼 {formatChips(balance)} → 離開後 {formatChips(balance - exitFee)}
            </p>
            <div className="dialog-actions">
              <button type="button" className="action" onClick={leaveAndPay}>
                扣入場費並離開
              </button>
              <button type="button" className="action primary" onClick={() => setConfirmExit(false)} autoFocus>
                繼續打
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── 籌碼與台數加倍 ───────────────────────────

/**
 * 台數加倍的選單：滑鼠移上去（或點一下）打開。按「台數加倍」後再選 ×2–×5。
 * 只有前兩圈（四家都還沒打滿兩張）可以加倍，每局一次，所有玩家都適用。
 * 右上角的籌碼、和你座位上的輸贏分數都可以打開這個選單。
 */
function DoubleMenu({
  round,
  dealing,
  onDouble,
  children,
  label,
  placement = 'down',
  className = '',
}: {
  round: RoundState
  dealing: boolean
  onDouble: (factor: number) => void
  /** 按鈕裡顯示的內容（籌碼或分數）。 */
  children: React.ReactNode
  label: string
  /** 選單往下（右上角）或往上（畫面下方的座位）打開。 */
  placement?: 'down' | 'up'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const allowed = !dealing && canDouble(round)
  const perTai = round.rules.perTai
  const close = () => {
    setOpen(false)
    setPicking(false)
  }
  return (
    <div className={`chips-menu ${placement}${open ? ' open' : ''} ${className}`} onMouseLeave={close}>
      <button type="button" className="chips-button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label}>
        {children}
        {round.doubled && <span className="doubled-dot">×{round.doubled.factor}</span>}
      </button>
      <div className="chips-pop" role="dialog" aria-label="台數加倍">
        <p className="chips-pop-title">
          這一局：底 {round.rules.base}、每台 {perTai}
        </p>
        {round.doubled ? (
          <p>
            這局台數已經 <strong>×{round.doubled.factor}</strong>：每台 {round.doubled.fromPerTai} → {perTai}，所有玩家都適用。
          </p>
        ) : allowed ? (
          picking ? (
            <>
              <p>要加幾倍？所有玩家（包括你）的輸贏都會跟著變大。</p>
              <div className="factor-row">
                {DOUBLE_FACTORS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="factor-button"
                    onClick={() => {
                      onDouble(f)
                      close()
                    }}
                  >
                    <strong>×{f}</strong>
                    <span>每台 {perTai * f}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="link-button" onClick={() => setPicking(false)}>
                不要加倍
              </button>
            </>
          ) : (
            <>
              <p>要不要把這一局的台數價格加倍？可以選 ×2 到 ×5。</p>
              <button type="button" className="action primary" onClick={() => setPicking(true)}>
                台數加倍
              </button>
              <p className="chips-pop-note">前兩圈內（四家各打兩張之前）才能加倍，每局一次。</p>
            </>
          )
        ) : (
          <p className="chips-pop-note">
            {dealing
              ? '發完牌之後才能選擇加倍。'
              : `已經過了前兩圈（四家共打出 ${DOUBLE_DEADLINE_DISCARDS} 張），這局不能再加倍。`}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── 座位資訊 ───────────────────────────

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`

function SeatBadge({
  sv,
  view,
  match,
  scoreSlot,
}: {
  sv: SeatView
  view: PlayerView
  match: MatchState
  /** 取代分數的內容（你的座位：可以打開台數加倍選單）。 */
  scoreSlot?: React.ReactNode
}) {
  const isDealer = sv.seat === view.dealer
  const active = view.phase === 'discard' && view.turn === sv.seat
  return (
    <div className={`seat-badge${active ? ' active' : ''}`}>
      <span className="seat-wind">{WIND_NAMES[sv.seatWind]}</span>
      <span className="seat-name">{seatName(sv.seat)}</span>
      {isDealer && <span className="dealer-chip">莊{view.dealerStreak > 0 ? ` 連${view.dealerStreak}` : ''}</span>}
      {scoreSlot ?? <span className="seat-score">{signed(match.scores[sv.seat])}</span>}
    </div>
  )
}

function Melds({
  sv,
  size,
  meldTips = [],
  flowerTips = new Map(),
}: {
  sv: SeatView
  size: 'sm' | 'xs'
  /** 每組副露的台數說明（有就加金框）。 */
  meldTips?: (string | undefined)[]
  flowerTips?: Map<TileId, string>
}) {
  if (sv.melds.length === 0 && sv.flowers.length === 0) return null
  return (
    <div className="melds">
      {sv.melds.map((m, i) => {
        const tip = meldTips[i]
        return (
          <span
            className={`meld${tip ? ' tai' : ''}`}
            key={i}
            title={!tip && m.type === 'ankan' ? '暗槓' : undefined}
            data-tip={tip}
            tabIndex={tip ? 0 : undefined}
            aria-label={tip}
          >
            {m.hidden
              ? [0, 1, 2, 3].map((k) => <Tile key={k} back size={size} />)
              : m.tiles.map((t, k) => <Tile key={k} tile={t} size={size} dim={m.type === 'ankan' && (k === 0 || k === 3)} />)}
          </span>
        )
      })}
      {sv.flowers.length > 0 && (
        <span className="meld flowers">
          {sv.flowers.map((f) => (
            <Tile key={f} tile={f} size={size} tip={flowerTips.get(f)} />
          ))}
        </span>
      )}
    </div>
  )
}

function OpponentArea({
  sv,
  view,
  match,
  deal,
  taiOn,
}: {
  sv: SeatView
  view: PlayerView
  match: MatchState
  deal: number | null
  taiOn: boolean
}) {
  const pos = REL_POS[rel(sv.seat)]
  const who = seatName(sv.seat)
  const meldTips = taiOn
    ? sv.melds.map((m) => {
        const notes = meldNotes(m, sv.seatWind, view.roundWind)
        return notes.length > 0 ? notes.map((n) => taiTip(n, `（${who}胡牌時算）`)).join('\n') : undefined
      })
    : []
  const flowerTips = taiOn
    ? new Map([...flowerNotes(sv.flowers, sv.seatWind)].map(([f, n]) => [f, taiTip(n, `（${who}胡牌時算）`)]))
    : new Map<TileId, string>()
  const dealingDone = deal === null || deal >= DEAL_STEPS
  return (
    <section className={`seat-area seat-${pos}`} aria-label={who}>
      <SeatBadge sv={sv} view={view} match={match} />
      <div className="hand-count">
        <Tile back size="xs" /> × {dealtCount(sv.handCount, deal)}
      </div>
      {dealingDone && <Melds sv={sv} size="xs" meldTips={meldTips} flowerTips={flowerTips} />}
    </section>
  )
}

// ─────────────────────────── 中央：牌河與局況 ───────────────────────────

const TAKEN_VERB = { chow: '吃', pung: '碰', minkan: '槓', ron: '胡' } as const

/** 被拿走的牌：滑鼠移上去顯示「你打的三萬被下家碰走」。 */
function takenNote(from: number, r: SeatView['river'][number]): string | undefined {
  if (!r.claimed || !r.claimedBy) return undefined
  const { seat, how } = r.claimedBy
  return `${seatName(from)}打的${tileName(r.tile)}，被${seatName(seat)}${TAKEN_VERB[how]}${how === 'ron' ? '了' : '走'}`
}

function River({ sv, view }: { sv: SeatView; view: PlayerView }) {
  const pos = REL_POS[rel(sv.seat)]
  const lastIdx = sv.river.length - 1
  // 正在等人回應的那張牌特別標示
  const isLast = (i: number) => view.pending?.kind === 'discard' && view.pending.from === sv.seat && i === lastIdx
  return (
    <div className={`river river-${pos}`} aria-label={`${seatName(sv.seat)}的牌河`}>
      {sv.river.map((r, i) => (
        <Tile key={i} tile={r.tile} size="xs" dim={r.claimed} highlight={isLast(i)} note={takenNote(sv.seat, r)} />
      ))}
    </div>
  )
}

function Center({ view, match, round, deal }: { view: PlayerView; match: MatchState; round: RoundState; deal: number | null }) {
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
        {deal !== null ? (
          <p className="dealing-text" aria-live="polite">
            發牌中…
          </p>
        ) : (
          <ol className="event-log" aria-live="polite">
            {log.map((line, i) => (
              <li key={round.log.length - log.length + i}>{line}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── 自己的手牌與操作 ───────────────────────────

function PlayerArea({
  view,
  match,
  rules,
  act,
  showHint,
  taiOn,
  deal,
  scoreSlot,
}: {
  view: PlayerView
  match: MatchState
  /** 這一局實際使用的規則（台數提示、打牌分析要和計分一致）。 */
  rules: RuleConfig
  act: (a: Action) => void
  showHint: boolean
  taiOn: boolean
  deal: number | null
  scoreSlot?: React.ReactNode
}) {
  const me = view.seats[HUMAN]
  /** 選了第幾張（手上有兩張一樣的牌時，只浮起點到的那一張）。 */
  const [selIdx, setSelIdx] = useState<number | null>(null)
  const dealing = deal !== null
  const myTurn = !dealing && view.phase === 'discard' && view.turn === HUMAN
  const canDiscard = myTurn && view.legal.some((a) => a.type === 'discard')

  // 手牌變了就取消選取
  const handKey = view.hand.join(',')
  useEffect(() => setSelIdx(null), [handKey, view.phase])

  // 摸進來的牌放在最右邊、隔開一點
  const drawn = myTurn ? view.lastDrawn : null
  const handTiles = useMemo(() => {
    const tiles = [...view.hand]
    if (drawn !== null) tiles.splice(tiles.indexOf(drawn), 1)
    return tiles
  }, [view.hand, drawn])
  const shown = drawn !== null ? [...handTiles, drawn] : handTiles
  const selected: TileId | null = selIdx !== null ? (shown[selIdx] ?? null) : null

  const clickTile = (idx: number) => {
    if (!canDiscard) return
    if (selIdx === idx) act({ type: 'discard', seat: HUMAN, tile: shown[idx] })
    else setSelIdx(idx)
  }

  // 台數提示：哪幾張牌、哪幾組副露、哪幾張花有台
  const hints = useMemo(() => (taiOn ? myTaiHints(view, rules) : []), [taiOn, view, rules])
  const status = useMemo(() => (taiOn ? myStatusNotes(view) : []), [taiOn, view])
  const tileTips: string[][] = shown.map(() => [])
  const meldTips: string[][] = me.melds.map(() => [])
  const flowerTips = new Map<TileId, string>()
  for (const h of hints) {
    const text = taiTip(h, h.whenWin ? '（胡牌時沒拆掉就算）' : '')
    const used = new Set<number>()
    for (const t of h.tiles) {
      const idx = shown.findIndex((x, i) => x === t && !used.has(i))
      if (idx >= 0) {
        used.add(idx)
        tileTips[idx].push(text)
      }
    }
    for (const i of h.meldIdx) meldTips[i].push(text)
    for (const f of h.flowers) flowerTips.set(f, text)
  }
  const tipAt = (i: number) => (tileTips[i].length > 0 ? tileTips[i].join('\n') : undefined)

  // 打牌分析（階段 5）：輪到你出牌、而且開著「最佳出牌提示」時才算
  const analysis = useMemo(
    () => (showHint && canDiscard ? analyzeTurn(view, rules, seatName) : null),
    [showHint, canDiscard, view, rules],
  )
  const pickTile = (t: TileId) => {
    const idx = shown.lastIndexOf(t)
    if (idx >= 0) setSelIdx(idx)
  }

  // 發牌中只顯示已經發到的牌，新發到的牌會飛進來
  const visible = dealtCount(handTiles.length, deal)
  const dealDelay = dealing ? 0 : undefined
  const showMelds = deal === null || deal >= DEAL_STEPS

  return (
    <section className="seat-area seat-bottom" aria-label="你的手牌">
      <SeatBadge sv={me} view={view} match={match} scoreSlot={scoreSlot} />
      {showMelds && (
        <Melds
          sv={me}
          size="sm"
          meldTips={meldTips.map((t) => (t.length > 0 ? t.join('\n') : undefined))}
          flowerTips={flowerTips}
        />
      )}
      <div className="hand-wrap">
        {/* 最佳出牌提示：浮在手牌上方，不會把手牌推動 */}
        {analysis && selected !== null && <DiscardHint analysis={analysis} tile={selected} onPick={pickTile} />}
        {!dealing && view.phase !== 'discard' && <ClaimChoices view={view} act={act} />}
        <div className="my-hand">
          {handTiles.slice(0, visible).map((t, i) => (
            <Tile
              key={`${t}-${i}`}
              tile={t}
              size="lg"
              selected={selIdx === i}
              onClick={canDiscard ? () => clickTile(i) : undefined}
              tip={dealing ? undefined : tipAt(i)}
              dealDelay={dealDelay}
            />
          ))}
          {drawn !== null && !dealing && (
            <span className="drawn-slot">
              <Tile
                tile={drawn}
                size="lg"
                selected={selIdx === shown.length - 1}
                onClick={canDiscard ? () => clickTile(shown.length - 1) : undefined}
                tip={tipAt(shown.length - 1)}
              />
            </span>
          )}
        </div>
      </div>
      {!dealing && (hints.length > 0 || status.length > 0) && <TaiLegend hints={hints} status={status} />}
      {dealing ? (
        <div className="action-bar">
          <span className="action-hint">發牌中…</span>
        </div>
      ) : (
        <ActionBar view={view} selected={selected} act={act} showHint={showHint} />
      )}
    </section>
  )
}

/** 手牌下方：目前有台的組合（觸控裝置也能點來看說明）。 */
function TaiLegend({ hints, status }: { hints: ReturnType<typeof myTaiHints>; status: TaiNote[] }) {
  return (
    <div className="tai-legend" aria-label="目前有台的組合">
      <span className="tai-legend-title">目前有台：</span>
      {hints.map((h, i) => (
        <span
          key={`h-${i}`}
          className="tai-chip framed"
          tabIndex={0}
          data-tip={taiTip(h, h.whenWin ? '（胡牌時沒拆掉就算）' : '')}
        >
          {h.name} +{h.tai}
        </span>
      ))}
      {status.map((n, i) => (
        <span key={`s-${i}`} className="tai-chip" tabIndex={0} data-tip={taiTip(n)}>
          {n.name} +{n.tai}
        </span>
      ))}
    </div>
  )
}

const CLAIM_LABEL: Partial<Record<Action['type'], string>> = {
  ron: '胡',
  pung: '碰',
  minkan: '槓',
  tsumo: '自摸',
  pass: '過',
}

function ActionBar({
  view,
  selected,
  act,
  showHint,
}: {
  view: PlayerView
  selected: TileId | null
  act: (a: Action) => void
  showHint: boolean
}) {
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
          <span className="action-hint">
            輪到你：點一張牌{showHint ? '看分析' : '選取'}
            ，再點一次（或按「打出」）就會打出去
          </span>
        )}
      </div>
    )
  }

  if (legal.length > 0 && pending) {
    // 選擇框浮在手牌上方（ClaimChoices），這裡只留一句提示
    return (
      <div className="action-bar">
        <span className="action-hint">
          在手牌上方選擇要不要
          {legal.some((a) => a.type === 'ron') ? '胡' : '吃、碰、槓'}
        </span>
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

/** 可以吃、碰、槓、胡時的選擇框：浮在手牌正上方，比較不會沒注意到。 */
function ClaimChoices({ view, act }: { view: PlayerView; act: (a: Action) => void }) {
  const legal = view.legal
  const pending = view.pending
  if (legal.length === 0 || !pending) return null
  const fromName = seatName(pending.from)
  return (
    <div className="claim-choices" role="group" aria-label="可以吃碰槓胡">
      <span className="claim-title">
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

// ─────────────────────────── 結算 ───────────────────────────

/** 右下角：這一將的有效遊玩時間（閒置或切到別的頁面時暫停）。 */
function PlayClock({ seconds, paused }: { seconds: number; paused: boolean }) {
  return (
    <div className={`play-clock${paused ? ' paused' : ''}`} aria-label="這一將的遊玩時間">
      遊玩時間 <strong>{formatDuration(seconds)}</strong>
      {paused && <span className="clock-paused">（暫停中：閒置超過一分鐘或切到別的頁面，動一下就繼續）</span>}
    </div>
  )
}

/**
 * 胡牌是第幾輪（巡）：每個人輪到一次算一輪。
 * 自摸：胡的人這是第幾次輪到；胡別人的牌：打出那張牌的人這是第幾次出牌。
 */
function winTurn(result: Extract<RoundResult, { type: 'win' }>, round: RoundState): number {
  if (result.discarder === null) return round.players[result.winner].discards + 1
  return Math.max(1, round.players[result.discarder].discards)
}

function ResultDialog({
  result,
  round,
  seconds,
  refilled,
  onNext,
  onLeave,
}: {
  result: RoundResult
  round: RoundState
  seconds: number | null
  refilled: boolean
  onNext: () => void
  /** 一局結束後可以直接離開（不扣入場費）。 */
  onLeave: () => void
}) {
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
        {round.doubled && (
          <p className="result-doubled">
            本局台數 ×{round.doubled.factor}：每台 {round.doubled.fromPerTai} → {round.rules.perTai}（所有玩家都適用）
          </p>
        )}
        {refilled && (
          <p className="result-doubled">
            籌碼輸光了，已經自動補充到 {formatChips(STARTING_BALANCE)}
            （個人中心會記錄補充次數）。
          </p>
        )}
        {seconds !== null && <p className="result-time">這一局花了 {formatDuration(seconds)}</p>}
        <p className="result-time">這一局已經結束，現在離開不用扣入場費；下一局出牌前也都可以離開。</p>
        <div className="dialog-actions">
          <button type="button" className="action" onClick={onLeave}>
            離開對局
          </button>
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
      <p className="result-turn">第 {winTurn(result, round)} 輪胡牌</p>
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
            {seatName(p.payer)} 付 <strong>{p.amount}</strong>
            <span className="pay-formula">
              ＝ 入場費 {round.rules.base} ＋ {p.tai} 台 × 台費 {round.rules.perTai}
              {round.doubled ? `（已 ×${round.doubled.factor}）` : ''}
            </span>
            {p.dealerTai > 0 && <span className="pay-note">（{p.tai} 台裡含莊家相關 {p.dealerTai} 台）</span>}
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
        <div className="header-tools">
          <DecorMenu />
        </div>
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
