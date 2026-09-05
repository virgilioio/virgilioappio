import type { CSSProperties } from 'react'

/**
 * Shared visual truth for the pipeline Board and List views.
 * One stage colour, one score colour, one staleness rule — used by both.
 */

export const PIPELINE_INK = '#0d0d09'
export const PIPELINE_TEXT = '#1F2230'
export const PIPELINE_MUTED = '#5A6072'
export const PIPELINE_TERTIARY = '#8B8F9E'
export const PIPELINE_HAIRLINE = '#E7E8EE'
export const PIPELINE_ROWLINE = '#F1F0EC'
export const PIPELINE_SAND = '#FAFAF7'
export const PIPELINE_PURPLE = '#6F3FF5'
export const PIPELINE_LILAC = '#FAF8FF'
export const PIPELINE_RED = '#FA5252'
export const PIPELINE_GREEN = '#12B886'
export const PIPELINE_AMBER = '#F59E0B'

/** Stage identity by stage type — the same hue in both views. */
const STAGE_COLOR_BY_TYPE: Record<string, string> = {
  application: '#0EA5E9',
  application_review: '#6F3FF5',
  screening: '#0EA5E9',
  assessment: '#EC4899',
  interview: '#6F3FF5',
  offer: '#F59E0B',
  reference_check: '#12B886',
  onboarding: '#12B886',
}

const FALLBACK_CYCLE = ['#0EA5E9', '#EC4899', '#6F3FF5', '#F59E0B', '#12B886']

export function stageColor(stageType: string | null | undefined, index = 0): string {
  if (stageType && STAGE_COLOR_BY_TYPE[stageType]) return STAGE_COLOR_BY_TYPE[stageType]
  return FALLBACK_CYCLE[index % FALLBACK_CYCLE.length]
}

export function scoreColor(score: number | null | undefined): string {
  if (typeof score !== 'number') return PIPELINE_MUTED
  if (score >= 85) return PIPELINE_GREEN
  if (score >= 70) return PIPELINE_AMBER
  return PIPELINE_MUTED
}

export const isStale = (days: number) => days > 7

/** Whole days since the candidate entered the stage. */
export function daysInStage(enteredAt?: string | null, createdAt?: string | null): number {
  const base = enteredAt || createdAt
  if (!base) return 0
  const ms = Date.now() - new Date(base).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

/** What's owed at this stage — the reason the list view exists. */
const NEXT_STEP_BY_TYPE: Record<string, string> = {
  application: 'Screen call to schedule',
  application_review: 'Screen call to schedule',
  screening: 'Screen call to schedule',
  assessment: 'Awaiting submission',
  interview: 'Panel to book',
  offer: 'Decision with hiring manager',
  reference_check: 'References in progress',
}

export function nextStepText(stageType: string | null | undefined): string {
  return (stageType && NEXT_STEP_BY_TYPE[stageType]) || '—'
}

/** One grid constant — header row, stage headers and data rows all import it. */
export const LIST_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px minmax(0,1.9fr) 92px 116px minmax(0,1.3fr) 132px 64px',
  alignItems: 'center',
  gap: 12,
}
