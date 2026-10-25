import { Briefcase, CheckCheck, CornerUpLeft, Inbox as InboxIcon, Layers, PenSquare, Send, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { FOLDER_LABELS, type InboxCounts, type InboxFolder } from '@/lib/inbox'

export const FOLDER_ICONS: Record<InboxFolder, LucideIcon> = {
  inbox: InboxIcon,
  needs_reply: CornerUpLeft,
  sent: Send,
  done: CheckCheck,
  all: Layers,
}

const ORDER: InboxFolder[] = ['inbox', 'needs_reply', 'sent', 'done', 'all']

/**
 * The folder column: Compose, the folders, then your open jobs as labels.
 * Drawn like Settings' side menu (no card, the active row filled noir).
 * `compact` folds it to icons with their names in tooltips.
 */
export function InboxFolders({
  folder,
  jobId,
  counts,
  compact = false,
  onFolder,
  onJob,
  onCompose,
}: {
  folder: InboxFolder
  jobId: string | null
  counts?: InboxCounts
  compact?: boolean
  onFolder: (f: InboxFolder) => void
  onJob: (jobId: string) => void
  onCompose: () => void
}) {
  const countFor = (f: InboxFolder) =>
    f === 'inbox' ? counts?.inbox_unread : f === 'needs_reply' ? counts?.needs_reply : undefined

  return (
    <nav aria-label="Mail folders" className={cn('flex h-full min-h-0 flex-col', compact ? 'w-12 items-center' : 'w-[216px]')}>
      {compact ? (
        <IconTip label="Compose (C)" side="right">
          <Button variant="primary" size="lg" iconOnly icon={PenSquare} aria-label="Compose" onClick={onCompose} />
        </IconTip>
      ) : (
        <Button variant="primary" size="lg" icon={PenSquare} onClick={onCompose} className="w-full justify-center">
          Compose
        </Button>
      )}

      <div className={cn('mt-4 space-y-0.5', compact && 'flex flex-col items-center')}>
        {ORDER.map(f => (
          <Row
            key={f}
            compact={compact}
            icon={FOLDER_ICONS[f]}
            label={FOLDER_LABELS[f]}
            count={countFor(f)}
            strong={f === 'inbox'}
            active={!jobId && folder === f}
            onClick={() => onFolder(f)}
          />
        ))}
      </div>

      {(counts?.jobs.length ?? 0) > 0 && (
        <div className={cn('mt-5 min-h-0 flex-1 overflow-y-auto', compact && 'flex flex-col items-center')}>
          {!compact && (
            <div
              className="px-2.5 mb-1.5 font-inter font-semibold uppercase text-[#8B8F9E]"
              style={{ fontSize: '10px', letterSpacing: '0.08em' }}
            >
              Your jobs
            </div>
          )}
          {compact && <div aria-hidden className="mb-2 h-px w-6 bg-[#E7E8EE]" />}
          <div className="space-y-0.5">
            {counts!.jobs.map(j => (
              <Row
                key={j.job_id}
                compact={compact}
                icon={Briefcase}
                label={j.title}
                count={j.unread}
                strong
                active={jobId === j.job_id}
                onClick={() => onJob(j.job_id)}
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

function Row({
  icon: Icon,
  label,
  count,
  strong,
  active,
  compact,
  onClick,
}: {
  icon: LucideIcon
  label: string
  count?: number
  /** Unread counts read semibold; other counts stay quiet. */
  strong?: boolean
  active: boolean
  compact: boolean
  onClick: () => void
}) {
  const shown = count && count > 0 ? (count > 999 ? '999+' : String(count)) : null
  if (compact) {
    return (
      <IconTip label={shown ? `${label} · ${shown}` : label} side="right">
        <button
          type="button"
          aria-label={shown ? `${label}, ${shown}` : label}
          aria-current={active ? 'page' : undefined}
          onClick={onClick}
          className={cn(
            'gio-pressable relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
            active ? 'bg-[#0d0d09] text-[#fffcf9]' : 'text-[#1F2230] hover:bg-[rgba(13,13,9,0.05)]',
          )}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
          {shown && strong && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#6F3FF5] ring-2 ring-virgilio-cream"
            />
          )}
        </button>
      </IconTip>
    )
  }
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-lg transition-colors text-left font-inter',
        active ? 'bg-[#0d0d09] text-[#fffcf9]' : 'text-[#1F2230] hover:bg-[rgba(13,13,9,0.05)]',
      )}
      style={{ padding: '7px 10px', fontSize: '12.5px' }}
    >
      <Icon className="w-[14px] h-[14px] shrink-0" strokeWidth={2} />
      <span className="truncate flex-1">{label}</span>
      {shown && (
        <span
          className={cn('tabular-nums shrink-0', strong ? 'font-semibold' : '')}
          style={{ fontSize: 11.5, color: active ? '#fffcf9' : strong ? '#0d0d09' : '#6B7080' }}
        >
          {shown}
        </span>
      )}
    </button>
  )
}
