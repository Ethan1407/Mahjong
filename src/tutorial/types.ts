/**
 * 教學劇本的資料格式（各玩法共用）。
 * 牌用簡寫表示（見 engine/tiles.ts 的 parseTiles），例如 "123m 45p 11z"。
 */

/** 相對於玩家的位置。上家打的牌才能吃。 */
export type Seat = 'upper' | 'opposite' | 'lower'

export const SEAT_NAMES: Record<Seat, string> = { upper: '上家', opposite: '對家', lower: '下家' }

export type TutorialAction =
  | 'discard' // 打出指定的牌
  | 'chow' // 吃
  | 'pung' // 碰
  | 'kong' // 明槓（別人打出第 4 張）
  | 'ankan' // 暗槓（自己摸到第 4 張）
  | 'kakan' // 加槓（已經碰出，又摸到第 4 張）
  | 'ron' // 胡別人打的牌
  | 'tsumo' // 自摸
  | 'flower' // 補花
  | 'pass' // 不要（過）

export const ACTION_NAMES: Record<TutorialAction, string> = {
  discard: '打牌',
  chow: '吃',
  pung: '碰',
  kong: '槓',
  ankan: '暗槓',
  kakan: '加槓',
  ron: '胡',
  tsumo: '自摸',
  flower: '補花',
  pass: '過',
}

export type TutorialEvent =
  /** 別人打出一張牌。lastTile：這是整局最後一張打出的牌。 */
  | { type: 'discard'; from: Seat; tile: string; lastTile?: boolean }
  /** 自己摸牌。replacement：槓後從牌尾補的牌；lastTile：牌牆最後一張可摸的牌。 */
  | { type: 'draw'; tile: string; replacement?: boolean; lastTile?: boolean }
  /** 別人要加槓這張牌（可以搶槓）。 */
  | { type: 'kakan'; from: Seat; tile: string }

interface StepBase {
  title: string
  /** 開始這一步前的說明。 */
  explain: string
}

/** 只有說明、看牌，按「下一步」繼續。 */
export interface InfoStep extends StepBase {
  kind: 'info'
  /** 展示用的牌（可以用 | 分成幾組顯示）。 */
  tiles?: string
}

/** 餵一張牌，玩家要做出指定動作。 */
export interface ActionStep extends StepBase {
  kind: 'action'
  /** 玩家暗手（等別人打牌時 16 張；有副露則少 3 張／組）。 */
  hand: string
  /** 已經吃碰槓出去的牌組。 */
  melds?: string[]
  event: TutorialEvent
  expect: TutorialAction
  /** expect 為 discard 時，要打出哪張牌。 */
  discard?: string
  /** expect 為 chow 時，要用手上哪兩張牌。 */
  chowWith?: string
  /** 這一步示範的台型名稱，測試會確認胡牌時真的有這個台。 */
  teachesTai?: string
  /** 做對時的說明。 */
  success: string
  /** 做錯時的提示。 */
  hint: string
}

export type TutorialStep = InfoStep | ActionStep

export type LessonLevel = 'intro' | 'basic' | 'advanced'

export const LEVEL_NAMES: Record<LessonLevel, string> = {
  intro: '入門',
  basic: '基本玩法',
  advanced: '進階術語',
}

export interface Lesson {
  id: string
  level: LessonLevel
  title: string
  summary: string
  steps: TutorialStep[]
}
