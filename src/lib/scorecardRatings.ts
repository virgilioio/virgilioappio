import { ThumbsDown, Frown, Meh, ThumbsUp, Star } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ScoreRating } from '@/hooks/useScorecards'

export type RatingTone = 'green' | 'yellow' | 'orange' | 'red' | 'neutral'

export interface RatingMeta {
  value: ScoreRating
  label: string
  numeric: 1 | 2 | 3 | 4 | 5
  bg: string
  text: string
  tone: RatingTone
  icon: ComponentType<{ className?: string }>
}

/** Canonical 5-level rating model (weakest → strongest). */
export const RATING_VALUES: ScoreRating[] = [
  'strong_no',
  'lean_no',
  'lean_yes',
  'yes',
  'strong_yes',
]

export const RATING_META: Record<ScoreRating, RatingMeta> = {
  strong_no:  { value: 'strong_no',  label: 'Strong no',  numeric: 1, bg: '#C9554C', text: '#FFFFFF', tone: 'red',    icon: ThumbsDown },
  lean_no:    { value: 'lean_no',    label: 'Lean no',    numeric: 2, bg: '#E7ABA4', text: '#7A2E27', tone: 'orange', icon: Frown      },
  lean_yes:   { value: 'lean_yes',   label: 'Lean yes',   numeric: 3, bg: '#F5C16C', text: '#6B3A05', tone: 'yellow', icon: Meh        },
  yes:        { value: 'yes',        label: 'Yes',        numeric: 4, bg: '#C8B9F0', text: '#3B2A6B', tone: 'green',  icon: ThumbsUp   },
  strong_yes: { value: 'strong_yes', label: 'Strong yes', numeric: 5, bg: '#6F3FF5', text: '#FFFFFF', tone: 'green',  icon: Star       },
}

/** Legacy → canonical coercion (for any row that escaped data migration). */
const LEGACY_MAP: Record<string, ScoreRating> = {
  definitely_no: 'strong_no',
  no: 'lean_no',
}

export function coerceRating(value?: string | null): ScoreRating | null {
  if (!value) return null
  if (value in RATING_META) return value as ScoreRating
  if (value in LEGACY_MAP) return LEGACY_MAP[value]
  return null
}

export function ratingMeta(value?: string | null): RatingMeta | null {
  const v = coerceRating(value)
  return v ? RATING_META[v] : null
}

export function ratingLabel(value?: string | null): string {
  return ratingMeta(value)?.label ?? '—'
}

export function ratingTone(value?: string | null): RatingTone {
  return ratingMeta(value)?.tone ?? 'neutral'
}

export function ratingNumeric(value?: string | null): number | null {
  return ratingMeta(value)?.numeric ?? null
}
