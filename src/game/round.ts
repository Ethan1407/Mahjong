/**
 * 單局狀態機（規則見 docs/RULES.md 第 4、5 節）。
 *
 * 用法：
 *   let s = startRound(config)
 *   legalActions(s, seat)      // 這個座位現在可以做什麼
 *   s = applyAction(s, action) // 回傳新的狀態，不修改舊的
 *
 * 補花是自動的；摸牌也是自動的（打牌後沒人要就換下一家摸）。
 * 玩家只需要做「選擇」：打哪張、要不要吃碰槓胡、要不要自摸。
 */
import {
  DEFAULT_RESERVE,
  DEFAULT_RULES,
  Wall,
  computePayments,
  dealInitial,
  isFlower,
  isWinningHand,
  scoreHand,
  sortTiles,
  toCounts,
  type Meld,
  type RuleConfig,
  type Tile,
  type WinContext,
} from '../engine'
import type { Action, PendingClaim, PlayerState, RoundConfig, RoundState, Seat } from './types'

export const nextSeat = (s: Seat) => (s + 1) % 4
export const prevSeat = (s: Seat) => (s + 3) % 4

/** 門風：莊家為東（0），依序南西北。 */
export const seatWindOf = (state: Pick<RoundState, 'config'>, seat: Seat) => (seat - state.config.dealer + 4) % 4

// ─────────────────────────── 建立與複製 ───────────────────────────

export function startRound(config: RoundConfig): RoundState {
  const rules: RuleConfig = { ...DEFAULT_RULES, ...config.rules }
  const reserve = config.reserve ?? DEFAULT_RESERVE
  const wall = config.wallTiles ? Wall.fromTiles(config.wallTiles, reserve) : Wall.create(config.seed, reserve)
  const deal = dealInitial(wall, config.dealer)

  const s: RoundState = {
    config,
    rules,
    wall,
    players: deal.hands.map((hand, i) => ({
      hand,
      melds: [],
      flowers: deal.flowers[i],
      river: [],
      draws: 0,
      discards: 0,
    })),
    turn: config.dealer,
    phase: 'discard',
    drewThisTurn: true, // 莊家 17 張，可以直接天胡或暗槓
    lastDrawn: null,
    afterKong: false,
    anyCalls: false,
    pending: null,
    result: null,
    log: [{ type: 'deal', dealer: config.dealer }],
  }
  for (let i = 0; i < 4; i++) {
    const seat = (config.dealer + i) % 4
    for (const f of s.players[seat].flowers) s.log.push({ type: 'flower', seat, tile: f })
  }
  checkFlowerWin(s)
  return s
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    hand: [...p.hand],
    melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
    flowers: [...p.flowers],
    river: p.river.map((r) => ({ ...r })),
    draws: p.draws,
    discards: p.discards,
  }
}

export function cloneRound(s: RoundState): RoundState {
  return {
    ...s,
    wall: s.wall.clone(),
    players: s.players.map(clonePlayer),
    pending: s.pending && {
      ...s.pending,
      options: s.pending.options.map((o) => [...o]),
      responses: [...s.pending.responses],
    },
    log: [...s.log],
  }
}

// ─────────────────────────── 台數加倍 ───────────────────────────

/** 前兩圈（四家都還沒打滿兩張牌）以內可以加倍。 */
export const DOUBLE_DEADLINE_DISCARDS = 8

/** 這一局還能不能把台數加倍（每局只能加倍一次）。 */
export function canDouble(s: RoundState): boolean {
  if (s.doubled || s.phase === 'ended') return false
  const discards = s.players.reduce((n, p) => n + p.discards, 0)
  return discards < DOUBLE_DEADLINE_DISCARDS
}

/** 可以選的倍數。 */
export const DOUBLE_FACTORS = [2, 3, 4, 5] as const

