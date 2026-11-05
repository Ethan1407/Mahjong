/**
 * 牌的定義。
 *
 * 編號：0–8 萬、9–17 筒、18–26 條、27–30 東南西北、31–33 中發白、34–41 春夏秋冬梅蘭竹菊。
 * 「牌種」(tile kind) 指上述編號；同一牌種有 4 張（花牌各 1 張）。
 */
export type Tile = number

/** 非花牌的牌種數量（0–33），手牌計數陣列的長度。 */
export const TILE_KINDS = 34
export const FLOWER_FIRST = 34
export const FLOWER_LAST = 41

export const WINDS = [27, 28, 29, 30] as const
export const DRAGONS = [31, 32, 33] as const

export const TILE_NAMES: readonly string[] = [
  '一萬', '二萬', '三萬', '四萬', '五萬', '六萬', '七萬', '八萬', '九萬',
  '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
  '一條', '二條', '三條', '四條', '五條', '六條', '七條', '八條', '九條',
  '東風', '南風', '西風', '北風', '紅中', '青發', '白板',
  '春', '夏', '秋', '冬', '梅', '蘭', '竹', '菊',
]

export const WIND_NAMES = ['東', '南', '西', '北'] as const

export type SuitKind = 'man' | 'pin' | 'sou' | 'honor' | 'flower'

export const isSuited = (t: Tile) => t >= 0 && t < 27
export const isHonor = (t: Tile) => t >= 27 && t < 34
export const isWind = (t: Tile) => t >= 27 && t <= 30
export const isDragon = (t: Tile) => t >= 31 && t <= 33
export const isFlower = (t: Tile) => t >= FLOWER_FIRST && t <= FLOWER_LAST

export function suitOf(t: Tile): SuitKind {
  if (t < 9) return 'man'
  if (t < 18) return 'pin'
  if (t < 27) return 'sou'
  if (t < 34) return 'honor'
  return 'flower'
}

/** 數牌的點數 1–9；字牌與花牌回傳 0。 */
export const rankOf = (t: Tile) => (isSuited(t) ? (t % 9) + 1 : 0)

export const isTerminal = (t: Tile) => isSuited(t) && (t % 9 === 0 || t % 9 === 8)

/** 門風／圈風（0=東…3=北）對應的風牌。 */
export const windTile = (wind: number): Tile => 27 + wind

/** 門風對應的兩張「正花」。東：春梅、南：夏蘭、西：秋竹、北：冬菊。 */
export const seatFlowers = (seatWind: number): [Tile, Tile] => [34 + seatWind, 38 + seatWind]

export const tileName = (t: Tile) => TILE_NAMES[t] ?? `?${t}`

export function emptyCounts(): number[] {
  return new Array(TILE_KINDS).fill(0)
}

/** 轉成長度 34 的計數陣列（忽略花牌）。 */
export function toCounts(tiles: readonly Tile[]): number[] {
  const c = emptyCounts()
  for (const t of tiles) if (t < TILE_KINDS) c[t]++
  return c
}

export function countsToTiles(counts: readonly number[]): Tile[] {
  const out: Tile[] = []
  counts.forEach((n, t) => {
    for (let i = 0; i < n; i++) out.push(t)
  })
  return out
}

export const sortTiles = (tiles: readonly Tile[]) => [...tiles].sort((a, b) => a - b)

const SUIT_OFFSET: Record<string, number> = { m: 0, p: 9, s: 18, z: 27, f: 34 }

/**
 * 簡寫轉牌，主要給測試與除錯使用。
 * 例：`"123m 456p 789s 11z"`；z 為字牌 1–7（東南西北中發白），f 為花牌 1–8。
 */
export function parseTiles(text: string): Tile[] {
  const out: Tile[] = []
  const re = /(\d+)([mpszf])/g
  let match: RegExpExecArray | null
  let consumed = 0
  while ((match = re.exec(text.replace(/\s+/g, '')))) {
    consumed += match[0].length
    const offset = SUIT_OFFSET[match[2]]
    for (const ch of match[1]) {
      const n = Number(ch)
      const max = match[2] === 'z' ? 7 : match[2] === 'f' ? 8 : 9
      if (n < 1 || n > max) throw new Error(`無效的牌：${ch}${match[2]}`)
      out.push(offset + n - 1)
    }
  }
  if (consumed !== text.replace(/\s+/g, '').length) throw new Error(`無法解析：${text}`)
  return out
}
