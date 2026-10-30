import { useEffect, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { RotateCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import {
  SLACK_EVENT,
  TRIGGER_LABEL,
  deliveryOutcome,
  useRetrySlackDelivery,
  useSendNow,
  useSendNowPreview,
  useSlackHistory,
  type SlackAutomation,
  type SlackHistoryRow,
  type SlackWaiting,
} from '@/lib/slack'
import { cn } from '@/lib/utils'

const TONE: Record<ReturnType<typeof deliveryOutcome>['tone'], string> = {
  ok: 'bg-[#E7F6EF] text-[#0B7A52]',
  warn: 'bg-[#FEF3C7] text-[#8A5306]',
  bad: 'bg-[#FEE2E2] text-[#B91C1C]',
  muted: 'bg-[#F1F0EC] text-[#5A6072]',
  busy: 'bg-[#E8F0FE] text-[#2563EB]',
}

function ago(at: string) {
  return formatDistanceToNowStrict(new Date(at), { addSuffix: true })
}

/**
 * What an automation sent (Allan, 2026-10-28): its last 50 messages, newest
 * first, in one card of rows: the outcome, who it was about, who it reached
 * and what started it, then anything that didn't reach (Slack's reason) or
 * why it was skipped. A message that didn't go out has Send again. Names
 * only, from slack_automation_history.
 */
export function SlackHistoryPanel({ automationId }: { automationId: string }) {
  const history = useSlackHistory(automationId)
  const retry = useRetrySlackDelivery()
  const timedOut = useLoadTimeout(history.isLoading, history.dataUpdatedAt)
  const rows = history.data?.rows ?? []

  const sendAgain = (row: SlackHistoryRow) => {
    retry.mutate(
      { deliveryId: row.id, automationId },
      {
        onSuccess: () => toast('Sending it again', { description: 'It goes out within a minute; its row updates here.' }),
        onError: (e) => toast.error('Couldn’t send it again', { description: e.message }),
      },
    )
  }

  if (history.isError || timedOut) {
    return <LoadError what="this automation’s messages" compact timedOut={timedOut && !history.isError} onRetry={() => void history.refetch()} />
  }

  return (
    <Loadable
      loading={history.isLoading}
      skeleton={
        <div className="flex flex-col divide-y divide-[#F1F0EC] overflow-clip rounded-xl border border-[#EFEEEA] bg-white">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-[64px] items-center gap-3 px-3">
              <Skeleton className="h-5 w-16 rounded-md" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-2.5 w-3/5" /></div>
            </div>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#EFEEEA] bg-white py-6">
          <AnimatedEmpty
            scene="scheduling"
            size="compact"
            onceKey="slack-history-empty"
            title="Nothing sent yet"
            body="Each message shows here as it goes out, with who it reached and anything that didn’t."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-inter text-[12px] text-text-tertiary tabular-nums">
            {rows.length === 50 ? 'The last 50 messages' : `${rows.length} message${rows.length === 1 ? '' : 's'}`}
          </p>
          <ul className="divide-y divide-[#F1F0EC] overflow-clip rounded-xl border border-[#EFEEEA] bg-white">
            {rows.map((row) => (
              <HistoryRow key={row.id} row={row} onRetry={sendAgain} retrying={retry.isPending && retry.variables?.deliveryId === row.id} />
            ))}
          </ul>
        </div>
      )}
    </Loadable>
  )
}

function HistoryRow({ row, onRetry, retrying }: { row: SlackHistoryRow; onRetry: (row: SlackHistoryRow) => void; retrying: boolean }) {
  const outcome = deliveryOutcome(row)
  const about = row.candidate
    ? [row.candidate, row.job].filter(Boolean).join(' · ')
    : row.member ?? row.job ?? 'Gio'
  const reached = row.recipients.filter((r) => r.ok && !r.problem).map((r) => r.to)
  const problems = row.recipients.map((r) => r.problem).filter(Boolean) as string[]
  const how = TRIGGER_LABEL[row.trigger]
  const meta = [
    reached.length ? `To ${reached.join(', ')}` : null,
    how ? (row.by ? `${how} by ${row.by}` : how) : null,
  ].filter(Boolean).join(' · ')
  // Why it didn't reach, why it was skipped, or when it tries again.
  const note =
    problems.length > 0
      ? problems.join(' ')
      : row.status === 'failed'
        ? row.error ?? 'Nothing went out.'
        : row.status === 'skipped'
          ? row.error
          : row.status === 'queued' && row.attempts > 0 && row.next_attempt_at
            ? `Slack was busy. Trying again at ${format(new Date(row.next_attempt_at), 'p')}.`
            : null
  const at = row.sent_at ?? row.created_at

  return (
    <li data-row-id={row.id} className="flex items-start gap-3 px-3 py-2.5">
      <span className={cn('mt-0.5 inline-flex h-5 shrink-0 items-center rounded-md px-1.5 font-inter text-[11px] font-medium', TONE[outcome.tone])}>
        {outcome.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate font-inter text-[13px] font-medium leading-5 text-text-primary">{about}</p>
          <time dateTime={at} className="shrink-0 font-inter text-[11.5px] tabular-nums text-text-tertiary">
            {ago(at)}
          </time>
        </div>
        {meta && <p className="truncate font-inter text-[12px] leading-[18px] text-text-secondary">{meta}</p>}
        {note && (
          <p className={cn('font-inter text-[12px] leading-[18px]', outcome.tone === 'bad' || outcome.tone === 'warn' ? 'text-[#B42318]' : 'text-text-tertiary')}>
            {note}
          </p>
        )}
      </div>
      {row.can_retry && (
        <Button size="sm" variant="secondary" icon={RotateCw} loading={retrying} onClick={() => onRetry(row)} className="shrink-0">
          Send again
        </Button>
      )}
    </li>
  )
}

function waitingLine(w: SlackWaiting) {
  return [w.candidate, w.job, w.stage, w.waiting ? `waiting ${w.waiting}` : null, w.progress].filter(Boolean).join(' · ')
}

function initials(name?: string) {
  return (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

/**
 * Send now (2026-10-28): who a reminder is waiting on right now, then one
 * button sends it to all of them. At most once every 10 minutes per
 * automation; the schedule counts from it, so nobody gets two in a row.
 * In the action-dialog frame (badge, title, description, footer bar).
 */
export function SendNowDialog({
  open,
  onOpenChange,
  tenantId,
  automation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  automation: SlackAutomation
}) {
  const preview = useSendNowPreview(automation.id, open)
  const send = useSendNow(tenantId)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const def = SLACK_EVENT[automation.event]
  const waiting = preview.data?.waiting ?? []
  const n = waiting.length
  const waitUntil = preview.data?.next_at ?? null
  const off = preview.data ? !preview.data.active : !automation.is_active
  const ready = !!preview.data && n > 0 && !waitUntil && !off

  useEffect(() => {
    if (open) send.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    if (send.isPending) return
    onOpenChange(false)
  }

  const submit = () => {
    if (!ready) return
    send.mutate(automation.id, {
      onSuccess: (r) => {
        toast(`${r.queued} reminder${r.queued === 1 ? '' : 's'} on the way to Slack`, {
          description: 'Each one shows in this automation’s History as it goes out.',
        })
        onOpenChange(false)
      },
    })
  }

  const title = !preview.data
    ? 'Send these reminders now?'
    : n === 0
      ? 'Nobody’s waiting right now'
      : `Send ${n} reminder${n === 1 ? '' : 's'} now?`

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="gio-dialog-overlay fixed inset-0 z-[80]" style={{ background: 'rgba(13,13,9,0.34)' }} />
        <DialogPrimitive.Content
          className="gio-dialog fixed left-1/2 top-1/2 z-[90] flex flex-col overflow-hidden bg-white [translate:-50%_-50%] focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (send.isPending) e.preventDefault()
          }}
          style={{
            width: 480,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header className="flex shrink-0 items-start gap-[14px]" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDE4FF] text-[#6F3FF5]">
              <Send className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                {automation.name?.trim() || def?.when}. Each person gets it in Slack right away, and their next scheduled
                reminder counts from now.
              </DialogPrimitive.Description>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" style={{ padding: '18px 24px' }}>
            {preview.isLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-[10px]" />)}
              </div>
            ) : preview.isError ? (
              <LoadError what="who’s waiting" compact onRetry={() => void preview.refetch()} />
            ) : n === 0 ? (
              <p className="font-inter text-[13px] leading-[1.5] text-text-secondary">
                {automation.event === 'scorecard.due'
                  ? 'Every interviewer has handed in their scorecard, or no interview has ended yet.'
                  : automation.event === 'offer.approval_waiting'
                    ? 'No offer is waiting for anyone’s approval.'
                    : 'Everyone’s profile is complete.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {waiting.slice(0, 8).map((w, i) => (
                  <li key={`${w.to}-${i}`} className="flex items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3 py-2">
                    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white font-inter text-[10.5px] font-semibold text-[#5A6072] ring-1 ring-[#E7E8EE]">
                      {initials(w.to)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-inter text-[13px] font-medium text-text-primary">{w.to ?? 'Someone'}</p>
                      <p className="truncate font-inter text-[12px] text-text-tertiary">{waitingLine(w)}</p>
                    </div>
                  </li>
                ))}
                {n > 8 && <li className="px-3 pt-1 font-inter text-[12px] text-text-tertiary tabular-nums">+{n - 8} more</li>}
              </ul>
            )}

            {preview.data && n > 0 && (waitUntil || off) && (
              <p className="rounded-[10px] border border-[#FCE7B2] bg-[#FFFBEB] px-3 py-2 font-inter text-[12.5px] leading-[1.5] text-[#7C4A03]" role="note">
                {off
                  ? 'This automation is off. Turn it on to send its reminders.'
                  : `These went out a few minutes ago. You can send again at ${format(new Date(waitUntil!), 'p')}.`}
              </p>
            )}
            {send.isError && (
              <p className="rounded-[10px] border border-[#F3D0CC] bg-[#FEF4F4] px-3 py-2 font-inter text-[12.5px] text-[#B91C1C]" role="alert">
                {send.error.message}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            <Button ref={cancelRef} type="button" variant="secondary" size="md" disabled={send.isPending} onClick={close}>
              {n === 0 && preview.data ? 'Close' : 'Cancel'}
            </Button>
            {(!preview.data || n > 0) && (
              <Button
                type="button"
                size="md"
                icon={Send}
                loading={send.isPending}
                onClick={submit}
                aria-disabled={!ready || undefined}
                style={ready ? undefined : { opacity: 0.4, pointerEvents: 'none' }}
              >
                {n > 0 ? `Send ${n} reminder${n === 1 ? '' : 's'}` : 'Send reminders'}
              </Button>
            )}
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
