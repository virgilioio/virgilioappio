import { describe, expect, it, vi } from 'vitest'
import { REASON, recordReceived, sourceFor, sourceForNotes } from '../interviewTranscripts'
import { PROBLEM_REASON } from '../fireflies'
import { substantiveWords } from '../interviewNotes'

/** Just enough of supabase-js for one table, keyed by booking_id. */
function fakeDb(initial: Record<string, any> = {}) {
  const rows = new Map<string, any>(Object.entries(initial))
  const db = {
    rows,
    from(table: string) {
      expect(table).toBe('interview_transcripts')
      let id = ''
      let patch: any = null
      const q: any = {
        select: () => q,
        eq: (_c: string, v: string) => {
          id = v
          if (patch) {
            rows.set(id, { ...(rows.get(id) ?? {}), ...patch })
            return Promise.resolve({ error: null })
          }
          return q
        },
        maybeSingle: () => Promise.resolve({ data: rows.get(id) ?? null, error: null }),
        update: (p: any) => {
          patch = p
          return q
        },
        upsert: (r: any) => {
          rows.set(r.booking_id, { ...(rows.get(r.booking_id) ?? {}), ...r })
          return Promise.resolve({ error: null })
        },
      }
      return q
    },
  }
  return db
}

const SENTENCES = [
  { index: 0, speaker_name: 'Sam Ortiz', text: 'Tell me about your work.', start_time: 3, end_time: 5 },
  { index: 1, speaker_name: 'Jordan Rivera', text: 'Seventeen years in marketing.', start_time: 6, end_time: 9 },
]
const ok = () =>
  vi.fn(async () =>
    new Response(JSON.stringify({ data: { transcript: { id: 'FF1', speakers: [], sentences: SENTENCES, summary: { overview: 'x' } } } }), {
      status: 200,
    }),
  )
const recap = { text: 'Meeting overview:\n- Talked about marketing', kind: 'summary' as const, provider: 'fireflies' as const, firefliesId: 'FF1' }
const booking = { id: 'b1', tenant_id: 't1' }

describe('sourceFor', () => {
  it('maps providers to the table sources', () => {
    expect(sourceFor({ provider: 'fireflies' })).toBe('fireflies_recap')
    expect(sourceFor({ provider: 'read_ai' })).toBe('read_ai')
    expect(sourceFor({ provider: 'other' })).toBe('email')
  })
})

describe('recordReceived', () => {
  it('starts a row, and keeps a fetched transcript when the same meeting arrives again', async () => {
    const db = fakeDb()
    await recordReceived(db, booking, { provider: 'fireflies', firefliesId: 'FF1' })
    expect(db.rows.get('b1')).toMatchObject({ source: 'fireflies_recap', external_id: 'FF1', status: 'received', tenant_id: 't1' })
    db.rows.set('b1', { ...db.rows.get('b1'), source: 'fireflies_api', sentences: [{ i: 0 }], status: 'drafted' })
    await recordReceived(db, booking, { provider: 'fireflies', firefliesId: 'FF1' })
    expect(db.rows.get('b1')).toMatchObject({ source: 'fireflies_api', sentences: [{ i: 0 }], status: 'received' })
    await recordReceived(db, booking, { provider: 'fireflies', firefliesId: 'FF2' })
    expect(db.rows.get('b1')).toMatchObject({ source: 'fireflies_recap', external_id: 'FF2', sentences: [] })
  })
})

