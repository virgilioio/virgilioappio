import { describe, it, expect } from 'vitest'
import { fetchAll, fetchAllIn } from '../fetchAllRows'

const fakeTable = (n: number) => () => {
  let r: [number, number] = [0, 0]
  const q: any = {
    order: () => q,
    range: (a: number, b: number) => { r = [a, b]; return q },
    then: (res: any) => res({ data: Array.from({ length: Math.max(0, Math.min(n, r[1] + 1) - r[0]) }, (_, i) => ({ id: r[0] + i })), error: null }),
  }
  return q
}

describe('fetchAll', () => {
  it('returns more than 1,000 rows across pages', async () => {
    expect((await fetchAll(fakeTable(2450))).length).toBe(2450)
  })
  it('handles exactly one page', async () => {
    expect((await fetchAll(fakeTable(1000))).length).toBe(1000)
  })
  it('merges chunks of ids', async () => {
    const ids = Array.from({ length: 400 }, (_, i) => String(i))
    expect((await fetchAllIn(ids, 'job_id', () => fakeTable(10)())).length).toBe(30)
  })
})
