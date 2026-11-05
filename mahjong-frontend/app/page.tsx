'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { BrainCircuit, ChevronLeft, CircleHelp, RotateCcw, Sparkles, Trophy, Volume2, X } from 'lucide-react'

type GameTile = { id: string; label: string }
type Discard = { id: string; tile: string; player: string; note: string }
type Meld = { id: string; kind: '吃' | '碰' | '槓'; tiles: GameTile[] }
type SeatId = 'north' | 'west' | 'east'

const FLOWER_TILES = new Set(['春', '夏', '秋', '冬', '梅', '蘭', '竹', '菊'])
const FLOWER_NUMBERS: Record<string, string> = {
  春: '1',
  夏: '2',
  秋: '3',
  冬: '4',
  梅: '1',
  蘭: '2',
  竹: '3',
  菊: '4',
}
const TILE_ID_LOOKUP: Record<string, number> = {
  一萬: 0, 二萬: 1, 三萬: 2, 四萬: 3, 五萬: 4, 六萬: 5, 七萬: 6, 八萬: 7, 九萬: 8,
  一筒: 9, 二筒: 10, 三筒: 11, 四筒: 12, 五筒: 13, 六筒: 14, 七筒: 15, 八筒: 16, 九筒: 17,
  一條: 18, 二條: 19, 三條: 20, 四條: 21, 五條: 22, 六條: 23, 七條: 24, 八條: 25, 九條: 26,
  東風: 27, 南風: 28, 西風: 29, 北風: 30, 紅中: 31, 青發: 32, 發財: 32, 白板: 33,
  春: 34, 夏: 35, 秋: 36, 冬: 37, 梅: 38, 蘭: 39, 竹: 40, 菊: 41,
}
const TILE_LABEL_LOOKUP = Object.fromEntries(Object.entries(TILE_ID_LOOKUP).map(([label, id]) => [id, label])) as Record<number, string>
const NPC_HAND_SIZE = 16
const FALLBACK_NPC_TILES: Record<string, string> = {
  北家: '二萬',
  西家: '三筒',
  東家: '白板',
}

function makeMeld(kind: Meld['kind'], labels: string[], prefix: string): Meld {
  return {
    id: prefix,
    kind,
    tiles: labels.map((label, i) => ({ id: `${prefix}-${i}`, label })),
  }
}

const NPC_SEATS: { id: SeatId; name: string; dot: string; flowers: string[]; melds: Meld[] }[] = [
  {
    id: 'north',
    name: '北家',
    dot: 'dot-slate',
    flowers: ['春', '梅'],
    melds: [makeMeld('碰', ['九筒', '九筒', '九筒'], 'n-pong')],
  },
  {
    id: 'west',
    name: '西家',
    dot: 'dot-amber',
    flowers: ['夏'],
    melds: [makeMeld('吃', ['一萬', '二萬', '三萬'], 'w-chi')],
  },
  {
    id: 'east',
    name: '東家',
    dot: 'dot-coral',
    flowers: ['秋', '蘭'],
    melds: [makeMeld('槓', ['發財', '發財', '發財', '發財'], 'e-kong')],
  },
]
const TURN_ORDER: Array<'north' | 'west' | 'east' | 'south'> = ['north', 'west', 'east', 'south']

const INITIAL_HAND = ['一萬', '二萬', '三萬', '四萬', '五萬', '六萬', '七萬', '八萬', '九萬', '二筒', '三筒', '四筒', '六條', '七條', '八條', '白板', '發財']
const WALL_TILES = ['九筒', '一條', '春', '紅中', '五條', '菊', '三萬', '二萬', '八筒', '九萬', '發財', '四條']
const ACTIONS = [
  { label: '吃', en: 'EAT' },
  { label: '碰', en: 'PONG' },
  { label: '槓', en: 'KONG' },
  { label: '胡', en: 'WIN' },
  { label: '過', en: 'PASS' },
] as const

const INITIAL_NPC_HANDS: Record<SeatId, number[]> = {
  north: [0, 0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 18, 19, 20, 27, 31],
  west: [1, 1, 2, 2, 3, 4, 5, 6, 9, 10, 12, 18, 19, 20, 22, 29],
  east: [3, 3, 4, 4, 5, 6, 7, 8, 13, 14, 15, 21, 22, 23, 31, 33],
}

function removeOneTile(values: number[], target: number) {
  const next = [...values]
  const index = next.indexOf(target)
  if (index < 0) return next
  next.splice(index, 1)
  return next
}

