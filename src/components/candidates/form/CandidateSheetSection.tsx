import React from 'react'
import { cn } from '@/lib/utils'

interface CandidateSheetSectionProps {
  label: string
  rightMeta?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  /** When true, renders children with no card chrome (for full-width blocks like the rich text editor) */
  bare?: boolean
  className?: string
}

/**
 * Gio Foundation v1.0 — Candidate sheet section.
 * Uppercase Poppins label (11.5px / 0.06em) outside the card, optional right-aligned meta,
 * bordered rounded-xl card with 24px padding inside.
 */
export function CandidateSheetSection({
  label,
  rightMeta,
  action,
  children,
  bare = false,
  className,
}: CandidateSheetSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3 px-0.5">
        <h3 className="font-poppins font-semibold uppercase tracking-[0.06em] text-[11.5px] text-virgilio-text">
          {label}
        </h3>
        <div className="flex items-center gap-2">
          {rightMeta}
          {action}
        </div>
      </div>
      {bare ? (
        children
      ) : (
        <div className="rounded-xl ring-1 ring-virgilio-border/60 bg-background p-6 space-y-5">
          {children}
        </div>
      )}
    </section>
  )
}

export default CandidateSheetSection
