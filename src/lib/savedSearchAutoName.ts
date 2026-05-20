import type { CandidateFilters } from '@/contexts/CandidateFilterContext'

/**
 * Derive a smart, human-readable name from active filters / search context.
 *
 * Priority (max 3 segments, joined by " · ", truncated to 48 chars):
 *   1. Primary skill OR primary boolean keyword
 *   2. Seniority OR pipeline stage
 *   3. Location (city > state > country)
 *
 * Fallback: "Saved search · {Mon D}"
 */
export function deriveAutoName(
  filters: Partial<CandidateFilters>,
  context?: { booleanQuery?: string; aiQuery?: string },
): string {
  const segments: string[] = []

  // 1. Primary skill or boolean keyword
  const firstSkill = filters.skills?.[0]
  const booleanKeyword = context?.booleanQuery
    ? extractFirstKeyword(context.booleanQuery)
    : null
  const aiKeyword = context?.aiQuery?.trim().split(/\s+/).slice(0, 3).join(' ') || null
  if (firstSkill) segments.push(firstSkill)
  else if (booleanKeyword) segments.push(booleanKeyword)
  else if (aiKeyword) segments.push(aiKeyword)

  // 2. Seniority or stage
  const seniority = filters.seniorityLevels?.[0]
  const stage = filters.stages?.[0]
  if (seniority) segments.push(seniority)
  else if (stage) segments.push(stage)

  // 3. Location
  const city = filters.cities?.[0]
  const state = filters.states?.[0]
  const country = filters.countries?.[0]
  if (city) segments.push(city)
  else if (state) segments.push(state)
  else if (country) segments.push(country)

  if (segments.length === 0) {
    const d = new Date()
    const mon = d.toLocaleString('en-US', { month: 'short' })
    return `Saved search · ${mon} ${d.getDate()}`
  }

  const name = segments.slice(0, 3).join(' · ')
  return name.length > 48 ? name.slice(0, 47).trimEnd() + '…' : name
}

function extractFirstKeyword(expr: string): string | null {
  // Pull first quoted phrase or first plain word, ignoring operators.
  const quoted = expr.match(/"([^"]+)"/)
  if (quoted) return quoted[1]
  const word = expr
    .split(/\s+/)
    .find(w => w && !['AND', 'OR', 'NOT', '(', ')'].includes(w.toUpperCase()))
  return word ? word.replace(/[()]/g, '') : null
}
