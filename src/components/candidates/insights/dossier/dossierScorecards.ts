import type { ScoreRating } from '@/hooks/useScorecards'

export interface DossierScorecardArea {
  label: string
  rating: ScoreRating
}

export interface DossierScorecard {
  id: string
  interviewerName: string
  interviewerRole: string | null
  submittedAt: string
  stage: string
  rating: ScoreRating
  takeawayParagraphs: string[]
  areas?: DossierScorecardArea[]
}

export interface DossierPendingScorecard {
  userId: string
  name: string
}

const BLOCK_BREAK = /<\/(?:p|div|li|blockquote|h[1-6])>|<br\s*\/?>/gi

function decodeHtml(value: string) {
  if (typeof document === 'undefined') {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  }
  const node = document.createElement('textarea')
  node.innerHTML = value
  return node.value
}

/** Preserves authored paragraph boundaries while removing editor markup. */
export function richTextParagraphs(value?: string | null): string[] {
  if (!value) return []
  return decodeHtml(value.replace(BLOCK_BREAK, '\n').replace(/<[^>]*>/g, ''))
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function shortDossierDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}