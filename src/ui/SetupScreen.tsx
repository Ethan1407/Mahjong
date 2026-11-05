import { useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../difficulty'
import { VARIANTS, type VariantId } from '../variants'

export interface GameSettings {
  variant: VariantId
  difficulty: Difficulty
}

const STORAGE_KEY = 'mahjong.settings'

/** 記住上次的選擇（只是方便用，讀不到就用預設值）。 */
export function loadSettings(): GameSettings {
  const fallback: GameSettings = { variant: 'taiwan16', difficulty: 'normal' }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<GameSettings> | null
    const variant = VARIANTS.find((v) => v.id === saved?.variant && v.available)?.id ?? fallback.variant
    const difficulty = DIFFICULTIES.find((d) => d.id === saved?.difficulty)?.id ?? fallback.difficulty
    return { variant, difficulty }
  } catch {
    return fallback
  }
}

function saveSettings(s: GameSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // 無痕模式等情況下無法儲存，忽略即可
  }
}

export function SetupScreen({ onStart }: { onStart: (s: GameSettings) => void }) {
  const [settings, setSettings] = useState<GameSettings>(loadSettings)

  const start = () => {
    saveSettings(settings)
    onStart(settings)
  }

  return (
    <main className="setup">
      <header className="setup-header">
        <h1>台灣麻將教練</h1>
        <p>和三位機器人對局，每打一張牌都告訴你它的機會成本與放槍風險。</p>
      </header>

      <section aria-labelledby="variant-title">
        <h2 id="variant-title">選擇玩法</h2>
        <div className="option-grid variants" role="radiogroup" aria-labelledby="variant-title">
          {VARIANTS.map((v) => {
            const selected = settings.variant === v.id
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!v.available}
                className={`option-card${selected ? ' selected' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, variant: v.id }))}
              >
                <span className="option-title">
                  {v.name}
                  <span className="option-subtitle">{v.subtitle}</span>
                  {!v.available && <span className="badge">即將推出</span>}
                </span>
                <span className="option-desc">{v.description}</span>
                <ul className="option-points">
                  {v.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="difficulty-title">
        <h2 id="difficulty-title">機器人模式</h2>
        <p className="section-note">難度只改變機器人的打法；發牌和摸牌一律隨機，不會因為選簡單就拿到比較好的牌。</p>
        <div className="option-grid difficulties" role="radiogroup" aria-labelledby="difficulty-title">
          {DIFFICULTIES.map((d) => {
            const selected = settings.difficulty === d.id
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`option-card${selected ? ' selected' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, difficulty: d.id }))}
              >
                <span className="option-title">{d.name}</span>
                <span className="option-desc">{d.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="setup-actions">
        <button type="button" className="primary" onClick={start}>
          開始對局
        </button>
      </div>
    </main>
  )
}
