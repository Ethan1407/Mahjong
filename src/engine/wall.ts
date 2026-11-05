import { createRng, shuffle, type Rng } from './rng'
import { FLOWER_FIRST, FLOWER_LAST, TILE_KINDS, isFlower, sortTiles, type Tile } from './tiles'

export const DEFAULT_RESERVE = 16

/** 建立一副 144 張的牌（未洗）。 */
export function fullTileSet(): Tile[] {
  const tiles: Tile[] = []
  for (let t = 0; t < TILE_KINDS; t++) tiles.push(t, t, t, t)
  for (let f = FLOWER_FIRST; f <= FLOWER_LAST; f++) tiles.push(f)
  return tiles
}

/**
 * 牌牆。正常摸牌從牌頭，補花與槓後補牌從牌尾。
 * 最後 `reserve` 張不能摸（留牌）；可摸張數歸零即流局。
 */
export class Wall {
  private constructor(
    private readonly tiles: Tile[],
    private front: number,
    private back: number,
    readonly reserve: number,
  ) {}

  static create(rng: Rng | number, reserve = DEFAULT_RESERVE): Wall {
    const r = typeof rng === 'number' ? createRng(rng) : rng
    return new Wall(shuffle(fullTileSet(), r), 0, 143, reserve)
  }

  /** 以指定順序建立（測試用）。第一張是牌頭。 */
  static fromTiles(tiles: Tile[], reserve = 0): Wall {
    return new Wall([...tiles], 0, tiles.length - 1, reserve)
  }

  /** 牌牆中剩下的總張數（含留牌）。 */
  get remaining(): number {
    return this.back - this.front + 1
  }

  /** 還能摸的張數。 */
  get drawable(): number {
    return Math.max(0, this.remaining - this.reserve)
  }

  get isExhausted(): boolean {
    return this.drawable === 0
  }

  drawFront(): Tile | null {
    if (this.isExhausted) return null
    return this.tiles[this.front++]
  }

  drawBack(): Tile | null {
    if (this.isExhausted) return null
    return this.tiles[this.back--]
  }

  clone(): Wall {
    return new Wall(this.tiles, this.front, this.back, this.reserve)
  }
}

export interface InitialDeal {
  /** 依座位 0–3 的手牌（已排序、不含花）。莊家 17 張，其餘 16 張。 */
  hands: Tile[][]
  /** 依座位亮出的花牌。 */
  flowers: Tile[][]
}

/**
 * 從牌尾補花，直到手上沒有花牌。
 * 回傳 false 表示牌牆在補花時被摸完（極少見，視為流局）。
 */
export function replaceFlowers(hand: Tile[], flowers: Tile[], wall: Wall): boolean {
  for (;;) {
    const idx = hand.findIndex(isFlower)
    if (idx < 0) return true
    flowers.push(hand[idx])
    const t = wall.drawBack()
    if (t === null) {
      hand.splice(idx, 1)
      return false
    }
    hand[idx] = t
  }
}

/** 發牌（每人 16 張，莊家 17 張），並從莊家開始依序補花。 */
export function dealInitial(wall: Wall, dealer: number): InitialDeal {
  const hands: Tile[][] = [[], [], [], []]
  const flowers: Tile[][] = [[], [], [], []]
  // 四輪，每輪每人拿 4 張
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < 4; i++) {
      const seat = (dealer + i) % 4
      for (let k = 0; k < 4; k++) hands[seat].push(wall.drawFront()!)
    }
  }
  hands[dealer].push(wall.drawFront()!)

  for (let i = 0; i < 4; i++) {
    const seat = (dealer + i) % 4
    replaceFlowers(hands[seat], flowers[seat], wall)
  }
  return { hands: hands.map(sortTiles), flowers: flowers.map(sortTiles) }
}
