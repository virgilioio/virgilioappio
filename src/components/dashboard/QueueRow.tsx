/**
 * One row of the dashboard's "Your queue" (Allan, 2026-11-14): what it is, who,
 * where, how long it has waited, and its real next step on the right instead of a
 * "done" checkbox. Secondary actions and the ⋯ menu (Open profile, Hide from my
 * queue) sit beside it; the ⋯ shows on hover with a mouse and always on touch.
 */
import { AlarmClock, CalendarClock, ClipboardCheck, EyeOff, FileCheck2, GitBranch, Mail, MoreHorizontal, UserRound, Users2, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuShortcut,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { GioGlyph } from '@/components/icons/GioGlyph'
import { cn } from '@/lib/utils'
import { rowActions, type QueueActionId, type QueueItem } from '@/lib/queue'

export type { QueueActionId } from '@/lib/queue'

/**
 * Each kind's icon and tint, the notification centre's (NotificationCenter
 * CATEGORY_META), so a scorecard or an offer looks the same in the bell and here.
 */
const KIND = {
  scorecard: { icon: ClipboardCheck, bg: '#FFEDD5', fg: '#C2410C' },
  decision: { icon: GitBranch, bg: '#DBEAFE', fg: '#1D4ED8' },
  offer: { icon: FileCheck2, bg: '#DCFCE7', fg: '#15803D' },
  reply: { icon: Mail, bg: '#EDE4FF', fg: '#6F3FF5' },
  application: { icon: Users2, bg: '#DCFCE7', fg: '#15803D' },
  applications: { icon: Users2, bg: '#DCFCE7', fg: '#15803D' },
} as const

const URGENCY = {
  overdue: 'text-[#B91C1C] bg-[#FEE2E2]',
  today: 'text-[#B45309] bg-[#FEF3C7]',
  normal: 'text-[#5A6072] bg-[#F1F0EC]',
} as const

interface Props {
  item: QueueItem
  isLast: boolean
  /** The action running on this row (its button shows a spinner and keeps its width). */
  busy: QueueActionId | null
  onOpen: () => void
  onAction: (id: QueueActionId) => void
  onOpenProfile: () => void
  onHide: () => void
  /** Snooze until 9:00 AM tomorrow or on Monday (the hints show those times). */
  onSnooze: (when: 'tomorrow' | 'monday') => void
  snoozeHints: { tomorrow: string; monday: string }
  /** A snoozed row (the Snoozed group): when it comes back, and Unsnooze instead of its actions. */
  snoozedLabel?: string
  onUnsnooze?: () => void
}

export function QueueRow({ item, isLast, busy, onOpen, onAction, onOpenProfile, onHide, onSnooze, snoozeHints, snoozedLabel, onUnsnooze }: Props) {
  const kind = KIND[item.kind]
  const Icon = kind.icon
  const snoozed = !!snoozedLabel
  const actions = snoozed ? [] : rowActions(item)
  const isGroup = item.kind === 'applications'
  return (
    <div
      data-queue-row={item.id}
      className={cn(
        'group/qrow relative flex items-center gap-3 py-[11px] pl-4 pr-3 min-h-[60px]',
        !isLast && 'border-b border-[#F1F0EC]',
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: kind.bg, color: kind.fg }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="font-inter text-[13px] leading-[18px] font-semibold text-[#1F2230] whitespace-nowrap">
            {item.label}
          </span>
          <span className="min-w-0 truncate font-inter text-[13px] leading-[18px] text-[#5A6072]">
            · {item.candidateName}
          </span>
          {item.hasGioDraft && (
            <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-[#EDE4FF] px-2 font-inter text-[11px] font-semibold text-[#5B21B6]">
              <GioGlyph className="h-2.5 w-2.5" />
              Gio draft
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate font-inter text-[11.5px] leading-4 text-[#6B7080]">{item.context}</span>
      </button>

      <span
        className={cn(
          'shrink-0 whitespace-nowrap rounded-full px-2 py-1 font-inter text-[10.5px] font-semibold leading-none tabular-nums',
          snoozed ? URGENCY.normal : URGENCY[item.urgency],
        )}
      >
        {snoozed ? `back ${snoozedLabel}` : item.urgencyLabel}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        {snoozed && onUnsnooze && (
          <Button type="button" size="sm" variant="secondary" onClick={onUnsnooze}>
            Unsnooze
          </Button>
        )}
        {actions.map((a) => (
          <Button
            key={a.id}
            type="button"
            size="sm"
            variant={a.variant}
            loading={busy === a.id}
            disabled={busy !== null && busy !== a.id}
            onClick={() => onAction(a.id)}
            className={a.variant === 'ghost' ? 'text-[#5A6072]' : undefined}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <DropdownMenu>
        <IconTip label="More actions">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className={cn(
                'gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#5A6072]',
                'hover:bg-[#F1F0EC] data-[state=open]:bg-[#F1F0EC] data-[state=open]:opacity-100',
                '[@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover/qrow:opacity-100 group-focus-within/qrow:opacity-100',
              )}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuItem onSelect={onOpenProfile}>
            {isGroup ? <Briefcase /> : <UserRound />}
            <span className="truncate">{isGroup ? 'Open job' : 'Open profile'}</span>
          </DropdownMenuItem>
          {!snoozed && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onSnooze('tomorrow')}>
                <AlarmClock />
                <span className="truncate">Snooze until tomorrow</span>
                <DropdownMenuShortcut>{snoozeHints.tomorrow}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSnooze('monday')}>
                <CalendarClock />
                <span className="truncate">Snooze until Monday</span>
                <DropdownMenuShortcut>{snoozeHints.monday}</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onHide}>
            <EyeOff />
            <span className="truncate">Hide from my queue</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
