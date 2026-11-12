import { describe, expect, it } from 'vitest'
import {
  cleanInboundText,
  firefliesIdFrom,
  scorecardLink,
  stripEmailNoise,
  substantiveWords,
  toSuggestedRating,
  tooLittleToDraft,
} from '../interviewNotes'

// Shaped like the recaps Fireflies sends to the ingest address (2026-11).
const RECAP = `Fred from Fireflies
[https://files.fireflies.ai/email-templates/meeting-recap-v2/fred-notetaker.png]
https://app.fireflies.ai/view/Recruiter-Screening-with-Jordan-Rivera-Head-of-Marketing::01FAKEMEETING00000000TEST01?ref=recap&track=x
Your meeting recap
is ready Invited by Sam Ortiz allan@virgilio.tech [allan@virgilio.tech]

Recruiter Screening with Jordan Rivera - Head of Marketing

Nov 11th at 11:30 AM CST

View meeting recap
[https://app.fireflies.ai/view/Recruiter-Screening-with-Jordan-Rivera-Head-of-Marketing::01FAKEMEETING00000000TEST01?ref=recap]

105+ Questions were asked

Discussed in this meeting Generación de demanda
[https://app.fireflies.ai/view/x]
Marketing empresarial
[https://app.fireflies.ai/view/x]
+3 more

See more insights

  Meeting Overview
 * Rol: Head of Marketing para escalar una función existente y generar demanda
   para ventas enterprise.
 * Objetivo comercial: Subir el ticket de advisory de aproximadamente 40K a
   100K–150K o más.
 * Experiencia: Jordan aporta 15 años en marketing, 11 en partnerships y manejo de
   presupuestos superiores a 1M.
 * Compensación y proceso: Jordan requiere al menos 150K; entrevista con Morgan el
   viernes a las 11:00, seguida posiblemente por Lee.

View complete meeting notes
[https://app.fireflies.ai/view/x]

Supercharge your
meetings with an AI teammate

Just invite Fireflies secure Notetaker to your meetings for seamless recording.
Transcribe Easily transcribe your live meetings or media files that you can upload.
Fireflies.ai Corp • 1000 Brickell Ave, Ste 715 PMB 5136 Miami, FL 33131`

// An older recap with no overview at all (Manuel Perez, Aug 31): Gio wrote 4,000
// characters of notes from it.
const EMPTY_RECAP = `Sam Ortiz

(allan@virgilio.tech) [allan@virgilio.tech]

invited Fireflies to your meeting

To record and take notes

Interview: Manuel Perez

Aug 31st at 10:30 AM CST

View meeting recap

Supercharge your
meetings with AI Assistant

Record

Just invite Fireflies secure Notetaker to your meetings for seamless recording.

Transcribe

Easily transcribe your live meetings or media files that you can upload.

Summarize

Instantly get meeting overview, outline, bullet-point notes, action items and
more.

Analyze

Understand your meetings better with conversation intelligence.

Fireflies.ai Corp • 1000 Brickell Ave, Ste 715 PMB 5136 Miami, FL 33131`

describe('cleanInboundText: Fireflies recaps', () => {
  it('keeps the meeting, the date, the topics and the overview, nothing else', () => {
    const c = cleanInboundText(RECAP, 'Fred from Fireflies <fred@fireflies.ai>')
    expect(c.kind).toBe('summary')
    expect(c.provider).toBe('fireflies')
    expect(c.firefliesId).toBe('01FAKEMEETING00000000TEST01')
    expect(c.text).toBe(
      [
        'Meeting: Recruiter Screening with Jordan Rivera - Head of Marketing',
        'When: Nov 11th at 11:30 AM CST',
        'Topics: Generación de demanda, Marketing empresarial',
        '',
        'Meeting overview:',
        '- Rol: Head of Marketing para escalar una función existente y generar demanda para ventas enterprise.',
        '- Objetivo comercial: Subir el ticket de advisory de aproximadamente 40K a 100K–150K o más.',
        '- Experiencia: Jordan aporta 15 años en marketing, 11 en partnerships y manejo de presupuestos superiores a 1M.',
        '- Compensación y proceso: Jordan requiere al menos 150K; entrevista con Morgan el viernes a las 11:00, seguida posiblemente por Lee.',
      ].join('\n'),
    )
    expect(c.text).not.toMatch(/https?:|Supercharge|Brickell/)
    expect(tooLittleToDraft(c.text, c.kind)).toBe(false)
  })

  it('reads a recap with no overview as nothing said', () => {
    const c = cleanInboundText(EMPTY_RECAP, 'fred@fireflies.ai')
    expect(c.text).toBe('Meeting: Interview: Manuel Perez\nWhen: Aug 31st at 10:30 AM CST')
    expect(substantiveWords(c.text)).toBe(0)
    expect(tooLittleToDraft(c.text, c.kind)).toBe(true)
    // The old check counted the advertising as conversation.
    expect(substantiveWords(EMPTY_RECAP)).toBeGreaterThan(50)
  })
})

describe('cleanInboundText: other senders', () => {
  it('strips links, preheader filler and tokens from Read.ai, labelled a summary', () => {
    const raw = 'Javier y Andrés conversaron. ͏ ‌ ­ ͏ ‌ ­\nVer https://read.ai/x?y=1 email_access_invite_token:eyJhbGciOiJ9.eyJraW5kIjoi.abc billing_plan:&lt;nil&gt;'
    const c = cleanInboundText(raw, 'executiveassistant@e.read.ai')
    expect(c.kind).toBe('summary')
    expect(c.provider).toBe('read_ai')
    expect(c.text).not.toMatch(/eyJ|https|nil|͏/)
    expect(c.text).toContain('Javier y Andrés conversaron.')
  })

  it('treats anything else as a transcript', () => {
    const c = cleanInboundText('Speaker 1: Tell me about your last role.', 'someone@example.com')
    expect(c.kind).toBe('transcript')
    expect(c.provider).toBe('other')
  })

  it('finds a Fireflies id in any link to the meeting', () => {
    expect(firefliesIdFrom('https://app.fireflies.ai/view/Interview-Bruna-Knights::01K6EXAMPLE1234?ref=recap')).toBe('01K6EXAMPLE1234')
    expect(firefliesIdFrom('no link here')).toBeNull()
    expect(stripEmailNoise('a [https://x.y/z] b')).toBe('a  b')
  })
})

describe('toSuggestedRating', () => {
  it('maps every label and the old four-point scale onto the scorecard scale', () => {
    expect(toSuggestedRating('strong_yes')).toBe('strong_yes')
    expect(toSuggestedRating('Strong Yes')).toBe('strong_yes')
    expect(toSuggestedRating('lean_yes')).toBe('lean_yes')
    expect(toSuggestedRating('yes')).toBe('yes')
    expect(toSuggestedRating('no')).toBe('lean_no')
    expect(toSuggestedRating('definitely_no')).toBe('strong_no')
  })
  it('gives no rating instead of a default yes', () => {
    expect(toSuggestedRating('not_enough')).toBeNull()
    expect(toSuggestedRating(undefined)).toBeNull()
    expect(toSuggestedRating('maybe')).toBeNull()
  })
})

describe('scorecardLink', () => {
  it('opens the in-job profile on your own scorecard', () => {
    expect(scorecardLink('https://app.gogio.io/', 'j1', 'c1')).toBe('https://app.gogio.io/jobs/j1/candidates/c1?focus=my-scorecard')
    expect(scorecardLink('https://app.gogio.io', 'j1', null)).toBe('https://app.gogio.io/jobs/j1')
  })
})
