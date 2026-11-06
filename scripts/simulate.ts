/**
 * 命令列模擬器：讓機器人自動打完整將，印出統計。
 *
 *   npm run simulate                              # 預設：困難、中等、簡單、簡單 同桌打 20 將
 *   npm run simulate -- --bots hard,easy,easy,easy
 *   npm run simulate -- --matches 5 --seed 123
 *   npm run simulate -- --show                    # 另外印出第一局的完整過程（含機器人的理由）
 *
 * 每一將會輪換座位，避免座位先後造成的偏差。
 */
import { brainFor, type BotLevel } from '../src/ai'
import { createRng, sortTiles, tileName } from '../src/engine'
import {
  applyAction,
  describeEvent,
  describeResult,
  getView,
  nextHand,
  playOutRound,
  seatsToAct,
  startMatch,
  startRound,
  type Bot,
} from '../src/game'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const matches = Number(opt('matches', '20'))
const baseSeed = Number(opt('seed', '1'))
const levels = opt('bots', 'hard,normal,easy,easy').split(',') as BotLevel[]
if (levels.length !== 4 || levels.some((l) => !['easy', 'normal', 'hard'].includes(l))) {
  throw new Error('--bots 需要 4 個值，例如 hard,normal,easy,easy')
}
const LEVEL_NAMES: Record<BotLevel, string> = { easy: '簡單', normal: '中等', hard: '困難' }
const seatName = (s: number) => ['東家', '南家', '西家', '北家'][s] ?? `座位${s}`

if (args.includes('--show')) {
  console.log('══════ 第一局完整過程 ══════')
  let s = startRound({ seed: baseSeed, dealer: 0, dealerStreak: 0, roundWind: 0 })
  s.players.forEach((p, i) =>
    console.log(`${seatName(i)}（${LEVEL_NAMES[levels[i]]}）起手：${sortTiles(p.hand).map(tileName).join(' ')}`),
  )
  const rng = createRng(baseSeed)
  const brains = levels.map(brainFor)
  while (s.phase !== 'ended') {
    for (const seat of seatsToAct(s)) {
      if (s.phase === 'ended') break
      const d = brains[seat](getView(s, seat), rng)
      const before = s.log.length
      s = applyAction(s, d.action)
      for (const e of s.log.slice(before)) {
        if (e.type === 'draw') continue
        const note = 'seat' in e && e.seat === seat && d.action.type !== 'pass' ? `　← ${d.reason}` : ''
        console.log('  ' + describeEvent(e, seatName) + note)
      }
    }
  }
  console.log('結果：' + describeResult(s.result!, seatName))
  console.log()
}

interface Stat {
  hands: number
  wins: number
  tsumo: number
  dealIns: number
  score: number
  tai: number
  calls: number
}
const stats = new Map<string, Stat>()
const statOf = (label: string) => {
  if (!stats.has(label)) stats.set(label, { hands: 0, wins: 0, tsumo: 0, dealIns: 0, score: 0, tai: 0, calls: 0 })
  return stats.get(label)!
}

let hands = 0
let exhaustive = 0
const t0 = performance.now()

for (let k = 0; k < matches; k++) {
  // 輪換座位：第 k 將由 levels 往右轉 k 格
  const seatLevels = [0, 1, 2, 3].map((s) => levels[(s + k) % 4])
  const labels = seatLevels.map((l, s) => `${LEVEL_NAMES[l]}#${(s + k) % 4}`)
  const bots: Bot[] = seatLevels.map((l) => {
    const brain = brainFor(l)
    return (v, r) => brain(v, r).action
  })
  const rng = createRng(baseSeed + k)
  let m = startMatch({ seed: baseSeed + k, winds: 4 })
  while (!m.finished) {
    const round = playOutRound(m.round!, bots, rng)
    for (const e of round.log) {
      if (e.type === 'chow' || e.type === 'pung' || e.type === 'minkan') statOf(labels[e.seat]).calls++
    }
    m = nextHand({ ...m, round })
  }
  for (const h of m.history) {
    hands++
    labels.forEach((l) => statOf(l).hands++)
    if (h.result.type === 'exhaustive') {
      exhaustive++
      continue
    }
    const w = statOf(labels[h.result.winner])
    w.wins++
    w.tai += h.result.score.tai
    if (h.result.selfDrawn) w.tsumo++
    if (h.result.discarder !== null) statOf(labels[h.result.discarder]).dealIns++
  }
  m.scores.forEach((s, i) => (statOf(labels[i]).score += s))
}

const ms = performance.now() - t0
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1).padStart(5)}%`
console.log(`══════ 模擬統計：${matches} 將，共 ${hands} 局，流局 ${pct(exhaustive, hands)} ══════`)
console.log('機器人      胡牌率   自摸率   放槍率   平均台數  吃碰/局   平均每將得分')
for (const [label, s] of [...stats.entries()].sort()) {
  console.log(
    `${label.padEnd(8, '　')} ${pct(s.wins, s.hands)}  ${pct(s.tsumo, s.wins)}  ${pct(s.dealIns, s.hands)}   ${(s.tai / Math.max(1, s.wins)).toFixed(2).padStart(5)}     ${(s.calls / s.hands).toFixed(2)}     ${Math.round(s.score / matches).toString().padStart(6)}`,
  )
}
console.log(`耗時 ${(ms / 1000).toFixed(1)} 秒，平均每局 ${(ms / hands).toFixed(1)} 毫秒`)
