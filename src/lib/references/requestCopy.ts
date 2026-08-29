/**
 * Copy composition for reference requests. Nothing here is hardcoded to a
 * client, a stage or a requirement — every string is derived from the template
 * and the current context.
 */
import type { ReferenceTemplate, RelationshipRule } from '@/lib/references/templateModel'

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']

const word = (n: number) => NUMBER_WORD[n] ?? String(n)

/** "2 references, one from a direct manager" */
export function refereeRulesLine(
  min: number,
  rules: RelationshipRule[] = [],
): string {
  const base = `${min} ${min === 1 ? 'reference' : 'references'}`
  const rule = rules
    .filter((r) => r.relationship)
    .map((r) => `${word(r.count || 1)} from a ${r.relationship.toLowerCase()}`)
  return [base, ...rule].join(', ')
}

/** Read-only relationship sentence for the sheet: "At least one must be a X" */
export function relationshipSentence(rules: RelationshipRule[] = []): string | null {
  const first = rules.find((r) => r.relationship)
  if (!first) return null
  return `At least ${word(first.count || 1)} must be a `
}

export function relationshipTarget(rules: RelationshipRule[] = []): string | null {
  const first = rules.find((r) => r.relationship)
  return first ? first.relationship.toLowerCase() : null
}

/**
 * The requirement line for the card:
 *  with a client → "{client} asks for {requirement} · {turnaround}"
 *  without      → "{requirement} · {turnaround}"
 */
export function composeRequirementLine(
  requirement: string,
  client?: string | null,
  turnaround?: string | null,
): string {
  return [client ? `${client} asks for ${requirement}` : requirement, turnaround]
    .filter(Boolean)
    .join(' · ')
}

/** "{referee rules} · {n} questions" for a template row. */
export function templateSummaryLine(t: ReferenceTemplate): string {
  const visible = (t.questions || []).filter((q) => !q.internal).length
  return `${refereeRulesLine(t.min_referees, t.relationship_rules)} · ${visible} ${
    visible === 1 ? 'question' : 'questions'
  }`
}

/** Reminder cadence resolved into a sentence the recruiter reads. */
export function reminderLine(t: ReferenceTemplate | null): string {
  const r = t?.reminders
  if (!r || !r.enabled) return 'No reminders'
  return `First after ${r.candidate_first_after_days}d, then every ${r.candidate_every_days}d`
}

export function expiryLine(days: number | undefined | null): string {
  const d = days && days > 0 ? days : 7
  const date = new Date(Date.now() + d * 86_400_000)
  return `${d} days · ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

/**
 * Stages that normally collect references. Prompt only — never a gate.
 * The list is CONFIGURATION: it comes from the template's `collect_at_stages`.
 * Falls back to the shipped default when a template has none.
 */
export const DEFAULT_COLLECT_AT_STAGES = ['Final interview', 'Offer']

export function stageSuggestsReferences(
  stageName?: string | null,
  collectAtStages?: string[] | null,
): boolean {
  if (!stageName) return false
  const list = collectAtStages?.length ? collectAtStages : DEFAULT_COLLECT_AT_STAGES
  const s = stageName.trim().toLowerCase()
  return list.some((n) => {
    const c = String(n || '').trim().toLowerCase()
    return !!c && (s === c || s.includes(c))
  })
}

/** Resolve {{placeholders}} in template email copy. */
export function resolvePlaceholders(
  text: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return (text || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : String(v)
  })
}
