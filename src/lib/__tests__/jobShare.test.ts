import { describe, expect, it } from 'vitest'
import { countSources, shareIntent, shareLink } from '../jobShare'
import { wrapLines } from '../shareCard'
import { cleanPost, fillLink, plainDescription, postingFacts, sharePostsPrompt } from '../../../supabase/functions/_shared/sharePosts'

const url = 'https://app.gogio.io/careers/acme/head-of-sales-x1'

describe('share links', () => {
  it('tags the channel and who shared it', () => {
    expect(shareLink(url, 'linkedin', '3ab94f45')).toBe(`${url}?src=linkedin&by=3ab94f45`)
    expect(shareLink(url, 'whatsapp', 'client')).toBe(`${url}?src=whatsapp&by=client`)
    expect(shareLink(`${url}?old=1`, 'anywhere', null)).toBe(url)
  })

  it('opens each site\'s own share page', () => {
    expect(shareIntent('whatsapp', 'L', 'Hi L', 'T')).toBe('https://wa.me/?text=Hi%20L')
    expect(shareIntent('linkedin', 'https://a.b/c', '', 'T')).toBe('https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fa.b%2Fc')
    expect(shareIntent('email', 'L', 'Body', 'Title')).toBe('mailto:?subject=Title&body=Body')
    expect(shareIntent('anywhere', 'L', '', 'T')).toBeNull()
  })
})

describe('countSources', () => {
  it('counts by channel, most first, untracked last', () => {
    expect(countSources([{ applied_via: null }, { applied_via: 'linkedin' }, { applied_via: 'jooble' }, { applied_via: 'linkedin' }, { applied_via: null }, { applied_via: null }])).toEqual([
      { key: 'linkedin', label: 'LinkedIn', count: 2 },
      { key: 'jooble', label: 'Jooble', count: 1 },
      { key: null, label: 'Not tracked', count: 3 },
    ])
  })
})

describe('wrapLines', () => {
  const measure = (s: string) => s.length * 10
  it('wraps words into lines', () => {
    expect(wrapLines(measure, 'Head of Sales for Mexico', 100, 3)).toEqual({ lines: ['Head of', 'Sales for', 'Mexico'], cut: false })
  })
  it('cuts what does not fit with an ellipsis', () => {
    const r = wrapLines(measure, 'one two three four five six seven', 100, 2)
    expect(r.cut).toBe(true)
    expect(r.lines).toHaveLength(2)
    expect(r.lines[1].endsWith('…')).toBe(true)
    expect(r.lines.every((l) => measure(l) <= 100)).toBe(true)
  })
  it('cuts a single word that is too long', () => {
    const r = wrapLines(measure, 'Supercalifragilistic', 100, 1)
    expect(r.lines[0].endsWith('…')).toBe(true)
    expect(measure(r.lines[0])).toBeLessThanOrEqual(100)
  })
  it('handles empty text', () => {
    expect(wrapLines(measure, '   ', 100, 2)).toEqual({ lines: [], cut: false })
  })
})

describe('Gio\'s posts', () => {
  it('keeps {link} exactly once and drops other links and Markdown', () => {
    expect(cleanPost('**Hiring** a Head of Sales\nApply: {link} or https://x.com {link}', 'linkedin')).toBe('Hiring a Head of Sales\nApply: {link} or')
    expect(cleanPost('*Head of Sales* at Acme', 'whatsapp')).toBe('*Head of Sales* at Acme\n\n{link}')
    expect(cleanPost('**Head of Sales**', 'whatsapp')).toBe('*Head of Sales*\n\n{link}')
    expect(cleanPost(null, 'linkedin')).toBe('{link}')
    expect(cleanPost('a'.repeat(5000), 'whatsapp').length).toBeLessThanOrEqual(900)
    expect(cleanPost('a'.repeat(5000), 'whatsapp').endsWith('{link}')).toBe(true)
  })

  it('puts the link in', () => {
    expect(fillLink('Apply: {link}', 'https://a.b')).toBe('Apply: https://a.b')
    expect(fillLink('Apply', 'https://a.b')).toBe('Apply\n\nhttps://a.b')
  })

  it('only mentions pay when the post shows it', () => {
    const base = { title: 'Head of Sales', company: 'Acme', description: 'x' }
    expect(sharePostsPrompt({ ...base, pay: null }, 'team').system).toContain('Never mention pay')
    expect(sharePostsPrompt({ ...base, pay: 'MXN 40,000 – 60,000 per month' }, 'client').system).toContain('MXN 40,000 – 60,000 per month')
    expect(sharePostsPrompt(base, 'client').system).toContain('as the company itself')
  })

  it('reads a post\'s facts like the public page', () => {
    expect(postingFacts({ location: 'Mexico City', location_type: 'hybrid', employment_type: 'full_time', salary_min: 40000, salary_max: 60000, salary_currency: 'MXN', salary_period: 'monthly', show_salary_public: true }, null)).toEqual({
      location: 'Mexico City',
      workMode: 'Hybrid',
      employmentType: 'Full Time',
      pay: 'MXN 40,000 – 60,000 per month',
    })
    expect(postingFacts({ salary_max: 5000 }, { location: 'Remote', show_salary_public: false })).toEqual({ location: 'Remote', workMode: null, employmentType: null, pay: null })
  })

  it('turns the post into plain text', () => {
    expect(plainDescription('<p>About&nbsp;us</p><ul><li>Sell</li><li>Lead</li></ul>')).toBe('About us\n\n- Sell\n- Lead')
  })
})
