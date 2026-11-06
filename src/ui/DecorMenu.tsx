/**
 * 「裝飾」按鈕與下拉選單：外觀模式（明亮／黑暗）、牌桌顏色、吃碰槓特效。
 * 放在牌桌的上方橫幅（onFelt）和一般頁面的右上角。
 */
import { useEffect, useRef, useState } from 'react'
import { EFFECTS, TABLE_COLORS, equipEffect, setTableColor, useCosmetics, type EffectId } from '../cosmetics'
import { setTheme, useTheme } from '../theme'
import { GoldBurst, type BurstAction } from './GoldBurst'

/** 預覽時依序輪流播放的動作（鯨魚每種動作的表演不同）。 */
const PREVIEW_CYCLE: { action: BurstAction; text: string }[] = [
  { action: 'chow', text: '吃' },
  { action: 'pung', text: '碰' },
  { action: 'kong', text: '槓' },
  { action: 'win', text: '胡' },
]

export function DecorMenu({ onFelt = false, onShop }: { onFelt?: boolean; /** 有給就顯示「前往商店」。 */ onShop?: () => void }) {
  const [open, setOpen] = useState(false)
  const [theme] = useTheme()
  const cosmetics = useCosmetics()
  const [preview, setPreview] = useState<{ effect: EffectId; step: number; key: number } | null>(null)
  const [step, setStep] = useState(1)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const owned = EFFECTS.filter((e) => cosmetics.owned.includes(e.id))

  return (
    <div className="decor-menu" ref={ref}>
      <button
        type="button"
        className={`decor-button${onFelt ? ' on-felt' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.5 17 3 12 3z" />
          <circle cx="7.5" cy="11.5" r="1.2" />
          <circle cx="10.5" cy="7.5" r="1.2" />
          <circle cx="15" cy="7.5" r="1.2" />
        </svg>
        <span className="decor-button-label">裝飾</span>
      </button>

      {open && (
        <div className="decor-popover" role="dialog" aria-label="裝飾">
          <h2>裝飾</h2>

          <section className="decor-section" aria-labelledby="decor-theme">
            <h3 id="decor-theme">外觀模式</h3>
            <div className="decor-segment" role="radiogroup" aria-labelledby="decor-theme">
              {(['light', 'dark'] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'on' : undefined} onClick={() => setTheme(t)}>
                  {t === 'light' ? '☀ 明亮' : '☾ 黑暗'}
                </button>
              ))}
            </div>
          </section>

          <section className="decor-section" aria-labelledby="decor-table">
            <h3 id="decor-table">牌桌顏色</h3>
            <div className="decor-swatches" role="radiogroup" aria-labelledby="decor-table">
              {TABLE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={cosmetics.table === c.id}
                  className={`decor-swatch${cosmetics.table === c.id ? ' on' : ''}`}
                  onClick={() => setTableColor(c.id)}
                >
                  <span className="swatch-dot" style={{ background: c.swatch }} aria-hidden />
                  {c.name}
                </button>
              ))}
            </div>
          </section>

          <section className="decor-section" aria-labelledby="decor-effect">
            <h3 id="decor-effect">吃碰槓胡特效</h3>
            <p className="decor-note">你自己吃、碰、槓、胡、自摸時顯示。</p>
            <div className="decor-effects" role="radiogroup" aria-labelledby="decor-effect">
              {owned.map((e) => (
                <div key={e.id} className={`decor-effect${cosmetics.effect === e.id ? ' on' : ''}`}>
                  <button type="button" role="radio" aria-checked={cosmetics.effect === e.id} className="decor-effect-pick" onClick={() => equipEffect(e.id)}>
                    <span className={`effect-sample burst-${e.id}`} aria-hidden>
                      <span className="gold-burst-text">碰</span>
                    </span>
                    {e.name}
                  </button>
                  <button type="button" className="decor-preview" onClick={() => {
                      setPreview({ effect: e.id, step, key: Date.now() })
                      setStep((n) => (n + 1) % PREVIEW_CYCLE.length)
                    }} aria-label={`預覽${e.name}`}>
                    預覽
                  </button>
                </div>
              ))}
            </div>
            {onShop ? (
              <button type="button" className="decor-shop" onClick={onShop}>
                到商店買更多特效 →
              </button>
            ) : (
              owned.length < EFFECTS.length && <p className="decor-note">想要更多特效？回到主畫面的「商店」用籌碼購買。</p>
            )}
          </section>
        </div>
      )}
      {preview && (
        <GoldBurst
          key={preview.key}
          text={`${PREVIEW_CYCLE[preview.step].text}！`}
          sub="你"
          effect={preview.effect}
          action={PREVIEW_CYCLE[preview.step].action}
          onDone={() => setPreview(null)}
        />
      )}
    </div>
  )
}
