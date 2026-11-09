/**
 * 裝飾與商店：牌桌顏色、吃碰槓胡的特效（用籌碼在商店購買）。
 *
 * 存在這台裝置的瀏覽器（localStorage），和錢包一樣不會上傳。
 * 新增商品時：在 EFFECTS 加一筆，並在 table.css 加上對應的 .burst-<id> 樣式。
 * 之後要賣別種東西（牌背、桌布……），在 ShopScreen 的 SECTIONS 加一個區塊即可。
 */
import { useSyncExternalStore } from 'react'
import { spendChips } from './wallet'

// ─────────────────────────── 牌桌顏色 ───────────────────────────

export type TableColor = 'green' | 'blue'

export const TABLE_COLORS: readonly { id: TableColor; name: string; swatch: string }[] = [
  { id: 'green', name: '經典綠', swatch: '#22573f' },
  { id: 'blue', name: '深海藍', swatch: '#1f4e73' },
]

// ─────────────────────────── 特效 ───────────────────────────

export type EffectId = 'gold' | 'fire' | 'jade' | 'sakura' | 'thunder' | 'whale' | 'rainbow'

export interface EffectInfo {
  id: EffectId
  name: string
  /** 價格（籌碼）；0 = 一開始就有。 */
  price: number
  description: string
}

export const EFFECTS: readonly EffectInfo[] = [
  { id: 'gold', name: '金光', price: 0, description: '經典的金色大字，一開始就有。' },
  { id: 'fire', name: '烈焰', price: 2_000, description: '畫面下方竄起熊熊火焰，燒大約一秒，還會冒出火星。' },
  { id: 'jade', name: '翡翠', price: 2_000, description: '翡翠綠大字，一顆顆閃亮的寶石從天上掉下來。' },
  { id: 'sakura', name: '櫻吹雪', price: 2_000, description: '粉紅色大字，大片櫻花瓣左右飄著，慢慢落滿整個畫面。' },
  { id: 'thunder', name: '雷霆', price: 2_000, description: '金黃電光大字，閃電從天劈下，畫面連閃三下並大力震動。' },
  { id: 'whale', name: '鯨魚', price: 6_000, description: '可愛的鯨魚依動作表演' },
  { id: 'rainbow', name: '彩虹', price: 2_000, description: '七彩流動的大字，一道彩虹從左到右畫過天空再消失。' },
]

export const effectInfo = (id: EffectId) => EFFECTS.find((e) => e.id === id) ?? EFFECTS[0]

// ─────────────────────────── 儲存 ───────────────────────────

export interface Cosmetics {
  /** 擁有的特效。 */
  owned: EffectId[]
  /** 使用中的特效（你自己吃碰槓胡時顯示）。 */
  effect: EffectId
  table: TableColor
}

const KEY = 'mahjong.cosmetics'
const DEFAULT: Cosmetics = { owned: ['gold'], effect: 'gold', table: 'green' }
const isEffect = (x: unknown): x is EffectId => EFFECTS.some((e) => e.id === x)

function load(): Cosmetics {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Cosmetics> | null
    if (!saved) return DEFAULT
    const owned = [...new Set<EffectId>(['gold', ...(saved.owned ?? []).filter(isEffect)])]
    const effect = isEffect(saved.effect) && owned.includes(saved.effect) ? saved.effect : 'gold'
    const table = TABLE_COLORS.some((t) => t.id === saved.table) ? (saved.table as TableColor) : 'green'
    return { owned, effect, table }
  } catch {
    return DEFAULT
  }
}

let cache: Cosmetics | null = null
const listeners = new Set<() => void>()

export function getCosmetics(): Cosmetics {
  return (cache ??= load())
}

function save(next: Cosmetics) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 無痕模式等情況無法儲存，這次有效就好
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCosmetics(): Cosmetics {
  return useSyncExternalStore(subscribe, getCosmetics, () => DEFAULT)
}

/** 在 <html> 加上 data-table，table.css 依此切換牌桌顏色。index.html 也會在畫面出現前先套用。 */
export function applyTableColor(color: TableColor = getCosmetics().table) {
  if (typeof document !== 'undefined') document.documentElement.dataset.table = color
}

export function setTableColor(table: TableColor) {
  save({ ...getCosmetics(), table })
  applyTableColor(table)
}

export function equipEffect(effect: EffectId) {
  const c = getCosmetics()
  if (c.owned.includes(effect)) save({ ...c, effect })
}

export type BuyResult = { ok: true } | { ok: false; reason: string }

/** 用籌碼買特效，買到就直接裝備。 */
export function buyEffect(id: EffectId): BuyResult {
  const c = getCosmetics()
  if (c.owned.includes(id)) return { ok: false, reason: '已經擁有了' }
  const item = effectInfo(id)
  const paid = spendChips(item.price, `特效「${item.name}」`)
  if (!paid.ok) return paid
  save({ ...c, owned: [...c.owned, id], effect: id })
  return { ok: true }
}

/** 測試用：清除快取，下次重新從 localStorage 讀。 */
export function resetCosmeticsCache() {
  cache = null
}
