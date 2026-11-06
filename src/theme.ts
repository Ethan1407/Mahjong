/**
 * 明亮／黑暗模式。
 *
 * 沒選過時跟隨系統設定（CSS 的 prefers-color-scheme）；按過切換按鈕後，就記住你的選擇（存在這台裝置的瀏覽器）。
 * 實際的顏色在 styles.css 與 table.css 的 :root 變數裡，這裡只負責在 <html> 加上 data-theme="light" 或 "dark"。
 * index.html 裡有一小段相同邏輯的程式，在畫面出現前就先套用，避免閃一下錯的顏色。
 */
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'mahjong.theme'
const listeners = new Set<() => void>()

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const systemQuery = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)')
  } catch {
    return null
  }
}

/** 現在實際顯示的模式（有選過就用選的，否則看系統）。 */
export function currentTheme(): Theme {
  return storedTheme() ?? (systemQuery()?.matches ? 'dark' : 'light')
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 無痕模式等情況無法儲存，這次有效就好
  }
  document.documentElement.dataset.theme = theme
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  // 跟隨系統時，系統切換深淺色也要跟著更新按鈕
  const mq = systemQuery()
  mq?.addEventListener('change', fn)
  return () => {
    listeners.delete(fn)
    mq?.removeEventListener('change', fn)
  }
}

/** 目前的模式，和切換到另一種模式的函式。 */
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme)
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')]
}