/** 把這一局每台的錢乘上 factor 倍（2–5 倍，所有玩家都適用）。 */
export function doubleStakes(state: RoundState, by: Seat, factor = 2): RoundState {
  if (!canDouble(state)) throw new Error('現在不能加倍')
  if (!Number.isInteger(factor) || factor < 2 || factor > 5) throw new Error(`倍數只能是 2 到 5：${factor}`)
  const s = cloneRound(state)
  s.doubled = { by, fromPerTai: s.rules.perTai, factor }
  s.rules = { ...s.rules, perTai: s.rules.perTai * factor }
  return s
}

// ─────────────────────────── 合法動作 ───────────────────────────

const winOpts = (s: RoundState) => ({ allowLiguLigu: s.rules.allowLiguLigu })

function canWinWith(s: RoundState, seat: Seat, extra: Tile | null): boolean {
  const p = s.players[seat]
  const counts = toCounts(p.hand)
  if (extra !== null) counts[extra]++
  return isWinningHand(counts, p.melds.length, winOpts(s))
}

/** 別人打出 tile 時，seat 可以做的動作（不含 pass）。 */
function claimOptions(s: RoundState, seat: Seat, tile: Tile, from: Seat): Action[] {
  const p = s.players[seat]
  const counts = toCounts(p.hand)
  const out: Action[] = []
  if (canWinWith(s, seat, tile)) out.push({ type: 'ron', seat })
  // 最後一張打出的牌只能胡（河底撈魚），不能再吃碰槓
  if (s.wall.isExhausted) return out
  if (counts[tile] >= 2) out.push({ type: 'pung', seat })
  if (counts[tile] === 3) out.push({ type: 'minkan', seat })
  if (seat === nextSeat(from) && tile < 27) {
    const r = tile % 9
    const pairs: [number, number][] = [
      [-2, -1],
      [-1, 1],
      [1, 2],
    ]
    for (const [a, b] of pairs) {
      if (r + a < 0 || r + b > 8) continue
      if (counts[tile + a] > 0 && counts[tile + b] > 0) out.push({ type: 'chow', seat, tiles: [tile + a, tile + b] })
    }
  }
  return out
}

export function legalActions(s: RoundState, seat: Seat): Action[] {
  if (s.phase === 'ended') return []

  if (s.phase === 'discard') {
    if (seat !== s.turn) return []
    const p = s.players[seat]
    const out: Action[] = []
    if (s.drewThisTurn) {
      if (canWinWith(s, seat, null)) out.push({ type: 'tsumo', seat })
      if (s.wall.drawable > 0) {
        const counts = toCounts(p.hand)
        counts.forEach((n, t) => {
          if (n === 4) out.push({ type: 'ankan', seat, tile: t })
        })
        for (const m of p.melds) {
          if (m.type === 'pung' && counts[m.tiles[0]] > 0) out.push({ type: 'kakan', seat, tile: m.tiles[0] })
        }
      }
    }
    for (const t of new Set(p.hand)) out.push({ type: 'discard', seat, tile: t })
    return out
  }

  // claim / robKong：依優先順序輪流問（能胡的先決定，再來碰槓，最後才是吃）
  const pending = s.pending!
  if (!seatsOnDeck(pending).includes(seat)) return []
  return [...pending.options[seat], { type: 'pass', seat }]
}

/** 動作的優先順序：胡 0、碰／槓 1、吃 2（越小越優先）。 */
const claimTier = (a: Action) => (a.type === 'ron' ? 0 : a.type === 'chow' ? 2 : 1)

/**
 * 比較兩個宣告誰優先：先比動作（胡 > 碰槓 > 吃），同一種動作時打牌者之後最近的一家優先（截胡）。
 * 回傳越小越優先。
 */
function claimKey(pending: PendingClaim, seat: Seat, tier: number): number {
  return tier * 4 + ((seat - pending.from + 4) % 4)
}

/** 還沒決定、而且他的宣告還有可能勝過目前最好宣告的座位。 */
function liveSeats(pending: PendingClaim): Seat[] {
  let best = Infinity
  pending.responses.forEach((r, seat) => {
    if (r && r.type !== 'pass') best = Math.min(best, claimKey(pending, seat, claimTier(r)))
  })
  return [0, 1, 2, 3].filter((seat) => {
    if (pending.responses[seat] !== null || pending.options[seat].length === 0) return false
    const tier = Math.min(...pending.options[seat].map(claimTier))
    return claimKey(pending, seat, tier) < best
  })
}

