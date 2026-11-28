import { describe, expect, it } from 'vitest'
import { needsPayNote } from '../payNote'

describe('pay reminder in the post editor (2026-11-28)', () => {
  it('reminds when a post reaches the US or Canada without showing pay', () => {
    expect(needsPayNote(['US'], false)).toBe(true)
    expect(needsPayNote(['GB', 'CA'], false)).toBe(true)
  })
  it('stays quiet when pay shows, elsewhere, or when the editor does not say', () => {
    expect(needsPayNote(['US'], true)).toBe(false)
    expect(needsPayNote(['CO', 'GB', 'MX'], false)).toBe(false)
    expect(needsPayNote(['US'], undefined)).toBe(false)
  })
})
