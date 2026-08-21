import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Reference checks glyph — two equal overlapping discs, back disc masked so a
 * 2-unit gap of background separates them. The mask is load-bearing: without it
 * the discs fuse into a single lozenge in the inactive state.
 *
 * Accent shape is marked with className="accent" so the surrounding tile
 * controls the lilac fill via [&_.accent]:fill-[#D7C5FB] on hover/active.
 */
export const ReferencesGlyph: React.FC<{ className?: string }> = ({ className }) => {
  const uid = 'rg' + React.useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
      <mask id={uid} maskUnits="userSpaceOnUse">
        <rect width="48" height="48" fill="#fff" />
        <circle cx="16.5" cy="24" r="13.5" fill="#000" />
      </mask>
      <circle cx="31.5" cy="24" r="11.5" fill="currentColor" mask={`url(#${uid})`} />
      <circle className="accent" cx="16.5" cy="24" r="11.5" fill="currentColor" />
    </svg>
  )
}

export default ReferencesGlyph
