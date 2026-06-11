import { cn } from '@/lib/utils'

export type StatusTone = 'done' | 'todo' | 'progress' | 'blocked' | 'neutral'

const TONE: Record<StatusTone, { bg: string; fg: string; label: string }> = {
  done:     { bg: '#E5F4EC', fg: '#0E7A4D', label: 'Done' },
  todo:     { bg: '#F1F0EC', fg: '#5A6072', label: 'To do' },
  progress: { bg: '#EDE4FF', fg: '#5B21B6', label: 'In progress' },
  blocked:  { bg: '#FCE4E4', fg: '#A21D1D', label: 'Blocked' },
  neutral:  { bg: '#F1F0EC', fg: '#5A6072', label: '' },
}

interface StatusChipProps {
  tone: StatusTone
  label?: string
  className?: string
}

export function StatusChip({ tone, label, className }: StatusChipProps) {
  const t = TONE[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 h-[20px] rounded-md font-inter font-semibold',
        className
      )}
      style={{
        fontSize: '10.5px',
        letterSpacing: '0.02em',
        backgroundColor: t.bg,
        color: t.fg,
      }}
    >
      {label ?? t.label}
    </span>
  )
}
