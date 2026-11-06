import { useState } from 'react'
import { parseTiles, type Tile as TileId } from '../engine'
import {
  ACTION_NAMES,
  LEVEL_NAMES,
  SEAT_NAMES,
  lessonsFor,
  type ActionStep,
  type Lesson,
  type LessonLevel,
  type TutorialAction,
} from '../tutorial'
import { getVariant, type VariantId } from '../variants'
import { DecorMenu } from './DecorMenu'
import { Tile } from './Tile'
import './table.css'

const LEVELS: LessonLevel[] = ['intro', 'basic', 'advanced']
const STORAGE_KEY = 'mahjong.tutorial.done'

function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveDone(done: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]))
  } catch {
    // 無法儲存就算了，只是不會記住進度
  }
}

export function TutorialScreen({ variant, onExit }: { variant: VariantId; onExit: () => void }) {
  const lessons = lessonsFor(variant)
  const [done, setDone] = useState(loadDone)
  const [current, setCurrent] = useState<number | null>(null)

  const finish = (lesson: Lesson) => {
    const next = new Set(done).add(`${variant}:${lesson.id}`)
    setDone(next)
    saveDone(next)
  }

  if (current !== null) {
    const lesson = lessons[current]
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        hasNext={current + 1 < lessons.length}
        onFinish={() => finish(lesson)}
        onNext={() => setCurrent(current + 1)}
        onBack={() => setCurrent(null)}
      />
    )
  }

  const v = getVariant(variant)
  return (
    <main className="setup">
      <header className="setup-header">
        <div className="header-tools">
          <DecorMenu />
        </div>
        <h1>{v.name}教學</h1>
        <p>從入門開始，一步一步學會打牌。完成的課程會打勾。</p>
      </header>
      {lessons.length === 0 && <p className="section-note">這個玩法的教學還在準備中。</p>}
      {LEVELS.map((level) => {
        const group = lessons.map((l, i) => ({ l, i })).filter(({ l }) => l.level === level)
        if (group.length === 0) return null
        return (
          <section key={level} aria-labelledby={`level-${level}`}>
            <h2 id={`level-${level}`}>{LEVEL_NAMES[level]}</h2>
            <div className="option-grid difficulties">
              {group.map(({ l, i }) => {
                const isDone = done.has(`${variant}:${l.id}`)
                return (
                  <button key={l.id} type="button" className="option-card" onClick={() => setCurrent(i)}>
                    <span className="option-title">
                      {l.title}
                      {isDone && <span className="badge done">✓ 完成</span>}
                    </span>
                    <span className="option-desc">
                      {l.summary}（{l.steps.length} 步）
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      <div className="setup-actions">
        <button type="button" onClick={onExit}>
          返回
        </button>
      </div>
    </main>
  )
}

// ─────────────────────────── 單一課程 ───────────────────────────

interface Feedback {
  ok: boolean
  text: string
}

function LessonPlayer({
  lesson,
  hasNext,
  onFinish,
  onNext,
  onBack,
}: {
  lesson: Lesson
  hasNext: boolean
  onFinish: () => void
  onNext: () => void
  onBack: () => void
}) {
  const [stepIdx, setStepIdx] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const finished = stepIdx >= lesson.steps.length

  const advance = () => {
    setFeedback(null)
    if (stepIdx + 1 >= lesson.steps.length) onFinish()
    setStepIdx(stepIdx + 1)
  }

  if (finished) {
    return (
      <main className="setup">
        <header className="setup-header">
          <h1>完成「{lesson.title}」！</h1>
          <p>你已經學會：{lesson.summary}。</p>
        </header>
        <div className="setup-actions">
          <button type="button" onClick={onBack}>
            回到課程列表
          </button>
          {hasNext && (
            <button type="button" className="primary" onClick={onNext}>
              下一課
            </button>
          )}
        </div>
      </main>
    )
  }

  const step = lesson.steps[stepIdx]
  return (
    <main className="setup tutorial">
      <header className="tutorial-header">
        <button type="button" className="text-button" onClick={onBack}>
          ← 課程列表
        </button>
        <span className="tutorial-progress">
          {lesson.title} · 第 {stepIdx + 1} / {lesson.steps.length} 步
        </span>
        <DecorMenu />
      </header>

      <h1 className="tutorial-title">{step.title}</h1>
      <p className="tutorial-explain">{step.explain}</p>

      {step.kind === 'info' ? (
        <>
          {step.tiles && (
            <div className="tutorial-board">
              {step.tiles.split('|').map((group, i) => (
                <span className="meld" key={i}>
                  {parseTiles(group).map((t, k) => (
                    <Tile key={k} tile={t} size="md" />
                  ))}
                </span>
              ))}
            </div>
          )}
          <div className="setup-actions">
            <button type="button" className="primary" onClick={advance}>
              下一步
            </button>
          </div>
        </>
      ) : (
        <ActionStepView
          key={stepIdx}
          step={step}
          feedback={feedback}
          onAnswer={(fb) => setFeedback(fb)}
          onNext={advance}
        />
      )}
    </main>
  )
}

function eventText(step: ActionStep): string {
  const ev = step.event
  if (ev.type === 'discard') return `${SEAT_NAMES[ev.from]}打出${ev.lastTile ? '（整局最後一張）' : ''}`
  if (ev.type === 'kakan') return `${SEAT_NAMES[ev.from]}要加槓`
  if (ev.replacement) return '你從牌尾補到'
  if (ev.lastTile) return '你摸到最後一張'
  return '你摸到'
}

function ActionStepView({
  step,
  feedback,
  onAnswer,
  onNext,
}: {
  step: ActionStep
  feedback: Feedback | null
  onAnswer: (fb: Feedback) => void
  onNext: () => void
}) {
  const hand = parseTiles(step.hand)
  const melds = (step.melds ?? []).map(parseTiles)
  const eventTile = parseTiles(step.event.tile)[0]
  const isDraw = step.event.type === 'draw'
  const solved = feedback?.ok === true

  const buttons: TutorialAction[] =
    step.event.type === 'draw'
      ? ['tsumo', 'ankan', 'kakan', 'flower']
      : step.event.type === 'kakan'
        ? ['ron', 'pass']
        : ['ron', 'pung', 'kong', 'chow', 'pass']

  const answer = (action: TutorialAction, tile?: TileId) => {
    if (solved) return
    const ok = action === step.expect && (action !== 'discard' || tile === parseTiles(step.discard!)[0])
    onAnswer({ ok, text: ok ? step.success : step.hint })
  }

  return (
    <>
      <div className="tutorial-board">
        <div className="tutorial-event">
          <span>{eventText(step)}</span>
          <Tile tile={eventTile} size="md" highlight />
        </div>
        {melds.length > 0 && (
          <div className="melds">
            {melds.map((m, i) => (
              <span className="meld" key={i}>
                {m.map((t, k) => (
                  <Tile key={k} tile={t} size="sm" />
                ))}
              </span>
            ))}
          </div>
        )}
        <div className="my-hand">
          {hand.map((t, i) => (
            <Tile key={i} tile={t} size="lg" onClick={isDraw && !solved ? () => answer('discard', t) : undefined} />
          ))}
          {isDraw && (
            <span className="drawn-slot">
              <Tile tile={eventTile} size="lg" onClick={!solved ? () => answer('discard', eventTile) : undefined} />
            </span>
          )}
        </div>
        {!solved && (
          <div className="action-bar">
            {buttons.map((a) => (
              <button key={a} type="button" className={a === 'ron' || a === 'tsumo' ? 'action win' : 'action'} onClick={() => answer(a)}>
                {ACTION_NAMES[a]}
              </button>
            ))}
          </div>
        )}
        {isDraw && !solved && <p className="tutorial-tip">也可以點一張牌直接打出去。</p>}
      </div>

      {feedback && (
        <div className={`tutorial-feedback ${feedback.ok ? 'ok' : 'no'}`} role="status">
          <strong>{feedback.ok ? '答對了！' : '再想想看'}</strong> {feedback.text}
        </div>
      )}

      {solved && (
        <div className="setup-actions">
          <button type="button" className="primary" onClick={onNext} autoFocus>
            下一步
          </button>
        </div>
      )}
    </>
  )
}
