// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toastCalls: Array<{ message: string; opts: any }> = []
const errorCalls: Array<{ message: string; opts: any }> = []
vi.mock('sonner', () => {
  const t = (message: string, opts: any) => {
    toastCalls.push({ message, opts })
    return opts?.id
  }
  t.error = (message: string, opts: any) => {
    errorCalls.push({ message, opts })
  }
  return { toast: t }
})

import {
  queueEmail,
  pendingEmails,
  getRestored,
  clearRestored,
  sentMessage,
  type EmailDraft,
} from '@/lib/emailOutbox'

const draft = (over: Partial<EmailDraft> = {}): EmailDraft => ({
  fromEmail: 'me@virgilio.tech',
  to: ['priya@example.com'],
  cc: [],
  bcc: ['boss@example.com'],
  subjectHtml: 'Hello',
  bodyHtml: '<p>Hi Priya</p>',
  attachments: [],
  templateId: 't1',
  scheduledAt: null,
  candidateName: 'Priya Raman',
  ...over,
})

const last = () => toastCalls[toastCalls.length - 1]
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  toastCalls.length = 0
  errorCalls.length = 0
  clearRestored()
  document.body.innerHTML = ''
})
afterEach(() => vi.useRealTimers())

describe('emailOutbox', () => {
  it('holds the email until the toast closes on its own, then sends once', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    queueEmail({ message: 'Email sent to Priya Raman', draft: draft(), send, failMessage: 'x' })
    expect(last().message).toBe('Email sent to Priya Raman')
    expect(last().opts.action.label).toBe('Undo')
    expect(send).not.toHaveBeenCalled()
    expect(pendingEmails()).toHaveLength(1)
    last().opts.onAutoClose()
    last().opts.onDismiss() // a second close never sends twice
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(pendingEmails()).toHaveLength(0)
    expect(getRestored()).toBeNull()
  })

  it('Undo never sends and reopens the same draft', async () => {
    const send = vi.fn()
    const d = draft()
    queueEmail({ message: 'm', draft: d, send, failMessage: 'x' })
    last().opts.action.onClick()
    last().opts.onDismiss() // Sonner removing the toast after Undo
    await flush()
    expect(send).not.toHaveBeenCalled()
    expect(getRestored()?.draft).toBe(d)
    expect(getRestored()?.draft.bcc).toEqual(['boss@example.com'])
  })

  it('a failed send says so with Open draft, which reopens it', async () => {
    const d = draft()
    queueEmail({ message: 'm', draft: d, send: () => Promise.reject(new Error('500 raw server text')), failMessage: "Couldn't send the email to Priya Raman" })
    last().opts.onAutoClose()
    await flush()
    expect(errorCalls[0].message).toBe("Couldn't send the email to Priya Raman")
    expect(errorCalls[0].message).not.toContain('500')
    errorCalls[0].opts.action.onClick()
    expect(getRestored()?.draft).toBe(d)
  })

  it('a partial bulk send reports the counts without Open draft', async () => {
    queueEmail({ message: 'm', draft: draft(), send: async () => ({ partial: "10 sent · 2 couldn't be sent" }), failMessage: 'x' })
    last().opts.onDismiss()
    await flush()
    expect(errorCalls[0].message).toBe("10 sent · 2 couldn't be sent")
    expect(errorCalls[0].opts).toBeUndefined()
  })

  it('sends when the toast leaves the page some other way (toast.dismiss elsewhere)', async () => {
    vi.useFakeTimers()
    const send = vi.fn().mockResolvedValue(undefined)
    const id = queueEmail({ message: 'm', draft: draft(), send, failMessage: 'x' })
    const li = document.createElement('li')
    li.className = id
    document.body.appendChild(li)
    vi.advanceTimersByTime(450)
    expect(send).not.toHaveBeenCalled()
    li.remove()
    vi.advanceTimersByTime(450)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends anyway if no toast was ever drawn', () => {
    vi.useFakeTimers()
    const send = vi.fn().mockResolvedValue(undefined)
    queueEmail({ message: 'm', draft: draft(), send, failMessage: 'x' })
    vi.advanceTimersByTime(1600)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('asks before the tab closes while an email waits', async () => {
    queueEmail({ message: 'm', draft: draft(), send: async () => undefined, failMessage: 'x' })
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    last().opts.onAutoClose()
    await flush()
    const e2 = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e2)
    expect(e2.defaultPrevented).toBe(false)
  })

  it('names the email in the toast', () => {
    expect(sentMessage({ to: ['a@x.com'], candidateName: 'Priya Raman' })).toBe('Email sent to Priya Raman')
    expect(sentMessage({ to: ['a@x.com'], candidateName: 'Priya Raman', mode: 'reply' })).toBe('Reply sent to Priya Raman')
    expect(sentMessage({ to: ['a@x.com'], mode: 'forward' })).toBe('Email forwarded to a@x.com')
    expect(sentMessage({ to: ['a@x.com', 'b@x.com', 'c@x.com'], candidateName: 'Priya' })).toBe('Email sent to 3 people')
  })
})
