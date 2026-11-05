/**
 * 各玩法的教學課程是分開的：台麻、日麻、三麻規則不同，各自一套。
 * 新增玩法的教學時，建立一個新檔案（例如 riichi.ts）並登記在這裡。
 */
import type { VariantId } from '../variants'
import { TAIWAN16_LESSONS } from './taiwan16'
import type { Lesson } from './types'

export * from './types'

export const TUTORIALS: Record<VariantId, readonly Lesson[]> = {
  taiwan16: TAIWAN16_LESSONS,
  riichi: [], // 日本麻將教學：之後加入
  sanma: [], // 三人麻將教學：之後加入
}

export const lessonsFor = (variant: VariantId) => TUTORIALS[variant]
