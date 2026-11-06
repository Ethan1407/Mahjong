/**
 * 賭注與錢包：玩家選擇打多少錢（或免費入場），輸贏記在自己這台裝置上（localStorage）。
 *
 * 錢只是遊戲用的虛擬金額，不會上傳到任何地方；換裝置、換瀏覽器或清除網站資料就會重新開始。
 */

export type StakeId = 'free' | 's30' | 's50' | 's100' | 's300' | 'custom'

export interface Stake {
  id: StakeId
  name: string
  /** 底（每局基本金額）。 */
  base: number
  /** 每一台多少錢。 */
  perTai: number
  /** 免費入場：照樣算分，但不計入錢包。 */
  free: boolean
  description: string
}

export const STAKES: Stake[] = [
  { id: 'free', name: '免費入場', base: 100, perTai: 20, free: true, description: '照樣算輸贏分數，但不計入籌碼，也不能台數加倍，適合練習' },
  { id: 's30', name: '30 / 10', base: 30, perTai: 10, free: false, description: '底 30、每台 10' },
  { id: 's50', name: '50 / 20', base: 50, perTai: 20, free: false, description: '底 50、每台 20' },
  { id: 's100', name: '100 / 50', base: 100, perTai: 50, free: false, description: '底 100、每台 50' },
  { id: 's300', name: '300 / 100', base: 300, perTai: 100, free: false, description: '底 300、每台 100' },
  { id: 'custom', name: '自行設定', base: 100, perTai: 20, free: false, description: '自己決定底和每台多少錢' },
]

/** 自行設定的金額範圍。 */
export const CUSTOM_LIMITS = { min: 1, max: 100_000 }

export interface CustomStake {
  base: number
  perTai: number
}

export const DEFAULT_CUSTOM: CustomStake = { base: 100, perTai: 20 }

/** 把輸入的金額整理成合理的整數（範圍外就拉回範圍內）。 */
export function cleanAmount(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(CUSTOM_LIMITS.max, Math.max(CUSTOM_LIMITS.min, Math.round(n)))
}

/** 分場統計用的鍵：自行設定的每種金額分開算。 */
export const stakeKey = (st: Stake) => (st.id === 'custom' ? `custom:${st.base}/${st.perTai}` : st.id)
export const stakeLabel = (st: Stake) => (st.id === 'custom' ? `${st.name}（自行設定）` : st.name)

export function stakeOf(id: StakeId, custom: CustomStake = DEFAULT_CUSTOM): Stake {
  const st = STAKES.find((s) => s.id === id) ?? STAKES[0]
  if (st.id !== 'custom') return st
  const base = cleanAmount(custom.base, DEFAULT_CUSTOM.base)
  const perTai = cleanAmount(custom.perTai, DEFAULT_CUSTOM.perTai)
  return { ...st, name: `${base} / ${perTai}`, base, perTai, description: `自行設定：底 ${base}、每台 ${perTai}` }
}

export interface MatchRecord {
  /** 這一將的識別（亂數種子）。 */
  id: number
  stake: StakeId
  /** 賭注的顯示名稱（例如「50 / 20」；自行設定的金額也記在這裡）。 */
  stakeName?: string
  startedAt: number
  /** 這一將到目前為止的輸贏。 */
  delta: number
  /** 已經記到第幾局（避免重複記帳）。 */
  hands: number
}

export interface Wallet {
  /** 目前的籌碼（一開始有 STARTING_BALANCE，可以輸到負的）。 */
  balance: number
  /** 資料格式版本。 */
  version?: number
  /** 最近的對局，新的在前面。 */
  records: MatchRecord[]
  /** 籌碼變化（舊的在前面），畫圖表用。 */
  history?: ChipPoint[]
  /** 輸光後自動補充過幾次。 */
  refills?: number
}

export interface ChipPoint {
  /** 時間（毫秒）。 */
  t: number
  balance: number
  /** 這一點是輸光後自動補充。 */
  refill?: boolean
  /** 這一點是中途離開扣的入場費。 */
  fee?: boolean
}

