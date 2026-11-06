# 台灣麻將教練

用來學習台灣十六張麻將的網頁：一位真人玩家對三個機器人，打牌時系統即時分析每一張牌的進攻效率與放槍風險。

- 規則規格：[docs/RULES.md](docs/RULES.md)
- 技術：Vite + React + TypeScript。所有規則、機器人與分析都在瀏覽器執行，沒有後端，
  建置結果是純靜態檔案，可以免費部署到 Vercel / Netlify / Cloudflare Pages / GitHub Pages。

部署：Vercel（連結 GitHub 倉庫，推送到 main 後自動部署）。

## 開發

```bash
npm install
npm run dev        # 本機開發伺服器
npm test           # 執行單元測試
npm run simulate   # 讓機器人自動打完整將，比較各難度的勝率（-- --bots hard,normal,easy,easy；-- --show 看一局過程與理由）
npm run build      # 建置到 dist/
```

## 目錄

```
src/
  variants.ts      玩法清單（台麻、日麻、三麻；新增玩法在此登記）
  difficulty.ts    機器人難度清單
  ui/              畫面元件：SetupScreen（選玩法與難度）、TableScreen（牌桌）、TutorialScreen（教學）、Tile（牌面）
  tutorial/        教學模式劇本，各玩法分開（taiwan16.ts；日麻、三麻之後加入），每一步都有測試驗證
  ai/              機器人
    danger.ts      放槍危險度估計（對手聽牌機率、筋、壁、一色…；階段 5 的分析也會用）
    brains.ts      三種難度的出牌與吃碰判斷，每個決定都附理由
  game/            對局流程（純 TypeScript）
    round.ts       單局狀態機：摸打、吃碰槓胡、搶槓、流局、結算
    view.ts        玩家視角（機器人只拿得到這個，看不到別人的牌）
    match.ts       一將：連莊、換莊、換圈、累計分數
    bots.ts        測試用的簡單機器人
    log.ts         對局事件的中文敘述
  engine/          規則引擎（純 TypeScript，不依賴畫面）
    tiles.ts       牌的定義與工具
    rng.ts         可指定種子的亂數（重播、復盤用）
    wall.ts        牌牆、發牌、補花
    hand.ts        胡牌判定、拆牌、向聽數、聽牌、有效進張
    scoring.ts     台數與付款
    __tests__/     單元測試
docs/RULES.md      規則規格（程式以此為準）
scripts/simulate.ts  命令列模擬器
```

## 開發階段

| 階段 | 內容 | 狀態 |
|---|---|---|
| 0 | 規則規格 | ✅ |
| 1 | 規則引擎 + 測試 | ✅ |
| 2 | 對局狀態機（輪次、吃碰槓胡優先序、流局、連莊、結算） | ✅ |
| 3 | 牌桌畫面、教學模式畫面 | ✅ |
| 4 | 機器人 AI（簡單／中等／困難） | ✅ |
| 5 | 打牌分析：進攻效率、放槍風險、他人需求 | ⬜ |
| 6 | 吃碰建議、對局復盤、新手教學 | ⬜ |
| 7 | 動畫、音效、手機版、部署 | ⬜ |
| 8 | 其他玩法：日本麻將、三人麻將（規則引擎已支援十三張牌型） | ⬜ |
