/**
 * 機器人模式。
 *
 * 重要原則：難度只影響機器人「怎麼打」，不影響「拿到什麼牌」。
 * 簡單、中等、困難的發牌與摸牌一律完全隨機，不會因為選簡單就讓玩家拿到好牌，
 * 機器人也看不到玩家的手牌和牌牆。唯一例外是「教學」，它照劇本餵牌。
 * 實際的出牌邏輯在 src/ai/brains.ts。
 */
export type Difficulty = 'tutorial' | 'easy' | 'normal' | 'hard'

export interface DifficultyInfo {
  id: Difficulty
  name: string
  description: string
}

export const DIFFICULTIES: readonly DifficultyInfo[] = [
  { id: 'tutorial', name: '教學', description: '一步步餵牌給你，教你補花、吃、碰、槓、胡。第一次玩從這裡開始。' },
  { id: 'easy', name: '簡單', description: '機器人只追求最快聽牌，不會防守，偶爾失誤。' },
  { id: 'normal', name: '中等', description: '機器人會計算進張、判斷該不該吃碰，危險時打安全牌。' },
  { id: 'hard', name: '困難', description: '機器人會讀牌、評估台數，看到有人聽牌時懂得棄胡防守。' },
]
