/**
 * 可指定種子的亂數產生器（mulberry32）。
 * 同一個種子會產生同一副牌，方便重播對局、復盤與測試。
 */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/**
 * 真正隨機的骰子（擲骰定莊用）：用瀏覽器的密碼學亂數，並排除取餘數造成的偏差。
 * 和種子無關，每次擲都獨立。
 */
export function rollDie(): number {
  const c = globalThis.crypto
  if (!c?.getRandomValues) return 1 + Math.floor(Math.random() * 6)
  const buf = new Uint8Array(1)
  // 252 = 6 × 42：大於等於 252 的值丟掉重抽，讓 1–6 機率完全相同
  do c.getRandomValues(buf)
  while (buf[0] >= 252)
  return 1 + (buf[0] % 6)
}

/** Fisher–Yates 洗牌（原地修改並回傳同一陣列）。 */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
