import { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Standard right-pane card wrapper for the Scorecard sheet.
 * White surface, hairline border, rounded, with optional header (title + subtitle + right action slot).
 * Presentational only — no state.
 */
export function FormSectionCard({ title, subtitle, action, children, className }: Props) {
  return (
    <section
      className={`rounded-xl border border-[#E7E8EE] bg-white p-4 ${className ?? ''}`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3
            className="font-poppins font-semibold text-[#1F2230]"
            style={{ fontSize: 15, letterSpacing: '-0.02em' }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="font-inter text-[#5A6072] mt-0.5" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div>{children}</div>
    </section>
  )
}
