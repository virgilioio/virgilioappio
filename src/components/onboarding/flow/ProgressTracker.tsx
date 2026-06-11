interface ProgressTrackerProps {
  /** 1-indexed current step (1..total) */
  current: number
  total?: number
}

/**
 * Brand progress tracker.
 * - Completed: 18×7 lilac pill (#D7C5FB)
 * - Current:   9px noir dot (#0d0d09)
 * - Upcoming:  7px faint dot (rgba(13,13,9,.14))
 * Dots morph into pills as steps complete (300ms cubic-bezier(.2,.9,.3,1)).
 */
export function ProgressTracker({ current, total = 5 }: ProgressTrackerProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const idx = i + 1
          const done = idx < current
          const active = idx === current
          const w = done ? 18 : active ? 9 : 7
          const h = done ? 7 : active ? 9 : 7
          const bg = done
            ? '#D7C5FB'
            : active
              ? '#0d0d09'
              : 'rgba(13,13,9,0.14)'
          return (
            <span
              key={idx}
              className="ob-tracker-mark inline-block"
              style={{
                width: w,
                height: h,
                borderRadius: 999,
                background: bg,
              }}
            />
          )
        })}
      </div>
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 10.5,
          fontWeight: 500,
          color: '#8B8F9E',
          letterSpacing: '0.01em',
        }}
      >
        {Math.min(current, total)} of {total}
      </span>
    </div>
  )
}
