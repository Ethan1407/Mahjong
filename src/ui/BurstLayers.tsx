/**
 * 商店特效的背景動畫圖層（大字後面的火焰、寶石、花瓣、閃電、彩虹、鯨魚）。
 * 樣式與動畫在 table.css 的「商店特效」段落；每種特效的總長度在 GoldBurst.tsx 的 EFFECT_MS。
 */
import type { EffectId } from '../cosmetics'
import type { Tile as TileId } from '../engine'
import { Tile } from './Tile'

/** 特效可以依動作表演不同的內容（目前只有鯨魚會區分）。 */
export type BurstAction = 'chow' | 'pung' | 'kong' | 'win'

export interface LayerProps {
  action: BurstAction
  /** 這個動作牽涉的那張牌（吃、碰、槓的牌、胡的牌）；不知道時為 undefined。 */
  tile?: TileId
}

/** 固定的「亂數」：同一個 i 每次都得到同一個 0–1 的值，畫面每次都一樣、也不會重新排列。 */
const pseudo = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

type Vars = React.CSSProperties & Record<`--${string}`, string>
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// ─────────────────────────── 烈焰 ───────────────────────────
//
// 逼真的火：很多團「火焰粒子」持續從底部往上竄、邊升邊縮小變淡，
// 分三層顏色（外層暗紅、中層橘、核心黃白），再用 SVG 的亂流濾鏡把它們扭曲成一條條跳動的火舌。
// 上面再飄一點煙和火星，底部有一圈熱光。

const FLAME_LAYERS = [
  { cls: 'outer', count: 44, size: [90, 160], rise: [30, 46], dur: [0.7, 1.05] },
  { cls: 'mid', count: 38, size: [64, 115], rise: [20, 32], dur: [0.55, 0.85] },
  { cls: 'core', count: 30, size: [44, 80], rise: [9, 18], dur: [0.45, 0.7] },
] as const

const lerp = ([a, b]: readonly [number, number], t: number) => a + (b - a) * t

function FireLayer() {
  return (
    <div className="burst-layer fx-fire" aria-hidden>
      <svg className="fx-defs" width="0" height="0" focusable="false">
        <filter id="fx-fire-distort" x="-20%" y="-20%" width="140%" height="140%">
          {/* 1. 先模糊，讓一顆顆火焰粒子融成一整團 */}
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="soft" />
          {/* 2. 把半透明的邊緣收緊，火焰才有清楚的輪廓 */}
          <feComponentTransfer in="soft" result="solid">
            <feFuncA type="linear" slope="2.2" intercept="-0.25" />
          </feComponentTransfer>
          {/* 3. 用會變化的亂流把它扭成一條條往上跳動的火舌 */}
          <feTurbulence type="fractalNoise" baseFrequency="0.007 0.022" numOctaves="3" seed="4" result="noise">
            <animate attributeName="baseFrequency" dur="0.7s" values="0.007 0.022;0.009 0.03;0.007 0.022" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="solid" in2="noise" scale="60" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="fx-fire-glow" />
      <div className="fx-smoke-wrap">
        {range(12).map((i) => (
          <i
            key={i}
            className="fx-smoke"
            style={{
              left: `${pseudo(i, 21) * 100}%`,
              width: `${120 + pseudo(i, 22) * 120}px`,
              height: `${120 + pseudo(i, 22) * 120}px`,
              '--dx': `${(pseudo(i, 23) - 0.5) * 14}vw`,
              animationDelay: `${250 + Math.round(pseudo(i, 24) * 350)}ms`,
            } as Vars}
          />
        ))}
      </div>
      <div className="fx-fire-body">
        <div className="fx-fire-base" />
        {FLAME_LAYERS.map((layer, li) =>
          range(layer.count).map((i) => {
            const size = lerp(layer.size, pseudo(i, li * 10 + 1))
            const dur = lerp(layer.dur, pseudo(i, li * 10 + 2))
            return (
              <i
                key={`${layer.cls}${i}`}
                className={`fx-fp ${layer.cls}`}
                style={{
                  // 核心集中在中間一點，外層鋪滿整排
                  left: `${(layer.cls === 'core' ? 6 : 0) + pseudo(i, li * 10 + 3) * (layer.cls === 'core' ? 88 : 100)}%`,
                  width: `${size}px`,
                  height: `${size * 1.15}px`,
                  marginLeft: `${-size / 2}px`,
                  '--rise': `${-lerp(layer.rise, pseudo(i, li * 10 + 4))}vh`,
                  '--dx': `${(pseudo(i, li * 10 + 5) - 0.5) * 6}vw`,
                  animationDuration: `${dur}s`,
                  // 負的延遲：一開始火就已經在燒，不會一顆一顆冒出來
                  animationDelay: `${-pseudo(i, li * 10 + 6) * dur}s`,
                } as Vars}
              />
            )
          }),
        )}
      </div>
      {range(26).map((i) => (
        <i
          key={`e${i}`}
          className="fx-ember"
          style={{
            left: `${pseudo(i, 6) * 100}%`,
            '--dx': `${(pseudo(i, 7) - 0.5) * 16}vw`,
            animationDelay: `${Math.round(pseudo(i, 8) * 600)}ms`,
          } as Vars}
        />
      ))}
    </div>
  )
}

