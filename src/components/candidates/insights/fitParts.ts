import { Check, CircleDashed, Minus } from 'lucide-react'
import type { MustHave } from '@/hooks/useCandidateFitInsights'

/**
 * Gio Fit's shared look (2026-11-07): the profile's Gio Fit tab and the
 * application review's condensed Gio Fit card draw from the same parts.
 */
export const fitCardClass = 'rounded-[14px] border border-virgilio-border bg-surface-primary'
export const fitSectionHeadingClass = 'flex items-center gap-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-fit-subtle'

export const FIT_DIMENSION_COLORS = [
  { dot: 'bg-fit-violet-deep', fill: 'bg-fit-violet-deep' },
  { dot: 'bg-virgilio-purple', fill: 'bg-virgilio-purple' },
  { dot: 'bg-fit-violet-mid', fill: 'bg-fit-violet-mid' },
  { dot: 'bg-fit-violet-bright', fill: 'bg-fit-violet-bright' },
  { dot: 'bg-fit-stone', fill: 'bg-fit-stone' },
  { dot: 'bg-fit-violet-soft', fill: 'bg-fit-violet-soft' },
  { dot: 'bg-fit-lilac', fill: 'bg-fit-lilac' },
]

export const MUST_HAVE_STYLE: Record<MustHave['status'], { label: string; className: string; Icon: typeof Check | null }> = {
  met: { label: 'Met', className: 'border-fit-skill-evidenced-border bg-fit-skill-evidenced-bg text-fit-skill-evidenced-text', Icon: Check },
  partial: { label: 'Partly', className: 'border-fit-row-border bg-fit-paper text-fit-ink', Icon: CircleDashed },
  not_met: { label: 'Not met', className: 'border-fit-risk-border bg-fit-warning-soft text-fit-risk-copy', Icon: Minus },
  unknown: { label: 'Not verified', className: 'border-fit-row-border bg-surface-primary text-fit-subtle', Icon: null },
}
