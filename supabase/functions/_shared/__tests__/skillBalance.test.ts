import { describe, expect, it } from 'vitest'
import { balance, notASkill, yearsRange } from '../skillBalance'

const list = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p} ${i + 1}`)

describe('balance', () => {
  it('keeps a proposal that is already in range', () => {
    const r = balance({ must: list('M', 4), nice: list('N', 5), extra: list('X', 3) })
    expect([r.must.length, r.nice.length, r.extra.length]).toEqual([4, 5, 3])
  })

  it('moves must-have overflow down to nice-to-have, and nice overflow to extra', () => {
    const r = balance({ must: list('M', 8), nice: list('N', 5), extra: [] })
    expect(r.must).toEqual(list('M', 5))
    expect(r.nice.slice(0, 3)).toEqual(['M 6', 'M 7', 'M 8'])
    expect(r.nice.length).toBe(6)
    expect(r.extra.length).toBe(2)
  })

  it('caps extra points at 4', () => {
    expect(balance({ must: [], nice: [], extra: list('X', 9) }).extra.length).toBe(4)
  })

  it('drops duplicates across tiers, keeping the higher tier', () => {
    const r = balance({ must: ['Salesforce'], nice: ['salesforce', 'HubSpot'], extra: ['HUBSPOT', 'Apollo'] })
    expect(r).toEqual({ must: ['Salesforce'], nice: ['HubSpot'], extra: ['Apollo'], leftOut: [] })
  })

  it('cleans bullets and spacing, and drops empty, overlong or non-text items', () => {
    const r = balance({ must: ['- Cold  calling', '', 42, 'x'.repeat(41), '2) English (C1)'] as unknown[] })
    expect(r.must).toEqual(['Cold calling', 'English (C1)'])
  })

  it('treats a missing or malformed tier as empty', () => {
    expect(balance({ must: 'Salesforce' as unknown })).toEqual({ must: [], nice: [], extra: [], leftOut: [] })
  })

  it('sets traits, places, years and contract types aside, with what the model left out', () => {
    const r = balance({
      must: ['Higher Education or L&D', 'Toronto based', 'Independent remote work', 'Client Onboarding'],
      nice: ['Account Management', 'Communication skills', '7-10 years experience'],
      extra: ['Team leadership ambition', 'Learning Analytics'],
      left_out: ['Charisma with academics', 'toronto based'],
    })
    expect(r.must).toEqual(['Higher Education or L&D', 'Client Onboarding'])
    expect(r.nice).toEqual(['Account Management'])
    expect(r.extra).toEqual(['Learning Analytics'])
    expect(r.leftOut).toEqual([
      'Toronto based', 'Independent remote work', 'Communication skills', '7-10 years experience',
      'Team leadership ambition', 'Charisma with academics',
    ])
  })
})

describe('notASkill', () => {
  it('keeps work the role does, its domain and tools', () => {
    for (const s of ['Account-based Marketing', 'Team Leadership', 'High Availability', 'Contract Negotiation',
      'Evidence-based Practice', 'Client Onboarding', 'Renewals', 'Canvas or Moodle', 'Faculty Development']) {
      expect(notASkill(s), s).toBe(false)
    }
  })
  it('catches traits, places, years and contract types', () => {
    for (const s of ['Charisma', 'Self-starter', 'Proactive', 'Leadership skills', 'Based in Toronto',
      'Toronto based', 'Willing to relocate', '5+ years', '7–10 years', 'Freelance contractor', 'Work independently']) {
      expect(notASkill(s), s).toBe(true)
    }
  })
})

describe('yearsRange', () => {
  it('reads whole years and orders them', () => {
    expect(yearsRange(7, 10)).toEqual({ min: 7, max: 10 })
    expect(yearsRange('10', 7)).toEqual({ min: 7, max: 10 })
    expect(yearsRange(3, null)).toEqual({ min: 3, max: null })
  })
  it('is null when nothing usable is given', () => {
    expect(yearsRange(null, undefined)).toBeNull()
    expect(yearsRange(-1, 'ten')).toBeNull()
    expect(yearsRange(2.5, 99)).toBeNull()
  })
})
