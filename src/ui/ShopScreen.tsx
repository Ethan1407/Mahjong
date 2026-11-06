/**
 * 商店：用打牌贏來的籌碼購買裝飾。
 *
 * 目前賣的是吃碰槓胡的特效。之後要賣別的東西（牌背、桌布……），
 * 在 cosmetics.ts 加上資料與購買函式，再在這裡多放一個 <section> 就好。
 */
import { useState } from 'react'
import { EFFECTS, buyEffect, equipEffect, useCosmetics, type EffectId, type EffectInfo } from '../cosmetics'
import { formatChips, loadWallet } from '../wallet'
import { DecorMenu } from './DecorMenu'
import { GoldBurst, type BurstAction } from './GoldBurst'

/** 鯨魚會依動作表演不同的動畫，預覽時可以分別看。 */
const PREVIEW_ACTIONS: { action: BurstAction; text: string }[] = [
  { action: 'chow', text: '吃' },
  { action: 'pung', text: '碰' },
  { action: 'kong', text: '槓' },
  { action: 'win', text: '胡' },
]
import './table.css'

export function ShopScreen({ onBack }: { onBack: () => void }) {
  const cosmetics = useCosmetics()
  const [balance, setBalance] = useState(() => loadWallet().balance)
  const [confirming, setConfirming] = useState<EffectId | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<{ effect: EffectId; action: BurstAction; text: string; key: number } | null>(null)
  const play = (effect: EffectId, action: BurstAction = 'pung', text = '碰') => setPreview({ effect, action, text, key: Date.now() })

  const buy = (item: EffectInfo) => {
    const r = buyEffect(item.id)
    setConfirming(null)
    if (r.ok) {
      setBalance(loadWallet().balance)
      setMessage({ ok: true, text: `買到「${item.name}」了，已經幫你裝上！下次你吃碰槓胡時就會看到。` })
      play(item.id)
    } else {
      setMessage({ ok: false, text: r.reason })
    }
  }

  return (
    <main className="setup shop">
      <header className="setup-header">
        <div className="header-tools">
          <DecorMenu />
        </div>
        <button type="button" className="profile-back" onClick={onBack}>
          ← 返回
        </button>
        <h1>商店</h1>
        <p>用打牌贏來的籌碼購買裝飾。買過的東西永久擁有，可以隨時在「裝飾」裡切換。</p>
      </header>

      <div className="wallet-box shop-wallet">
        <span className="wallet-label">我的籌碼</span>
        <strong className="wallet-balance">{formatChips(balance)}</strong>
        <span className="section-note">在商店花的籌碼不算輸贏；買完至少要剩 1 籌碼。</span>
      </div>

      {message && (
        <p className={`shop-message ${message.ok ? 'ok' : 'no'}`} role="status">
          {message.text}
        </p>
      )}

      <section aria-labelledby="shop-effects">
        <h2 id="shop-effects">吃碰槓胡特效</h2>
        <p className="section-note">你自己吃、碰、槓、胡、自摸（和台數加倍）時的大字特效。機器人的動作維持金光。</p>
        <div className="shop-grid">
          {EFFECTS.map((item) => {
            const owned = cosmetics.owned.includes(item.id)
            const equipped = cosmetics.effect === item.id
            const affordable = balance - item.price >= 1
            return (
              <article key={item.id} className={`shop-card${equipped ? ' equipped' : ''}`}>
                <button
                  type="button"
                  className={`shop-sample burst-${item.id}`}
                  onClick={() => play(item.id)}
                  aria-label={`預覽${item.name}特效`}
                >
                  <span className="gold-burst-text">碰！</span>
                  <span className="shop-sample-hint">點一下預覽</span>
                </button>
                <div className="shop-info">
                  <h3>
                    {item.name}
                    {equipped && <span className="badge done">使用中</span>}
                  </h3>
                  <p className="option-desc">{item.description}</p>
                  {item.id === 'whale' && (
                    <div className="shop-acts" role="group" aria-label="預覽鯨魚的每種動作">
                      <span>預覽：</span>
                      {PREVIEW_ACTIONS.map((p) => (
                        <button key={p.action} type="button" onClick={() => play('whale', p.action, p.text)}>
                          {p.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shop-actions">
                  {owned ? (
                    <button type="button" className="shop-buy" disabled={equipped} onClick={() => equipEffect(item.id)}>
                      {equipped ? '使用中' : '使用'}
                    </button>
                  ) : confirming === item.id ? (
                    <>
                      <button type="button" className="shop-buy primary" onClick={() => buy(item)} autoFocus>
                        確定花 {formatChips(item.price)}
                      </button>
                      <button type="button" className="shop-buy" onClick={() => setConfirming(null)}>
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="shop-buy primary"
                      disabled={!affordable}
                      title={affordable ? undefined : '籌碼不夠'}
                      onClick={() => {
                        setMessage(null)
                        setConfirming(item.id)
                      }}
                    >
                      購買 · {formatChips(item.price)}
                    </button>
                  )}
                  {!owned && !affordable && <span className="shop-short">還差 {formatChips(item.price + 1 - balance)}</span>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="shop-soon">
        <h2 id="shop-soon">即將推出</h2>
        <p className="section-note">牌背花色、更多牌桌、胡牌音效……敬請期待。</p>
      </section>

      {preview && (
        <GoldBurst
          key={preview.key}
          text={`${preview.text}！`}
          sub="你"
          effect={preview.effect}
          action={preview.action}
          onDone={() => setPreview(null)}
        />
      )}
    </main>
  )
}
