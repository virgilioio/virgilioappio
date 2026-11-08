import { describe, expect, it } from 'vitest'
import { rejectionEmailView, rejectionEmailSentence, rejectionEmailNotified, scheduledEmailError, type RejectionEmail } from '@/lib/scheduledEmails'
import { activityMetaFor } from '@/lib/activityRegistry'

const row = (over: Partial<RejectionEmail>): RejectionEmail => ({
  id: 'e1', status: 'pending', scheduledFor: '2030-11-09T15:00:00Z', sentAt: null, cancelReason: null, ...over,
})
const none = { sentAt: null, scheduledFor: null }

describe('rejection email on the banner', () => {
  it('a waiting email can be cancelled and says when it goes out', () => {
    const v = rejectionEmailView(row({}), none)
    expect(v.kind).toBe('scheduled')
    expect(v.kind === 'scheduled' && v.canCancel).toBe(true)
    expect(rejectionEmailSentence(v)).toMatch(/^Rejection email goes out .+ at .+\.$/)
    expect(rejectionEmailNotified(v)).toMatch(/^Not yet · Email goes out /)
  })
  it('sent, cancelled and failed', () => {
    expect(rejectionEmailSentence(rejectionEmailView(row({ status: 'sent' }), none))).toBe('Rejection email sent.')
    expect(rejectionEmailSentence(rejectionEmailView(row({ status: 'cancelled', cancelReason: 'cancelled' }), none))).toBe('Rejection email cancelled.')
    expect(rejectionEmailSentence(rejectionEmailView(row({ status: 'failed' }), none))).toBe('Rejection email couldn’t be sent.')
    expect(rejectionEmailNotified(rejectionEmailView(row({ status: 'cancelled' }), none))).toBe('No · Email cancelled')
  })
  it('an email sent at once has no scheduled row', () => {
    expect(rejectionEmailSentence(rejectionEmailView(null, { sentAt: '2030-01-01T00:00:00Z', scheduledFor: null }))).toBe('Rejection email sent.')
  })
  it('a scheduled time you can see without its row shows, without Cancel', () => {
    const v = rejectionEmailView(null, { sentAt: null, scheduledFor: '2030-11-09T15:00:00Z' })
    expect(v.kind === 'scheduled' && v.canCancel).toBe(false)
  })
  it('no email at all says nothing', () => {
    expect(rejectionEmailSentence(rejectionEmailView(null, none))).toBe('')
    expect(rejectionEmailNotified(rejectionEmailView(null, none))).toBe('No')
  })
  it('server errors become our sentences', () => {
    expect(scheduledEmailError({ code: 'GSE02' }, 'Try again.')).toBe('This email isn’t waiting to go out any more.')
    expect(scheduledEmailError({ code: 'XX000' }, 'Try again.')).toBe('Try again.')
  })
})

describe('scheduled email in the feed', () => {
  const ev = (state: string) => ({ activity_type: 'candidate_email_scheduled', metadata: { state } })
  it('sits in Emails and changes glyph with its state', () => {
    expect(activityMetaFor(ev('scheduled')).category).toBe('emails')
    expect(activityMetaFor(ev('cancelled')).tone).toBe('neutral')
    expect(activityMetaFor(ev('failed')).tone).toBe('red')
  })
})