// ─────────────────────────── 翡翠 ───────────────────────────

function JadeLayer() {
  return (
    <div className="burst-layer fx-jade" aria-hidden>
      {range(26).map((i) => {
        const size = 16 + pseudo(i, 1) * 22
        return (
          <i
            key={i}
            className={`fx-gem${i % 3 === 0 ? ' alt' : ''}`}
            style={{
              left: `${pseudo(i, 2) * 96 + 2}%`,
              width: `${size}px`,
              height: `${size * 1.25}px`,
              '--r': `${(pseudo(i, 3) - 0.5) * 540}deg`,
              '--dur': `${1100 + pseudo(i, 4) * 600}ms`,
              animationDelay: `${Math.round(pseudo(i, 5) * 450)}ms`,
            } as Vars}
          />
        )
      })}
    </div>
  )
}

// ─────────────────────────── 櫻吹雪 ───────────────────────────

function SakuraLayer() {
  return (
    <div className="burst-layer fx-sakura" aria-hidden>
      {range(34).map((i) => {
        const size = 22 + pseudo(i, 1) * 18
        return (
          <i
            key={i}
            className="fx-petal"
            style={{
              left: `${pseudo(i, 2) * 104 - 2}%`,
              // 起點高度錯開，花瓣才會一片一片飄進畫面，而不是排成一排
              top: `${-8 - pseudo(i, 8) * 40}vh`,
              '--dur': `${2000 + pseudo(i, 3) * 800}ms`,
              '--sway': `${4 + pseudo(i, 4) * 7}vw`,
              '--dx': `${(pseudo(i, 5) - 0.3) * 18}vw`,
              animationDelay: `${Math.round(pseudo(i, 6) * 350)}ms`,
            } as Vars}
          >
            <b style={{ width: `${size}px`, height: `${size * 0.72}px`, animationDuration: `${700 + pseudo(i, 7) * 600}ms` }} />
          </i>
        )
      })}
    </div>
  )
}

// ─────────────────────────── 雷霆 ───────────────────────────

const BOLTS = [
  { x: 18, d: 0, pts: '0,0 -14,90 10,86 -18,190 6,184 -10,300' },
  { x: 78, d: 120, pts: '0,0 16,80 -6,84 20,170 -4,176 14,290' },
  { x: 50, d: 420, pts: '0,0 -10,70 12,74 -16,160 8,166 -6,260' },
  { x: 34, d: 560, pts: '0,0 12,60 -8,66 10,140' },
  { x: 64, d: 700, pts: '0,0 -12,64 8,68 -10,150' },
]

function ThunderLayer() {
  return (
    <div className="burst-layer fx-thunder" aria-hidden>
      <div className="fx-flash" />
      <svg className="fx-bolts" viewBox="0 0 100 100" preserveAspectRatio="none">
        {BOLTS.map((b, i) => (
          <g key={i} transform={`translate(${b.x} 0) scale(0.4 0.33)`} style={{ animationDelay: `${b.d}ms` }} className="fx-bolt">
            <polyline points={b.pts} className="fx-bolt-glow" />
            <polyline points={b.pts} className="fx-bolt-core" />
          </g>
        ))}
      </svg>
    </div>
  )
}

