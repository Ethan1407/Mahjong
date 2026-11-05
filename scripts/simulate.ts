/**
 * 命令列模擬器：讓 4 個機器人自動打完整將，印出統計（階段 2 驗證用）。
 *
 *   npm run simulate                 # 打 20 將，印統計
 *   npm run simulate -- --matches 5  # 指定將數
 *   npm run simulate -- --show       # 另外印出第一局的完整過程
 *   npm run simulate -- --seed 123   # 指定種子（同種子結果相同）
 */
import { tileName, sortTiles } from '../src/engine'
import {
  applyAction,
  describeEvent,
  describeResult,
  efficiencyBot,
  getView,
  nextHand,
  playOutRound,
  seatsToAct,
  startMatch,
  startRound,
} from '../src/game'
import { createRng } from '../src/engine'

const args = process.argv.slice(2)
const opt = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const matches = opt('matches', 20)
const baseSeed = opt('seed', 1)
const bots = [efficiencyBot, efficiencyBot, efficiencyBot, efficiencyBot]
const seatName = (s: number) => ['東家', '南家', '西家', '北家'][s] ?? `座位${s}`

if (args.includes('--show')) {
  console.log('══════ 第一局完整過程 ══════')
  let s = startRound({ seed: baseSeed, dealer: 0, dealerStreak: 0, roundWind: 0 })
  s.players.forEach((p, i) =>
    console.log(`${seatName(i)} 起手：${sortTiles(p.hand).map(tileName).join(' ')}`),
  )
  const rng = createRng(baseSeed)
  while (s.phase !== 'ended') {
    for (const seat of seatsToAct(s)) {
      if (s.phase === 'ended') break
      s = applyAction(s, bots[seat](getView(s, seat), rng))
    }
  }
  for (const e of s.log) if (e.type !== 'draw') console.log('  ' + describeEvent(e, seatName))
  console.log('結果：' + describeResult(s.result!, seatName))
  console.log()
}

let hands = 0
let exhaustive = 0
let tsumo = 0
let totalTai = 0
let maxTai = 0
const itemCounts = new Map<string, number>()
const finalScores: number[][] = []
const t0 = performance.now()

for (let k = 0; k < matches; k++) {
  const rng = createRng(baseSeed + k)
  let m = startMatch({ seed: baseSeed + k, winds: 4 })
  while (!m.finished) {
    m = { ...m, round: playOutRound(m.round!, bots, rng) }
    m = nextHand(m)
  }
  for (const h of m.history) {
    hands++
    if (h.result.type === 'exhaustive') {
      exhaustive++
      continue
    }
    if (h.result.selfDrawn) tsumo++
    totalTai += h.result.score.tai
    maxTai = Math.max(maxTai, h.result.score.tai)
    for (const item of h.result.score.items) itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + 1)
  }
  finalScores.push(m.scores)
}

const ms = performance.now() - t0
const wins = hands - exhaustive
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`
console.log('══════ 模擬統計（4 個只看牌效率的暫時機器人）══════')
console.log(`將數 ${matches}，共 ${hands} 局，平均每將 ${(hands / matches).toFixed(1)} 局`)
console.log(`胡牌 ${pct(wins, hands)}（自摸 ${pct(tsumo, wins)}、放槍 ${pct(wins - tsumo, wins)}），流局 ${pct(exhaustive, hands)}`)
console.log(`平均台數 ${(totalTai / wins).toFixed(2)}，最高 ${maxTai} 台`)
console.log('最常出現的台型：')
;[...itemCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([name, n]) => console.log(`  ${name.padEnd(10, '　')} ${pct(n, wins)}`))
const sums = finalScores.map((s) => s.reduce((a, b) => a + b, 0))
console.log(`每將分數總和皆為 0：${sums.every((x) => x === 0) ? '是' : '否'}`)
console.log(`耗時 ${(ms / 1000).toFixed(1)} 秒，平均每局 ${(ms / hands).toFixed(1)} 毫秒`)
