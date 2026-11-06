import { useEffect, useRef, useState } from 'react'
import { addPlaySeconds } from '../profile'

/** 超過這麼久沒有任何動作就暫停計時。 */
export const IDLE_LIMIT_MS = 60_000
const FLUSH_EVERY = 5 // 每累積幾秒寫入一次

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/**
 * 有效遊玩時間：只有 active（在對局中）、網頁在最前面、而且最近一分鐘內有動作時才計時。
 * 回傳這一將的有效秒數，並把時間累加到個人中心的總遊玩時間（存在本機）。
 */
export function usePlayTime(active: boolean, resetKey: unknown): { seconds: number; paused: boolean } {
  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const lastActivity = useRef(Date.now())
  const pending = useRef(0)

  useEffect(() => setSeconds(0), [resetKey])

  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now()
    }
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, touch, { passive: true })
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, touch)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    lastActivity.current = Date.now()
    const flush = () => {
      addPlaySeconds(pending.current)
      pending.current = 0
    }
    const id = setInterval(() => {
      const visible = document.visibilityState === 'visible' && document.hasFocus()
      const idle = Date.now() - lastActivity.current > IDLE_LIMIT_MS
      const counting = visible && !idle
      setPaused(!counting)
      if (!counting) return
      setSeconds((s) => s + 1)
      pending.current++
      if (pending.current >= FLUSH_EVERY) flush()
    }, 1000)
    // 切到別的分頁或關掉網頁時，馬上把累積的時間存起來
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [active])

  return { seconds, paused }
}
