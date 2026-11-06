import { useState } from 'react'
import { DIFFICULTIES } from '../difficulty'
import { loadStats, percent, resetStats, type StatLevel } from '../profile'
import { STAKES, STARTING_BALANCE, formatChips, formatMoney, loadWallet } from '../wallet'
import { ChipChart } from './ChipChart'
import { formatDuration } from './TableScreen'

const LEVELS: StatLevel[] = ['easy', 'normal', 'hard']
const dateText = (t: number | null) =>
  t === null ? '—' : new Date(t).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState(loadStats)
  const wallet = loadWallet()
  const refills = wallet.refills ?? 0
  /** 真正的輸贏：扣掉起始籌碼和補充的籌碼。 */
  const netChips = wallet.balance - STARTING_BALANCE * (1 + refills)
  const s = stats
  const losses = s.hands - s.wins - s.draws

  const cards: { label: string; value: string; note?: string }[] = [
    { label: '總遊玩時間', value: formatDuration(s.playSeconds), note: '只算對局中、有在操作的時間' },
    { label: '遊玩局數', value: `${s.hands} 局`, note: `開始 ${s.matchesStarted} 將、打完 ${s.matchesFinished} 將` },
    { label: '勝利局數', value: `${s.wins} 局` },
    { label: '勝率', value: percent(s.wins, s.hands), note: '胡牌局數 ÷ 遊玩局數' },
    { label: '自摸局數', value: `${s.tsumo} 局`, note: `佔胡牌的 ${percent(s.tsumo, s.wins)}` },
    { label: '放槍次數', value: `${s.dealIns} 次`, note: `放槍率 ${percent(s.dealIns, s.hands)}` },
    { label: '被自摸', value: `${s.tsumoAgainst} 次` },
    { label: '流局', value: `${s.draws} 局` },
    { label: '平均胡牌台數', value: s.wins > 0 ? `${(s.totalTai / s.wins).toFixed(1)} 台` : '—' },
    { label: '最快胡牌', value: s.fastestTurn !== null ? `第 ${s.fastestTurn} 輪` : '—' },
    { label: '目前籌碼', value: formatChips(wallet.balance), note: `起始 ${formatChips(STARTING_BALANCE)}，實際累計 ${formatMoney(netChips)}` },
    { label: '自動補充次數', value: `${refills} 次`, note: `籌碼輸光時自動補充 ${formatChips(STARTING_BALANCE)}` },
    { label: '沒胡的局', value: `${Math.max(0, losses)} 局`, note: '別人胡牌（不含流局）' },
  ]

  return (
    <main className="setup profile">
      <header className="setup-header profile-header">
        <button type="button" className="profile-back" onClick={onBack}>
          ← 返回
        </button>
        <h1>個人中心</h1>
        <p>遊玩數據存在這台裝置的瀏覽器裡，關掉網頁再打開也還在；換裝置、換瀏覽器或清除網站資料就會重新開始。</p>
      </header>

      <section aria-labelledby="stats-title">
        <h2 id="stats-title">遊玩數據</h2>
        <div className="stat-grid">
          {cards.map((c) => (
            <div className="stat-card" key={c.label}>
              <span className="stat-label">{c.label}</span>
              <strong className="stat-value">{c.value}</strong>
              {c.note && <span className="stat-note">{c.note}</span>}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="chips-title">
        <h2 id="chips-title">籌碼變化</h2>
        <p className="section-note">
          每打完一局有賭注的對局記一筆。目前 {formatChips(wallet.balance)}，自動補充過 {refills} 次，扣掉補充後實際累計{' '}
          {formatMoney(netChips)}。
        </p>
        <ChipChart history={wallet.history ?? []} />
      </section>

      <section aria-labelledby="best-title">
        <h2 id="best-title">最大的一手</h2>
        {s.best ? (
          <p className="stat-best">
            <strong>{s.best.tai} 台</strong>
            {s.best.items.length > 0 ? `：${s.best.items.join('、')}` : '（屁胡）'}
            <span className="stat-note">　{dateText(s.best.at)}</span>
          </p>
        ) : (
          <p className="section-note">還沒有胡過牌。</p>
        )}
      </section>

      <section aria-labelledby="stake-stats-title">
        <h2 id="stake-stats-title">各入場金額的戰績</h2>
        <StakeTable byStake={s.byStake} />
      </section>

      <section aria-labelledby="level-title">
        <h2 id="level-title">各難度戰績</h2>
        <table className="stat-table">
          <thead>
            <tr>
              <th>難度</th>
              <th>局數</th>
              <th>胡牌</th>
              <th>勝率</th>
              <th>放槍</th>
              <th>放槍率</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((lv) => {
              const d = s.byLevel[lv]
              return (
                <tr key={lv}>
                  <td>{DIFFICULTIES.find((x) => x.id === lv)?.name ?? lv}</td>
                  <td>{d.hands}</td>
                  <td>{d.wins}</td>
                  <td>{percent(d.wins, d.hands)}</td>
                  <td>{d.dealIns}</td>
                  <td>{percent(d.dealIns, d.hands)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="time-title">
        <h2 id="time-title">紀錄期間</h2>
        <p className="section-note">
          第一次遊玩：{dateText(s.firstPlayedAt)}　·　最近一次：{dateText(s.lastPlayedAt)}
        </p>
        <p className="section-note">
          遊玩時間的計算：只在對局畫面計時；停在主畫面、一分鐘沒有任何動作、或切到別的分頁／視窗時都會暫停。
        </p>
      </section>

      <div className="setup-actions">
        <button
          type="button"
          className="wallet-reset"
          onClick={() => {
            if (window.confirm('確定要清除所有遊玩數據嗎？（錢包不受影響）')) setStats(resetStats())
          }}
        >
          清除遊玩數據
        </button>
        <button type="button" className="primary" onClick={onBack}>
          返回主畫面
        </button>
      </div>
    </main>
  )
}

/** 各種入場金額玩了幾場：固定的選項照順序全部列出（沒玩過顯示 0），自行設定的每種金額各一列。 */
function StakeTable({ byStake }: { byStake: ReturnType<typeof loadStats>['byStake'] }) {
  const presetKeys = STAKES.filter((st) => st.id !== 'custom').map((st) => st.id as string)
  const rows = [
    ...presetKeys.map((k) => ({ key: k, label: STAKES.find((st) => st.id === k)!.name, d: byStake[k] })),
    ...Object.entries(byStake)
      .filter(([k]) => k.startsWith('custom:'))
      .sort(([, a], [, b]) => b.matches - a.matches)
      .map(([k, d]) => ({ key: k, label: d.label, d })),
  ]
  return (
    <table className="stat-table">
      <thead>
        <tr>
          <th>入場</th>
          <th>場數</th>
          <th>局數</th>
          <th>胡牌</th>
          <th>勝率</th>
          <th>輸贏</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, label, d }) => (
          <tr key={key}>
            <td>{label}</td>
            <td>{d?.matches ?? 0} 場</td>
            <td>{d?.hands ?? 0}</td>
            <td>{d?.wins ?? 0}</td>
            <td>{percent(d?.wins ?? 0, d?.hands ?? 0)}</td>
            <td>{d ? (key === 'free' ? `${formatMoney(d.net)} 分` : formatMoney(d.net)) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
