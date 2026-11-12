import { describe, expect, it } from 'vitest'
import { callLength, clock, firefliesUrl, notesStatusView, orderCriteria, parseRecommendation, transcriptTurns, turnAt, type NotesStatusRow } from '../interviewNotes'

const row = (over: Partial<NotesStatusRow>): NotesStatusRow => ({
  booking_id: 'b1', status: 'drafted', status_reason: null, status_at: new Date().toISOString(),
  source: 'fireflies_api', external_id: '01FAKEMEETING00000000TEST01', language: 'en', duration_seconds: 2040, ...over,
})

describe('parseRecommendation', () => {
  it('reads the stored recommendation and fixes anything odd', () => {
    const r = parseRecommendation({
      rating: 'lean_yes', confidence: 'medium', reason: ' Strong. ', source_kind: 'transcript',
      criteria: [
        { id: 'c1', kind: 'must', label: 'Partner marketing', verdict: 'met', evidence: 'Built one', quote: 'We did it.', at: 725 },
        { id: 'c2', kind: 'weird', label: 'Thing', verdict: 'maybe', at: -3 },
        { id: 'c3', label: '' },
      ],
    })!
    expect(r.rating).toBe('lean_yes')
    expect(r.reason).toBe('Strong.')
    expect(r.criteria).toHaveLength(2)
    expect(r.criteria[1]).toMatchObject({ kind: 'nice', verdict: 'not_discussed', at: null, quote: null })
  })
  it('has no rating for not enough, and nothing for an older draft', () => {
    expect(parseRecommendation({ rating: null, criteria: [] })!.rating).toBeNull()
    expect(parseRecommendation({ rating: 'not_enough' })!.rating).toBeNull()
    expect(parseRecommendation(null)).toBeNull()
    expect(parseRecommendation([1])).toBeNull()
  })
  it('puts must-haves first', () => {
    const r = parseRecommendation({ criteria: [{ id: 'a', kind: 'nice', label: 'A' }, { id: 'b', kind: 'salary', label: 'B' }, { id: 'c', kind: 'must', label: 'C' }] })!
    expect(orderCriteria(r.criteria).map((c) => c.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('notesStatusView', () => {
  it('says what Gio is doing, without Retry', () => {
    expect(notesStatusView(row({ status: 'drafting' }), { submitted: false })).toMatchObject({ tone: 'working', retry: null })
  })
  it('offers Retry once a run has been stuck 10 minutes', () => {
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    expect(notesStatusView(row({ status: 'fetching', status_at: old }), { submitted: false })).toMatchObject({ tone: 'problem', retry: 'Retry' })
  })
  it('a failure reads once, with Retry, never twice "try again"', () => {
    const v = notesStatusView(row({ status: 'failed', status_reason: "Gio couldn't write the notes. Try again." }), { submitted: false })!
    expect(v.text).toBe("Gio couldn't write the notes.")
    expect(v.retry).toBe('Retry')
  })
  it('a summary-only draft names why and offers Try again', () => {
    const v = notesStatusView(row({ source: 'fireflies_recap', status_reason: 'Fireflies had no transcript.' }), { submitted: false })!
    expect(v).toMatchObject({ tone: 'note', text: 'Fireflies had no transcript.', retry: 'Try again' })
  })
  it('never offers Retry once the scorecard is submitted', () => {
    expect(notesStatusView(row({ status: 'failed' }), { submitted: true })!.retry).toBeNull()
  })
  it('a full transcript draft is done', () => {
    expect(notesStatusView(row({}), { submitted: false })).toMatchObject({ tone: 'done', retry: null })
    expect(notesStatusView(null, { submitted: false })).toBeNull()
  })
})

describe('the transcript', () => {
  it('joins a speaker\'s sentences into turns, in time order', () => {
    const turns = transcriptTurns([
      { speaker: 'Jordan Rivera', text: 'Twelve years.', start: 64 },
      { speaker: 'Sam Ortiz', text: 'Tell me about your work.', start: 60 },
      { speaker: 'Jordan Rivera', text: 'Eight in partnerships.', start: 67 },
      { speaker: 'Sam Ortiz', text: '  ', start: 70 },
    ])
    expect(turns).toEqual([
      { speaker: 'Sam Ortiz', start: 60, text: 'Tell me about your work.' },
      { speaker: 'Jordan Rivera', start: 64, text: 'Twelve years. Eight in partnerships.' },
    ])
    expect(turnAt(turns, 66)).toBe(1)
    expect(turnAt(turns, 5)).toBe(0)
  })
  it('reads times and lengths', () => {
    expect(clock(725)).toBe('12:05')
    expect(clock(3725)).toBe('1:02:05')
    expect(callLength(2040)).toBe('34 min')
    expect(callLength(3900)).toBe('1 h 05 min')
    expect(callLength(null)).toBeNull()
  })
  it('links to Fireflies only for a real meeting id', () => {
    expect(firefliesUrl('01FAKEMEETING00000000TEST01')).toBe('https://app.fireflies.ai/view/01FAKEMEETING00000000TEST01')
    expect(firefliesUrl('x/../y')).toBeNull()
    expect(firefliesUrl(null)).toBeNull()
  })
})
