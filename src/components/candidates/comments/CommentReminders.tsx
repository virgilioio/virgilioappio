import { useState } from 'react'
import { format, formatDistanceToNowStrict, isPast, parseISO } from 'date-fns'
import { Bell, Check, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { useCandidateReminders, type CandidateReminder } from '@/hooks/useCandidateReminders'
import { ReminderForm } from '@/components/candidates/ReminderForm'
import { cn } from '@/lib/utils'

/**
 * The reminders row under the comment box (2026-10-19, replacing the
 * Reminders card on the Comments tab): one line saying how many are open,
 * "Remind me" to add one, then each open reminder on a single line. The form
 * opens in place (grid-rows height, §2).
 */
export function CommentReminders({ candidateId, jobId }: { candidateId: string; jobId: string | null }) {
  const { reminders, isLoading, createReminder, updateReminder, completeReminder, deleteReminder, isCreating, isUpdating } =
    useCandidateReminders(candidateId, jobId)
  const [form, setForm] = useState<'new' | CandidateReminder | null>(null)
  const editing = form && form !== 'new' ? form : null

  const label = isLoading
    ? 'Reminders'
    : reminders.length === 0
      ? 'No reminders'
      : `${reminders.length} reminder${reminders.length === 1 ? '' : 's'}`

  const remove = async (r: CandidateReminder) => {
    const ok = await confirmDestructive({
      title: `Delete the reminder “${r.subject}”?`,
      description: r.is_team_visible
        ? 'It’s a team reminder, so it goes for everyone and nobody is reminded when it’s due. This can’t be undone.'
        : 'You won’t be reminded when it’s due. Your other reminders stay. This can’t be undone.',
      confirmLabel: 'Delete reminder',
    })
    if (ok) deleteReminder(r.id)
  }

  return (
    <div className="rounded-[10px] bg-[#FAFAF7]">
      <div className="flex h-8 items-center gap-2 pl-2.5 pr-1">
        <Bell className="h-3.5 w-3.5 shrink-0 text-[#8B8F9E]" aria-hidden />
        <span className="font-inter text-[12px] text-[#5A6072] tabular-nums">{label}</span>
        <Button
          variant="ghost"
          size="xs"
          icon={Plus}
          className="ml-auto"
          aria-expanded={form === 'new'}
          onClick={() => setForm((f) => (f === 'new' ? null : 'new'))}
        >
          Remind me
        </Button>
      </div>

      {reminders.length > 0 && (
        <ul className="px-1 pb-1">
          {reminders.map((r) => {
            const due = parseISO(r.due_at)
            const late = isPast(due)
            return (
              <li key={r.id} className={cn('flex items-center gap-1.5 rounded-md px-1.5 py-1', editing?.id === r.id && 'bg-white')}>
                <IconTip label="Mark as done">
                  <button
                    type="button"
                    aria-label={`Mark “${r.subject}” as done`}
                    onClick={() => completeReminder(r.id)}
                    className="gio-pressable group inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#C9C8C1] bg-white text-transparent transition-colors duration-hover hover:border-emerald-500 hover:text-emerald-600"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                </IconTip>
                <span className="min-w-0 flex-1 truncate font-inter text-[12px] font-medium text-[#1F2230]">{r.subject}</span>
                {r.is_team_visible && <Users className="h-3 w-3 shrink-0 text-[#8B8F9E]" aria-label="Team reminder" />}
                <time
                  dateTime={r.due_at}
                  title={format(due, 'MMM d, h:mm a')}
                  className={cn('shrink-0 font-inter text-[11px] tabular-nums', late ? 'font-medium text-[#C2372B]' : 'text-[#8B8F9E]')}
                >
                  {late ? `${formatDistanceToNowStrict(due)} late` : `in ${formatDistanceToNowStrict(due)}`}
                </time>
                <DropdownMenu>
                  <IconTip label="Reminder actions">
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for “${r.subject}”`}
                        className="gio-pressable inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8B8F9E] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230]"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                  </IconTip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setForm(r)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => completeReminder(r.id)}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark as done
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void remove(r)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete reminder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      <Collapsible open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <CollapsibleContent className="px-1 pb-1">
          {form && (
            <ReminderForm
              key={editing?.id ?? 'new'}
              reminder={editing ?? undefined}
              isSubmitting={editing ? isUpdating : isCreating}
              onCancel={() => setForm(null)}
              onSubmit={(data) => {
                if (editing) updateReminder({ id: editing.id, ...data })
                else createReminder({ candidate_id: candidateId, job_id: jobId, ...data })
                setForm(null)
              }}
            />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
