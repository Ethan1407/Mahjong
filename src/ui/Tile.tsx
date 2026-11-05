import { isDragon, isFlower, isSuited, isWind, tileName, type Tile as TileId } from '../engine'

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const SUIT_CHARS = ['萬', '筒', '條']
const SUIT_CLASS = ['man', 'pin', 'sou']
const HONOR_CHARS = ['東', '南', '西', '北', '中', '發', '']
const FLOWER_CHARS = ['春', '夏', '秋', '冬', '梅', '蘭', '竹', '菊']

export type TileSize = 'lg' | 'md' | 'sm' | 'xs'

interface FaceProps {
  tile: TileId
}

function Face({ tile }: FaceProps) {
  if (isSuited(tile)) {
    const suit = Math.floor(tile / 9)
    return (
      <>
        <span className="tile-num">{NUMERALS[tile % 9]}</span>
        <span className="tile-suit">{SUIT_CHARS[suit]}</span>
      </>
    )
  }
  if (isFlower(tile)) {
    const i = tile - 34
    return (
      <>
        <span className="tile-big">{FLOWER_CHARS[i]}</span>
        <span className="tile-corner">{(i % 4) + 1}</span>
      </>
    )
  }
  if (tile === 33) return <span className="tile-frame" aria-hidden />
  return <span className="tile-big">{HONOR_CHARS[tile - 27]}</span>
}

function faceClass(tile: TileId): string {
  if (isSuited(tile)) return SUIT_CLASS[Math.floor(tile / 9)]
  if (isFlower(tile)) return tile < 38 ? 'flower season' : 'flower plant'
  if (isWind(tile)) return 'wind'
  if (isDragon(tile)) return ['red', 'green', 'white'][tile - 31]
  return ''
}

export interface TileProps {
  tile?: TileId
  /** 牌背（看不到的牌）。 */
  back?: boolean
  size?: TileSize
  selected?: boolean
  highlight?: boolean
  dim?: boolean
  onClick?: () => void
  title?: string
}

export function Tile({ tile, back, size = 'md', selected, highlight, dim, onClick, title }: TileProps) {
  const cls = [
    'tile',
    `tile-${size}`,
    back ? 'tile-back' : faceClass(tile!),
    selected && 'selected',
    highlight && 'highlight',
    dim && 'dim',
    onClick && 'clickable',
  ]
    .filter(Boolean)
    .join(' ')
  const label = back ? '牌背' : tileName(tile!)
  const content = back ? null : <Face tile={tile!} />
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label} aria-pressed={selected} title={title ?? label}>
        {content}
      </button>
    )
  }
  return (
    <span className={cls} role="img" aria-label={label} title={title ?? label}>
      {content}
    </span>
  )
}

export function TileRow({ tiles, size = 'sm', gap }: { tiles: TileId[]; size?: TileSize; gap?: boolean }) {
  return (
    <span className={`tile-row${gap ? ' gap' : ''}`}>
      {tiles.map((t, i) => (
        <Tile key={i} tile={t} size={size} />
      ))}
    </span>
  )
}