describe('sourceForNotes', () => {
  it('fetches the full transcript from Fireflies and keeps it on the row', async () => {
    const db = fakeDb()
    await recordReceived(db, booking, recap)
    const f = ok()
    const s = await sourceForNotes(db, booking, recap, { apiKey: 'k', fetchImpl: f as any })
    expect(s).toMatchObject({ kind: 'transcript', full: true, reason: null })
    expect(s.text).toBe('[0:03] Sam Ortiz: Tell me about your work.\n[0:06] Jordan Rivera: Seventeen years in marketing.')
    expect(db.rows.get('b1')).toMatchObject({ source: 'fireflies_api', status: 'ready', duration_seconds: 9, provider_summary: { overview: 'x' } })
    // A re-run reads the row, never Fireflies again.
    const again = await sourceForNotes(db, booking, recap, { apiKey: 'k', fetchImpl: f as any })
    expect(again.full).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('waits once while Fireflies is still processing', async () => {
    const db = fakeDb()
    let n = 0
    const f = vi.fn(async () => {
      n++
      const sentences = n === 1 ? null : SENTENCES
      return new Response(JSON.stringify({ data: { transcript: { id: 'FF1', sentences } } }), { status: 200 })
    })
    const sleep = vi.fn(async () => {})
    const s = await sourceForNotes(db, booking, recap, { apiKey: 'k', fetchImpl: f as any, sleep })
    expect(s.full).toBe(true)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('falls back to the summary with a readable reason', async () => {
    const db = fakeDb()
    const f = vi.fn(async () => new Response(JSON.stringify({ data: { transcript: null } }), { status: 200 }))
    const s = await sourceForNotes(db, booking, recap, { apiKey: 'k', fetchImpl: f as any, sleep: async () => {} })
    expect(s).toMatchObject({ kind: 'summary', full: false, reason: PROBLEM_REASON.not_found, text: recap.text })
    expect(db.rows.get('b1')).toMatchObject({ source: 'fireflies_recap', status: 'ready', status_reason: PROBLEM_REASON.not_found })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('says why without a key or without a meeting link, and never calls Fireflies', async () => {
    const f = ok()
    const a = await sourceForNotes(fakeDb(), booking, recap, { apiKey: '', fetchImpl: f as any })
    expect(a.reason).toBe(REASON.noKey)
    const b = await sourceForNotes(fakeDb(), booking, { ...recap, firefliesId: null }, { apiKey: 'k', fetchImpl: f as any })
    expect(b.reason).toBe(REASON.noLink)
    expect(f).not.toHaveBeenCalled()
  })

  it('uses any other email as it came', async () => {
    const f = ok()
    const other = { text: 'Speaker 1: hello', kind: 'transcript' as const, provider: 'other' as const, firefliesId: null }
    const db = fakeDb()
    const s = await sourceForNotes(db, booking, other, { apiKey: 'k', fetchImpl: f as any })
    expect(s).toMatchObject({ text: 'Speaker 1: hello', full: false, reason: null })
    expect(db.rows.get('b1')).toMatchObject({ source: 'email', status: 'ready' })
    expect(f).not.toHaveBeenCalled()
  })
})

describe('substantiveWords on a fetched transcript', () => {
  it("doesn't count times or speaker names", () => {
    expect(substantiveWords('[0:03] Sam Ortiz: Tell me about your work.\n[1:02:06] Jordan Rivera: Seventeen years marketing.')).toBe(8)
  })
})

describe('sourceForNotes: finding a meeting that sent no recap', () => {
  const lookup = { start: '2026-11-11T19:00:00Z', end: '2026-11-11T19:45:00Z', emails: ['dana@example.com'], name: 'Dana Whitfield' }
  const at = Date.parse(lookup.start)
  it('finds it by time and attendee, then fetches it', async () => {
    const calls: string[] = []
    const f = vi.fn(async (_u: string, init: any) => {
      const body = JSON.parse(init.body)
      calls.push(body.query.includes('GioFindMeeting') ? 'find' : 'get')
      if (body.query.includes('GioFindMeeting')) {
        return new Response(JSON.stringify({ data: { transcripts: [
          { id: 'OTHER', title: 'Weekly sync', date: at + 5 * 60000, participants: ['x@example.com'] },
          { id: 'FFH', title: 'Screening', date: at + 2 * 60000, participants: ['dana@example.com', 'allan@example.com'] },
          { id: 'LATE', title: 'Screening', date: at + 120 * 60000, participants: ['dana@example.com'] },
        ] } }), { status: 200 })
      }
      expect(body.variables.id).toBe('FFH')
      return new Response(JSON.stringify({ data: { transcript: { id: 'FFH', sentences: SENTENCES } } }), { status: 200 })
    })
    const db = fakeDb()
    const s = await sourceForNotes(db, booking, { text: '', kind: 'summary', provider: 'fireflies', firefliesId: null }, { apiKey: 'k', fetchImpl: f as any, lookup })
    expect(s.full).toBe(true)
    expect(calls).toEqual(['find', 'get'])
    expect(db.rows.get('b1')).toMatchObject({ source: 'fireflies_api', external_id: 'FFH' })
  })
  it('says it found nothing when no meeting fits', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: { transcripts: [] } }), { status: 200 }))
    const db = fakeDb()
    const s = await sourceForNotes(db, booking, { text: '', kind: 'summary', provider: 'fireflies', firefliesId: null }, { apiKey: 'k', fetchImpl: f as any, lookup })
    expect(s).toMatchObject({ full: false, reason: REASON.notFound, text: '' })
    expect(f).toHaveBeenCalledTimes(2) // by attendee, then by time alone
  })
})
