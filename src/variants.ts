/**
 * 玩法清單。新增玩法時在這裡登記，並把 `available` 設為 true。
 * `engine` 內的參數會傳給規則引擎（例如十三張玩法的 totalSets = 4）。
 */
export type VariantId = 'taiwan16' | 'riichi' | 'sanma'

export interface VariantInfo {
  id: VariantId
  name: string
  subtitle: string
  description: string
  highlights: string[]
  available: boolean
  engine: {
    players: 3 | 4
    /** 閒家的手牌張數。 */
    handSize: 13 | 16
    /** 胡牌需要的面子數。 */
    totalSets: 4 | 5
    /** 整副牌的張數。 */
    tileCount: number
    hasFlowers: boolean
  }
}

export const VARIANTS: readonly VariantInfo[] = [
  {
    id: 'taiwan16',
    name: '台灣麻將',
    subtitle: '十六張',
    description: '台灣最常見的打法，節奏快、牌型變化多，計台結算。',
    highlights: ['16 張手牌，5 組面子 + 1 對', '含 8 張花牌', '門清、自摸、清一色等台型'],
    available: true,
    engine: { players: 4, handSize: 16, totalSets: 5, tileCount: 144, hasFlowers: true },
  },
  {
    id: 'riichi',
    name: '日本麻將',
    subtitle: '立直麻將',
    description: '必須有「役」才能胡，重視防守與讀牌，規則最嚴謹。',
    highlights: ['13 張手牌，4 組面子 + 1 對', '立直、寶牌、振聽', '符數與翻數計分'],
    available: false,
    engine: { players: 4, handSize: 13, totalSets: 4, tileCount: 136, hasFlowers: false },
  },
  {
    id: 'sanma',
    name: '三人麻將',
    subtitle: '三麻',
    description: '三人對局，拿掉二到八萬，牌型更容易做大。',
    highlights: ['3 人對局', '去掉 2–8 萬，共 108 張', '節奏比四人更快'],
    available: false,
    engine: { players: 3, handSize: 13, totalSets: 4, tileCount: 108, hasFlowers: false },
  },
]

export const getVariant = (id: VariantId) => VARIANTS.find((v) => v.id === id)!