function removeTiles(values: number[], targets: number[]) {
  const next = [...values]
  for (const target of targets) {
    const index = next.indexOf(target)
    if (index >= 0) next.splice(index, 1)
  }
  return next
}

function getRealEatSequence(discardId: number, seatHand: number[]) {
  const suit = Math.floor(discardId / 9)
  const base = suit * 9
  const candidates = [discardId - 1, discardId, discardId + 1].filter((value) => value >= base && value < base + 9)
  if (candidates.length === 3) return candidates

  const existing = Array.from(new Set(seatHand)).filter((tile) => tile >= base && tile < base + 9)
  if (existing.length >= 3) return existing.slice(0, 3)
  return [discardId, discardId, discardId]
}

const drawSpring = { type: 'spring' as const, stiffness: 380, damping: 16 }
const layoutSpring = { type: 'spring' as const, stiffness: 420, damping: 30 }
const discardExit = {
  y: -120,
  scale: 0.8,
  opacity: 0,
  rotate: [0, 360],
  zIndex: 20,
  transition: { duration: 0.55, ease: 'easeInOut' as const },
}

function createHand(labels: string[], prefix: string) {
  return labels.map((label, i) => ({ id: `${prefix}-${i}-${label}`, label }))
}

function tileToId(label: string) {
  return TILE_ID_LOOKUP[label] ?? -1
}

function getTileCounts(labels: string[]) {
  return labels.reduce<Record<string, number>>((counts, label) => {
    counts[label] = (counts[label] ?? 0) + 1
    return counts
  }, {})
}

function isLegalVisibleSet(labels: string[]) {
  return Object.values(getTileCounts(labels)).every((count) => count <= 4)
}

function chooseLegalTile(preferred: string, labels: string[]) {
  const counts = getTileCounts(labels)
  if (!counts[preferred] || counts[preferred] < 4) return preferred

  const fallbackOrder = ['一萬', '二萬', '三萬', '四萬', '五萬', '六萬', '七萬', '八萬', '九萬', '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒', '一條', '二條', '三條', '四條', '五條', '六條', '七條', '八條', '九條', '東風', '南風', '西風', '北風', '紅中', '青發', '白板']
  return fallbackOrder.find((tile) => !counts[tile] || counts[tile] < 4) ?? preferred
}

function Tile({
  label,
  selected,
  onClick,
  faceDown = false,
  compact = false,
  mini = false,
  isDraw = false,
  isMelding = false,
  isFlower = false,
  hoverable = true,
  layoutId,
  onAnimationComplete,
}: {
  label: string
  selected?: boolean
  onClick?: () => void
  faceDown?: boolean
  compact?: boolean
  mini?: boolean
  isDraw?: boolean
  isMelding?: boolean
  isFlower?: boolean
  hoverable?: boolean
  layoutId?: string
  onAnimationComplete?: () => void
}) {
  return (
    <motion.button
      layout={Boolean(layoutId) && !isDraw}
      layoutId={isDraw ? undefined : layoutId}
      type="button"
      onClick={onClick}
      onAnimationComplete={onAnimationComplete}
      aria-label={faceDown ? 'Face down tile' : isFlower && FLOWER_NUMBERS[label] ? `${label} ${FLOWER_NUMBERS[label]}` : label}
      className={`mahjong-tile ${compact ? 'mahjong-tile--compact' : ''} ${mini ? 'mahjong-tile--mini' : ''} ${selected ? 'mahjong-tile--selected' : ''} ${faceDown ? 'mahjong-tile--back' : ''} ${isFlower ? 'mahjong-tile--flower' : ''}`}
      initial={isDraw ? { x: 50, opacity: 0 } : false}
      animate={{ x: 0, opacity: 1, y: selected ? -10 : 0 }}
      exit={isMelding ? undefined : discardExit}
      whileHover={faceDown || !hoverable ? undefined : { y: selected ? -10 : -6 }}
      transition={isDraw ? drawSpring : layoutSpring}
    >
      {!faceDown && (
        <span className="tile-inner">
          {isFlower && FLOWER_NUMBERS[label] && <span className="tile-flower-num">{FLOWER_NUMBERS[label]}</span>}
          <span className="tile-label">{label}</span>
        </span>
      )}
    </motion.button>
  )
}

