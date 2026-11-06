import { SUIT_NAMES, isDragon, isFlower, isSuited, isWind, tileName, type Tile as TileId } from '../engine'

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
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
        <span className="tile-suit">{SUIT_NAMES[suit]}</span>
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
  /** 有台：加金框，滑鼠移上去（或點一下）顯示這段說明。 */
  tip?: string
  /** 發牌動畫：延遲幾毫秒後飛進來。 */
  dealDelay?: number
  /** 一般說明（滑鼠移上去顯示，不加金框），例如被誰吃碰走。 */
  note?: string
  /** 牌上方的小標籤，例如「建議」。 */
  mark?: string
}

export function Tile({ tile, back, size = 'md', selected, highlight, dim, onClick, title, tip, dealDelay, note, mark }: TileProps) {
  const cls = [
    'tile',
    `tile-${size}`,
    back ? 'tile-back' : faceClass(tile!),
    selected && 'selected',
    highlight && 'highlight',
    dim && 'dim',
    onClick && 'clickable',
    tip && 'tai',
    dealDelay !== undefined && 'deal-in',
  ]
    .filter(Boolean)
    .join(' ')
  const name = back ? '牌背' : tileName(tile!)
  const info = tip ?? note
  const label = [name, mark && `（${mark}）`, info && `（${info}）`].filter(Boolean).join('')
  const content = back ? null : (
    <>
      <Face tile={tile!} />
      {mark && (
        <span className="tile-mark" aria-hidden>
          {mark}
        </span>
      )}
    </>
  )
  const style = dealDelay !== undefined ? { animationDelay: `${dealDelay}ms` } : undefined
  // 有說明時用自訂的提示框（data-tip），不再用瀏覽器內建的 title，避免出現兩個提示
  const titleAttr = info ? undefined : (title ?? name)
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label} aria-pressed={selected} title={titleAttr} data-tip={info} style={style}>
        {content}
      </button>
    )
  }
  return (
    <span className={cls} role="img" aria-label={label} title={titleAttr} data-tip={info} tabIndex={info ? 0 : undefined} style={style}>
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
