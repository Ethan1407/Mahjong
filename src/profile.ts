/**
 * 個人中心的遊玩數據：存在這台裝置的瀏覽器（localStorage），關掉網頁再打開也還在。
 *
 * 遊玩時間只算「真的在打」的時間：在對局畫面、網頁在最前面、而且最近一分鐘內有動作。
 */

export type StatLevel = 'easy' | 'normal' | 'hard'

export interface LevelStats {
  hands: number
  wins: number
  dealIns: number
}

export interface PlayerStats {
  /** 有效遊玩秒數。 */
  playSeconds: number
  /** 開始過幾將、打完幾將。 */
  matchesStarted: number
  matchesFinished: number
  /** 打完的局數（含流局）。 */
  hands: number
  wins: number
  /** 自摸胡牌次數。 */
  tsumo: number
  /** 放槍次數。 */
  dealIns: number
  /** 被別人自摸的次數。 */
  tsumoAgainst: number
  /** 流局次數。 */
  draws: number
  /** 胡牌時的台數總和（算平均台數用）。 */
  totalTai: number
  /** 最大的一手。 */
  best: { tai: number; items: string[]; at: number } | null
  /** 最快在第幾輪胡牌。 */
  fastestTurn: number | null
  byLevel: Record<StatLevel, LevelStats>
  /** 各種入場（賭注）分開統計，鍵是 stakeKey。 */
  byStake: Record<string, StakeStats>
  firstPlayedAt: number | null
  lastPlayedAt: number | null
  /** 最後記到哪一將的第幾局（避免重複記）。 */
  lastHand: { match: number; hand: number } | null
}

export interface StakeStats {
  /** 顯示名稱，例如「50 / 20」「免費入場」。 */
  label: string
  /** 玩了幾場（將）。 */
  matches: number
  /** 打完幾局。 */
  hands: number
  wins: number
  /** 這種入場的籌碼輸贏（免費入場是分數）。 */
  net: number
}

export interface StakeRef {
  key: string
  label: string
}

const KEY = 'mahjong.stats'

const emptyLevel = (): LevelStats => ({ hands: 0, wins: 0, dealIns: 0 })

export function emptyStats(): PlayerStats {
  return {
    playSeconds: 0,
    matchesStarted: 0,
    matchesFinished: 0,
    hands: 0,
    wins: 0,
    tsumo: 0,
    dealIns: 0,
    tsumoAgainst: 0,
    draws: 0,
    totalTai: 0,
    best: null,
    fastestTurn: null,
    byLevel: { easy: emptyLevel(), normal: emptyLevel(), hard: emptyLevel() },
    byStake: {},
    firstPlayedAt: null,
    lastPlayedAt: null,
    lastHand: null,
  }
}

export function loadStats(): PlayerStats {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PlayerStats> | null
    if (!saved || typeof saved !== 'object') return emptyStats()
    const base = emptyStats()
    // 和預設值合併：以後新增欄位時，舊資料也讀得進來
    return { ...base, ...saved, byLevel: { ...base.byLevel, ...(saved.byLevel ?? {}) }, byStake: { ...(saved.byStake ?? {}) } }
  } catch {
    return emptyStats()
  }
}

function saveStats(s: PlayerStats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 無痕模式等情況下無法儲存，忽略即可
  }
}

function update(fn: (s: PlayerStats) => void): PlayerStats {
  const s = loadStats()
  fn(s)
  saveStats(s)
  return s
}

export function addPlaySeconds(seconds: number) {
  if (seconds <= 0) return
  update((s) => {
    s.playSeconds += seconds
    s.lastPlayedAt = Date.now()
  })
}

const stakeEntry = (s: PlayerStats, st: StakeRef): StakeStats =>
  (s.byStake[st.key] ??= { label: st.label, matches: 0, hands: 0, wins: 0, net: 0 })

export function recordMatchStart(stake?: StakeRef) {
  update((s) => {
    s.matchesStarted++
    if (stake) stakeEntry(s, stake).matches++
    s.firstPlayedAt ??= Date.now()
    s.lastPlayedAt = Date.now()
  })
}

export function recordMatchFinish() {
  update((s) => {
    s.matchesFinished++
  })
}

export interface HandOutcome {
  match: number
  hand: number
  level: StatLevel
  /** 'win' 我胡、'dealIn' 我放槍、'tsumoAgainst' 別人自摸、'otherWin' 別人互相放槍、'draw' 流局 */
  kind: 'win' | 'dealIn' | 'tsumoAgainst' | 'otherWin' | 'draw'
  tsumo?: boolean
  tai?: number
  items?: string[]
  turn?: number
  /** 這一將的入場（賭注），和你這一局的輸贏。 */
  stake?: StakeRef
  delta?: number
}

/** 記一局的結果；同一將的同一局只會記一次。 */
export function recordHandOutcome(o: HandOutcome) {
  update((s) => {
    if (s.lastHand && s.lastHand.match === o.match && s.lastHand.hand >= o.hand) return
    s.lastHand = { match: o.match, hand: o.hand }
    s.hands++
    const lv = (s.byLevel[o.level] ??= emptyLevel())
    lv.hands++
    if (o.stake) {
      const st = stakeEntry(s, o.stake)
      st.hands++
      if (o.kind === 'win') st.wins++
      st.net += o.delta ?? 0
    }
    if (o.kind === 'win') {
      s.wins++
      lv.wins++
      if (o.tsumo) s.tsumo++
      const tai = o.tai ?? 0
      s.totalTai += tai
      if (!s.best || tai > s.best.tai) s.best = { tai, items: o.items ?? [], at: Date.now() }
      if (o.turn !== undefined && (s.fastestTurn === null || o.turn < s.fastestTurn)) s.fastestTurn = o.turn
    } else if (o.kind === 'dealIn') {
      s.dealIns++
      lv.dealIns++
    } else if (o.kind === 'tsumoAgainst') {
      s.tsumoAgainst++
    } else if (o.kind === 'draw') {
      s.draws++
    }
    s.lastPlayedAt = Date.now()
  })
}

/** 中途離開扣的入場費，也算進這種入場的輸贏。 */
export function recordStakeFee(stake: StakeRef, amount: number) {
  update((s) => {
    stakeEntry(s, stake).net -= amount
  })
}

export function resetStats(): PlayerStats {
  const s = emptyStats()
  saveStats(s)
  return s
}

export const percent = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—')
