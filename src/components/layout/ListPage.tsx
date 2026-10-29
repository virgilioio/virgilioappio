import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

/**
 * The list-page frame, laid out like the Jobs list (Allan, 2026-10-14). Used by
 * People & Access and Reference checks: full-height scroll area on cream, the same container and
 * padding, a 28/32px title with its purple period and count chip, a meta row
 * of dotted counts underneath, and the action buttons on the right. The list
 * (a ListTabs + filters card, then the table card) goes in `children`.
 */
export function ListPage({
  title,
  count,
  meta,
  actions,
  breadcrumb,
  children,
}: {
  title: ReactNode
  count?: number
  meta?: ReactNode
  actions?: ReactNode
  breadcrumb?: { label: string; to?: string }[]
  children: ReactNode
}) {
  return (
    <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem-var(--gio-strip))] flex flex-col overflow-hidden bg-virgilio-cream">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6">
          <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              {breadcrumb && breadcrumb.length > 0 && (
                <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 font-inter text-[11.5px] text-text-tertiary">
                  {breadcrumb.map((c, i) => (
                    <span key={i} className="flex min-w-0 items-center gap-1.5">
                      {i > 0 && <ChevronRight size={11} strokeWidth={2} aria-hidden className="shrink-0" />}
                      {c.to ? (
                        <Link to={c.to} className="truncate hover:text-text-primary transition-colors duration-hover">
                          {c.label}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-text-primary">{c.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="min-w-0 line-clamp-3 font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] leading-tight sm:text-[32px]">
                  {title}
                  <span className="text-virgilio-purple">.</span>
                </h1>
                {count != null && (
                  <Badge tone="neutral" size="sm">
                    {count}
                  </Badge>
                )}
              </div>
              {meta && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">{meta}</div>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}

/** A dotted count in the meta row, like "● 12 open" on Jobs. */
export function MetaDot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}
