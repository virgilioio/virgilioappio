import { formatDistanceToNowStrict } from 'date-fns'
import { Copy, History, MoreHorizontal, Pencil, Send, SendHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { IconTip } from '@/components/ui/tooltip'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { undoToast } from '@/lib/undoToast'
import {
  SLACK_EVENT,
  canSeeHistory,
  canSendNow,
  destinationsSentence,
  useSetSlackAutomation,
  useSlackTest,
  type SlackAutomation,
} from '@/lib/slack'
import { cn } from '@/lib/utils'

const ICON_BTN =
  'gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230] disabled:opacity-40 disabled:pointer-events-none'

/**
 * Slack automations as sentences (2026-10-27; compact 2026-10-28): one card
 * of 52px rows, "When a candidate is hired" over where it goes and when it
 * last went out (or why it didn't). On/off is a switch; Edit, Duplicate,
 * Send test and Remove (with Undo) sit in the ⋯ menu, shown on hover with a
 * mouse and always on touch. The status opens what it sent (History), and
 * reminders have Send now (2026-10-28). Rows someone can't change read the same,
 * without the controls (a job's Recruiter sees the workspace-wide ones).
 */
export function SlackAutomationList({
  tenantId,
  rows,
  connected,
  inJob,
  more,
  onEdit,
  onHistory,
  onSendNow,
  onDuplicate,
}: {
  tenantId: string
  rows: SlackAutomation[]
  connected: boolean
  /** Shown inside a job: workspace-wide rows say so. */
  inJob?: boolean
  /** A second group in the same card, under its own header. */
  more?: { label: string; rows: SlackAutomation[] }
  onEdit: (row: SlackAutomation) => void
  /** What it sent (the sheet's History tab). */
  onHistory?: (row: SlackAutomation) => void
  /** Reminders: send to everyone waiting now. */
  onSendNow?: (row: SlackAutomation) => void
  onDuplicate: (row: SlackAutomation) => void
}) {
  const set = useSetSlackAutomation(tenantId)
  const test = useSlackTest(tenantId)

  const toggle = (row: SlackAutomation, on: boolean) => {
    set.mutate(
      { id: row.id, active: on },
      { onError: (e) => toast.error(`Couldn’t turn it ${on ? 'on' : 'off'}`, { description: e.message }) },
    )
  }

  const remove = async (row: SlackAutomation) => {
    const exit = collapseRows(rowsById([row.id]))
    await exit.done
    set.mutate(
      { id: row.id, removed: true },
      {
        onSuccess: () =>
          undoToast(`Removed · ${title(row)}`, () =>
            set.mutate(
              { id: row.id, removed: false },
              {
                onSuccess: () => requestAnimationFrame(() => restoreRows(rowsById([row.id]))),
                onError: (e) => toast.error('Couldn’t bring it back', { description: e.message }),
              },
            ),
          ),
        onError: (e) => {
          exit.revert()
          toast.error('Couldn’t remove it', { description: e.message })
        },
      },
    )
  }

  const sendTest = (row: SlackAutomation) => {
    const id = toast.loading('Sending a test to Slack…')
    test.mutate(
      { job_id: row.job_id, event: row.event, message: row.message, destinations: row.destinations },
      {
        onSuccess: ({ results }) => {
          const bad = results.filter((r) => !r.ok || r.problem)
          if (bad.length === 0) toast.success('Test sent', { id, description: `Check ${destinationsSentence(row.destinations)} in Slack.` })
          else toast.error(bad.length === results.length ? 'The test didn’t go out' : 'The test partly went out', { id, description: bad.map((b) => b.problem).filter(Boolean).join(' ') })
        },
        onError: (e) => toast.error('The test didn’t go out', { id, description: e.message }),
      },
    )
  }

  const renderRow = (row: SlackAutomation) => {
    const ev = SLACK_EVENT[row.event]
    const Icon = ev?.icon
    const fromWorkspace = inJob && !row.job_id
    const repeat = repeatLabel(row)
    return (
      <li key={row.id} data-row-id={row.id} className="group flex min-h-[52px] items-center gap-3 px-3 py-2">
        <span
          aria-hidden
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg',
            row.is_active ? 'bg-[#EDE4FF] text-[#6F3FF5]' : 'bg-[#EFEEEA] text-[#8B8F9E]',
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className={cn('truncate font-inter text-[13px] font-medium leading-5', row.is_active ? 'text-text-primary' : 'text-text-secondary')}>
              {title(row)}
            </p>
            {fromWorkspace && <Chip>From workspace</Chip>}
            {!inJob && row.job_title && <Chip className="max-w-[160px] truncate">{row.job_title}</Chip>}
            {repeat && <Chip>{repeat}</Chip>}
          </div>
          <p className="truncate font-inter text-[12px] leading-[18px] text-text-tertiary tabular-nums">
            Sends to <span className="text-text-secondary">{destinationsSentence(row.destinations)}</span>
            <span aria-hidden> · </span>
            {onHistory && canSeeHistory(row) ? (
              <button
                type="button"
                onClick={() => onHistory(row)}
                className="rounded-sm underline-offset-2 transition-colors duration-hover hover:text-text-primary hover:underline"
                aria-label={`What ${title(row)} sent`}
              >
                <Status row={row} connected={connected} />
              </button>
            ) : (
              <Status row={row} connected={connected} />
            )}
          </p>
        </div>
        {row.can_edit ? (
          <span className="flex shrink-0 items-center gap-1">
            <Switch
              checked={row.is_active}
              onCheckedChange={(on) => toggle(row, on)}
              aria-label={`${row.is_active ? 'Turn off' : 'Turn on'} ${title(row)}`}
            />
            <DropdownMenu>
              <IconTip label="Automation actions">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${title(row)} actions`}
                    className={cn(
                      ICON_BTN,
                      '[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
                    )}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </DropdownMenuTrigger>
              </IconTip>
              <DropdownMenuContent align="end" className="w-[272px]">
                <DropdownMenuItem onSelect={() => onEdit(row)}>
                  <Pencil />
                  <span className="truncate">Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDuplicate(row)}>
                  <Copy />
                  <span className="truncate">Duplicate</span>
                </DropdownMenuItem>
                {onSendNow && canSendNow(row) && (
                  <DropdownMenuItem disabled={!connected || !row.is_active} onSelect={() => onSendNow(row)}>
                    <SendHorizontal />
                    <span className="truncate">Send now</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={!connected} onSelect={() => sendTest(row)}>
                  <Send />
                  <span className="truncate">Send test</span>
                </DropdownMenuItem>
                {onHistory && (
                  <DropdownMenuItem onSelect={() => onHistory(row)}>
                    <History />
                    <span className="truncate">History</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem data-danger onSelect={() => void remove(row)}>
                  <Trash2 />
                  <span className="truncate">Remove</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ) : (
          <span className="shrink-0 font-inter text-[12px] text-text-tertiary">{row.is_active ? 'On' : 'Off'}</span>
        )}
      </li>
    )
  }

  return (
    <div className="overflow-clip rounded-xl border border-[#EFEEEA] bg-white">
      {rows.length > 0 && <ul className="divide-y divide-[#F1F0EC]">{rows.map(renderRow)}</ul>}
      {more && more.rows.length > 0 && (
        <>
          <p className={cn('bg-[#FAFAF7] px-3 py-1.5 font-inter text-[11.5px] font-medium text-text-tertiary', rows.length > 0 && 'border-t border-[#F1F0EC]')}>
            {more.label}
          </p>
          <ul className="divide-y divide-[#F1F0EC] border-t border-[#F1F0EC]">{more.rows.map(renderRow)}</ul>
        </>
      )}
    </div>
  )
}

export function title(row: SlackAutomation): string {
  return row.name?.trim() || SLACK_EVENT[row.event]?.when || 'Automation'
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('shrink-0 rounded-md bg-white px-1.5 py-[1px] font-inter text-[11px] font-medium text-text-secondary ring-1 ring-[#E7E8EE]', className)}>
      {children}
    </span>
  )
}

function ago(at: string) {
  return formatDistanceToNowStrict(new Date(at), { addSuffix: true })
}

/** How often a reminder repeats, as a chip; nothing for one-off messages. */
function repeatLabel(row: SlackAutomation): string | null {
  const def = SLACK_EVENT[row.event]
  if (!def?.repeats) return null
  const n = Number(row.filters.every_days ?? 0)
  if (!n) return def.repeats.once ? 'Once' : null
  return n === 1 ? 'Every day' : `Every ${n} days`
}

/** The last send, what went wrong, or why it's paused. */
function Status({ row, connected }: { row: SlackAutomation; connected: boolean }) {
  if (!connected) return <>Paused while Slack isn&rsquo;t connected</>
  if (row.last_error && row.last_error_at && (!row.last_sent_at || row.last_error_at >= row.last_sent_at)) {
    return <span className="text-[#B42318]">{row.last_error}</span>
  }
  if (row.last_sent_at) return <>Last sent {ago(row.last_sent_at)}</>
  return <>{row.is_active ? 'Nothing sent yet' : 'Off'}</>
}
