/** 畫面共用的格式化小工具。 */

/** 「3 分 05 秒」這種寫法。 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h} 小時 ${String(m).padStart(2, '0')} 分 ${sec} 秒` : `${m} 分 ${sec} 秒`
}
