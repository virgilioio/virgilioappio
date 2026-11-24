import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { Archive, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CharCounterLine } from '@/components/ui/char-counter'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { shakeFirstInvalid } from '@/lib/motion'
import { useHeightTransition } from '@/lib/heightTransition'
import {
  CLOSE_NOTE_MAX,
  JOB_CLOSE_REASONS,
  closeReasonProblem,
  jobCloseReasonLabel,
  type JobCloseReason,
} from '@/lib/jobCloseReasons'

/**
 * The one Close job dialog (Allan, 2026-11-24): every close and archive asks
 * why. The job's unfilled openings (Req IDs) are cancelled with that reason by
 * the database, which also tells Gio Sales; the dialog names them. After a hire
 * fills the last opening it opens with Filled chosen ("All openings for … are
 * filled. Close the job?").
 *
 *   const answer = await requestCloseReason({ jobId, jobTitle, to: 'closed' })
 *   // { reason, note } or null when cancelled
 *
 * One host is mounted in App.tsx (`CloseJobReasonHost`).
 */
export interface CloseReasonRequest {
  jobId: string
  jobTitle?: string | null
  to: 'closed' | 'archived'
  /** Chosen when it opens (still changeable). Filled is chosen when every opening is filled. */
  preset?: JobCloseReason
  /** After a hire filled the last opening: the title asks, the buttons read Keep it open · Close job. */
  afterHire?: boolean
  /** People still in the pipeline, rejected next (the reject form follows). */
  remaining?: number
}

export interface CloseReasonAnswer {
  reason: Exclude<JobCloseReason, 'not_recorded'>
  note: string | null
}

type Pending = CloseReasonRequest & { resolve: (a: CloseReasonAnswer | null) => void }
let enqueue: ((r: Pending) => void) | null = null

export function requestCloseReason(req: CloseReasonRequest): Promise<CloseReasonAnswer | null> {
  return new Promise((resolve) => {
    if (enqueue) enqueue({ ...req, resolve })
    else resolve(null)
  })
}

export function CloseJobReasonHost() {
  const [current, setCurrent] = React.useState<Pending | null>(null)
  const [open, setOpen] = React.useState(false)
  const settled = React.useRef(false)

  React.useEffect(() => {
    enqueue = (r) => {
      settled.current = false
      setCurrent(r)
      setOpen(true)
    }
    return () => {
      enqueue = null
    }
  }, [])

  const finish = (a: CloseReasonAnswer | null) => {
    if (!current || settled.current) return
    settled.current = true
    current.resolve(a)
    setOpen(false)
    const was = current
    // Unmount after the exit (--dur-dialog-out).
    window.setTimeout(() => setCurrent((c) => (c === was ? null : c)), 200)
  }

  if (!current) return null
  return <CloseJobDialog key={current.jobId + current.to} request={current} open={open} onAnswer={finish} />
}

interface OpeningRow {
  req_id: string
  hired_association_id: string | null
  cancelled_at: string | null
  sales_deal_id: string | null
}

function useOpenings(jobId: string) {
  const [rows, setRows] = React.useState<OpeningRow[] | null>(null)
  React.useEffect(() => {
    let live = true
    void supabase
      .from('job_openings')
      .select('req_id, hired_association_id, cancelled_at, sales_deal_id')
      .eq('job_id', jobId)
      .order('position')
      .then(({ data, error }) => {
        if (live) setRows(error ? [] : ((data ?? []) as OpeningRow[]))
      })
    return () => {
      live = false
    }
  }, [jobId])
  return rows
}

