import { describe, expect, it } from 'vitest'
import { finishSlug, isSlugTaken, typedSlug } from '../postingUrl'

describe('posting slugs', () => {
  it('cleans what is typed', () => {
    expect(typedSlug('Senior Diseñador UX')).toBe('senior-disenador-ux')
    expect(typedSlug('Sales/Ops  Lead_MX!')).toBe('salesops-lead-mx')
    expect(typedSlug('--lead')).toBe('lead')
  })

  it('keeps a trailing hyphen while typing, drops it when saved', () => {
    expect(typedSlug('account-')).toBe('account-')
    expect(finishSlug('account- ')).toBe('account')
    expect(finishSlug('  ')).toBe('')
  })

  it('knows a taken slug from other failures', () => {
    expect(isSlugTaken({ code: '23505', message: 'duplicate key value violates unique constraint "job_postings_slug_key"' })).toBe(true)
    expect(isSlugTaken({ code: '23505', message: 'duplicate key value violates unique constraint "other_key"' })).toBe(false)
    expect(isSlugTaken({ code: '42501', message: 'slug' })).toBe(false)
    expect(isSlugTaken(null)).toBe(false)
  })
})
