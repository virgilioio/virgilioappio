import { format, isToday, isYesterday } from 'date-fns'

interface DaySeparatorProps {
  date: string
}

/**
 * DaySeparator — centered pill between message groups.
 * Spec: bg #F1F0EC · radius 999 · Inter 500 10.5 · #8B8F9E · letter-spacing 0.02em.
 */
export function DaySeparator({ date }: DaySeparatorProps) {
  const d = new Date(date)
  const label = isToday(d)
    ? 'Today'
    : isYesterday(d)
      ? 'Yesterday'
      : format(d, 'EEEE, MMMM d')
  return (
    <div
      className="flex justify-center"
      role="separator"
      aria-label={label}
      style={{ margin: '8px 0 18px' }}
    >
      <span
        className="inline-flex items-center font-inter"
        style={{
          padding: '3px 12px',
          background: '#F1F0EC',
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 500,
          color: '#8B8F9E',
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
    </div>
  )
}
