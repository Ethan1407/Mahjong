/**
 * 每種特效的代表圖示（商店卡片、裝飾選單用）：
 * 金光＝閃光、烈焰＝火焰、翡翠＝寶石、櫻吹雪＝櫻花、雷霆＝閃電、鯨魚＝鯨魚、彩虹＝彩虹。
 */
import { useId } from 'react'
import type { EffectId } from '../cosmetics'
import { WhaleSide } from './BurstLayers'

/** SVG 漸層：上到下 stops 依序排開。 */
function Grad({ id, stops, horizontal = false }: { id: string; stops: string[]; horizontal?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
      {stops.map((c, i) => (
        <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />
      ))}
    </linearGradient>
  )
}

const PETAL = 'M50 50 C 37 41, 35 22, 45 12 L 50 19 L 55 12 C 65 22, 63 41, 50 50 Z'
const RAINBOW = ['#ff4d4d', '#ff9a3c', '#ffd93d', '#5be37d', '#4fc3ff', '#5b7cff', '#a46bff']

export function EffectIcon({ id, className = '' }: { id: EffectId; className?: string }) {
  // 同一頁會出現好幾個圖示，漸層的 id 要各自唯一
  const uid = useId().replace(/:/g, '')
  const g = (name: string) => `${uid}-${name}`
  const cls = `effect-icon icon-${id} ${className}`

  switch (id) {
    case 'whale':
      return (
        <span className={cls} aria-hidden>
          <WhaleSide />
        </span>
      )
    case 'rainbow':
      return (
        <svg className={cls} viewBox="0 0 200 110" aria-hidden>
          {RAINBOW.map((c, i) => {
            const r = 92 - i * 9
            return <path key={c} d={`M ${100 - r} 104 A ${r} ${r} 0 0 1 ${100 + r} 104`} stroke={c} strokeWidth="9" fill="none" strokeLinecap="round" />
          })}
        </svg>
      )
    case 'fire':
      return (
        <svg className={cls} viewBox="0 0 100 100" aria-hidden>
          <defs>
            <Grad id={g('outer')} stops={['#ff9a2e', '#ff5a14', '#c41d0a']} />
            <Grad id={g('inner')} stops={['#fff3a0', '#ffd23f', '#ff9a2e']} />
          </defs>
          <path
            d="M50 4 C 60 26, 84 38, 82 64 C 80 86, 64 96, 50 96 C 32 96, 18 84, 18 64 C 18 46, 32 36, 34 20 C 42 30, 44 38, 46 44 C 50 32, 52 20, 50 4 Z"
            fill={`url(#${g('outer')})`}
          />
          <path
            d="M50 40 C 58 54, 68 62, 66 76 C 64 88, 56 92, 50 92 C 42 92, 34 86, 34 76 C 34 66, 42 60, 44 52 C 47 58, 48 62, 50 64 C 52 56, 52 48, 50 40 Z"
            fill={`url(#${g('inner')})`}
          />
        </svg>
      )
    case 'jade':
      return (
        <svg className={cls} viewBox="0 0 100 100" aria-hidden>
          <defs>
            <Grad id={g('body')} stops={['#9ff0c8', '#2fbf7f', '#0b5e3c']} />
            <Grad id={g('top')} stops={['#f0fff7', '#8fe8bd']} />
          </defs>
          <polygon points="14,38 32,16 68,16 86,38 50,90" fill={`url(#${g('body')})`} />
          <polygon points="32,16 68,16 86,38 14,38" fill={`url(#${g('top')})`} />
          <g stroke="#0b5e3c" strokeOpacity="0.45" strokeWidth="1.5" fill="none">
            <polyline points="32,16 40,38 50,16 60,38 68,16" />
            <line x1="40" y1="38" x2="50" y2="90" />
            <line x1="60" y1="38" x2="50" y2="90" />
          </g>
          <polygon points="36,20 44,20 38,32" fill="#ffffff" opacity="0.85" />
        </svg>
      )
    case 'sakura':
      return (
        <svg className={cls} viewBox="0 0 100 100" aria-hidden>
          <defs>
            <Grad id={g('petal')} stops={['#ffe3ee', '#ff9cc2', '#f06292']} />
          </defs>
          {[0, 72, 144, 216, 288].map((deg) => (
            <path key={deg} d={PETAL} transform={`rotate(${deg} 50 50)`} fill={`url(#${g('petal')})`} />
          ))}
          <circle cx="50" cy="50" r="9" fill="#ffd9e6" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <circle key={deg} cx="50" cy="42" r="2.4" transform={`rotate(${deg + 36} 50 50)`} fill="#e0457b" />
          ))}
        </svg>
      )
    case 'thunder':
      return (
        <svg className={cls} viewBox="0 0 100 100" aria-hidden>
          <defs>
            <Grad id={g('bolt')} stops={['#fffbd0', '#ffe14d', '#ffb300']} />
          </defs>
          <polygon points="60,4 20,58 46,58 36,96 80,38 54,38 66,4" fill={`url(#${g('bolt')})`} stroke="#fff6c8" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )
    default:
      // 金光：一大一小的金色閃光
      return (
        <svg className={cls} viewBox="0 0 100 100" aria-hidden>
          <defs>
            <Grad id={g('gold')} stops={['#fff1b8', '#f2b84b', '#c9861c']} />
          </defs>
          <path d="M44 8 C 48 36, 56 44, 84 48 C 56 52, 48 60, 44 88 C 40 60, 32 52, 4 48 C 32 44, 40 36, 44 8 Z" fill={`url(#${g('gold')})`} />
          <path d="M80 6 C 82 16, 84 18, 94 20 C 84 22, 82 24, 80 34 C 78 24, 76 22, 66 20 C 76 18, 78 16, 80 6 Z" fill={`url(#${g('gold')})`} />
        </svg>
      )
  }
}
