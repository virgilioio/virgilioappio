/**
 * What the queue's buttons do (Allan, 2026-11-14). Actions that finish the item
 * (Approve, Advance, No reply needed, Hide) take the row away at once (it folds
 * shut, §18) and say so in a toast, with Undo where it can be undone; actions that
 * open something (a scorecard, the Offer tab, Application review, the composer, the
 * Reject dialog) leave the row until the work is really done.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { RejectionDialog } from '@/components/candidates/RejectionDialog'
import { fetchEmailForReply } from '@/lib/emailLog'
import { formatQuotedReply, getReplySubject } from '@/utils/emailFormatUtils'
import { collapseRows } from '@/lib/motion'
import { undoToast } from '@/lib/undoToast'
import { advanceCandidate, approvalError, approveOfferStep, candidateEmail, profileHref } from '@/lib/queueActions'
import type { QueueItem } from '@/lib/queue'
import type { QueueActionId } from '@/lib/queue'

interface Options {
  hide: (keys: string[]) => Promise<unknown>
  show: (keys: string[]) => Promise<unknown>
}

interface ReplyState {
  item: QueueItem
  to?: string
  subject?: string
  body?: string
  cc?: string
  replyToId?: string
}

interface RejectState {
  item: QueueItem
  email: string
}

function rowEl(id: string): Element | null {
  return document.querySelector(`[data-queue-row="${CSS.escape(id)}"]`)
}

export function useQueueRowActions({ hide, show }: Options) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<{ id: string; action: QueueActionId } | null>(null)
  /** Rows taken away before the server says so (and put back by Undo or a failure). */
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [reply, setReply] = useState<ReplyState | null>(null)
  const [reject, setReject] = useState<RejectState | null>(null)

  const take = useCallback(async (item: QueueItem) => {
    await collapseRows([rowEl(item.id)]).done
    setGone((prev) => new Set(prev).add(item.id))
  }, [])
  const putBack = useCallback((item: QueueItem) => {
    setGone((prev) => {
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
  }, [])
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
    void queryClient.invalidateQueries({ queryKey: ['new-applications-queue'] })
  }, [queryClient])

  const hideRow = useCallback(
    async (item: QueueItem, message = `Hidden from your queue · ${item.candidateName}`) => {
      await take(item)
      try {
        await hide(item.dismissKeys)
      } catch {
        putBack(item)
        toast("Couldn't hide it", { action: { label: 'Retry', onClick: () => void hideRow(item, message) } })
        return
      }
      undoToast(message, async () => {
        await show(item.dismissKeys)
        putBack(item)
      })
    },
    [hide, show, take, putBack],
  )

  const run = useCallback(
    async (item: QueueItem, action: QueueActionId) => {
      const cand = item.candidateId
      switch (action) {
        case 'scorecard':
          if (cand) navigate(profileHref(item.jobId, cand, item.isOwn === false ? 'tab=scorecards' : 'focus=my-scorecard'))
          return
        case 'decline':
          if (cand) navigate(profileHref(item.jobId, cand, 'tab=offer&focus=approval'))
          return
        case 'review':
          navigate(`/jobs/${item.jobId}?review=1`)
          return
        case 'no_reply':
          await hideRow(item, `Marked no reply needed · ${item.candidateName}`)
          return
        case 'approve': {
          if (!item.offerStepId) return
          setBusy({ id: item.id, action })
          try {
            await approveOfferStep(item.offerStepId)
          } catch (e) {
            setBusy(null)
            toast(`Couldn't approve the offer for ${item.candidateName}`, {
              description: approvalError(e),
              action: { label: 'Retry', onClick: () => void run(item, 'approve') },
            })
            return
          }
          setBusy(null)
          await take(item)
          toast(`Offer approved · ${item.candidateName}`)
          void queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
          refresh()
          return
        }
        case 'advance': {
          if (!item.associationId || !item.stageInstanceId) return
          setBusy({ id: item.id, action })
          let result
          try {
            result = await advanceCandidate({
              associationId: item.associationId,
              jobId: item.jobId,
              currentJhsId: item.stageInstanceId,
            })
          } catch {
            setBusy(null)
            toast(`Couldn't move ${item.candidateName}`, { action: { label: 'Retry', onClick: () => void run(item, 'advance') } })
            return
          }
          setBusy(null)
          if (result.status === 'gated') {
            toast('Scorecard required', {
              description: result.reason,
              action: cand
                ? { label: 'Submit scorecard', onClick: () => navigate(profileHref(item.jobId, cand, 'focus=my-scorecard')) }
                : undefined,
            })
            return
          }
          if (result.status === 'last') {
            toast(`${item.candidateName} is at the last stage of the plan`, {
              description: 'Open the profile to make an offer or mark them hired.',
              action: cand ? { label: 'Open profile', onClick: () => navigate(profileHref(item.jobId, cand)) } : undefined,
            })
            return
          }
          await take(item)
          refresh()
          const undo = result.undo
          undoToast(`Moved ${item.candidateName} to ${result.to.name}`, async () => {
            try {
              await undo()
            } catch {
              toast(`Couldn't move ${item.candidateName} back`)
              return
            }
            putBack(item)
            refresh()
          })
          return
        }
        case 'reply': {
          if (!item.emailId) {
            if (cand) navigate(profileHref(item.jobId, cand, 'tab=activity'))
            return
          }
          setBusy({ id: item.id, action })
          const email = await fetchEmailForReply(item.emailId)
          setBusy(null)
          if (!email) {
            toast('Couldn’t open that email', { description: 'It may have been removed. Open the profile’s Activity to reply.' })
            return
          }
          const received = email.direction === 'received'
          setReply({
            item,
            to: received ? email.from_address : email.to_addresses[0],
            subject: getReplySubject(email.subject),
            body: formatQuotedReply(email),
            cc: email.cc_addresses?.join(', ') || undefined,
            replyToId: email.id,
          })
          return
        }
        case 'reject': {
          if (!cand || !item.associationId) return
          setBusy({ id: item.id, action })
          const email = await candidateEmail(cand)
          setBusy(null)
          setReject({ item, email })
          return
        }
      }
    },
    [hideRow, navigate, putBack, queryClient, refresh, take],
  )

  const dialogs: ReactNode = (
    <>
      <MinimizableEmailComposer
        isOpen={!!reply}
        onOpenChange={(open) => {
          if (!open) setReply(null)
        }}
        candidateId={reply?.item.candidateId ?? undefined}
        jobId={reply?.item.jobId || undefined}
        candidateName={reply?.item.candidateName}
        mode="reply"
        defaultTo={reply?.to}
        defaultSubject={reply?.subject}
        defaultBody={reply?.body}
        defaultCc={reply?.cc}
        inReplyToMessageId={reply?.replyToId}
        onSuccess={() => {
          // Sent (or waiting out Undo Send): the reply is no longer owed.
          const item = reply?.item
          setReply(null)
          if (item) {
            void take(item)
            void hide(item.dismissKeys)
          }
        }}
      />
      {reject && (
        <RejectionDialog
          open
          onOpenChange={(open) => {
            if (!open) setReject(null)
          }}
          associationId={reject.item.associationId}
          candidateId={reject.item.candidateId ?? undefined}
          candidateName={reject.item.candidateName}
          candidateEmail={reject.email}
          jobId={reject.item.jobId}
          jobTitle={reject.item.jobTitle}
          onSuccess={() => {
            const item = reject.item
            setReject(null)
            void take(item)
            refresh()
          }}
        />
      )}
    </>
  )

  return {
    run,
    hideRow,
    gone,
    busyFor: (item: QueueItem): QueueActionId | null => (busy?.id === item.id ? busy.action : null),
    dialogs,
  }
}
