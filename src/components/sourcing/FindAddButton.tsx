import { useState } from 'react'
import { Briefcase, ChevronDown, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { FindAddTarget } from '@/lib/findAdd'

/**
 * The one Add control in Find (Allan, 2026-10-22): a split button. The main
 * part adds to the default place (the linked job, else the talent pool); the
 * chevron opens a §19 menu to pick the pool, the linked job, or another job and
 * stage. The same control serves one row and the bulk bar.
 */
export function FindAddButton({
  linkedJob,
  credits,
  onlyInGio,
  onAdd,
  onChooseJob,
  loading,
  disabled,
  onDark,
  size = 'sm',
  who,
  compact,
  className,
}: {
  linkedJob: { id: string; title: string } | null
  /** Credits this add would spend (Apollo previews). */
  credits: number
  /** Everyone here is already in Gio: the pool isn't a destination. */
  onlyInGio: boolean
  onAdd: (target: FindAddTarget) => void
  onChooseJob: () => void
  loading?: boolean
  disabled?: boolean
  onDark?: boolean
  size?: 'xs' | 'sm'
  /** For the menu header and labels: "Maya Okafor" or "3 people". */
  who: string
  /** Phones: a short, lighter button ("Add to job" / "Add to pool"). */
  compact?: boolean
  className?: string
}) {
  const pool: FindAddTarget = { kind: 'pool' }
  const job: FindAddTarget | null = linkedJob ? { kind: 'job', jobId: linkedJob.id, jobTitle: linkedJob.title } : null
  const primary = job ?? (onlyInGio ? null : pool)
  const primaryLabel = compact
    ? primary ? (primary.kind === 'job' ? 'Add to job' : 'Add to pool') : 'Add to a job'
    : primary
      ? primary.kind === 'job' ? `Add to ${primary.jobTitle}` : 'Add to talent pool'
      : 'Add to a job'
  const cost = credits > 0 ? `${credits} credit${credits === 1 ? '' : 's'}` : undefined
  // Marks the control while its menu is open, so a row that shows it on hover keeps it shown.
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={cn('inline-flex min-w-0', className)} data-add-menu-open={menuOpen || undefined} onClick={(e) => e.stopPropagation()}>
      <Button
        size={size}
        variant={compact ? 'secondary' : 'primary'}
        onDark={onDark}
        loading={loading}
        disabled={disabled}
        className="min-w-0 rounded-r-none"
        onClick={() => (primary ? onAdd(primary) : onChooseJob())}
      >
        <span className="max-w-[180px] truncate">{primaryLabel}</span>
      </Button>
      <DropdownMenu onOpenChange={setMenuOpen}>
        <IconTip label="More places to add">
          <DropdownMenuTrigger asChild>
            <Button
              size={size}
              variant={compact ? 'secondary' : 'primary'}
              onDark={onDark}
              iconOnly
              icon={ChevronDown}
              aria-label="More places to add"
              disabled={disabled || loading}
              className={cn('rounded-l-none', compact ? 'border-l-0' : 'border-l border-white/20')}
            />
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-[272px]">
          <DropdownMenuLabel>Add {who} to</DropdownMenuLabel>
          <DropdownMenuItem disabled={onlyInGio} onSelect={() => onAdd(pool)}>
            <Users />
            <span className="truncate">{onlyInGio ? 'Talent pool (already there)' : 'Talent pool'}</span>
            {cost && !onlyInGio && <DropdownMenuShortcut>{cost}</DropdownMenuShortcut>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {job && (
            <DropdownMenuItem onSelect={() => onAdd(job)}>
              <Briefcase />
              <span className="truncate">{linkedJob!.title}</span>
              {cost && <DropdownMenuShortcut>{cost}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onChooseJob}>
            <Search />
            <span className="truncate">{job ? 'Another job or stage…' : 'Choose a job and stage…'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
