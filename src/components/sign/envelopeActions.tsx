import { CalendarX, Trash2, type LucideIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { signActions, type EnvelopeRow } from '@/lib/sign/api'

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
 * The actions an envelope offers today, by status. Send reminder, Void, Correct,
 * Send now, Download and Duplicate join as their Edge Functions land (steps 7–9),
 * so nothing here is a button that can't do anything yet.
 */
export function useEnvelopeActions(opts: { onRemoved?: (id: string) => void } = {}) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['sign'] })
  const fail = (what: string) => (e: unknown) => {
    toast.error(`Couldn't ${what}`, { description: e instanceof Error ? e.message : undefined })
  }

  return (e: EnvelopeRow): EnvelopeAction[] => {
    const out: EnvelopeAction[] = []
    if (e.status === 'scheduled' && e.scheduled_at) {
      const at = e.scheduled_at
      out.push({
        id: 'unschedule',
        label: 'Cancel schedule',
        icon: CalendarX,
        footer: true,
        run: async () => {
          try {
            await signActions.unschedule(e.id)
            await refresh()
            undoToast('Schedule cancelled', async () => {
              try {
                await signActions.schedule(e.id, at)
                await refresh()
              } catch (err) {
                fail('schedule it again')(err)
              }
            }, 'Moved to Drafts. No one was emailed.')
          } catch (err) {
            fail('cancel the schedule')(err)
          }
        },
      })
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
}
