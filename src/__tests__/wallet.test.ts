import { beforeEach, describe, expect, it } from 'vitest'
import { STARTING_BALANCE, chargeExitFee, exitFeeOf, loadWallet, recordHand, stakeOf } from '../wallet'

beforeEach(() => {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

describe('籌碼', () => {
  it('一開始有 10000，每局記一筆變化', () => {
    expect(loadWallet().balance).toBe(STARTING_BALANCE)
    recordHand(1, stakeOf('s100'), 0, 0, -300)
    recordHand(1, stakeOf('s100'), 0, 0, -300) // 同一局不重複記
    recordHand(1, stakeOf('s100'), 0, 1, 500)
    const w = loadWallet()
    expect(w.balance).toBe(STARTING_BALANCE + 200)
    expect(w.history!.map((p) => p.balance)).toEqual([10000, 9700, 10200])
  })

  it('輸光後自動補充 10000，並記下補充次數', () => {
    const r = recordHand(1, stakeOf('s300'), 0, 0, -12000)
    expect(r.refilled).toBe(true)
    const w = loadWallet()
    expect(w.balance).toBe(STARTING_BALANCE)
    expect(w.refills).toBe(1)
    expect(w.history!.at(-1)).toMatchObject({ balance: STARTING_BALANCE, refill: true })
    expect(w.history!.at(-2)!.balance).toBe(-2000)
  })

  it('免費入場不計入籌碼', () => {
    recordHand(1, stakeOf('free'), 0, 0, -500)
    expect(loadWallet().balance).toBe(STARTING_BALANCE)
  })

  it('自行設定的金額', () => {
    const st = stakeOf('custom', { base: 40, perTai: 15 })
    expect(st).toMatchObject({ base: 40, perTai: 15, name: '40 / 15', free: false })
  })

  it('中途離開扣入場費（一個底），免費入場不扣', () => {
    const st = stakeOf('s100')
    expect(exitFeeOf(st)).toBe(100)
    expect(exitFeeOf(stakeOf('free'))).toBe(0)
    recordHand(7, st, 0, 0, 0)
    chargeExitFee(7, st, exitFeeOf(st))
    const w = loadWallet()
    expect(w.balance).toBe(STARTING_BALANCE - 100)
    expect(w.records[0].delta).toBe(-100)
    expect(w.history!.at(-1)).toMatchObject({ balance: STARTING_BALANCE - 100, fee: true })
  })
})
