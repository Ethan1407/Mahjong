import { useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../difficulty'
import { VARIANTS, type VariantId } from '../variants'
import {
  CUSTOM_LIMITS,
  DEFAULT_CUSTOM,
  STAKES,
  STARTING_BALANCE,
  cleanAmount,
  formatChips,
  formatMoney,
  loadWallet,
  resetWallet,
  type CustomStake,
  type StakeId,
} from '../wallet'
import { AssistToggles, useAssist } from './assist'

export interface GameSettings {
  variant: VariantId
  difficulty: Difficulty
  stake: StakeId
  /** 自行設定的金額（選「自行設定」時才用）。 */
  custom: CustomStake
}

const STORAGE_KEY = 'mahjong.settings'

/** 記住上次的選擇（只是方便用，讀不到就用預設值）。 */
export function loadSettings(): GameSettings {
  const fallback: GameSettings = { variant: 'taiwan16', difficulty: 'normal', stake: 'free', custom: DEFAULT_CUSTOM }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<GameSettings> | null
    const variant = VARIANTS.find((v) => v.id === saved?.variant && v.available)?.id ?? fallback.variant
    const difficulty = DIFFICULTIES.find((d) => d.id === saved?.difficulty)?.id ?? fallback.difficulty
    const stake = STAKES.find((s) => s.id === saved?.stake)?.id ?? fallback.stake
    const custom = {
      base: cleanAmount(Number(saved?.custom?.base), DEFAULT_CUSTOM.base),
      perTai: cleanAmount(Number(saved?.custom?.perTai), DEFAULT_CUSTOM.perTai),
    }
    return { variant, difficulty, stake, custom }
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

export function SetupScreen({ onStart, onProfile }: { onStart: (s: GameSettings) => void; onProfile: () => void }) {
  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const [assist, updateAssist] = useAssist()
  const [wallet, setWallet] = useState(loadWallet)
  /** 真正的輸贏：扣掉起始籌碼和自動補充的籌碼。 */
  const net = wallet.balance - STARTING_BALANCE * (1 + (wallet.refills ?? 0))

  const start = () => {
    const clean = {
      ...settings,
      custom: {
        base: cleanAmount(settings.custom.base, DEFAULT_CUSTOM.base),
        perTai: cleanAmount(settings.custom.perTai, DEFAULT_CUSTOM.perTai),
      },
    }
    saveSettings(clean)
    onStart(clean)
  }

  return (
    <main className="setup">
      <header className="setup-header">
        <button type="button" className="profile-link" onClick={onProfile}>
          個人中心
        </button>
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

      {settings.difficulty !== 'tutorial' && (
        <section aria-labelledby="stake-title">
          <h2 id="stake-title">打多少錢</h2>
          <div className="wallet-box">
            <div>
              <span className="wallet-label">我的籌碼</span>
              <strong className={`wallet-balance${wallet.balance < 0 ? ' neg' : ''}`}>{formatChips(wallet.balance)}</strong>
              <span className={`wallet-diff${net < 0 ? ' neg' : net > 0 ? ' pos' : ''}`}>
                （累計 {formatMoney(net)}
                {(wallet.refills ?? 0) > 0 && `，自動補充過 ${wallet.refills} 次`}）
              </span>
            </div>
            {wallet.records.length > 0 && (
              <details className="wallet-records">
                <summary>最近 {Math.min(wallet.records.length, 10)} 將的紀錄</summary>
                <ul>
                  {wallet.records.slice(0, 10).map((r) => (
                    <li key={r.id}>
                      <span>{new Date(r.startedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{r.stakeName ?? STAKES.find((x) => x.id === r.stake)?.name}</span>
                      <span>{r.hands} 局</span>
                      <strong className={r.delta < 0 ? 'neg' : r.delta > 0 ? 'pos' : ''}>{formatMoney(r.delta)}</strong>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="wallet-reset"
                  onClick={() => {
                    if (window.confirm(`確定要把籌碼重設為 ${formatChips(STARTING_BALANCE)}、清除所有紀錄嗎？`)) setWallet(resetWallet())
                  }}
                >
                  重設籌碼
                </button>
              </details>
            )}
          </div>
          <p className="section-note">
            每位玩家一開始有 {formatChips(STARTING_BALANCE)} 籌碼，輸光會自動補充 {formatChips(STARTING_BALANCE)}。籌碼是遊戲用的虛擬金額，只記在這台裝置的瀏覽器裡，不會上傳；每打完一局就會記帳，中途離開也算。
          </p>
          <div className="option-grid stakes" role="radiogroup" aria-labelledby="stake-title">
            {STAKES.map((st) => {
              const selected = settings.stake === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`option-card${selected ? ' selected' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, stake: st.id }))}
                >
                  <span className="option-title">{st.name}</span>
                  <span className="option-desc">{st.description}</span>
                </button>
              )
            })}
          </div>
          {settings.stake === 'custom' && (
            <div className="custom-stake">
              <label>
                底
                <input
                  type="number"
                  inputMode="numeric"
                  onFocus={(e) => e.target.select()}
                  min={CUSTOM_LIMITS.min}
                  max={CUSTOM_LIMITS.max}
                  value={settings.custom.base}
                  onChange={(e) => setSettings((s) => ({ ...s, custom: { ...s.custom, base: Number(e.target.value) } }))}
                  onBlur={() => setSettings((s) => ({ ...s, custom: { ...s.custom, base: cleanAmount(s.custom.base, DEFAULT_CUSTOM.base) } }))}
                />
              </label>
              <label>
                每台
                <input
                  type="number"
                  inputMode="numeric"
                  onFocus={(e) => e.target.select()}
                  min={CUSTOM_LIMITS.min}
                  max={CUSTOM_LIMITS.max}
                  value={settings.custom.perTai}
                  onChange={(e) => setSettings((s) => ({ ...s, custom: { ...s.custom, perTai: Number(e.target.value) } }))}
                  onBlur={() =>
                    setSettings((s) => ({ ...s, custom: { ...s.custom, perTai: cleanAmount(s.custom.perTai, DEFAULT_CUSTOM.perTai) } }))
                  }
                />
              </label>
              <span className="section-note">
                範圍 {CUSTOM_LIMITS.min}–{formatChips(CUSTOM_LIMITS.max)}。例如底 {cleanAmount(settings.custom.base, 100)}、每台{' '}
                {cleanAmount(settings.custom.perTai, 20)}：胡 3 台時放槍的人付 {cleanAmount(settings.custom.base, 100) + 3 * cleanAmount(settings.custom.perTai, 20)}。
              </span>
            </div>
          )}
        </section>
      )}

      {settings.difficulty !== 'tutorial' && (
        <section aria-labelledby="assist-title">
          <h2 id="assist-title">輔助功能</h2>
          <p className="section-note">學習用的提示，對局中也可以從右上角的「輔助功能」隨時開關。</p>
          <div className="assist-panel">
            <AssistToggles settings={assist} update={updateAssist} />
          </div>
        </section>
      )}

      <div className="setup-actions">
        <button type="button" className="primary" onClick={start}>
          開始對局
        </button>
      </div>
    </main>
  )
}
