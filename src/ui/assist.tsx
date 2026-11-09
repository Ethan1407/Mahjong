/**
 * 輔助功能（可開關的學習輔助）：設定存在瀏覽器裡，開始畫面與牌桌共用。
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Tile } from './Tile'

/** 開關用的牌：紅中。 */
const RED_DRAGON = 31

export interface AssistSettings {
  /** 選牌時顯示「打出後幾向聽、進張幾張、最佳打法」。 */
  discardHint: boolean
  /** 顯示對手分析：聽牌可能、可能需要的牌、從動作推測。 */
  botThoughts: boolean
  /** 用金框標出有台的牌組，滑鼠移上去說明原因與台數。 */
  taiHints: boolean
}

export const DEFAULT_ASSIST: AssistSettings = { discardHint: true, botThoughts: false, taiHints: true }

const STORAGE_KEY = 'mahjong.assist'

function load(): AssistSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AssistSettings>
    return { ...DEFAULT_ASSIST, ...saved }
  } catch {
    return DEFAULT_ASSIST
  }
}

export function useAssist() {
  const [settings, setSettings] = useState<AssistSettings>(load)
  const update = useCallback((patch: Partial<AssistSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // 無痕模式等情況無法儲存，這次有效就好
      }
      return next
    })
  }, [])
  return [settings, update] as const
}

interface OptionInfo {
  key: keyof AssistSettings
  name: string
  description: string
  note?: string
}

export const ASSIST_OPTIONS: OptionInfo[] = [
  {
    key: 'discardHint',
    name: '最佳出牌提示',
    description: '手牌上標出建議打的牌；點選一張牌時，分析進攻效率、機會成本（慢幾步、會不會拆掉有台的組合）、放槍風險和誰可能需要這張，還能比較所有打法。',
  },
  {
    key: 'taiHints',
    name: '台數提示',
    description: '用金框標出會加台的牌：字牌刻子、正花、花槓、一條龍、三暗刻……滑鼠移上去（或點一下）會說明原因和幾台。',
  },
  {
    key: 'botThoughts',
    name: '機器人思路',
    description: '在畫面左側分析三位對手：誰可能已經聽牌、可能需要哪些牌、從他的動作看出什麼，並附上判斷依據。',
    note: '只根據他們打出的牌和吃碰推測，不會偷看手牌；想自己練習讀牌時可以關掉。',
  },
]

/** 一排開關（開始畫面與牌桌選單共用）。 */
export function AssistToggles({ settings, update }: { settings: AssistSettings; update: (p: Partial<AssistSettings>) => void }) {
  return (
    <div className="assist-list">
      {ASSIST_OPTIONS.map((o) => (
        <AssistSwitch key={o.key} option={o} checked={settings[o.key]} onChange={(v) => update({ [o.key]: v })} />
      ))}
    </div>
  )
}

function AssistSwitch({ option, checked, onChange }: { option: OptionInfo; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="assist-item">
      <div className="assist-text">
        <label htmlFor={id} className="assist-name">
          {option.name}
        </label>
        <p className="assist-desc">{option.description}</p>
        {option.note && <p className="assist-note">{option.note}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
        title={checked ? '點一下關掉' : '點一下打開'}
      >
        {/* 開關是一張紅中：打開時亮起、浮起來；關掉時變暗、變灰 */}
        <Tile tile={RED_DRAGON} size="md" title="" />
        <span className="switch-label">{checked ? '開' : '關'}</span>
      </button>
    </div>
  )
}

/** 牌桌右上角的「輔助功能」按鈕與下拉卡片。 */
export function AssistMenu({ settings, update }: { settings: AssistSettings; update: (p: Partial<AssistSettings>) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const enabled = ASSIST_OPTIONS.filter((o) => settings[o.key]).length

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

  return (
    <div className="assist-menu" ref={ref}>
      <button type="button" className="assist-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
        輔助功能
        <span className="assist-count">
          {enabled}/{ASSIST_OPTIONS.length}
        </span>
      </button>
      {open && (
        <div className="assist-popover" role="dialog" aria-label="輔助功能">
          <h2>輔助功能</h2>
          <p className="assist-intro">依照你的程度開關，設定會自動記住。</p>
          <AssistToggles settings={settings} update={update} />
        </div>
      )}
    </div>
  )
}