// ─────────────────────────── 彩虹 ───────────────────────────

const RAINBOW = ['#ff4d4d', '#ff9a3c', '#ffd93d', '#5be37d', '#4fc3ff', '#5b7cff', '#a46bff']

function RainbowLayer() {
  return (
    <div className="burst-layer fx-rainbow" aria-hidden>
      <svg viewBox="0 0 200 110" className="fx-arc">
        {RAINBOW.map((c, i) => {
          const r = 92 - i * 7
          return <path key={c} d={`M ${100 - r} 104 A ${r} ${r} 0 0 1 ${100 + r} 104`} pathLength={1} stroke={c} />
        })}
      </svg>
    </div>
  )
}

// ─────────────────────────── 鯨魚 ───────────────────────────
//
// 吃：鯨魚游過來、張嘴把那張牌吃掉、嚼一嚼、游走。
// 碰：鯨魚衝過去用頭把那張牌撞飛。
// 槓：鯨魚站起來，舉起用那張牌做成的槓鈴（兩邊各兩張，共四張）舉三下。
// 胡、自摸、台數加倍：鯨魚躍出水面、從噴氣孔噴水。

/** 側面的鯨魚（臉朝右）。嘴巴的下顎（.whale-jaw）可以張開。 */
function WhaleSide() {
  return (
    <svg viewBox="0 0 220 130" className="whale-svg">
      <g className="whale-tail">
        <path d="M44 64 C 32 60, 22 46, 6 40 C 14 54, 14 66, 6 84 C 22 78, 34 70, 46 70 Z" fill="#2f68b8" />
      </g>
      <path d="M148 73 L 214 71 L 204 98 L 158 100 Z" fill="#7b1e3c" />
      <path d="M170 76 Q 186 86 200 76" fill="#ff7b9c" />
      <path d="M214 71 C 214 44, 190 22, 150 21 C 104 20, 64 38, 42 64 C 62 82, 104 95, 148 95 L 148 73 Z" fill="#3a7bd5" />
      <path d="M58 74 C 86 88, 118 94, 148 95 L 148 87 C 120 87, 90 82, 58 74 Z" fill="#a9d6ff" />
      <ellipse cx="146" cy="24" rx="5" ry="2" fill="#24538f" />
      <path d="M122 80 C 128 96, 120 108, 104 114 C 108 100, 108 90, 110 80 Z" fill="#2f68b8" />
      <g className="whale-jaw">
        <path d="M148 73 L 214 71 C 212 87, 196 99, 170 101 C 156 102, 148 94, 148 73 Z" fill="#cfe9ff" />
        <path d="M156 81 L 205 79 M158 89 L 198 87 M162 96 L 186 95" stroke="#8fc1ef" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <circle cx="180" cy="50" r="5.5" fill="#14233a" />
      <circle cx="182" cy="48" r="1.8" fill="#fff" />
      <ellipse cx="194" cy="61" rx="6" ry="3" fill="#ff9db0" opacity="0.65" />
    </svg>
  )
}

