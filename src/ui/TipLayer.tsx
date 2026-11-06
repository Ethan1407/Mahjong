/**
 * 全站共用的說明框：滑鼠移到（或鍵盤聚焦、手機點一下）有 data-tip 的元素時顯示。
 *
 * 位置優先放在元素上方、置中；會先量好大小，左右超出畫面就往內推，
 * 上方放不下才改放下方，兩邊都放不下時放在空間比較大的那一邊。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MARGIN = 8 // 和畫面邊緣至少留的距離
const GAP = 8 // 和元素之間的距離

interface TipState {
  text: string
  rect: DOMRect
}

const tipTarget = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-tip]') : null)

export function TipLayer() {
  const [tip, setTip] = useState<TipState | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const show = (el: HTMLElement | null) => {
      const text = el?.dataset.tip
      if (!el || !text) return
      currentRef.current = el
      setPos(null)
      setTip({ text, rect: el.getBoundingClientRect() })
    }
    const hide = () => {
      currentRef.current = null
      setTip(null)
    }
    const onOver = (e: MouseEvent) => {
      const el = tipTarget(e.target)
      if (el !== currentRef.current) (el ? show(el) : hide())
    }
    const onFocus = (e: FocusEvent) => show(tipTarget(e.target))
    const onBlur = (e: FocusEvent) => {
      if (tipTarget(e.relatedTarget) === null) hide()
    }
    // 觸控：點一下顯示，點別的地方關掉
    const onTouch = (e: TouchEvent) => {
      const el = tipTarget(e.target)
      if (el) show(el)
      else hide()
    }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    document.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
      document.removeEventListener('touchstart', onTouch)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  // 元素被移除（例如打出那張牌）時，說明框也要跟著消失
  useEffect(() => {
    if (!tip) return
    const id = setInterval(() => {
      if (currentRef.current && !currentRef.current.isConnected) {
        currentRef.current = null
        setTip(null)
      }
    }, 250)
    return () => clearInterval(id)
  }, [tip])

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!tip || !box) return
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const { width, height } = box.getBoundingClientRect()
    const r = tip.rect
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - width / 2, vw - width - MARGIN))
    const above = r.top - GAP - height
    const below = r.bottom + GAP
    let top: number
    if (above >= MARGIN) top = above
    else if (below + height <= vh - MARGIN) top = below
    else top = r.top > vh - r.bottom ? Math.max(MARGIN, above) : Math.min(below, vh - height - MARGIN)
    setPos({ left, top })
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={boxRef}
      className="tip-layer"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {tip.text}
    </div>
  )
}
