import { describe, expect, it } from 'vitest'

import { formatKind, formatSample, numWords, offerCategory } from '@/lib/sign/formats'
import { draftCoverage, fieldUses, type OfferFormTag, type TplField } from '@/lib/sign/templates'

const tag = (key: string, type: string, label = key): OfferFormTag => ({ key, label, type, required: true })
const data = (key: string): TplField => ({ id: key + Math.random(), type: 'data', rid: null, page: 0, x: 0, y: 0, w: 10, h: 3, required: true, data_key: key, font_size: null })

describe('value formats (mirror sign_format)', () => {
  it('writes numbers in words like sign_num_words', () => {
    expect(numWords(1234567)).toBe('one million two hundred thirty-four thousand five hundred sixty-seven')
    expect(numWords(480000)).toBe('four hundred eighty thousand')
    expect(numWords(12)).toBe('twelve')
  })
  it('samples each money format with the field’s currency and period', () => {
    const cfg = { currency: 'MXN', period: 'annually' }
    expect(formatSample('money', null, cfg)).toBe('MXN 480,000')
    expect(formatSample('money', 'money_code', cfg)).toBe('MXN 480,000 / yearly')
    expect(formatSample('money', 'money_symbol', cfg)).toBe('$480,000 MXN per year')
    expect(formatSample('money', 'money_words', { currency: 'MXN', period: 'monthly' })).toBe('four hundred eighty thousand Mexican pesos (MXN 480,000) per month')
  })
  it('samples dates three ways', () => {
    expect(formatSample('date', null)).toBe('October 26, 2026')
    expect(formatSample('date', 'date_numeric')).toBe('26/10/2026')
    expect(formatSample('date', 'date_dmy')).toBe('26 October 2026')
  })
  it('knows which values take formats', () => {
    expect(formatKind('base_salary', 'salary')).toBe('money')
    expect(formatKind('salary', null)).toBe('money')
    expect(formatKind('today', null)).toBe('date')
    expect(formatKind('job_title', 'text')).toBeNull()
  })
})

describe('offer field categories', () => {
  it('groups by type and name', () => {
    expect(offerCategory(tag('base_salary', 'salary'))).toBe('Compensation')
    expect(offerCategory(tag('start_date', 'date'))).toBe('Dates')
    expect(offerCategory(tag('candidate_s_location', 'location'))).toBe('Candidate')
    expect(offerCategory(tag('full_legal_name', 'text', 'Full Legal Name'))).toBe('Candidate')
    expect(offerCategory(tag('job_title', 'text', 'Job Title'))).toBe('Job')
    expect(offerCategory(tag('work_location', 'work_location'))).toBe('Job')
    expect(offerCategory(tag('probation_period', 'text', 'Probation period'))).toBe('Terms')
  })
})

describe('draft coverage (§7)', () => {
  const form = [tag('base_salary', 'salary'), tag('start_date', 'date'), tag('job_title', 'text'), tag('notes', 'text')]
  it('counts mapped, missing, skipped and blocking; signer fields never count', () => {
    const fields = [data('base_salary'), data('base_salary'), data('bonus'), data('today'), { ...data('x'), type: 'signature' as const, data_key: null, rid: 'r' }]
    const written = [{ id: 'w', name: 'Offer', position: 0, content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'placeholder', placeholderKey: 'job_title' }] }] } } }]
    const c = draftCoverage({ fields, written: written as never, not_needed: ['notes'] }, form)
    expect(c.mapped.map((t) => t.key)).toEqual(['base_salary', 'job_title'])
    expect(c.missing.map((t) => t.key)).toEqual(['start_date'])
    expect(c.skipped.map((t) => t.key)).toEqual(['notes'])
    expect(c.blocking).toEqual(['bonus'])
    expect(c.total).toBe(3)
    expect(fieldUses({ fields, written: written as never }).get('base_salary')).toBe(2)
  })
})