function OpenSets({ flowers, melds, shareLayout = false }: { flowers: string[] | GameTile[]; melds: Meld[]; shareLayout?: boolean }) {
  if (flowers.length === 0 && melds.length === 0) return null
  return (
    <motion.div className="open-sets" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
      {flowers.length > 0 && (
        <div className="flower-set" title="花牌">
          {flowers.map((flower, i) => {
            const label = typeof flower === 'string' ? flower : flower.label
            const id = typeof flower === 'string' ? `flower-${label}-${i}` : flower.id
            return <Tile key={id} label={label} mini hoverable={false} isFlower />
          })}
        </div>
      )}
      {melds.map((meld) => (
        <motion.div key={meld.id} className="meld-set" title={meld.kind} initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28 }}>
          {meld.tiles.map((tile) => (
            <Tile key={tile.id} layoutId={shareLayout ? tile.id : undefined} label={tile.label} mini hoverable={false} isMelding={shareLayout} />
          ))}
        </motion.div>
      ))}
    </motion.div>
  )
}

function NpcSeat({ seat, melds, handCount }: { seat: (typeof NPC_SEATS)[number]; melds: Meld[]; handCount: number }) {
  const side = seat.id === 'west' || seat.id === 'east'
  const rack = (
    <div className="npc-rack">
      {Array.from({ length: handCount }).map((_, i) => (
        <Tile key={`${seat.id}-${i}`} label="" faceDown mini hoverable={false} />
      ))}
    </div>
  )
  const extras = <OpenSets flowers={seat.flowers} melds={melds} />

  return (
    <div className={`npc-seat npc-seat--${seat.id}`}>
      <div className="npc-meta">
        <span className={`player-dot ${seat.dot}`} />
        {seat.name} <b>{handCount}</b>
      </div>
      {side ? <div className="npc-turn npc-turn--rack">{rack}</div> : rack}
      {side ? <div className="npc-turn npc-turn--open">{extras}</div> : extras}
    </div>
  )
}

