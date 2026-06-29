import { format, isToday, isYesterday } from 'date-fns'

interface DaySeparatorProps {
  date: string
}

/**
 * DaySeparator — date label between message groups (Step 1.6).
 */
export function DaySeparator({ date }: DaySeparatorProps) {
  const d = new Date(date)
  const label = isToday(d)
    ? 'Today'
    : isYesterday(d)
      ? 'Yesterday'
      : format(d, 'EEEE, MMM d')
  return (
    <div className="flex items-center gap-3 my-4" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-virgilio-border" />
      <span className="font-poppins text-[10.5px] tracking-[0.06em] uppercase text-text-secondary">
        {label}
      </span>
      <div className="flex-1 h-px bg-virgilio-border" />
    </div>
  )
}