/** 現在輪到誰決定：還有機會的座位中，最高優先等級（胡 > 碰槓 > 吃）的那幾家同時決定。 */
function seatsOnDeck(pending: PendingClaim): Seat[] {
  const live = liveSeats(pending)
  if (live.length === 0) return []
  const tierOf = (seat: Seat) => Math.min(...pending.options[seat].map(claimTier))
  const top = Math.min(...live.map(tierOf))
  return live.filter((seat) => tierOf(seat) === top)
}

export function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type || a.seat !== b.seat) return false
  if ('tile' in a && 'tile' in b) return a.tile === b.tile
  if (a.type === 'chow' && b.type === 'chow') return a.tiles[0] === b.tiles[0] && a.tiles[1] === b.tiles[1]
  return true
}

/** 現在需要哪些座位做決定。 */
export function seatsToAct(s: RoundState): Seat[] {
  if (s.phase === 'ended') return []
  if (s.phase === 'discard') return [s.turn]
  return [0, 1, 2, 3].filter((seat) => legalActions(s, seat).length > 0)
}

// ─────────────────────────── 套用動作 ───────────────────────────

export function applyAction(state: RoundState, action: Action): RoundState {
  if (!isLegal(state, action)) {
    throw new Error(`不合法的動作：${JSON.stringify(action)}（階段 ${state.phase}，輪到 ${state.turn}）`)
  }
  const s = cloneRound(state)
  const p = s.players[action.seat]

  switch (action.type) {
    case 'discard': {
      removeTiles(p.hand, [action.tile])
      p.river.push({ tile: action.tile, claimed: false })
      p.discards++
      s.log.push({ type: 'discard', seat: action.seat, tile: action.tile })
      s.lastDrawn = null
      s.afterKong = false
      s.drewThisTurn = false
      openClaims(s, action.seat, action.tile, 'discard')
      break
    }
    case 'tsumo':
      winBySelfDraw(s, action.seat)
      break
    case 'ankan': {
      removeTiles(p.hand, [action.tile, action.tile, action.tile, action.tile])
      p.melds.push({ type: 'ankan', tiles: [action.tile, action.tile, action.tile, action.tile], riverIndex: p.river.length })
      s.anyCalls = true
      s.log.push({ type: 'ankan', seat: action.seat, tile: action.tile })
      drawFor(s, action.seat, true)
      break
    }
    case 'kakan':
      openClaims(s, action.seat, action.tile, 'kakan')
      break
    default: {
      // 回應別人的牌（ron / pung / minkan / chow / pass）
      s.pending!.responses[action.seat] = action
      // 剩下的人不可能勝過目前的宣告時，就不用再問了
      if (liveSeats(s.pending!).length === 0) resolveClaims(s)
    }
  }
  return s
}

/** 這個動作在目前的狀態下合不合法。 */
export const isLegal = (s: RoundState, action: Action) => legalActions(s, action.seat).some((a) => sameAction(a, action))

/**
 * 給畫面用：動作合法才套用，不合法就原封不動回傳。
 * 玩家的點擊可能根據「上一個畫面」送出（例如快速連點兩下打牌，第二下時已經輪到別人），
 * 這種過期的動作直接忽略，不要讓整個畫面當掉。
 */
export function applyIfLegal(state: RoundState, action: Action): RoundState {
  return isLegal(state, action) ? applyAction(state, action) : state
}

// ─────────────────────────── 內部流程 ───────────────────────────

function removeTiles(hand: Tile[], tiles: Tile[]) {
  for (const t of tiles) {
    const i = hand.indexOf(t)
    if (i < 0) throw new Error(`手上沒有這張牌：${t}`)
    hand.splice(i, 1)
  }
}