/** 正面站著的鯨魚（舉重用），兩隻鰭當手臂往上舉。 */
function WhaleFront() {
  return (
    <svg viewBox="0 0 200 230" className="whale-svg">
      <path d="M100 196 C 84 206, 60 214, 44 210 C 60 222, 86 226, 100 214 C 114 226, 140 222, 156 210 C 140 214, 116 206, 100 196 Z" fill="#2f68b8" />
      <line className="whale-arm" x1="54" y1="128" x2="34" y2="44" style={{ transformOrigin: '54px 128px' }} />
      <line className="whale-arm" x1="146" y1="128" x2="166" y2="44" style={{ transformOrigin: '146px 128px' }} />
      <ellipse cx="100" cy="138" rx="60" ry="70" fill="#3a7bd5" />
      <ellipse cx="100" cy="162" rx="40" ry="44" fill="#cfe9ff" />
      <path d="M82 150 L 82 196 M100 146 L 100 204 M118 150 L 118 196" stroke="#8fc1ef" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="80" cy="110" r="6.5" fill="#14233a" />
      <circle cx="120" cy="110" r="6.5" fill="#14233a" />
      <circle cx="82" cy="108" r="2" fill="#fff" />
      <circle cx="122" cy="108" r="2" fill="#fff" />
      <path className="whale-grit" d="M88 128 Q 100 136 112 128" stroke="#14233a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="68" cy="124" rx="7" ry="3.5" fill="#ff9db0" opacity="0.65" />
      <ellipse cx="132" cy="124" rx="7" ry="3.5" fill="#ff9db0" opacity="0.65" />
      <ellipse cx="100" cy="72" rx="5" ry="2" fill="#24538f" />
    </svg>
  )
}

/** 置中的一張大牌（吃、碰時鯨魚的目標）。 */
function TargetTile({ tile }: { tile: TileId }) {
  return (
    <div className="whale-tile">
      <div className="whale-center">
        <Tile tile={tile} size="lg" />
      </div>
    </div>
  )
}

function Bubbles() {
  return (
    <>
      {range(18).map((i) => (
        <i
          key={i}
          className="whale-bubble"
          style={{
            left: `${pseudo(i, 31) * 100}%`,
            width: `${8 + pseudo(i, 32) * 18}px`,
            height: `${8 + pseudo(i, 32) * 18}px`,
            animationDelay: `${Math.round(pseudo(i, 33) * 900)}ms`,
            animationDuration: `${1300 + pseudo(i, 34) * 700}ms`,
          }}
        />
      ))}
    </>
  )
}

/** 一群水滴往上噴；delay：等多久才開始噴（毫秒）。 */
function Droplets({ n, salt, className, delay = 0 }: { n: number; salt: number; className: string; delay?: number }) {
  return (
    <div className={className}>
      {range(n).map((i) => (
        <i
          key={i}
          style={{
            '--dx': `${(pseudo(i, salt) - 0.5) * 120}px`,
            '--dy': `${-(60 + pseudo(i, salt + 1) * 110)}px`,
            animationDelay: `${delay + Math.round(pseudo(i, salt + 2) * 120)}ms`,
          } as Vars}
        />
      ))}
    </div>
  )
}

function WhaleLayer({ action, tile }: LayerProps) {
  const t = tile ?? 4 // 不知道是哪張牌時（例如預覽），用五萬
  return (
    <div className={`burst-layer fx-whale whale-act-${action}`} aria-hidden>
      <Bubbles />
      {action === 'kong' ? (
        <div className="whale-kong">
          <WhaleFront />
          <div className="whale-barbell">
            <span className="whale-plates">
              <Tile tile={t} size="lg" />
              <Tile tile={t} size="lg" />
            </span>
            <span className="whale-plates">
              <Tile tile={t} size="lg" />
              <Tile tile={t} size="lg" />
            </span>
          </div>
          <span className="whale-sparkle s1">✦</span>
          <span className="whale-sparkle s2">✦</span>
          <span className="whale-sparkle s3">✦</span>
        </div>
      ) : (
        <>
          {action !== 'win' && <TargetTile tile={t} />}
          {action === 'pung' && (
            <svg className="whale-impact" viewBox="-50 -50 100 100">
              <polygon points="0,-48 11,-15 46,-18 18,4 30,40 0,18 -30,40 -18,4 -46,-18 -11,-15" />
            </svg>
          )}
          {action === 'win' && <Droplets n={16} salt={41} className="whale-splash" />}
          <div className="whale-pos">
            <div className="whale-center whale-body">
              <WhaleSide />
              {action === 'win' && <Droplets n={14} salt={51} className="whale-spout" delay={850} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const LAYERS: Partial<Record<EffectId, (p: LayerProps) => React.ReactElement>> = {
  fire: FireLayer,
  jade: JadeLayer,
  sakura: SakuraLayer,
  thunder: ThunderLayer,
  whale: WhaleLayer,
  rainbow: RainbowLayer,
}
