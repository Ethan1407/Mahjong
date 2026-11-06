/**
 * 台灣十六張的教學課程。每一步都由 lessons.test.ts 用規則引擎驗證。
 */
import type { Lesson } from './types'

// 聽一條（單吊）的手牌，多個課程共用
const WAIT_1S = '123m 456m 789m 123p 456p 1s'

export const TAIWAN16_LESSONS: readonly Lesson[] = [
  // ─────────────────────────── 入門 ───────────────────────────
  {
    id: 'basics',
    level: 'intro',
    title: '認識麻將',
    summary: '牌的種類，以及胡牌的目標',
    steps: [
      {
        kind: 'info',
        title: '三種數牌',
        explain: '萬、筒、條各有 1 到 9，每種 4 張。數牌可以組成「順子」（同花色連續三張）或「刻子」（三張一樣）。',
        tiles: '123456789m | 123456789p | 123456789s',
      },
      {
        kind: 'info',
        title: '字牌與花牌',
        explain: '字牌有東南西北中發白，每種 4 張，只能組成刻子，不能組順子。花牌春夏秋冬梅蘭竹菊各 1 張，摸到就亮出來補牌，可以加台。',
        tiles: '1234567z | 12345678f',
      },
      {
        kind: 'info',
        title: '胡牌的目標',
        explain: '台灣麻將手上有 16 張，再拿到第 17 張時，湊成「5 組面子 + 1 對眼睛」就胡了。面子就是順子或刻子。',
        tiles: '123m | 456p | 789s | 111z | 555z | 22s',
      },
    ],
  },

  // ─────────────────────────── 基本玩法 ───────────────────────────
  {
    id: 'flow',
    level: 'basic',
    title: '一局的流程',
    summary: '座位、莊家、輪流摸打',
    steps: [
      {
        kind: 'info',
        title: '四個座位',
        explain: '四個人分別坐東、南、西、北。莊家固定是「東」，依逆時針方向輪流：你右手邊的人是「下家」，對面是「對家」，左手邊是「上家」。上家打完牌就輪到你。',
      },
      {
        kind: 'info',
        title: '開局',
        explain: '洗牌後每人拿 16 張，莊家多拿 1 張共 17 張，所以由莊家先打出第一張。拿到花牌的人要先「補花」。',
      },
      {
        kind: 'info',
        title: '摸一張、打一張',
        explain: '輪到你時，先從牌牆摸一張（變 17 張），再打出一張（回到 16 張）。手上永遠維持 16 張，吃、碰、槓之後也一樣。',
      },
      {
        kind: 'info',
        title: '別人打牌時',
        explain: '每次有人打出牌，其他人可以選擇吃、碰、槓或胡。都沒人要的話，就換打牌者的下家摸牌。',
      },
    ],
  },
  {
    id: 'discard',
    level: 'basic',
    title: '摸牌與打牌',
    summary: '要留哪張、打哪張',
    steps: [
      {
        kind: 'action',
        title: '打出沒用的牌',
        explain: '你摸到一張五條。手上的北風只有一張，和其他牌都組不起來。想一想該打哪一張？',
        hand: '123m 456m 789p 234s 567s 4z',
        event: { type: 'draw', tile: '5s' },
        expect: 'discard',
        discard: '4z',
        success: '打北風後，二三四五條和五六七條可以拆成好幾種組合，二、五、八條都能胡，叫「三面聽」。孤單的字牌通常最先打。',
        hint: '找一張和其他牌都組不成順子或刻子的牌，北風只有一張。',
      },
      {
        kind: 'info',
        title: '打牌的順序',
        explain: '一般來說先打孤單的字牌，再打邊緣的一、九，然後是孤單的數牌。兩張連在一起的牌（例如三四萬）比較有用，先留著。之後打牌時，系統會幫你分析每一張牌的好壞。',
      },
    ],
  },
  {
    id: 'flower',
    level: 'basic',
    title: '補花',
    summary: '摸到花牌要亮出來，再補一張',
    steps: [
      {
        kind: 'action',
        title: '摸到花牌',
        explain: '輪到你摸牌，摸到了一張花牌。花牌不能用來組牌，要先把它亮出來。',
        hand: '123m 456m 789p 234s 567s 1z',
        event: { type: 'draw', tile: '1f' },
        expect: 'flower',
        success: '花牌放到旁邊，再從牌牆尾端補一張。自己門風對應的花（東家是春、梅）胡牌時每張加 1 台。',
        hint: '花牌不能打出去，也不能組牌，請按「補花」。',
      },
    ],
  },
  {
    id: 'chow',
    level: 'basic',
    title: '吃',
    summary: '用上家打的牌湊成順子',
    steps: [
      {
        kind: 'action',
        title: '吃上家的牌',
        explain: '你手上有一萬、二萬，上家打出三萬。拿這張三萬，就能湊成一二三萬的順子。',
        hand: '12m 456m 789p 234s 567s 15z',
        event: { type: 'discard', from: 'upper', tile: '3m' },
        expect: 'chow',
        chowWith: '12m',
        success: '吃完要把這組順子亮在桌上，然後打出一張牌。亮出來的牌別人看得到，也就不算「門清」了。',
        hint: '一萬、二萬加上三萬剛好是順子，而且是上家打的，可以吃。',
      },
      {
        kind: 'action',
        title: '只能吃上家',
        explain: '這次是對家打出三萬。你手上一樣有一萬、二萬……',
        hand: '12m 456m 789p 234s 567s 15z',
        event: { type: 'discard', from: 'opposite', tile: '3m' },
        expect: 'pass',
        success: '沒錯！只有上家（在你前一個出牌的人）打的牌才能吃，對家和下家的牌都不能吃。',
        hint: '吃只能吃上家的牌，這張是對家打的，只能選「過」。',
      },
    ],
  },
  {
    id: 'pung',
    level: 'basic',
    title: '碰',
    summary: '有一對時，任何人打出第三張都能碰',
    steps: [
      {
        kind: 'action',
        title: '碰牌',
        explain: '你手上有一對五筒，下家打出五筒。',
        hand: '55p 123m 456m 789s 234s 15z',
        event: { type: 'discard', from: 'lower', tile: '5p' },
        expect: 'pung',
        success: '碰跟吃不同，任何一家打的牌都可以碰。碰完一樣要把刻子亮出來，再打一張牌。',
        hint: '你手上有兩張五筒，再加一張就是刻子，可以碰。',
      },
    ],
  },
  {
    id: 'kong',
    level: 'basic',
    title: '槓',
    summary: '四張一樣的牌：明槓、暗槓、加槓',
    steps: [
      {
        kind: 'action',
        title: '明槓',
        explain: '你手上已經有三張五筒，對家打出第四張五筒。',
        hand: '555p 123m 456m 789s 234s 5z',
        event: { type: 'discard', from: 'opposite', tile: '5p' },
        expect: 'kong',
        success: '槓完四張亮在桌上，從牌牆尾端補一張牌（四張只算一組面子，所以要補）。',
        hint: '你有三張五筒，別人打出第四張，可以槓。',
      },
      {
        kind: 'action',
        title: '暗槓',
        explain: '這次是你自己摸到第四張五筒。',
        hand: '555p 123m 456m 789s 234s 5z',
        event: { type: 'draw', tile: '5p' },
        expect: 'ankan',
        success: '自己摸齊四張叫暗槓，牌蓋著放，別人不知道是什麼。暗槓不會破壞門清。',
        hint: '四張五筒都是自己摸到的，可以暗槓。',
      },
      {
        kind: 'action',
        title: '加槓',
        explain: '你之前碰了五筒，現在又摸到第四張五筒。',
        hand: '123m 456m 789s 234s 5z',
        melds: ['555p'],
        event: { type: 'draw', tile: '5p' },
        expect: 'kakan',
        success: '把第四張加到已經碰出的刻子上就是加槓。小心：如果別人正好在聽這張牌，他可以「搶槓」胡你。',
        hint: '你已經碰出五筒，再摸到一張可以加槓。',
      },
    ],
  },
  {
    id: 'win',
    level: 'basic',
    title: '胡',
    summary: '胡別人打的牌，或自己摸到（自摸）',
    steps: [
      {
        kind: 'info',
        title: '聽牌',
        explain: '只差一張就能胡的狀態叫「聽牌」。下面這手牌已經有 5 組面子，只差一張一條湊成對子。',
        tiles: WAIT_1S,
      },
      {
        kind: 'action',
        title: '胡別人打的牌',
        explain: '你正在聽一條，上家打出了一條。',
        hand: WAIT_1S,
        event: { type: 'discard', from: 'upper', tile: '1s' },
        expect: 'ron',
        success: '胡了！打出這張牌的人叫「放槍」，由他一個人付錢。',
        hint: '一條剛好讓你湊齊 5 組面子 + 1 對，按「胡」。',
      },
      {
        kind: 'action',
        title: '自摸',
        explain: '同樣聽一條，這次是你自己摸到一條。',
        hand: WAIT_1S,
        event: { type: 'draw', tile: '1s' },
        expect: 'tsumo',
        success: '自己摸到胡牌叫「自摸」，三家都要付錢。沒有吃碰過又自摸，叫「門清自摸」，有 3 台。',
        hint: '你摸到的一條剛好胡牌，按「自摸」。',
      },
    ],
  },
  {
    id: 'priority',
    level: 'basic',
    title: '誰先拿牌',
    summary: '胡 > 碰、槓 > 吃，以及截胡',
    steps: [
      {
        kind: 'info',
        title: '優先順序',
        explain: '同一張牌好幾個人都想要時：要胡的人最優先，其次是碰或槓，最後才是吃。所以你想吃上家的牌，但對家要碰，就會被對家拿走。',
      },
      {
        kind: 'info',
        title: '截胡',
        explain: '如果兩個人都能胡同一張牌，由打牌者的下家方向、最近的那個人胡，另一個人就被「截胡」了。',
      },
    ],
  },
  {
    id: 'ending',
    level: 'basic',
    title: '流局與換莊',
    summary: '牌摸完、連莊、一將打多久',
    steps: [
      {
        kind: 'info',
        title: '流局',
        explain: '牌牆最後 16 張不摸。可以摸的牌都摸完了還沒人胡，這局就是「流局」，沒有人輸贏。',
      },
      {
        kind: 'info',
        title: '連莊與換莊',
        explain: '莊家胡牌或流局，莊家繼續當莊，叫「連莊」；閒家胡牌，就換下一家當莊。',
      },
      {
        kind: 'info',
        title: '一將',
        explain: '四個人都當過莊，叫做一「圈」。依序打完東風圈、南風圈、西風圈、北風圈，總共四圈叫做一「將」。',
      },
    ],
  },
  {
    id: 'scoring',
    level: 'basic',
    title: '計分方式',
    summary: '底與台、誰付錢',
    steps: [
      {
        kind: 'info',
        title: '底與台',
        explain: '胡牌的分數 = 底 + 台數 × 每台。本遊戲是底 100、每台 20，所以 3 台就是 100 + 3 × 20 = 160。牌型越難，台數越多。',
      },
      {
        kind: 'info',
        title: '誰付錢',
        explain: '胡別人打的牌，只有放槍的人付；自摸則三家都要付。',
      },
      {
        kind: 'info',
        title: '莊家台',
        explain: '只要莊家有參與（莊家胡牌，或莊家放槍、被自摸），那一份就多算「莊家」1 台。莊家每連莊一次，再加 2 台，叫「連一拉一」。',
      },
    ],
  },

  // ─────────────────────────── 進階術語 ───────────────────────────
  {
    id: 'tai-common',
    level: 'advanced',
    title: '常見台型',
    summary: '門清、平胡、獨聽、碰碰胡、一色牌…',
    steps: [
      {
        kind: 'info',
        title: '門清、自摸、門清自摸',
        explain: '沒有吃、碰、明槓就胡叫「門清」（1 台）；有吃碰過但自己摸到叫「自摸」（1 台）；門清又自摸叫「門清自摸」（3 台）。',
      },
      {
        kind: 'info',
        title: '平胡（2 台）',
        explain: '5 組都是順子、沒有字牌也沒有花牌，胡別人打的牌，而且不是只聽一張。',
        tiles: '123m | 456m | 789m | 234p | 67s | 55p',
      },
      {
        kind: 'info',
        title: '獨聽（1 台）',
        explain: '只聽一種牌就胡。常見三種：「邊張」一二萬等三萬、「中洞」一三萬等二萬、「單吊」單張等一對。',
        tiles: '12m | 13m | 1s',
      },
      {
        kind: 'info',
        title: '碰碰胡（4 台）',
        explain: '5 組面子全部都是刻子（或槓）。',
        tiles: '111m | 999p | 555s | 222z | 666z | 33s',
      },
      {
        kind: 'info',
        title: '混一色（4 台）與清一色（8 台）',
        explain: '只有一種花色加上字牌叫「混一色」；整手只有一種花色、沒有字牌叫「清一色」。',
        tiles: '123m 456m 789m 111z 555z 22z | 111m 234m 456m 567m 789m 99m',
      },
      {
        kind: 'info',
        title: '三元牌與風牌',
        explain: '中、發、白的刻子各 1 台（三元刻）。三種湊兩刻一對是「小三元」4 台，三組刻子是「大三元」8 台。自己門風的刻子、本圈風的刻子各 1 台；四種風牌三刻一對是「小四喜」8 台，四刻是「大四喜」16 台。',
        tiles: '555z | 666z | 77z',
      },
      {
        kind: 'info',
        title: '一條龍（16 台）',
        explain: '同一種花色的一到九，湊成 123、456、789 三組順子（吃出來的也算）。台灣麻將原本沒有這個台型，本遊戲採用國際麻將的 16 台。',
        tiles: '123m | 456m | 789m',
      },
      {
        kind: 'info',
        title: '嚦咕嚦咕（8 台）',
        explain: '不吃不碰，7 組對子加上 1 組刻子。',
        tiles: '11m 22m 33p 44p 55s 66s 77z 111z',
      },
      {
        kind: 'info',
        title: '正花與花槓',
        explain: '和自己門風對應的花每張 1 台：東是春、梅，南是夏、蘭，西是秋、竹，北是冬、菊。集齊春夏秋冬或梅蘭竹菊一整套叫「花槓」，2 台。',
        tiles: '15f | 26f | 37f | 48f',
      },
    ],
  },
  {
    id: 'special-win',
    level: 'advanced',
    title: '特殊胡牌',
    summary: '槓上開花、海底撈月、河底撈魚、搶槓、天胡…',
    steps: [
      {
        kind: 'action',
        title: '槓上開花',
        explain: '你剛暗槓了五筒，正從牌尾補一張牌。你在聽一條、四條……',
        hand: '123m 456m 789s 23s 11z',
        melds: ['5555p'],
        event: { type: 'draw', tile: '4s', replacement: true },
        expect: 'tsumo',
        teachesTai: '槓上開花',
        success: '槓後補到的牌剛好胡，叫「槓上開花」，加 1 台。',
        hint: '補到的四條和二三條組成順子，可以自摸。',
      },
      {
        kind: 'action',
        title: '海底撈月',
        explain: '牌牆只剩最後一張可以摸，輪到你。你在聽一條……',
        hand: WAIT_1S,
        event: { type: 'draw', tile: '1s', lastTile: true },
        expect: 'tsumo',
        teachesTai: '海底撈月',
        success: '摸最後一張牌自摸，叫「海底撈月」，加 1 台。',
        hint: '最後一張正好是你要的一條，按「自摸」。',
      },
      {
        kind: 'action',
        title: '河底撈魚',
        explain: '下家摸了最後一張牌後打出一條，這是整局最後一張打出的牌。',
        hand: WAIT_1S,
        event: { type: 'discard', from: 'lower', tile: '1s', lastTile: true },
        expect: 'ron',
        teachesTai: '河底撈魚',
        success: '胡整局最後一張打出的牌，叫「河底撈魚」，加 1 台。最後一張牌只能胡，不能吃碰槓。',
        hint: '這張一條可以胡，按「胡」。',
      },
      {
        kind: 'action',
        title: '搶槓',
        explain: '對家之前碰了五筒，現在摸到第四張要加槓。你正好在聽五筒（四六筒中洞）。',
        hand: '46p 456s 789s 111z 222z 33z',
        event: { type: 'kakan', from: 'opposite', tile: '5p' },
        expect: 'ron',
        teachesTai: '搶槓',
        success: '別人加槓的那張牌，如果你能胡，可以把它搶過來胡，叫「搶槓」，加 1 台。',
        hint: '對家要加槓的五筒正是你要的牌，按「胡」搶槓。',
      },
      {
        kind: 'info',
        title: '天胡、地胡、人胡',
        explain: '莊家拿到 17 張就直接胡叫「天胡」（24 台）；閒家第一次摸牌就自摸叫「地胡」（16 台）；第一巡內胡別人打的牌叫「人胡」（16 台）。地胡、人胡都要在沒有人吃碰槓之前才算。',
      },
      {
        kind: 'info',
        title: '八仙過海、七搶一',
        explain: '一個人集齊 8 張花牌，直接胡，叫「八仙過海」（8 台）。如果你有 7 張花，別人拿到第 8 張，你可以把它搶過來胡，叫「七搶一」（8 台），由那個人付錢。',
        tiles: '12345678f',
      },
    ],
  },
  {
    id: 'terms',
    level: 'advanced',
    title: '牌桌用語',
    summary: '向聽、放槍、相公、安全牌…',
    steps: [
      {
        kind: 'info',
        title: '聽牌與向聽',
        explain: '差一張就能胡叫「聽牌」。差兩張叫「一向聽」，差三張叫「二向聽」，以此類推。打牌時讓向聽數越來越少，就是在往胡牌前進。',
      },
      {
        kind: 'info',
        title: '放槍與防守',
        explain: '打出別人要胡的牌叫「放槍」（也叫放炮），要付錢給他。看到別人可能聽牌時，要改打比較安全的牌，必要時寧可不胡，這叫「棄胡」。',
      },
      {
        kind: 'info',
        title: '安全牌、生張與熟張',
        explain: '台灣麻將沒有「振聽」規則，別人打過的牌他照樣可以胡；不過他剛丟掉的牌，通常不是他在等的牌，所以相對安全。桌上已經出現好幾張的牌叫「熟張」，比較安全；一張都還沒出現的牌叫「生張」，比較危險。',
      },
      {
        kind: 'info',
        title: '相公',
        explain: '手牌張數不對（多一張或少一張）叫「相公」，這一局就不能胡了。本遊戲會自動幫你維持正確張數，不會發生。',
      },
    ],
  },
]