/** 摸牌（含自動補花）。fromBack = 槓後補牌。 */
function drawFor(s: RoundState, seat: Seat, fromBack: boolean) {
  const p = s.players[seat]
  if (!fromBack) p.draws++
  s.afterKong = fromBack
  let replacement = fromBack
  for (;;) {
    const t = replacement ? s.wall.drawBack() : s.wall.drawFront()
    if (t === null) return endExhaustive(s)
    if (isFlower(t)) {
      p.flowers.push(t)
      s.log.push({ type: 'flower', seat, tile: t })
      if (checkFlowerWin(s)) return
      replacement = true
      continue
    }
    p.hand.push(t)
    p.hand.sort((a, b) => a - b)
    s.log.push({ type: 'draw', seat, tile: t, replacement })
    s.turn = seat
    s.phase = 'discard'
    s.drewThisTurn = true
    s.lastDrawn = t
    s.pending = null
    return
  }
}

/** 八仙過海、七搶一。回傳是否結束這局。 */
function checkFlowerWin(s: RoundState): boolean {
  const counts = s.players.map((p) => p.flowers.length)
  const eight = counts.indexOf(8)
  if (eight >= 0) {
    finishWin(s, eight, null, null, { special: 'eightFlowers' }, true)
    return true
  }
  const seven = counts.indexOf(7)
  const one = counts.indexOf(1)
  if (seven >= 0 && one >= 0) {
    finishWin(s, seven, one, null, { special: 'sevenRobOne' }, false)
    return true
  }
  return false
}

function openClaims(s: RoundState, from: Seat, tile: Tile, kind: PendingClaim['kind']) {
  const options = [0, 1, 2, 3].map((seat) => {
    if (seat === from) return []
    if (kind === 'kakan') return canWinWith(s, seat, tile) ? [{ type: 'ron', seat } as Action] : []
    return claimOptions(s, seat, tile, from)
  })
  const pending: PendingClaim = { tile, from, kind, options, responses: [null, null, null, null] }
  if (options.every((o) => o.length === 0)) {
    s.pending = null
    if (kind === 'kakan') completeKakan(s, from, tile)
    else advanceAfterDiscard(s, from)
    return
  }
  s.pending = pending
  s.phase = kind === 'kakan' ? 'robKong' : 'claim'
}

function advanceAfterDiscard(s: RoundState, from: Seat) {
  s.pending = null
  if (s.wall.isExhausted) return endExhaustive(s)
  drawFor(s, nextSeat(from), false)
}

function completeKakan(s: RoundState, seat: Seat, tile: Tile) {
  const p = s.players[seat]
  removeTiles(p.hand, [tile])
  const meld = p.melds.find((m) => m.type === 'pung' && m.tiles[0] === tile)!
  meld.type = 'kakan'
  meld.tiles.push(tile)
  s.anyCalls = true
  s.log.push({ type: 'kakan', seat, tile })
  drawFor(s, seat, true)
}

