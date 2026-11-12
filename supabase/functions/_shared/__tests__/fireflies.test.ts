import { describe, expect, it, vi } from 'vitest'
import {
  FIREFLIES_ENDPOINT,
  clock,
  fetchFirefliesTranscript,
  normalizeTranscript,
  pickMeeting,
  problemFrom,
  transcriptText,
} from '../fireflies'

const RAW = {
  id: '01FAKEMEETING00000000TEST01',
  title: 'Recruiter Screening with Jordan Rivera - Head of Marketing',
  speakers: [{ id: 0, name: 'Sam Ortiz' }, { id: 1, name: 'Jordan Rivera' }],
  sentences: [
    { index: 2, speaker_name: 'Jordan Rivera', speaker_id: 1, text: 'Llevo 15 años en marketing.', start_time: 64.2, end_time: 66.9 },
    { index: 0, speaker_name: 'Sam Ortiz', speaker_id: 0, text: 'Cuéntame de tu experiencia.', start_time: 60.0, end_time: 61.5 },
    { index: 3, speaker_name: null, speaker_id: 1, text: 'Y 11 en partnerships.', start_time: 67.0, end_time: 69.1 },
    { index: 1, speaker_name: 'Sam Ortiz', speaker_id: 0, text: '   ', start_time: 62, end_time: 63 },
    { index: 4, speaker_name: 'Sam Ortiz', speaker_id: 0, text: '¿Y tu expectativa salarial?', start_time: 1841.4, end_time: 1843.8 },
  ],
  summary: { overview: 'Head of Marketing', keywords: ['Generación de demanda'] },
}

describe('normalizeTranscript', () => {
  it('orders sentences, fills a missing speaker from its id, drops empty text, measures the call', () => {
    const t = normalizeTranscript(RAW)!
    expect(t.sentences.map((s) => s.speaker)).toEqual(['Sam Ortiz', 'Jordan Rivera', 'Jordan Rivera', 'Sam Ortiz'])
    expect(t.sentences[0]).toEqual({ i: 0, speaker: 'Sam Ortiz', text: 'Cuéntame de tu experiencia.', start: 60, end: 61.5 })
    expect(t.durationSeconds).toBe(1844)
    expect(t.speakers).toEqual([{ id: '0', name: 'Sam Ortiz' }, { id: '1', name: 'Jordan Rivera' }])
    expect(t.summary).toEqual(RAW.summary)
  })
  it('gives nothing for an empty answer', () => {
    expect(normalizeTranscript(null)).toBeNull()
    expect(normalizeTranscript({})).toBeNull()
  })
})

describe('transcriptText', () => {
  it('writes one timed turn per speaker change', () => {
    const t = normalizeTranscript(RAW)!
    expect(transcriptText(t.sentences)).toBe(
      [
        '[1:00] Sam Ortiz: Cuéntame de tu experiencia.',
        '[1:04] Jordan Rivera: Llevo 15 años en marketing. Y 11 en partnerships.',
        '[30:41] Sam Ortiz: ¿Y tu expectativa salarial?',
      ].join('\n'),
    )
  })
  it('clock reads minutes, then hours', () => {
    expect(clock(5)).toBe('0:05')
    expect(clock(725)).toBe('12:05')
    expect(clock(3725)).toBe('1:02:05')
  })
})

describe('problemFrom', () => {
  it('reads statuses and GraphQL errors', () => {
    expect(problemFrom(401, null)).toBe('unauthorized')
    expect(problemFrom(429, null)).toBe('rate_limited')
    expect(problemFrom(200, { errors: [{ extensions: { code: 'auth_failed' } }] })).toBe('unauthorized')
    expect(problemFrom(200, { errors: [{ extensions: { code: 'object_not_found' } }] })).toBe('not_found')
    expect(problemFrom(200, { errors: [{ code: 'too_many_requests' }] })).toBe('rate_limited')
    expect(problemFrom(200, { errors: [{ message: 'Something odd' }] })).toBe('error')
    expect(problemFrom(500, null)).toBe('error')
    expect(problemFrom(200, { data: {} })).toBeNull()
  })
})

describe('fetchFirefliesTranscript', () => {
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

  it('asks Fireflies for the transcript with the key and returns it normalized', async () => {
    const f = reply(200, { data: { transcript: RAW } })
    const r = await fetchFirefliesTranscript('01FAKEMEETING00000000TEST01', 'k-123', f as any)
    expect(r.ok).toBe(true)
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe(FIREFLIES_ENDPOINT)
    expect(init.headers.Authorization).toBe('Bearer k-123')
    expect(JSON.parse(init.body).variables).toEqual({ id: '01FAKEMEETING00000000TEST01' })
    if (r.ok) expect(r.transcript.sentences).toHaveLength(4)
  })
  it('says not ready when there are no sentences yet', async () => {
    const r = await fetchFirefliesTranscript('x', 'k', reply(200, { data: { transcript: { ...RAW, sentences: [] } } }) as any)
    expect(r).toEqual({ ok: false, problem: 'not_ready' })
  })
  it('says not found for a null transcript and for Fireflies not-found errors', async () => {
    expect(await fetchFirefliesTranscript('x', 'k', reply(200, { data: { transcript: null } }) as any)).toEqual({ ok: false, problem: 'not_found' })
    expect(
      await fetchFirefliesTranscript('x', 'k', reply(200, { errors: [{ extensions: { code: 'object_not_found' } }] }) as any),
    ).toEqual({ ok: false, problem: 'not_found' })
  })
  it('never throws on a network failure', async () => {
    const f = vi.fn(async () => {
      throw new Error('boom')
    })
    expect(await fetchFirefliesTranscript('x', 'k', f as any)).toEqual({ ok: false, problem: 'error' })
  })
})

describe('pickMeeting', () => {
  const q = { start: '2026-11-11T19:00:00Z', end: '2026-11-11T19:45:00Z', emails: ['robin@example.com'], name: 'Robin Castellanos' }
  const at = Date.parse(q.start)
  it('takes the closest meeting with the candidate, by email or full name in the title', () => {
    expect(pickMeeting([{ id: 'a', title: 'x', date: at + 10 * 60000, participants: ['robin@example.com'] }, { id: 'b', title: 'x', date: at + 60000, participants: ['robin@example.com'] }], q)?.id).toBe('b')
    expect(pickMeeting([{ id: 'c', title: 'Screening - Robin Castellanos', date: at, participants: [] }], q)?.id).toBe('c')
    expect(pickMeeting([{ id: 'd', title: 'Screening - Robin', date: at, participants: [] }], q)).toBeNull()
    expect(pickMeeting([{ id: 'e', title: 'x', date: at + 50 * 60000, participants: ['robin@example.com'] }], q)).toBeNull()
  })
})
