import { beforeEach, describe, expect, it } from 'vitest'
import { EFFECTS, buyEffect, equipEffect, getCosmetics, resetCosmeticsCache } from '../cosmetics'
import { STARTING_BALANCE, loadWallet, netChips, recordHand, spendChips, stakeOf } from '../wallet'

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
  resetCosmeticsCache()
})

const priceOf = (id: string) => EFFECTS.find((e) => e.id === id)!.price

describe('商店', () => {
  it('一開始只有金光特效，牌桌是綠色', () => {
    expect(getCosmetics()).toEqual({ owned: ['gold'], effect: 'gold', table: 'green' })
  })

  it('買特效：扣籌碼、記在籌碼變化裡、直接裝備', () => {
    expect(buyEffect('fire')).toEqual({ ok: true })
    const w = loadWallet()
    expect(w.balance).toBe(STARTING_BALANCE - priceOf('fire'))
    expect(w.spent).toBe(priceOf('fire'))
    expect(w.history!.at(-1)).toMatchObject({ purchase: '特效「烈焰」' })
    expect(getCosmetics().owned).toContain('fire')
    expect(getCosmetics().effect).toBe('fire')
  })

  it('同一個不能買兩次；買過的可以隨時切換', () => {
    buyEffect('fire')
    expect(buyEffect('fire').ok).toBe(false)
    equipEffect('gold')
    expect(getCosmetics().effect).toBe('gold')
    // 沒買過的不能裝備
    equipEffect('rainbow')
    expect(getCosmetics().effect).toBe('gold')
  })

  it('籌碼不夠就不能買，也不會扣錢', () => {
    recordHand(1, stakeOf('s50'), 0, 0, -(STARTING_BALANCE - 500)) // 剩 500
    const r = buyEffect('fire') // 1000
    expect(r.ok).toBe(false)
    expect(loadWallet().balance).toBe(500)
    expect(getCosmetics().owned).toEqual(['gold'])
  })

  it('買完至少要剩 1 籌碼：不能靠花光籌碼領自動補充', () => {
    recordHand(1, stakeOf('s50'), 0, 0, -(STARTING_BALANCE - 1000)) // 剩剛好 1000
    expect(spendChips(1000, '測試').ok).toBe(false)
    expect(spendChips(999, '測試').ok).toBe(true)
    expect(loadWallet().balance).toBe(1)
    expect(loadWallet().refills).toBe(0)
  })

  it('在商店花的錢不算輸：實際累計輸贏不變', () => {
    recordHand(1, stakeOf('s50'), 0, 0, 300)
    expect(netChips(loadWallet())).toBe(300)
    buyEffect('jade')
    expect(netChips(loadWallet())).toBe(300)
  })
})
