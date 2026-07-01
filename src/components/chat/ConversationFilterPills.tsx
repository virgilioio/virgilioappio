import { forwardRef, useState } from 'react'
import { Briefcase, GitBranch, MailOpen } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { InlineEmpty } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface ConversationPillFilters {
  unreadOnly: boolean
  jobIds: string[]
  stageIds: string[]
}

interface ConversationFilterPillsProps {
  value: ConversationPillFilters
  onChange: (next: ConversationPillFilters) => void
}

const PILL_BASE =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full font-inter text-[11.5px] font-medium transition-colors'

interface PillProps {
  icon: typeof Briefcase
  label: string
  active: boolean
  onClick?: () => void
  count?: number
}

const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { icon: Icon, label, active, onClick, count },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        PILL_BASE,
        active
          ? 'bg-[#0d0d09] text-[#fffcf9] border border-[#0d0d09]'
          : 'bg-white text-[#5A6072] border border-[#E7E8EE] hover:text-[#1F2230]',
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={1.9} />
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold',
            active ? 'bg-white/15 text-[#fffcf9]' : 'bg-[#EDE4FF] text-[#5B3FBF]',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
})

/**
 * ConversationFilterPills — Unread / By job / By stage filter row.
 * By-job and By-stage popovers are placeholders for this pass.
 */
export function ConversationFilterPills({ value, onChange }: ConversationFilterPillsProps) {
  const [jobOpen, setJobOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill
        icon={MailOpen}
        label="Unread"
        active={value.unreadOnly}
        onClick={() => onChange({ ...value, unreadOnly: !value.unreadOnly })}
      />
      <Popover open={jobOpen} onOpenChange={setJobOpen}>
        <PopoverTrigger asChild>
          <Pill
            icon={Briefcase}
            label="By job"
            active={value.jobIds.length > 0}
            count={value.jobIds.length || undefined}
          />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-[240px] p-3">
          <InlineEmpty text="No jobs to filter yet" />
        </PopoverContent>
      </Popover>
      <Popover open={stageOpen} onOpenChange={setStageOpen}>
        <PopoverTrigger asChild>
          <Pill
            icon={GitBranch}
            label="By stage"
            active={value.stageIds.length > 0}
            count={value.stageIds.length || undefined}
          />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-[240px] p-3">
          <InlineEmpty text="No stages to filter yet" />
        </PopoverContent>
      </Popover>
    </div>
  )
}
