import { describe, expect, it, vi } from 'vitest'
import {
  FIREFLIES_ENDPOINT,
  clock,
  fetchFirefliesTranscript,
  normalizeTranscript,
  problemFrom,
  transcriptText,
} from '../fireflies'

const RAW = {
  id: '01M6VREDFGKZNPQN35SPKK4SFA',
  title: 'Recruiter Screening with Luke Seria - Head of Marketing',
  speakers: [{ id: 0, name: 'Allan Bravo' }, { id: 1, name: 'Luke Seria' }],
  sentences: [
    { index: 2, speaker_name: 'Luke Seria', speaker_id: 1, text: 'Llevo 17 años en marketing.', start_time: 64.2, end_time: 66.9 },
    { index: 0, speaker_name: 'Allan Bravo', speaker_id: 0, text: 'Cuéntame de tu experiencia.', start_time: 60.0, end_time: 61.5 },
    { index: 3, speaker_name: null, speaker_id: 1, text: 'Y 13 en partnerships.', start_time: 67.0, end_time: 69.1 },
    { index: 1, speaker_name: 'Allan Bravo', speaker_id: 0, text: '   ', start_time: 62, end_time: 63 },
    { index: 4, speaker_name: 'Allan Bravo', speaker_id: 0, text: '¿Y tu expectativa salarial?', start_time: 1841.4, end_time: 1843.8 },
  ],
  summary: { overview: 'Head of Marketing', keywords: ['Generación de demanda'] },
}

describe('normalizeTranscript', () => {
  it('orders sentences, fills a missing speaker from its id, drops empty text, measures the call', () => {
    const t = normalizeTranscript(RAW)!
    expect(t.sentences.map((s) => s.speaker)).toEqual(['Allan Bravo', 'Luke Seria', 'Luke Seria', 'Allan Bravo'])
    expect(t.sentences[0]).toEqual({ i: 0, speaker: 'Allan Bravo', text: 'Cuéntame de tu experiencia.', start: 60, end: 61.5 })
    expect(t.durationSeconds).toBe(1844)
    expect(t.speakers).toEqual([{ id: '0', name: 'Allan Bravo' }, { id: '1', name: 'Luke Seria' }])
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
        '[1:00] Allan Bravo: Cuéntame de tu experiencia.',
        '[1:04] Luke Seria: Llevo 17 años en marketing. Y 13 en partnerships.',
        '[30:41] Allan Bravo: ¿Y tu expectativa salarial?',
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
    const r = await fetchFirefliesTranscript('01M6VREDFGKZNPQN35SPKK4SFA', 'k-123', f as any)
    expect(r.ok).toBe(true)
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe(FIREFLIES_ENDPOINT)
    expect(init.headers.Authorization).toBe('Bearer k-123')
    expect(JSON.parse(init.body).variables).toEqual({ id: '01M6VREDFGKZNPQN35SPKK4SFA' })
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
