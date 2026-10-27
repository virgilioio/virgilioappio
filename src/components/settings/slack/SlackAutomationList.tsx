import { formatDistanceToNowStrict } from 'date-fns'
import { Copy, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react'
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
  destinationsSentence,
  useSetSlackAutomation,
  useSlackTest,
  type SlackAutomation,
} from '@/lib/slack'
import { cn } from '@/lib/utils'

const ICON_BTN =
  'gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230] disabled:opacity-40 disabled:pointer-events-none'

/**
 * Slack automations as sentences (2026-10-27): "When a candidate is hired"
 * over where it goes, with when it last went out (or why it didn't) on a
 * reserved line. On/off is a switch; Edit, Duplicate, Send test and Remove
 * (with Undo) sit in the ⋯ menu. Rows someone can't change read the same,
 * without the controls (a job's Recruiter sees the workspace-wide ones).
 */
export function SlackAutomationList({
  tenantId,
  rows,
  connected,
  inJob,
  onEdit,
  onDuplicate,
}: {
  tenantId: string
  rows: SlackAutomation[]
  connected: boolean
  /** Shown inside a job: workspace-wide rows say so. */
  inJob?: boolean
  onEdit: (row: SlackAutomation) => void
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

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const ev = SLACK_EVENT[row.event]
        const Icon = ev?.icon
        const fromWorkspace = inJob && !row.job_id
        return (
          <li
            key={row.id}
            data-row-id={row.id}
            className={cn(
              'flex min-h-[64px] items-start gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-3',
              !row.is_active && 'bg-[#FAFAF7]',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                row.is_active ? 'bg-[#EDE4FF] text-[#6F3FF5]' : 'bg-[#EFEEEA] text-[#8B8F9E]',
              )}
            >
              {Icon && <Icon className="h-4 w-4" strokeWidth={2} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className={cn('truncate font-inter text-[13.5px] font-medium', row.is_active ? 'text-text-primary' : 'text-text-secondary')}>
                  {title(row)}
                </p>
                {fromWorkspace && <Chip>From workspace</Chip>}
                {!inJob && row.job_title && <Chip className="max-w-[180px] truncate">{row.job_title}</Chip>}
              </div>
              <p className="mt-0.5 truncate font-inter text-[12.5px] text-text-secondary">
                <span className="text-text-tertiary">Sends to </span>
                {destinationsSentence(row.destinations)}
              </p>
              <StatusLine row={row} connected={connected} />
            </div>
            {row.can_edit ? (
              <span className="flex shrink-0 items-center gap-1.5 pt-1">
                <Switch
                  checked={row.is_active}
                  onCheckedChange={(on) => toggle(row, on)}
                  aria-label={`${row.is_active ? 'Turn off' : 'Turn on'} ${title(row)}`}
                />
                <DropdownMenu>
                  <IconTip label="Automation actions">
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`${title(row)} actions`} className={ICON_BTN}>
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
                    <DropdownMenuItem disabled={!connected} onSelect={() => sendTest(row)}>
                      <Send />
                      <span className="truncate">Send test</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-danger onSelect={() => void remove(row)}>
                      <Trash2 />
                      <span className="truncate">Remove</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            ) : (
              <span className="shrink-0 pt-1.5 font-inter text-[12px] text-text-tertiary">{row.is_active ? 'On' : 'Off'}</span>
            )}
          </li>
        )
      })}
    </ul>
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

/** Reserved line: the last send, what went wrong, or why it's paused. */
function StatusLine({ row, connected }: { row: SlackAutomation; connected: boolean }) {
  let text: string
  let tone = 'text-text-tertiary'
  if (!connected) text = 'Paused while Slack isn’t connected'
  else if (row.last_error && row.last_error_at && (!row.last_sent_at || row.last_error_at >= row.last_sent_at)) {
    text = row.last_error
    tone = 'text-[#B42318]'
  } else if (row.last_sent_at) text = `Last sent ${ago(row.last_sent_at)}`
  else text = row.is_active ? 'Nothing sent yet' : 'Off'
  return <p className={cn('mt-1 min-h-[18px] truncate font-inter text-[11.5px] tabular-nums', tone)}>{text}</p>
}
