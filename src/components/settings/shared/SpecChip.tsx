import { cn } from '@/lib/utils'

export type SpecChipTone = 'green' | 'amber' | 'blue' | 'purple' | 'gray' | 'red'

const TONE: Record<SpecChipTone, { bg: string; fg: string }> = {
  green:  { bg: '#D1FAE5', fg: '#0B7A57' },
  amber:  { bg: '#FEF3C7', fg: '#92400E' },
  blue:   { bg: '#DBEAFE', fg: '#1D4ED8' },
  purple: { bg: '#EDE4FF', fg: '#5B21B6' },
  gray:   { bg: '#F1F0EC', fg: '#5A6072' },
  red:    { bg: '#FEE2E2', fg: '#B91C1C' },
}

interface SpecChipProps {
  tone: SpecChipTone
  children: React.ReactNode
  className?: string
}

export function SpecChip({ tone, children, className }: SpecChipProps) {
  const t = TONE[tone]
  return (
    <span
      className={cn('inline-flex items-center font-inter whitespace-nowrap', className)}
      style={{
        backgroundColor: t.bg,
        color: t.fg,
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}
