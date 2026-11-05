import { describe, expect, it } from 'vitest'
import { PAGE, pages } from '../pages'

/** A fake paged RPC over `n` ordered rows, counting calls and how many ran at once. */
function source(n: number) {
  const rows = Array.from({ length: n }, (_, i) => i)
  const stats = { calls: 0, running: 0, most: 0 }
  const fetchPage = async (from: number, to: number) => {
    stats.calls += 1
    stats.running += 1
    stats.most = Math.max(stats.most, stats.running)
    await new Promise((r) => setTimeout(r, 1))
    stats.running -= 1
    return { data: rows.slice(from, to + 1), error: null }
  }
  return { rows, stats, fetchPage }
}

describe('pages', () => {
  it('returns every row once, in order', async () => {
    for (const n of [0, 1, PAGE - 1, PAGE, PAGE + 1, 2 * PAGE, 36_400, 7 * PAGE]) {
      const s = source(n)
      expect(await pages(s.fetchPage)).toEqual(s.rows)
    }
  })

  it('asks once for a short list and fetches the rest in parallel', async () => {
    const small = source(300)
    await pages(small.fetchPage)
    expect(small.stats.calls).toBe(1)
    const big = source(36_400)
    await pages(big.fetchPage)
    expect(big.stats.most).toBe(6)
    expect(big.stats.calls).toBeLessThanOrEqual(1 + 6 * 7)
  })

  it('throws when a page fails', async () => {
    const fail = async (from: number) => ({ data: from === PAGE * 3 ? null : Array(PAGE).fill(0), error: from === PAGE * 3 ? new Error('boom') : null })
    await expect(pages(fail)).rejects.toThrow('boom')
  })
})
