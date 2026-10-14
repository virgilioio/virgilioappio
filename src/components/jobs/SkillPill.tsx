import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SKILL_PRIORITIES, SKILL_PRIORITY, type SkillPriority } from '@/lib/skillPriority'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A job skill, coloured by its priority (green must-have, blue nice-to-have,
 * lilac extra). With `onPriorityChange` a small chevron opens the priority
 * menu, the way LinkedIn lets you set a skill's level from the pill itself;
 * with `onRemove` an × removes it. Without either it is a plain read-only pill,
 * used everywhere a job's skills are listed.
 */
export function SkillPill({
  skill,
  priority = 'nice',
  onPriorityChange,
  onRemove,
  size = 'md',
  className,
  children,
  ...rest
}: {
  skill: string
  priority?: SkillPriority
  onPriorityChange?: (next: SkillPriority) => void
  onRemove?: () => void
  size?: 'sm' | 'md'
  className?: string
  /** Replaces the skill text, for a chip that also carries a verdict icon. */
  children?: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const meta = SKILL_PRIORITY[priority]
  const sizing = size === 'sm' ? 'h-[22px] px-2 text-[11px] gap-1' : 'px-2.5 py-1 text-[12px] gap-1'
  const pill = (
    <span
      {...rest}
      className={cn('inline-flex items-center rounded-full font-medium whitespace-nowrap', sizing, meta.pill, className)}
    >
      {children ?? skill}
      {onPriorityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label={`${skill}: ${meta.label}. Change priority`}
              className="gio-pressable -mr-0.5 rounded-full p-0.5 hover:bg-black/5"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-56" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Priority</DropdownMenuLabel>
            {SKILL_PRIORITIES.map((option) => (
              <DropdownMenuItem key={option} onSelect={() => onPriorityChange(option)} className="h-auto items-start gap-2.5 py-2">
                <span className={cn('mt-[5px] h-2 w-2 shrink-0 rounded-full', SKILL_PRIORITY[option].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-text-primary">{SKILL_PRIORITY[option].label}</span>
                  <span className="block text-[11.5px] leading-[1.4] text-text-tertiary">{SKILL_PRIORITY[option].hint}</span>
                </span>
                {option === priority && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-virgilio-purple" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="rounded-full p-0.5 hover:bg-black/5"
          aria-label={`Remove ${skill}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
  // Read-only pills say what the colour means on hover; editable ones say it in the menu.
  if (onPriorityChange) return pill
  return (
    <Tooltip>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent side="top" className="text-[11.5px]">{meta.label}</TooltipContent>
    </Tooltip>
  )
}

/** Small legend for a list of priority-coloured pills. */
export function SkillPriorityLegend({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-tertiary', className)}>
      {SKILL_PRIORITIES.map((p) => (
        <span key={p} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', SKILL_PRIORITY[p].dot)} />
          {SKILL_PRIORITY[p].label}
        </span>
      ))}
    </span>
  )
}
