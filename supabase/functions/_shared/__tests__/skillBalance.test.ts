import { describe, expect, it } from 'vitest'
import { balance } from '../skillBalance'

const list = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p} ${i + 1}`)

describe('balance', () => {
  it('keeps a proposal that is already in range', () => {
    const r = balance({ must: list('M', 5), nice: list('N', 5), extra: list('X', 3) })
    expect([r.must.length, r.nice.length, r.extra.length]).toEqual([5, 5, 3])
  })

  it('moves must-have overflow down to nice-to-have, and nice overflow to extra', () => {
    const r = balance({ must: list('M', 9), nice: list('N', 5), extra: [] })
    expect(r.must).toEqual(list('M', 6))
    expect(r.nice.slice(0, 3)).toEqual(['M 9', 'M 8', 'M 7'].reverse())
    expect(r.nice.length).toBe(6)
    expect(r.extra.length).toBe(2)
  })

  it('caps extra points at 4', () => {
    expect(balance({ must: [], nice: [], extra: list('X', 9) }).extra.length).toBe(4)
  })

  it('drops duplicates across tiers, keeping the higher tier', () => {
    const r = balance({ must: ['Salesforce'], nice: ['salesforce', 'HubSpot'], extra: ['HUBSPOT', 'Apollo'] })
    expect(r).toEqual({ must: ['Salesforce'], nice: ['HubSpot'], extra: ['Apollo'] })
  })

  it('cleans bullets and spacing, and drops empty, overlong or non-text items', () => {
    const r = balance({ must: ['- Cold  calling', '', 42, 'x'.repeat(41), '2) English (C1)'] as unknown[] })
    expect(r.must).toEqual(['Cold calling', 'English (C1)'])
  })

  it('treats a missing or malformed tier as empty', () => {
    expect(balance({ must: 'Salesforce' as unknown })).toEqual({ must: [], nice: [], extra: [] })
  })
})