export default function Page() {
  const [hand, setHand] = useState<GameTile[]>(() => createHand(INITIAL_HAND, 'h'))
  const [wall, setWall] = useState<string[]>(WALL_TILES)
  const [discards, setDiscards] = useState<Discard[]>([])
  const [melds, setMelds] = useState<Meld[]>([])
  const [flowers, setFlowers] = useState<GameTile[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [selectedDiscard, setSelectedDiscard] = useState<Discard | null>(null)
  const [recommendation, setRecommendation] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [lastDrawnId, setLastDrawnId] = useState<string | null>(null)
  const [callout, setCallout] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [meldingIds, setMeldingIds] = useState<string[]>([])
  const [pendingMeld, setPendingMeld] = useState<{
    kind: '吃' | '碰' | '槓'
    tiles: GameTile[]
    nextHand: GameTile[]
    claimed: Discard
  } | null>(null)
  const [actionResult, setActionResult] = useState<{
    can_eat: boolean
    can_pong: boolean
    can_kong: boolean
    can_hu: boolean
    options: string[]
  } | null>(null)
  const [isCheckingAction, setIsCheckingAction] = useState(false)
  const [isAnalyzingHand, setIsAnalyzingHand] = useState(false)
  const [isAnalyzingDiscard, setIsAnalyzingDiscard] = useState(false)
  const [handCoachText, setHandCoachText] = useState('預選分析：請點擊手牌查看進牌機率...')
  const [discardInsight, setDiscardInsight] = useState<string | null>(null)
  const [coachRecommendation, setCoachRecommendation] = useState<{
    tile: string | null
    waiting_count: number
    waiting_tiles: number[]
    reason: string
  } | null>(null)
  const [turnIndex, setTurnIndex] = useState(0)
  const [npcHandCounts, setNpcHandCounts] = useState<Record<SeatId, number>>({
    north: NPC_HAND_SIZE,
    west: NPC_HAND_SIZE,
    east: NPC_HAND_SIZE,
  })
  const [npcSeatMelds, setNpcSeatMelds] = useState<Record<SeatId, Meld[]>>({
    north: NPC_SEATS[0].melds,
    west: NPC_SEATS[1].melds,
    east: NPC_SEATS[2].melds,
  })
  const [npcSeatHands, setNpcSeatHands] = useState<Record<SeatId, number[]>>(INITIAL_NPC_HANDS)

  const selectedLabel = selected === null ? null : hand[selected]?.label

  const lastDiscard = discards[discards.length - 1] ?? null
  const currentSeat = TURN_ORDER[turnIndex] ?? 'south'
  const isPlayerTurn = currentSeat === 'south'
  const hasActionOptions = Boolean(actionResult && (actionResult.can_eat || actionResult.can_pong || actionResult.can_kong || actionResult.can_hu))

  const wallPreview = useMemo(() => wall.slice(0, 12), [wall])

  useEffect(() => {
    if (!isPlayerTurn) {
      setShowActions(false)
      setActionResult(null)
    }
  }, [isPlayerTurn])

  useEffect(() => {
    if (!callout) return
    const timer = window.setTimeout(() => setCallout(null), 1000)
    return () => window.clearTimeout(timer)
  }, [callout])

  useEffect(() => {
    if (!pendingMeld) return
    setHand(pendingMeld.nextHand)
    setDiscards((current) => current.filter((item) => item.id !== pendingMeld.claimed.id))
    setMelds((current) => [
      ...current,
      {
        id: `meld-${pendingMeld.claimed.id}`,
        kind: pendingMeld.kind,
        tiles: [...pendingMeld.tiles, { id: pendingMeld.claimed.id, label: pendingMeld.claimed.tile }],
      },
    ])
    setSelected(null)
    setSelectedDiscard(null)
    setPendingMeld(null)
    const timer = window.setTimeout(() => setMeldingIds([]), 500)
    return () => window.clearTimeout(timer)
  }, [pendingMeld])

  useEffect(() => {
    const currentSeat = TURN_ORDER[turnIndex]
    if (!currentSeat || currentSeat === 'south') {
      if (currentSeat === 'south') {
        setCallout('輪到你')
      }
      return
    }

    const seat = NPC_SEATS.find((target) => target.id === currentSeat)
    if (!seat) return

    const timer = window.setTimeout(() => {
      void performNpcTurn(seat)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [turnIndex])

  async function performNpcTurn(seat: (typeof NPC_SEATS)[number]) {
    let npcDiscard: Discard | null = null

    const seatHand = npcSeatHands[seat.id] ?? []

    try {
      const response = await fetch('http://localhost:8000/api/npc-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hand: seatHand,
          npc_name: seat.name,
        }),
      })

      if (!response.ok) {
        throw new Error(`npc-decision failed: ${response.status}`)
      }

      const data = await response.json()
      const tileLabel = typeof data.discarded_tile_name === 'string' && data.discarded_tile_name
        ? data.discarded_tile_name
        : typeof data.discarded_tile === 'number' && TILE_LABEL_LOOKUP[data.discarded_tile]
          ? TILE_LABEL_LOOKUP[data.discarded_tile]
          : FALLBACK_NPC_TILES[seat.name] ?? '二萬'

      npcDiscard = {
        id: `npc-${seat.id}-${Date.now()}`,
        tile: tileLabel,
        player: seat.name,
        note: `${seat.name} 依照後端大腦出牌`,
      }

      setDiscardInsight(data.reason || '後端決策中...')
      setCallout(`${seat.name} 出牌`)
    } catch {
      const fallbackTile = FALLBACK_NPC_TILES[seat.name] ?? '二萬'
      npcDiscard = {
        id: `npc-${seat.id}-${Date.now()}`,
        tile: fallbackTile,
        player: seat.name,
        note: `${seat.name} 使用備援牌局策略`,
      }

      setDiscardInsight('後端暫時無回應，使用備援策略進行輪流出牌。')
      setCallout(`${seat.name} 備援出牌`)
    }

    if (!npcDiscard) return

    const currentVisibleLabels = [...hand.map((tile) => tile.label), ...discards.map((discard) => discard.tile), ...melds.flatMap((meld) => meld.tiles.map((tile) => tile.label)), ...flowers.map((flower) => flower.label), npcDiscard.tile]
    const safeTile = isLegalVisibleSet(currentVisibleLabels) ? npcDiscard.tile : chooseLegalTile(npcDiscard.tile, currentVisibleLabels)

    const safeDiscard: Discard = { ...npcDiscard, tile: safeTile }
    const discardedTileId = tileToId(safeTile)

    setNpcSeatHands((current) => ({
      ...current,
      [seat.id]: removeOneTile(current[seat.id] ?? [], discardedTileId),
    }))
    setNpcHandCounts((current) => ({
      ...current,
      [seat.id]: Math.max(0, (current[seat.id] ?? NPC_HAND_SIZE) - 1),
    }))

    setDiscards((current) => [...current, safeDiscard])
    setSelectedDiscard(safeDiscard)
    setTurnIndex((current) => (current + 1) % TURN_ORDER.length)
    void checkActionOnNpcDiscard(safeDiscard)
  }

  async function checkActionOnNpcDiscard(discard: Discard) {
    setActionResult(null)
    setShowActions(false)
    setIsCheckingAction(true)
    try {
      const response = await fetch('http://localhost:8000/api/check-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hand: hand.map((tile) => tileToId(tile.label)),
          incoming_tile: tileToId(discard.tile),
        }),
      })
      if (!response.ok) throw new Error('check-action failed')
      const data = await response.json()
      setActionResult(data)
      const hasRealAction = Boolean(data.can_eat || data.can_pong || data.can_kong || data.can_hu)
      const noActionAvailable = !hasRealAction
      if (!isPlayerTurn) {
        setShowActions(false)
        return
      }
      if (noActionAvailable) {
        setTimeout(() => {
          drawTile()
          setCallout('摸牌')
        }, 500)
      } else {
        setShowActions(true)
        setCallout('可行動')
      }
    } catch {
      setCallout('連線異常')
    } finally {
      setIsCheckingAction(false)
    }
  }

  async function analyzeHandTile(tile: GameTile) {
    setIsAnalyzingHand(true)
    setHandCoachText('AI 分析中...')
    try {
      const response = await fetch('http://localhost:8000/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hand: hand.map((entry) => tileToId(entry.label)),
          selected_tile: tileToId(tile.label),
        }),
      })
      if (!response.ok) throw new Error('analyze-hand failed')
      const data = await response.json()
      setHandCoachText(data.analysis || '這張牌的價值中等，先觀察局勢後再決定。')
    } catch {
      setHandCoachText(`${tile.label} 這張牌可保留，先觀察局勢再做抉擇。`)
    } finally {
      setIsAnalyzingHand(false)
    }
  }

  async function analyzeDiscardTile(discard: Discard) {
    setSelectedDiscard(discard)
    setDiscardInsight('AI 讀牌中...')
    setIsAnalyzingDiscard(true)
    try {
      const response = await fetch('http://localhost:8000/api/analyze-discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clicked_tile: tileToId(discard.tile),
          context: `${discard.player}家打出 ${discard.tile}`,
        }),
      })
      if (!response.ok) throw new Error('analyze-discard failed')
      const data = await response.json()
      setDiscardInsight(data.analysis || '此牌可能是保留型出牌，需觀察後續動向。')
    } catch {
      setDiscardInsight(`${discard.tile}大概率不是主力牌，可能在等待其他花色或保留。`)
    } finally {
      setIsAnalyzingDiscard(false)
    }
  }

  function resetTable() {
    setHand(createHand(INITIAL_HAND, `h${Date.now()}`))
    setWall(WALL_TILES)
    setDiscards([])
    setMelds([])
    setFlowers([])
    setSelected(null)
    setSelectedDiscard(null)
    setRecommendation(false)
    setShowActions(false)
    setLastDrawnId(null)
    setCallout(null)
    setBusy(false)
    setMeldingIds([])
    setPendingMeld(null)
    setActionResult(null)
    setDiscardInsight(null)
    setCoachRecommendation(null)
    setTurnIndex(0)
    setNpcHandCounts({ north: NPC_HAND_SIZE, west: NPC_HAND_SIZE, east: NPC_HAND_SIZE })
    setNpcSeatMelds({ north: NPC_SEATS[0].melds, west: NPC_SEATS[1].melds, east: NPC_SEATS[2].melds })
    setNpcSeatHands(INITIAL_NPC_HANDS)
    setHandCoachText('預選分析：請點擊手牌查看進牌機率...')
    setIsCheckingAction(false)
    setIsAnalyzingHand(false)
    setIsAnalyzingDiscard(false)
  }

  async function autoResolveNpcResponses(discard: Discard) {
    const otherSeats = NPC_SEATS.filter((seat) => seat.name !== discard.player)

    for (const seat of otherSeats) {
      const seatHand = npcSeatHands[seat.id] ?? []
      if (seatHand.length === 0) continue

      try {
        const response = await fetch('http://localhost:8000/api/npc-reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hand: seatHand,
            incoming_tile: tileToId(discard.tile),
          }),
        })
        if (!response.ok) continue

        const data = await response.json()
        const action = data.action
        if (!action) continue

        const actionKey = action as 'eat' | 'pong' | 'kong' | 'hu'
        const actionLabels: Record<'eat' | 'pong' | 'kong' | 'hu', '吃' | '碰' | '槓' | '胡'> = {
          eat: '吃',
          pong: '碰',
          kong: '槓',
          hu: '胡',
        }

        if (actionKey === 'hu') {
          setNpcHandCounts((current) => ({
            ...current,
            [seat.id]: Math.max(0, (current[seat.id] ?? NPC_HAND_SIZE) - 0),
          }))
          setCallout(`${seat.name} 胡牌`)
          continue
        }

        const meldKind: '吃' | '碰' | '槓' = actionKey === 'eat'
          ? '吃'
          : actionKey === 'pong'
            ? '碰'
            : '槓'
        const revealedTileIds = actionKey === 'eat'
          ? getRealEatSequence(tileToId(discard.tile), seatHand)
          : actionKey === 'pong'
            ? [tileToId(discard.tile), tileToId(discard.tile), tileToId(discard.tile)]
            : [tileToId(discard.tile), tileToId(discard.tile), tileToId(discard.tile), tileToId(discard.tile)]

        const labels = revealedTileIds.map((tileId) => TILE_LABEL_LOOKUP[tileId] ?? discard.tile)
        const newMeld = makeMeld(meldKind, labels, `${seat.id}-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`)

        setNpcSeatMelds((current) => ({
          ...current,
          [seat.id]: [...(current[seat.id] ?? []), newMeld],
        }))

        const tilesToRemove = action === 'eat'
          ? getRealEatSequence(tileToId(discard.tile), seatHand)
          : action === 'pong'
            ? [tileToId(discard.tile), tileToId(discard.tile)]
            : action === 'kong'
              ? [tileToId(discard.tile), tileToId(discard.tile), tileToId(discard.tile)]
              : []

        setNpcSeatHands((current) => ({
          ...current,
          [seat.id]: removeTiles(current[seat.id] ?? [], tilesToRemove.concat(tileToId(discard.tile))),
        }))

        setNpcHandCounts((current) => ({
          ...current,
          [seat.id]: Math.max(0, (current[seat.id] ?? NPC_HAND_SIZE) - (action === 'hu' ? 0 : 1)),
        }))
        setCallout(`${seat.name} ${meldKind}牌`)
      } catch {
        continue
      }
    }
  }

  async function notifyNpcDiscard(discard: Discard) {
    setActionResult(null)
    setShowActions(false)

    if (discard.player !== '南') {
      void autoResolveNpcResponses(discard)
      return
    }

    setIsCheckingAction(true)
    try {
      const response = await fetch('http://localhost:8000/api/npc-discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_hand: hand.map((tile) => tileToId(tile.label)),
          discarded_tile: tileToId(discard.tile),
          npc_name: discard.player,
        }),
      })
      if (!response.ok) throw new Error('npc-discard failed')
      const data = await response.json()
      const backendAction = data.action_result ?? data
      setActionResult(backendAction)
      const noActionAvailable = !backendAction.can_eat && !backendAction.can_pong && !backendAction.can_kong && !backendAction.can_hu
      if (noActionAvailable) {
        setTimeout(() => {
          setCallout('摸牌')
        }, 500)
      } else {
        setShowActions(true)
        setCallout('可行動')
      }
    } catch {
      setCallout('連線異常')
    } finally {
      setIsCheckingAction(false)
    }
  }

  async function drawTile() {
    if (!isPlayerTurn || busy || wall.length === 0) return
    const [next, ...rest] = wall
    const tile: GameTile = { id: `draw-${Date.now()}-${next}`, label: next }
    const nextHand = [...hand, tile]
    setWall(rest)

    if (FLOWER_TILES.has(next)) {
      setFlowers((current) => [...current, tile])
      setCallout('花')
      try {
        await fetch('http://localhost:8000/api/player-draw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hand: hand.map((entry) => tileToId(entry.label)),
            drawn_tile: tileToId(next),
          }),
        })
      } catch {
        setCallout('花牌同步異常')
      }
      return
    }

    setLastDrawnId(tile.id)
    setHand(nextHand)
    setSelected(null)

    try {
      const response = await fetch('http://localhost:8000/api/player-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hand: nextHand.map((entry) => tileToId(entry.label)),
          drawn_tile: tileToId(next),
        }),
      })
      if (!response.ok) throw new Error('player-draw failed')
      const data = await response.json()
      const recommended = data.recommended_discard ?? null
      setCoachRecommendation(recommended)
      setRecommendation(true)
      setHandCoachText(data.analysis || '後端已計算最優棄牌。')
      if (recommended && recommended.tile_name) {
        setCallout(`建議棄 ${recommended.tile_name}`)
      }
    } catch {
      setHandCoachText('後端判斷失敗，請稍後再試。')
      setCallout('判斷異常')
    }
  }

  function discardTile(index: number) {
    if (!isPlayerTurn || busy) return
    const tile = hand[index]
    if (!tile) return

    const currentVisibleLabels = [...hand.map((entry) => entry.label), ...discards.map((discard) => discard.tile), ...melds.flatMap((meld) => meld.tiles.map((entry) => entry.label)), ...flowers.map((flower) => flower.label)]
    const legalTile = isLegalVisibleSet([...currentVisibleLabels, tile.label]) ? tile.label : chooseLegalTile(tile.label, currentVisibleLabels)

    setBusy(true)
    setSelected(null)
    setRecommendation(false)
    setLastDrawnId(null)
    setHand((current) => current.filter((item) => item.id !== tile.id))
    window.setTimeout(() => {
      const discard: Discard = { id: `discard-${tile.id}`, tile: legalTile, player: '南', note: '手動切牌' }
      setDiscards((current) => [...current, discard])
      setTurnIndex(0)
      setBusy(false)
    }, 550)
  }

  function takeFromHand(count: number, label?: string) {
    const preferred = label ? hand.filter((tile) => tile.label === label) : []
    const tiles = (preferred.length >= count ? preferred : hand).slice(0, count)
    if (tiles.length < count) return null
    const ids = new Set(tiles.map((tile) => tile.id))
    return {
      tiles,
      nextHand: hand.filter((tile) => !ids.has(tile.id)),
    }
  }

  function moveToMeld(kind: '吃' | '碰' | '槓', count: number) {
    if (!lastDiscard) return
    const taken = takeFromHand(count, lastDiscard.tile)
    if (!taken) return
    const movingIds = taken.tiles.map((tile) => tile.id)
    setMeldingIds(movingIds)
    setPendingMeld({ kind, tiles: taken.tiles, nextHand: taken.nextHand, claimed: lastDiscard })
  }

  function declareAction(action: (typeof ACTIONS)[number]['label']) {
    if (!isPlayerTurn) return
    setShowActions(false)
    if (action === '過') return
    setCallout(action)
    if (action === '碰') moveToMeld('碰', 2)
    if (action === '槓') moveToMeld('槓', 3)
    if (action === '吃') moveToMeld('吃', 2)
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className="mahjong-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Trophy size={17} /></div>
          <div><strong>雀魂研習室</strong><span>AI STRATEGY TABLE</span></div>
        </div>
        <div className="match-status"><span className="live-dot" /> 東四局 <b>・</b> 南家 <b>・</b> 1,500 pts</div>
        <div className="top-actions">
          <button aria-label="Sound"><Volume2 size={17} /></button>
          <button aria-label="Help"><CircleHelp size={17} /></button>
          <div className="avatar">L</div>
        </div>
      </header>

      <div className="workspace">
        <section className="table-section">
          <div className="table-heading">
            <div>
              <p className="eyebrow">MATCH 042 · TRAINING MODE</p>
              <h1>實戰牌局 <span>東四局</span></h1>
            </div>
            <button className="reset-button" onClick={resetTable}><RotateCcw size={14} /> 重新開始</button>
          </div>
          <div className="game-table">
            <NpcSeat seat={NPC_SEATS[0]} melds={npcSeatMelds.north} handCount={npcHandCounts.north} />
            <NpcSeat seat={NPC_SEATS[1]} melds={npcSeatMelds.west} handCount={npcHandCounts.west} />
            <NpcSeat seat={NPC_SEATS[2]} melds={npcSeatMelds.east} handCount={npcHandCounts.east} />

            <div className="discard-sea">
              <div className="discards">
                {discards.map((discard) => (
                  <Tile key={discard.id} label={discard.tile} compact onClick={() => analyzeDiscardTile(discard)} />
                ))}
              </div>
            </div>

            {selectedDiscard && (
              <div className="discard-info">
                <strong>{selectedDiscard.player}家</strong> 打出了【{selectedDiscard.tile}】
                <span>{selectedDiscard.note}</span>
                {discardInsight && <span className="discard-ai">{isAnalyzingDiscard ? 'AI 讀牌中...' : discardInsight}</span>}
              </div>
            )}

            <AnimatePresence>
              {showActions && isPlayerTurn && hasActionOptions && (
                <motion.div className="action-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="action-title">選擇你的行動</div>
                  <div className="action-row">
                    {ACTIONS.filter((action) => {
                      if (action.label === '吃') return actionResult?.can_eat
                      if (action.label === '碰') return actionResult?.can_pong
                      if (action.label === '槓') return actionResult?.can_kong
                      if (action.label === '胡') return actionResult?.can_hu
                      return true
                    }).map((action, i) => (
                      <motion.button
                        key={action.label}
                        type="button"
                        className={`action-button action-${i}`}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => declareAction(action.label)}
                      >
                        {action.label}<small>{action.en}</small>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {callout && (
                <motion.div
                  key={callout}
                  className="action-callout"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.5, 1], opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.45, times: [0, 0.55, 1], ease: 'easeOut' }}
                >
                  {callout}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="player-hand">
              <div className="hand-meta">
                <span><span className="player-dot dot-mint" />你 · 南家</span>
                <span>{hand.length} 張手牌</span>
              </div>
              <div className="player-hand-body">
                <motion.div className="hand-tiles" layout>
                  <AnimatePresence mode="popLayout">
                    {hand.map((tile, i) => (
                      <Tile
                        key={tile.id}
                        layoutId={tile.id}
                        label={tile.label}
                        selected={selected === i}
                        isDraw={tile.id === lastDrawnId}
                        isMelding={meldingIds.includes(tile.id)}
                        onAnimationComplete={() => {
                          if (tile.id === lastDrawnId) setLastDrawnId(null)
                        }}
                        onClick={() => {
                          setRecommendation(false)
                          if (selected === i) {
                            discardTile(i)
                            return
                          }
                          setSelected(i)
                          void analyzeHandTile(tile)
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
                {(melds.length > 0 || flowers.length > 0) && (
                  <div className="player-melds" aria-label="副露與花牌">
                    <OpenSets flowers={flowers} melds={melds} shareLayout />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="table-footer">
            <span><span className="pulse" /> AI 即時同步中</span>
            <div className="table-footer-actions">
              <button type="button" onClick={drawTile} disabled={wall.length === 0 || busy || isCheckingAction}>
                <span className="draw-icon">🀫</span> 摸牌 {wallPreview.length > 0 ? `(剩 ${wall.length})` : ''}
              </button>
              <button
                type="button"
                disabled={!isPlayerTurn || !hasActionOptions}
                onClick={() => {
                  if (!isPlayerTurn || !hasActionOptions) return
                  setShowActions((current) => !current)
                }}
              >
                {showActions ? <X size={14} /> : <Sparkles size={14} />} {showActions ? '關閉動作預覽' : '預覽可用動作'}
              </button>
            </div>
          </div>
        </section>

        <aside className="coach-panel">
          <div className="coach-header">
            <div className="coach-icon"><BrainCircuit size={23} /></div>
            <div>
              <p className="eyebrow">POWERED BY AI</p>
              <h2>AI 麻將教練</h2>
            </div>
            <span className="online-label">ONLINE</span>
          </div>
          <div className="coach-scroll">
            <section className="coach-section">
              <div className="section-title"><span className="step-number">01</span><span>即時分析</span><span className="section-line" /></div>
              <div className="analysis-card">
                <div className="analysis-pulse" />
                <p>{isAnalyzingHand ? 'AI 分析中...' : selectedLabel == null ? handCoachText : `已選擇【${selectedLabel}】。${handCoachText}`}</p>
                <div className="analysis-bars"><span /><span /><span /><span /><span /></div>
                <small>{actionResult ? `動作可行：${actionResult.options.join(', ') || '無'}` : '等待你的下一步操作'}</small>
              </div>
            </section>
            <section className="coach-section">
              <div className="section-title"><span className="step-number">02</span><span>教練決策</span><span className="section-line" /></div>
              <button className="answer-button" onClick={() => setRecommendation(true)}>
                <Sparkles size={18} /><span>獲取最佳解答</span><ChevronLeft size={16} className="answer-arrow" />
              </button>
              <p className="hint-text">分析牌局並提供勝率最高的建議</p>
            </section>
            {recommendation && coachRecommendation && (
              <section className="recommendation">
                <div className="recommendation-top">
                  <span className="recommendation-icon"><Sparkles size={14} /></span>
                  <span>教練推薦</span>
                  <span className="confidence">信心度 {Math.min(99, 76 + (coachRecommendation.waiting_count ?? 0) * 2)}%</span>
                </div>
                <p>打出 <strong>【{coachRecommendation.tile ?? '未知牌'}】</strong></p>
                <div className="recommendation-detail">
                  <b>{coachRecommendation.waiting_tiles.length > 0 ? `可聽 ${coachRecommendation.waiting_tiles.slice(0, 4).join('、')}${coachRecommendation.waiting_tiles.length > 4 ? ' 等' : ''}` : '無明顯進張'}</b>
                  <span>共 {coachRecommendation.waiting_count ?? 0} 張</span>
                </div>
                <div className="progress"><span /></div>
                <p className="reason">{coachRecommendation.reason || '後端計算出的最佳棄牌建議。'}</p>
              </section>
            )}
          </div>
          <div className="coach-footer"><span className="shield">◈</span> AI 建議僅供參考，祝你胡牌順利</div>
        </aside>
      </div>
    </main>
    </MotionConfig>
  )
}
