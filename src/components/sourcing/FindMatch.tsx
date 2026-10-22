import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SKILL_PRIORITY } from '@/lib/skillPriority'
import { cn } from '@/lib/utils'

/**
 * The Match column in Find (Allan, 2026-10-22). People with a profile show
 * their search match (title, place, seniority and the skills by tier, with
 * must-haves capped as in Gio Fit). Apollo previews have only a name, title
 * and company, so they show what was checked instead of a number. Their real
 * Gio Fit comes once they're added to a job.
 */

export type CheckState = 'yes' | 'close' | 'no' | 'apollo' | 'later'

export interface FindMatchRow {
  match_kind?: 'search' | 'preview'
  match_score?: number | null
  fit_reasons?: string[]
  matched_skills?: Array<{ skill: string; tier: 'must' | 'nice' | 'extra' }>
  missing_must?: string[]
  must_total?: number
  checks?: { title: CheckState | null; place: CheckState | null; seniority: CheckState | null; skills: CheckState | null; company: CheckState | null }
}

const TIER_PRIORITY = { must: 'must', nice: 'nice', extra: 'bonus' } as const

const scoreTone = (n: number) =>
  n >= 85 ? 'text-[#1E7F4F]' : n >= 70 ? 'text-[#1F3B8A]' : n >= 55 ? 'text-[#8A5A00]' : 'text-text-tertiary'

const CHECK_LABEL: Record<string, string> = { title: 'Title', place: 'Place', seniority: 'Level', company: 'Company', skills: 'Skills' }

function Check({ name, state }: { name: string; state: CheckState }) {
  const mark = state === 'yes' || state === 'apollo' ? '✓' : state === 'close' ? '~' : state === 'later' ? '?' : '✕'
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-[11px] font-medium leading-none',
        (state === 'yes' || state === 'apollo') && 'bg-pastel-green text-pastel-green-foreground',
        state === 'close' && 'bg-[#F1F0EC] text-text-secondary',
        state === 'no' && 'bg-[#F1F0EC] text-text-tertiary',
        state === 'later' && 'bg-[#FBF0D9] text-[#8A5A00]',
      )}
    >
      {CHECK_LABEL[name]} <span aria-hidden>{mark}</span>
    </span>
  )
}

const CHECK_WORDS: Record<CheckState, string> = {
  yes: 'matches',
  close: 'is close',
  no: "doesn't match",
  apollo: 'filtered by Apollo',
  later: 'checked once you add them',
}

export function FindMatch({ row }: { row: FindMatchRow }) {
  if (row.match_kind === 'preview' || (row.match_kind == null && row.match_score == null)) {
    const checks = row.checks
    const entries = checks
      ? (['title', 'company', 'place', 'seniority', 'skills'] as const).filter((k) => checks[k]).map((k) => [k, checks[k]!] as const)
      : []
    if (!entries.length) return <span className="text-[12px] text-text-tertiary">Preview</span>
    const label = entries.map(([k, s]) => `${CHECK_LABEL[k]} ${CHECK_WORDS[s]}`).join(', ')
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={label} className="inline-flex flex-nowrap gap-1 outline-none">
            {entries.map(([k, s]) => <Check key={k} name={k} state={s} />)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[260px]">
          <p className="font-medium">Apollo shows only the name, title and company until you add someone.</p>
          <ul className="mt-1 space-y-0.5">
            {entries.map(([k, s]) => <li key={k}>{CHECK_LABEL[k]}: {CHECK_WORDS[s]}</li>)}
          </ul>
        </TooltipContent>
      </Tooltip>
    )
  }

  const score = Math.round(row.match_score ?? 0)
  const mustTotal = row.must_total ?? 0
  const missing = row.missing_must ?? []
  const caption = mustTotal
    ? `${mustTotal - missing.length} of ${mustTotal} must-have${mustTotal === 1 ? '' : 's'}`
    : row.fit_reasons?.[0] ?? 'search match'
  const skills = row.matched_skills ?? []
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={`Search match ${score}, ${caption}`} className="inline-flex items-baseline gap-1.5 whitespace-nowrap outline-none">
          <span className={cn('font-poppins text-[15px] font-semibold tabular-nums leading-none', scoreTone(score))}>{score}</span>
          <span className="max-w-[150px] truncate text-[11.5px] text-text-tertiary">{caption}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[280px]">
        <p className="font-medium">Search match: what their profile shows against this search. Gio Fit comes once they're in a job.</p>
        {row.fit_reasons?.length ? <p className="mt-1">{row.fit_reasons.join(' · ')}</p> : null}
        {skills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {skills.map((s) => (
              <span key={s.skill} className={cn('rounded-full px-1.5 py-0.5 text-[11px]', SKILL_PRIORITY[TIER_PRIORITY[s.tier]].pill)}>{s.skill}</span>
            ))}
          </div>
        )}
        {missing.length > 0 && <p className="mt-1.5">Not on their profile: {missing.join(', ')}</p>}
      </TooltipContent>
    </Tooltip>
  )
}
