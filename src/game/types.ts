import type { Meld, PaymentResult, RuleConfig, ScoreResult, Tile, Wall } from '../engine'

/** 座位 0–3。下家 = (seat + 1) % 4，上家 = (seat + 3) % 4。 */
export type Seat = number

export type Action =
  | { type: 'discard'; seat: Seat; tile: Tile }
  | { type: 'tsumo'; seat: Seat }
  | { type: 'ankan'; seat: Seat; tile: Tile }
  | { type: 'kakan'; seat: Seat; tile: Tile }
  | { type: 'ron'; seat: Seat }
  | { type: 'pung'; seat: Seat }
  | { type: 'minkan'; seat: Seat }
  /** tiles：用自己手上的哪兩張來吃。 */
  | { type: 'chow'; seat: Seat; tiles: [Tile, Tile] }
  | { type: 'pass'; seat: Seat }

export type ActionType = Action['type']

export type GameEvent =
  | { type: 'deal'; dealer: Seat }
  | { type: 'flower'; seat: Seat; tile: Tile }
  | { type: 'draw'; seat: Seat; tile: Tile; replacement: boolean }
  | { type: 'discard'; seat: Seat; tile: Tile }
  /** claimed：從別人那裡拿來的那一張（吃的時候是上家打出的牌）。 */
  | { type: 'chow' | 'pung' | 'minkan'; seat: Seat; from: Seat; tiles: Tile[]; claimed: Tile }
  | { type: 'ankan' | 'kakan'; seat: Seat; tile: Tile }
  | { type: 'win'; seat: Seat; from: Seat | null; tile: Tile | null }
  | { type: 'exhaustive' }

export interface RiverTile {
  tile: Tile
  /** 被別人吃、碰、槓、胡走了。 */
  claimed: boolean
  /** 被誰拿走、怎麼拿走的（claimed 為 true 時才有）。 */
  claimedBy?: { seat: Seat; how: 'chow' | 'pung' | 'minkan' | 'ron' }
}

export interface PlayerState {
  /** 暗手（排序過，包含剛摸進來的牌）。 */
  hand: Tile[]
  melds: Meld[]
  flowers: Tile[]
  river: RiverTile[]
  /** 正常摸牌次數（不含補花、槓後補牌），用來判斷地胡、人胡。 */
  draws: number
  /** 打牌次數。 */
  discards: number
}

export type Phase = 'discard' | 'claim' | 'robKong' | 'ended'

export interface PendingClaim {
  tile: Tile
  from: Seat
  /** discard：等別人回應打出的牌；kakan：等別人決定要不要搶槓。 */
  kind: 'discard' | 'kakan'
  /** 每個座位可以做的動作（不含 pass）；空陣列代表不用回應。 */
  options: Action[][]
  /** 每個座位的回應；null 代表還沒回應。 */
  responses: (Action | null)[]
}

export type RoundResult =
  | {
      type: 'win'
      winner: Seat
      /** 放槍者；自摸、八仙過海為 null。 */
      discarder: Seat | null
      tile: Tile | null
      selfDrawn: boolean
      score: ScoreResult
      payments: PaymentResult
    }
  | { type: 'exhaustive' }

export interface RoundConfig {
  seed: number
  dealer: Seat
  /** 連莊次數，第一次當莊為 0。 */
  dealerStreak: number
  /** 圈風 0–3。 */
  roundWind: number
  rules?: Partial<RuleConfig>
  /** 留牌張數，預設 16。 */
  reserve?: number
  /** 測試用：指定牌牆順序（第一張是牌頭）。 */
  wallTiles?: Tile[]
}

export interface RoundState {
  config: RoundConfig
  rules: RuleConfig
  /** 這一局台數加倍了（每台的錢 ×factor，所有人都一樣）。 */
  doubled?: { by: Seat; fromPerTai: number; factor: number }
  wall: Wall
  players: PlayerState[]
  turn: Seat
  phase: Phase
  /** 輪到的人這回合是摸牌進來的（可以自摸、暗槓、加槓）；吃碰後為 false。 */
  drewThisTurn: boolean
  /** 剛摸進來的牌（顯示用；吃碰後為 null）。 */
  lastDrawn: Tile | null
  /** 這張牌是槓後補牌（槓上開花用）。 */
  afterKong: boolean
  /** 這局是否已經有人吃碰槓（天胡、地胡、人胡用）。 */
  anyCalls: boolean
  pending: PendingClaim | null
  result: RoundResult | null
  log: GameEvent[]
}
