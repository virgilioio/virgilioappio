import { useState, type ReactNode } from 'react'
import { Ban, BellRing, CalendarX, PencilLine, Send, Trash2, type LucideIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { signActions, signErrorMessage, type EnvelopeRow } from '@/lib/sign/api'
import { CorrectSheet, VoidDialog } from './ManageDialogs'

export interface EnvelopeAction {
  id: string
  label: string
  icon: LucideIcon
  danger?: boolean
  /** Shown as a footer button in the details sheet (secondary unless `primary`). */
  footer?: boolean
  primary?: boolean
  run: () => void | Promise<void>
}

/**
 * What can be done to an envelope, by status. Render `dialogs` once next to
 * whatever shows the actions (Void and Correct open from here).
 *   module: the Sign module (admins). Cancel schedule leaves a draft.
 *   record: an Agreements card. Cancel schedule takes it off the record;
 *           Undo puts it back on schedule.
 */
export function useEnvelopeActions(opts: { onRemoved?: (id: string) => void; context?: 'module' | 'record' } = {}): {
  actionsFor: (e: EnvelopeRow) => EnvelopeAction[]
  dialogs: ReactNode
} {
  const qc = useQueryClient()
  const [voiding, setVoiding] = useState<EnvelopeRow | null>(null)
  const [correcting, setCorrecting] = useState<EnvelopeRow | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['sign'] })
  const fail = (what: string) => (e: unknown) => {
    toast.error(signErrorMessage(e, `Couldn’t ${what}. Try again.`))
  }
  const record = opts.context === 'record'

  const actionsFor = (e: EnvelopeRow): EnvelopeAction[] => {
    const out: EnvelopeAction[] = []
    if (e.status === 'sent') {
      out.push({
        id: 'remind',
        label: 'Send reminder',
        icon: BellRing,
        footer: true,
        primary: true,
        run: async () => {
          try {
            const r = await signActions.remind(e.id)
            await refresh()
            toast.success(r.reminded ? 'Reminder sent' : 'No one to remind right now', {
              description: r.reminded ? 'They got a fresh link; the one in their earlier email still works.' : undefined,
            })
          } catch (err) {
            fail('send the reminder')(err)
          }
        },
      })
      out.push({ id: 'correct', label: 'Correct', icon: PencilLine, footer: true, run: () => setCorrecting(e) })
    }
    if (e.status === 'scheduled' && e.scheduled_at) {
      const at = e.scheduled_at
      out.push({
        id: 'send-now',
        label: 'Send now',
        icon: Send,
        footer: true,
        primary: true,
        run: async () => {
          try {
            await signActions.sendNow(e.id)
            await refresh()
            toast.success('Sending now', { description: 'The email goes out within a minute.' })
          } catch (err) {
            fail('send it now')(err)
          }
        },
      })
      out.push({ id: 'correct', label: 'Correct', icon: PencilLine, run: () => setCorrecting(e) })
      out.push({
        id: 'unschedule',
        label: 'Cancel schedule',
        icon: CalendarX,
        footer: true,
        run: async () => {
          try {
            await signActions.unschedule(e.id)
            if (record) await signActions.setDraftRemoved(e.id, true)
            await refresh()
            undoToast(
              'Schedule cancelled',
              async () => {
                try {
                  if (record) await signActions.setDraftRemoved(e.id, false)
                  await signActions.schedule(e.id, at)
                  await refresh()
                } catch (err) {
                  fail('schedule it again')(err)
                }
              },
              record ? 'No one was emailed.' : 'Moved to Drafts. No one was emailed.',
            )
          } catch (err) {
            fail('cancel the schedule')(err)
          }
        },
      })
    }
    if (e.status === 'sent' || e.status === 'scheduled' || e.status === 'queued') {
      out.push({ id: 'void', label: 'Void envelope', icon: Ban, danger: true, run: () => setVoiding(e) })
    }
    if (e.status === 'draft') {
      out.push({
        id: 'remove',
        label: 'Remove draft',
        icon: Trash2,
        danger: true,
        footer: true,
        run: async () => {
          const ok = await confirmDestructive({
            title: `Remove ${e.title}?`,
            description: 'This draft was never sent, so no one is notified. You can bring it back from the toast.',
            confirmLabel: 'Remove draft',
            variant: 'remove',
            icon: Trash2,
          })
          if (!ok) return
          try {
            await signActions.setDraftRemoved(e.id, true)
            opts.onRemoved?.(e.id)
            await refresh()
            undoToast(`${e.title} removed`, async () => {
              try {
                await signActions.setDraftRemoved(e.id, false)
                await refresh()
              } catch (err) {
                fail('bring the draft back')(err)
              }
            })
          } catch (err) {
            fail('remove the draft')(err)
          }
        },
      })
    }
    return out
  }

  const dialogs = (
    <>
      <VoidDialog envelope={voiding} open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)} />
      <CorrectSheet envelope={correcting} open={!!correcting} onOpenChange={(o) => !o && setCorrecting(null)} />
    </>
  )
  return { actionsFor, dialogs }
}
