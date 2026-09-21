import type { ReactNode } from 'react'

/** Pane opener: 11px/600 Poppins, uppercase, muted. */
export function PaneLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {icon}
      <h3
        className="font-poppins uppercase text-dup-muted"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em' }}
      >
        {children}
      </h3>
    </div>
  )
}

/** Section heading: 12px/600 Poppins ink-text, optional count and sub-note. */
export function SectionHeading({
  title,
  count,
  note,
  action,
}: {
  title: string
  count?: number | string
  note?: string
  action?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <h4
          className="min-w-0 font-poppins text-dup-text"
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          {title}
        </h4>
        {count !== undefined && count !== null && (
          <span className="shrink-0 font-inter text-dup-subtle" style={{ fontSize: 11, fontWeight: 600 }}>
            {count}
          </span>
        )}
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      {note && (
        <p
          className="font-inter text-dup-subtle"
          style={{ fontSize: 11, marginTop: 3, textWrap: 'pretty' as never }}
        >
          {note}
        </p>
      )}
    </div>
  )
}