function list(ids: string[]) {
  if (ids.length <= 3) return ids.length === 1 ? ids[0] : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`
  return `${ids.slice(0, 3).join(', ')} and ${ids.length - 3} more`
}

export function CloseJobDialog({
  request,
  open,
  onAnswer,
}: {
  request: CloseReasonRequest
  open: boolean
  onAnswer: (a: CloseReasonAnswer | null) => void
}) {
  const { jobId, jobTitle, to, afterHire, remaining = 0 } = request
  const title = jobTitle?.trim() || 'this job'
  const openings = useOpenings(jobId)
  const live = (openings ?? []).filter((o) => !o.cancelled_at)
  const unfilled = live.filter((o) => !o.hired_association_id)
  const allFilled = openings !== null && live.length > 0 && unfilled.length === 0

  const [reason, setReason] = React.useState<CloseReasonAnswer['reason'] | null>(
    (request.preset && request.preset !== 'not_recorded' ? request.preset : null) as CloseReasonAnswer['reason'] | null,
  )
  const [note, setNote] = React.useState('')
  const [tried, setTried] = React.useState(false)
  const touched = React.useRef(false)
  // Filled is chosen once the openings say every one is filled (unless they picked).
  React.useEffect(() => {
    if (allFilled && !touched.current && !reason) setReason('filled')
  }, [allFilled, reason])

  const formRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const resizeRef = useHeightTransition<HTMLDivElement>()
  const problem = closeReasonProblem(reason, note)
  const reasonMissing = tried && !reason
  const noteMissing = tried && !!reason && !!problem

  const submit = () => {
    setTried(true)
    if (problem) {
      shakeFirstInvalid(formRef.current)
      return
    }
    onAnswer({ reason: reason!, note: note.trim() || null })
  }

  const label = reason ? jobCloseReasonLabel(reason) : null
  const sales = unfilled.some((o) => o.sales_deal_id)
  const Icon = afterHire ? CheckCircle2 : to === 'archived' ? Archive : XCircle
  const heading = afterHire
    ? `All openings for ${title} are filled. Close the job?`
    : to === 'archived'
      ? `Archive ${title}?`
      : `Close ${title}?`
  const what =
    to === 'archived'
      ? 'It moves to the Archived tab on Jobs, its postings go offline and shared candidate profiles stop working.'
      : 'It stops taking applications and moves to the Closed tab on Jobs; its postings go offline and shared candidate profiles stop working.'

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onAnswer(null) }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/80 gio-dialog-overlay" onClick={() => onAnswer(null)} />
        <AlertDialogPrimitive.Content
          ref={resizeRef}
          className={cn(
            'fixed left-[50%] top-[50%] z-[90] [translate:-50%_-50%] w-[min(440px,calc(100vw-32px))]',
            'border bg-background shadow-lg gio-dialog rounded-lg',
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            triggerRef.current?.focus()
          }}
        >
          <div className="flex items-start gap-[14px] px-[22px] pt-[22px] pb-[14px]">
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F1F0EC] text-text-secondary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <AlertDialogPrimitive.Title className="mt-0.5 line-clamp-3 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                {heading}
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="mt-1 text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                {what} You can reopen it in Edit job › Status.
              </AlertDialogPrimitive.Description>
            </div>
          </div>

          <div ref={formRef} className="flex flex-col gap-1.5 px-[22px] pb-[14px]">
            <label htmlFor="close-reason" className="text-[13px] font-medium text-text-primary">
              Why is it {to === 'archived' ? 'being archived' : 'closing'}?
            </label>
            <Select
              value={reason ?? undefined}
              onValueChange={(v) => {
                touched.current = true
                setReason(v as CloseReasonAnswer['reason'])
              }}
            >
              <SelectTrigger id="close-reason" ref={triggerRef} aria-invalid={reasonMissing || undefined}>
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                {JOB_CLOSE_REASONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="gio-field-message min-h-[18px] text-xs leading-[18px] text-[var(--color-danger)]" role="alert">
              {reasonMissing ? 'Pick why the job is closing.' : ''}
            </p>

            <label htmlFor="close-note" className="text-[13px] font-medium text-text-primary">
              Note{reason === 'other' ? '' : <span className="font-normal text-text-secondary"> (optional)</span>}
            </label>
            <Textarea
              id="close-note"
              value={note}
              maxLength={CLOSE_NOTE_MAX}
              rows={2}
              placeholder={reason === 'other' ? 'Say why it’s closing' : 'Anything the team or the deal should know'}
              aria-invalid={noteMissing || undefined}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <CharCounterLine count={note.length} max={CLOSE_NOTE_MAX}>
              {noteMissing ? <span className="text-[var(--color-danger)]">{problem}</span> : null}
            </CharCounterLine>

            <p className="min-h-[18px] text-[12.5px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
              {openings === null
                ? ''
                : unfilled.length
                  ? `${list(unfilled.map((o) => o.req_id))} ${unfilled.length === 1 ? 'isn’t' : 'aren’t'} filled and ${unfilled.length === 1 ? 'is' : 'are'} cancelled${label ? ` as “${label}”` : ''}${sales ? '; the deal in Gio Sales hears about it' : ''}.`
                  : live.length
                    ? `Every opening is filled.`
                    : ''}
              {remaining > 0
                ? ` ${remaining} ${remaining === 1 ? 'person is' : 'people are'} still in the pipeline; you’ll reject them next.`
                : ''}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-virgilio-border px-[22px] py-[14px]">
            <Button variant="secondary" size="sm" onClick={() => onAnswer(null)}>
              {afterHire ? 'Keep it open' : 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              {to === 'archived' ? 'Archive job' : 'Close job'}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
