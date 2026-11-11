import { toast } from 'sonner'

/**
 * Undo Send (Allan, 2026-11-11). Gmail can't take an email back once it has gone, so a
 * real Undo is a delayed commit (§5, §18): the composer closes at once, "Email sent to …"
 * shows with Undo, and the email is only sent once that toast is gone (it timed out, was
 * closed or swiped, or was dismissed by something else). Undo means it's never sent and
 * reopens the composer with the draft as it was, through `EmailOutboxHost` (mounted once
 * in App.tsx), so it works even after the page that wrote it has closed.
 *
 * The toast lasts as long as toasts do (6s) and its timer pauses on hover, so Undo works
 * for exactly as long as you can see it. While anything waits or is sending, closing or
 * reloading the tab asks first (beforeunload).
 */

export interface OutboxAttachment {
  file: File
  name: string
  size: number
}

/** Everything the composer needs to open again exactly as it was. */
export interface EmailDraft {
  // Where it was written
  candidateId?: string
  jobId?: string
  jhsId?: string
  associationId?: string
  inReplyToMessageId?: string
  candidateName?: string
  mode?: 'compose' | 'reply' | 'forward'
  bulk?: { candidateIds: string[]; jobId: string }
  bulkJobTitle?: string
  // What was in it
  fromEmail: string
  to: string[]
  cc: string[]
  bcc: string[]
  subjectHtml: string
  bodyHtml: string
  attachments: OutboxAttachment[]
  templateId: string | null
  scheduledAt: Date | null
}

export interface OutboxResult {
  /** Nothing went out: offers Open draft. */
  failed?: boolean
  /** Shown on failure, e.g. "Couldn't send the email to Priya Raman". */
  failMessage?: string
  /** A partial bulk send: shown as it is, no Open draft (a resend would repeat the rest). */
  partial?: string
}

interface QueueOptions {
  /** "Email sent to Priya Raman" */
  message: string
  description?: string
  draft: EmailDraft
  /** Sends it. Throwing counts as a failure. */
  send: () => Promise<OutboxResult | void>
  failMessage: string
}

type State = 'waiting' | 'sending' | 'done' | 'undone'

interface Item {
  id: string
  state: State
  opts: QueueOptions
  watchdog: number | null
  seen: boolean
  queuedAt: number
}

const items = new Map<string, Item>()
let seq = 0

// ── The reopened draft (read by EmailOutboxHost) ─────────────────────────
let restored: { key: string; draft: EmailDraft } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function subscribeRestored(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export const getRestored = () => restored
export function clearRestored() {
  restored = null
  emit()
}
export function reopenDraft(draft: EmailDraft) {
  restored = { key: `draft-${++seq}`, draft }
  emit()
}

// ── Leaving the tab while something waits ───────────────────────────────
function busy() {
  for (const it of items.values()) if (it.state === 'waiting' || it.state === 'sending') return true
  return false
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!busy()) return
  e.preventDefault()
  e.returnValue = ''
}
let guarding = false
function syncGuard() {
  if (typeof window === 'undefined') return
  const need = busy()
  if (need && !guarding) window.addEventListener('beforeunload', onBeforeUnload)
  if (!need && guarding) window.removeEventListener('beforeunload', onBeforeUnload)
  guarding = need
}

function stopWatchdog(it: Item) {
  if (it.watchdog != null) window.clearInterval(it.watchdog)
  it.watchdog = null
}

async function commit(id: string) {
  const it = items.get(id)
  if (!it || it.state !== 'waiting') return
  it.state = 'sending'
  stopWatchdog(it)
  syncGuard()
  let result: OutboxResult | undefined
  try {
    result = (await it.opts.send()) || undefined
  } catch {
    result = { failed: true }
  }
  it.state = 'done'
  items.delete(id)
  syncGuard()
  if (result?.failed) {
    toast.error(result.failMessage || it.opts.failMessage, {
      action: { label: 'Open draft', onClick: () => reopenDraft(it.opts.draft) },
    })
  } else if (result?.partial) {
    toast.error(result.partial)
  }
}

function undo(id: string) {
  const it = items.get(id)
  if (!it || it.state !== 'waiting') return
  it.state = 'undone'
  stopWatchdog(it)
  items.delete(id)
  syncGuard()
  reopenDraft(it.opts.draft)
}

/**
 * Hold an email and show its toast. The toast's own close (timer, ×, swipe) commits it;
 * a watchdog also commits once the toast has left the page by any other route (another
 * screen calling `toast.dismiss()`), so a waiting email is never left behind.
 */
export function queueEmail(opts: QueueOptions): string {
  const id = `gio-outbox-${Date.now().toString(36)}-${++seq}`
  const it: Item = { id, state: 'waiting', opts, watchdog: null, seen: false, queuedAt: Date.now() }
  items.set(id, it)
  syncGuard()

  toast(opts.message, {
    id,
    description: opts.description,
    className: id,
    action: { label: 'Undo', onClick: () => undo(id) },
    onAutoClose: () => void commit(id),
    onDismiss: () => void commit(id),
  })

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    it.watchdog = window.setInterval(() => {
      if (it.state !== 'waiting') return stopWatchdog(it)
      const there = !!document.querySelector(`.${id}`) // ids are [a-z0-9-] only
      if (there) it.seen = true
      // Gone after showing, or never drawn at all (no toaster on the page).
      if ((it.seen && !there) || (!it.seen && Date.now() - it.queuedAt > 2000)) void commit(id)
    }, 400)
  }
  return id
}

/** For tests: what is waiting right now. */
export function pendingEmails() {
  return [...items.values()].filter((i) => i.state === 'waiting').map((i) => i.id)
}
/** For tests: send or undo by id, as the toast would. */
export const __outbox = { commit, undo }

/** "Email sent to Priya Raman", "Email sent to 3 people", "Reply sent to …". */
export function sentMessage(d: Pick<EmailDraft, 'to' | 'candidateName' | 'mode'>) {
  const noun = d.mode === 'reply' ? 'Reply' : d.mode === 'forward' ? 'Email forwarded' : 'Email'
  const verb = d.mode === 'forward' ? '' : ' sent'
  const who =
    d.to.length > 1 ? `${d.to.length} people` : (d.candidateName?.trim() || d.to[0] || 'the candidate')
  return `${noun}${verb} to ${who}`
}