const MAX_HISTORY = 500

const KEY = 'mahjong.wallet'
const MAX_RECORDS = 30
/** 每位玩家一開始的籌碼。 */
export const STARTING_BALANCE = 10_000
const VERSION = 2
const fresh = (): Wallet => ({
  balance: STARTING_BALANCE,
  version: VERSION,
  records: [],
  history: [{ t: Date.now(), balance: STARTING_BALANCE }],
  refills: 0,
})

export function loadWallet(): Wallet {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Wallet | null
    if (!w || typeof w.balance !== 'number' || !Array.isArray(w.records)) return fresh()
    // 舊版的錢包是從 0 開始記輸贏，補上起始的 10000
    if ((w.version ?? 1) < VERSION) {
      w.balance += STARTING_BALANCE
      w.version = VERSION
      saveWallet(w)
    }
    w.history ??= [{ t: w.records.at(-1)?.startedAt ?? Date.now(), balance: w.balance }]
    w.refills ??= 0
    return w
  } catch {
    return fresh()
  }
}

function saveWallet(w: Wallet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(w))
  } catch {
    // 無痕模式等情況下無法儲存，忽略即可
  }
}

export interface RecordResult extends Wallet {
  /** 這一局之後籌碼輸光，自動補充了。 */
  refilled: boolean
}

/**
 * 記一局的輸贏。handNumber 是這一將的第幾局（從 0 開始）；同一局只會記一次。
 * 籌碼輸光（≤ 0）時自動補充到 STARTING_BALANCE，並記下補充次數。
 */
export function recordHand(matchId: number, stake: Stake, startedAt: number, handNumber: number, delta: number): RecordResult {
  const w = loadWallet()
  const unchanged = { ...w, refilled: false }
  if (stake.free) return unchanged
  let rec = w.records.find((r) => r.id === matchId)
  if (rec && rec.hands > handNumber) return unchanged
  if (!rec) {
    rec = { id: matchId, stake: stake.id, stakeName: stake.name, startedAt, delta: 0, hands: 0 }
    w.records.unshift(rec)
  }
  rec.delta += delta
  rec.hands = handNumber + 1
  w.balance += delta
  const now = Date.now()
  const history = w.history ?? []
  history.push({ t: now, balance: w.balance })
  let refilled = false
  if (w.balance <= 0) {
    w.balance = STARTING_BALANCE
    w.refills = (w.refills ?? 0) + 1
    history.push({ t: now, balance: w.balance, refill: true })
    refilled = true
  }
  w.history = history.slice(-MAX_HISTORY)
  w.records = w.records.slice(0, MAX_RECORDS)
  saveWallet(w)
  return { ...w, refilled }
}

/** 有賭注的對局，出過牌之後中途離開要扣的入場費：一個「底」。 */
export const exitFeeOf = (stake: Stake) => (stake.free ? 0 : stake.base)

/** 扣入場費（中途離開）。輸光一樣會自動補充。 */
export function chargeExitFee(matchId: number, stake: Stake, amount: number): RecordResult {
  const w = loadWallet()
  if (stake.free || amount <= 0) return { ...w, refilled: false }
  const now = Date.now()
  w.balance -= amount
  const rec = w.records.find((r) => r.id === matchId)
  if (rec) rec.delta -= amount
  const history = w.history ?? []
  history.push({ t: now, balance: w.balance, fee: true })
  let refilled = false
  if (w.balance <= 0) {
    w.balance = STARTING_BALANCE
    w.refills = (w.refills ?? 0) + 1
    history.push({ t: now, balance: w.balance, refill: true })
    refilled = true
  }
  w.history = history.slice(-MAX_HISTORY)
  saveWallet(w)
  return { ...w, refilled }
}

export function resetWallet(): Wallet {
  const w = fresh()
  saveWallet(w)
  return w
}

/** 籌碼金額（不帶正負號）。 */
export const formatChips = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('zh-TW')}`

export const formatMoney = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('zh-TW')}`