function resolveClaims(s: RoundState) {
  const pending = s.pending!
  const order = [1, 2, 3].map((d) => (pending.from + d) % 4)
  const responseOf = (seat: Seat) => pending.responses[seat]

  // 1. 胡（截胡：打牌者之後最近的一家）
  const ronSeat = order.find((seat) => responseOf(seat)?.type === 'ron')
  if (ronSeat !== undefined) {
    const loser = s.players[pending.from]
    if (pending.kind === 'kakan') {
      removeTiles(loser.hand, [pending.tile])
    } else {
      const r = loser.river[loser.river.length - 1]
      r.claimed = true
      r.claimedBy = { seat: ronSeat, how: 'ron' }
    }
    s.players[ronSeat].hand.push(pending.tile)
    s.players[ronSeat].hand.sort((a, b) => a - b)
    finishWin(s, ronSeat, pending.from, pending.tile, { robbingKong: pending.kind === 'kakan' }, false)
    return
  }

  if (pending.kind === 'kakan') {
    s.pending = null
    return completeKakan(s, pending.from, pending.tile)
  }

  // 2. 碰／槓 優先於 3. 吃
  const claim =
    order.map(responseOf).find((r) => r?.type === 'pung' || r?.type === 'minkan') ??
    order.map(responseOf).find((r) => r?.type === 'chow')
  if (!claim) return advanceAfterDiscard(s, pending.from)

  const seat = claim.seat
  const p = s.players[seat]
  const tile = pending.tile
  const from = s.players[pending.from]
  const taken = from.river[from.river.length - 1]
  taken.claimed = true
  taken.claimedBy = { seat, how: claim.type as 'chow' | 'pung' | 'minkan' }
  s.anyCalls = true
  s.pending = null
  s.turn = seat
  s.phase = 'discard'
  s.drewThisTurn = false
  s.lastDrawn = null
  s.afterKong = false

  let meld: Meld
  if (claim.type === 'chow') {
    removeTiles(p.hand, claim.tiles)
    meld = { type: 'chow', tiles: sortTiles([...claim.tiles, tile]), fromSeat: pending.from }
  } else if (claim.type === 'pung') {
    removeTiles(p.hand, [tile, tile])
    meld = { type: 'pung', tiles: [tile, tile, tile], fromSeat: pending.from }
  } else {
    removeTiles(p.hand, [tile, tile, tile])
    meld = { type: 'minkan', tiles: [tile, tile, tile, tile], fromSeat: pending.from }
  }
  meld.riverIndex = p.river.length
  p.melds.push(meld)
  s.log.push({ type: claim.type as 'chow' | 'pung' | 'minkan', seat, from: pending.from, tiles: meld.tiles, claimed: tile })
  if (claim.type === 'minkan') drawFor(s, seat, true)
}

function winBySelfDraw(s: RoundState, seat: Seat) {
  const p = s.players[seat]
  const totalDiscards = s.players.reduce((a, q) => a + q.discards, 0)
  const flags: Partial<WinContext> = {
    afterKong: s.afterKong,
    lastTile: s.wall.isExhausted,
    heavenly: seat === s.config.dealer && totalDiscards === 0 && !s.anyCalls,
    earthly: seat !== s.config.dealer && p.draws === 1 && p.discards === 0 && !s.anyCalls,
  }
  finishWin(s, seat, null, s.lastDrawn, flags, true)
}

function finishWin(
  s: RoundState,
  winner: Seat,
  discarder: Seat | null,
  tile: Tile | null,
  flags: Partial<WinContext>,
  selfDrawn: boolean,
) {
  const p = s.players[winner]
  const base = {
    concealed: p.hand,
    melds: p.melds,
    selfDrawn,
    flowers: p.flowers,
    seatWind: seatWindOf(s, winner),
    roundWind: s.config.roundWind,
    ...flags,
  }
  if (!selfDrawn && !flags.special) {
    // 人胡：還沒摸過牌（第一巡內）就胡別人的牌，且無人吃碰槓
    base.humanly = winner !== s.config.dealer && p.draws === 0 && !s.anyCalls
    base.lastTile = s.wall.isExhausted
  }

  let score
  if (tile !== null || flags.special) {
    score = scoreHand({ ...base, winningTile: tile ?? 0 }, s.rules)
  } else {
    // 天胡沒有「最後一張」，取台數最高的解讀
    score = [...new Set(p.hand)]
      .map((t) => scoreHand({ ...base, winningTile: t }, s.rules))
      .reduce((a, b) => (b.tai > a.tai ? b : a))
  }

  const payments = computePayments(
    {
      winner,
      discarder,
      dealer: s.config.dealer,
      dealerStreak: s.config.dealerStreak,
      handTai: score.tai,
    },
    s.rules,
  )
  s.result = { type: 'win', winner, discarder, tile, selfDrawn, score, payments }
  s.phase = 'ended'
  s.pending = null
  s.log.push({ type: 'win', seat: winner, from: discarder, tile })
}

function endExhaustive(s: RoundState) {
  s.result = { type: 'exhaustive' }
  s.phase = 'ended'
  s.pending = null
  s.log.push({ type: 'exhaustive' })
}
