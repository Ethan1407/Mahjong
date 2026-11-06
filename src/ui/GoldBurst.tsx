/**
 * 金色大字動畫：在畫面中間放大並淡出。用在「台數 ×N」和所有玩家的吃、碰、槓、胡、自摸。
 *
 * 想改文字、要不要顯示、或動畫長短，改這個檔案最上面的設定就好：
 * - CALL_TEXT：每種動作顯示的字（設成 null 就不顯示那種動作）
 * - BURST_MS：大字的動畫長度；EFFECT_MS：各特效整體的長度（都要同步改 table.css 裡的動畫秒數）
 *
 * 你自己的動作會用你在商店買、在「裝飾」裡選的特效（effect）；機器人的動作一律是金光。
 */
import { useEffect, useRef, useState } from 'react'
import { useCosmetics, type EffectId } from '../cosmetics'
import type { Tile } from '../engine'
import type { GameEvent, RoundState } from '../game'
import { LAYERS, type BurstAction } from './BurstLayers'
import { HUMAN, seatName } from './useGame'

export type { BurstAction }

/** 動畫長度（毫秒）。 */
export const BURST_MS = 1300

/** 每種動作顯示的字；null = 這種動作不顯示動畫。 */
export const CALL_TEXT: Record<'chow' | 'pung' | 'minkan' | 'kakan' | 'ankan' | 'ron' | 'tsumo', string | null> = {
  chow: '吃',
  pung: '碰',
  minkan: '槓',
  kakan: '加槓',
  ankan: '暗槓',
  ron: '胡',
  tsumo: '自摸',
}

export interface Burst {
  /** 大字。 */
  text: string
  /** 大字上方的小字（例如誰做的）。 */
  sub?: string
  /** 用哪種特效顯示；省略就是金光。 */
  effect?: EffectId
  /** 是哪一類動作（鯨魚特效依此表演不同動畫）。 */
  action?: BurstAction
  /** 牽涉的那張牌（被吃、碰、槓的牌，胡的牌）。 */
  tile?: Tile
  key: number
}

/** 把一個事件變成要顯示的金字；不需要顯示就回傳 null。 */
export function burstFor(e: GameEvent, myEffect: EffectId = 'gold'): Omit<Burst, 'key'> | null {
  let text: string | null
  let action: BurstAction
  let tile: Tile | undefined
  if (e.type === 'chow' || e.type === 'pung' || e.type === 'minkan') {
    text = CALL_TEXT[e.type]
    action = e.type === 'minkan' ? 'kong' : e.type
    tile = e.claimed
  } else if (e.type === 'kakan' || e.type === 'ankan') {
    text = CALL_TEXT[e.type]
    action = 'kong'
    tile = e.tile
  } else if (e.type === 'win') {
    text = CALL_TEXT[e.from === null ? 'tsumo' : 'ron']
    action = 'win'
    tile = e.tile ?? undefined
  } else return null
  if (!text) return null
  return { text: `${text}！`, sub: seatName(e.seat), effect: e.seat === HUMAN ? myEffect : 'gold', action, tile }
}

/**
 * 看這一局的紀錄，有人吃、碰、槓、胡時回傳要顯示的金字。
 * handKey 換了（新的一局）就從頭算，不會把上一局的動作再播一次。
 */
export function useCallBursts(round: RoundState | null, handKey: string): [Burst | null, () => void] {
  const [burst, setBurst] = useState<Burst | null>(null)
  const seen = useRef({ key: handKey, len: round?.log.length ?? 0 })
  const { effect } = useCosmetics()
  const effectRef = useRef(effect)
  effectRef.current = effect

  useEffect(() => {
    if (!round) return
    if (seen.current.key !== handKey) seen.current = { key: handKey, len: 0 }
    const fresh = round.log.slice(seen.current.len)
    seen.current.len = round.log.length
    // 同時有好幾個動作時，只播最後一個
    for (let i = fresh.length - 1; i >= 0; i--) {
      const b = burstFor(fresh[i], effectRef.current)
      if (b) {
        setBurst({ ...b, key: Date.now() + i })
        break
      }
    }
  }, [round, handKey])

  return [burst, () => setBurst(null)]
}

/**
 * 每種特效整體持續多久（毫秒）：大字本身都是 BURST_MS 放大淡出，
 * 背景的火焰、寶石、花瓣、閃電、鯨魚、彩虹可以比大字久。要同步改 table.css 裡對應的動畫秒數。
 */
export const EFFECT_MS: Record<EffectId, number> = {
  gold: BURST_MS,
  fire: 1400,
  jade: 1900,
  sakura: 3200,
  thunder: 1600,
  whale: 2300,
  rainbow: 2000,
}

type Vars = React.CSSProperties & Record<`--${string}`, string>

/** 大字本身（effect 決定是哪種特效；action、tile 給會依動作表演的特效用，例如鯨魚）。 */
export function GoldBurst({
  text,
  sub,
  effect = 'gold',
  action = 'pung',
  tile,
  onDone,
}: {
  text: string
  sub?: string
  effect?: EffectId
  action?: BurstAction
  tile?: Tile
  onDone: () => void
}) {
  const done = useRef(onDone)
  done.current = onDone
  const ms = EFFECT_MS[effect] ?? BURST_MS
  useEffect(() => {
    // 保險：動畫事件沒觸發（例如減少動態效果）也會收掉
    const id = setTimeout(() => done.current(), ms + 300)
    return () => clearTimeout(id)
  }, [ms])
  const Layer = LAYERS[effect]
  return (
    <div
      className={`gold-burst burst-${effect}`}
      style={{ '--burst-ms': `${ms}ms` } as Vars}
      aria-live="assertive"
      onAnimationEnd={(e) => e.target === e.currentTarget && e.animationName === 'burst-hold' && done.current()}
    >
      {Layer && <Layer action={action} tile={tile} />}
      <div className="gold-burst-inner">
        {sub && <span className="gold-burst-sub">{sub}</span>}
        <span className="gold-burst-text">{text}</span>
      </div>
    </div>
  )
}
