import { describe, expect, it } from 'vitest'
import { hasDescription, outcomeOf } from '../fitQueue'

describe('hasDescription', () => {
  it('needs 30 characters of text, tags aside', () => {
    expect(hasDescription(null)).toBe(false)
    expect(hasDescription('<p>   </p>')).toBe(false)
    expect(hasDescription('<p><strong>Educators</strong></p>')).toBe(false)
    expect(hasDescription('<p>We are hiring educators to teach online classes.</p>')).toBe(true)
  })
})

describe('outcomeOf', () => {
  it('counts only a real assessment as done', () => {
    expect(outcomeOf(200, JSON.stringify({ success: true, analysis: {} })).kind).toBe('done')
    expect(outcomeOf(200, JSON.stringify({ success: true, unchanged: true })).kind).toBe('done')
    expect(outcomeOf(200, JSON.stringify({ error: 'something' })).kind).toBe('failed')
    expect(outcomeOf(200, 'not json').kind).toBe('failed')
  })
  it('waits when the job has no description', () => {
    expect(outcomeOf(200, JSON.stringify({ error: 'no_job_description' })).kind).toBe('waiting')
  })
  it('retries the passing problems and pauses on billing', () => {
    expect(outcomeOf(202, '{}').kind).toBe('retry')
    expect(outcomeOf(504, JSON.stringify({ error: 'timeout' }))).toMatchObject({ kind: 'retry', rateLimited: false })
    expect(outcomeOf(429, '')).toMatchObject({ kind: 'retry', rateLimited: true })
    expect(outcomeOf(0, '')).toMatchObject({ kind: 'retry', error: 'network_error' })
    expect(outcomeOf(402, '')).toMatchObject({ kind: 'pause', reason: 'ai_402' })
    expect(outcomeOf(404, JSON.stringify({ error: 'Candidate or job not found' })).kind).toBe('failed')
  })
})
