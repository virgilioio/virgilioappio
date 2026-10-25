import { describe, expect, it } from 'vitest'
import { bareAddress, displayName, inboxTime, replyAllRecipients, type InboxMessage } from '@/lib/inbox'

const msg = (over: Partial<InboxMessage>): InboxMessage => ({
  id: 'm', direction: 'received', status: 'delivered', from_address: 'Ana <ana@x.com>', to_addresses: ['allan@virgilio.tech'],
  cc_addresses: null, subject: 's', body_html: null, body_text: null, snippet: null, at: new Date().toISOString(), attachments: [],
  candidate_id: null, job_id: null, ...over,
})

describe('inbox helpers', () => {
  it('reads names and addresses', () => {
    expect(displayName('"Ana Pérez" <ana@x.com>')).toBe('Ana Pérez')
    expect(displayName('ana@x.com')).toBe('ana@x.com')
    expect(bareAddress('Ana <ANA@X.com>')).toBe('ana@x.com')
  })

  it('reply all leaves you out and puts the writer in To', () => {
    const r = replyAllRecipients(
      msg({ to_addresses: ['allan@virgilio.tech', 'maya@virgilio.tech'], cc_addresses: ['Leo <leo@virgilio.tech>', 'ANA@x.com'] }),
      ['Allan@virgilio.tech'],
    )
    expect(r.to).toBe('Ana <ana@x.com>')
    expect(r.cc).toEqual(['maya@virgilio.tech', 'Leo <leo@virgilio.tech>'])
  })

  it('reply all on your own message goes back to its recipients', () => {
    const r = replyAllRecipients(
      msg({ direction: 'sent', from_address: 'allan@virgilio.tech', to_addresses: ['ana@x.com', 'bo@x.com'], cc_addresses: ['allan@virgilio.tech'] }),
      ['allan@virgilio.tech'],
    )
    expect(r.to).toBe('ana@x.com')
    expect(r.cc).toEqual(['bo@x.com'])
  })

  it('short times', () => {
    const now = new Date('2026-10-25T18:00:00Z')
    expect(inboxTime('2026-10-25T17:59:30Z', now)).toBe('now')
    expect(inboxTime('2026-10-25T17:15:00Z', now)).toBe('45m')
  })
})
