import React from 'react'
import { Button } from '@/components/ui/button'
import { SkillPill } from '@/components/jobs/SkillPill'
import { SKILL_PRIORITY, type SkillPriority, type SuggestedSkills } from '@/lib/skillPriority'

const TIERS: { key: 'must' | 'nice' | 'extra'; priority: SkillPriority }[] = [
  { key: 'must', priority: 'must' },
  { key: 'nice', priority: 'nice' },
  { key: 'extra', priority: 'bonus' },
]

/**
 * The preview of Gio's skills by tier. Nothing changes on the job until "Use
 * these skills"; a pill's × drops it from the proposal first. Below the tiers:
 * the years it will fill in, and what it left out because a CV can't show it
 * (traits) or another field scores it (location, years, contract).
 */
export function SkillSuggestions({
  value,
  onChange,
  onApply,
  onCancel,
  replacing,
  years,
}: {
  value: SuggestedSkills
  onChange: (next: SuggestedSkills) => void
  onApply: () => void
  onCancel: () => void
  /** The job already has skills: applying replaces them. */
  replacing: boolean
  /** The Min/Max years "Use these skills" also fills in (only empty fields). */
  years?: { min_years_experience?: number; max_years_experience?: number }
}) {
  const total = value.must.length + value.nice.length + value.extra.length
  const leftOut = value.leftOut ?? []
  const lo = years?.min_years_experience
  const hi = years?.max_years_experience
  const yearsLabel =
    lo != null && hi != null ? `${lo}–${hi} years` : lo != null ? `${lo}+ years` : hi != null ? `up to ${hi} years` : null
  return (
    <div className="rounded-xl border border-[#E4DAFD] bg-[#FAF8FF] p-4 font-inter">
      <p className="text-[13px] font-medium text-text-primary">Gio suggests {total} skills</p>
      <p className="mt-0.5 text-[12px] text-text-secondary">
        What a CV can show for this role. Keep the must-haves to real requirements: each one a candidate lacks caps their score.
      </p>
      <div className="mt-3 space-y-3">
        {TIERS.map((t) => (
          <div key={t.key}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-[12px] font-medium text-text-primary">{SKILL_PRIORITY[t.priority].label}</span>
              <span className="text-[11.5px] text-text-tertiary tabular-nums">{value[t.key].length}</span>
            </div>
            {value[t.key].length ? (
              <div className="flex flex-wrap gap-1.5">
                {value[t.key].map((skill) => (
                  <SkillPill
                    key={skill}
                    skill={skill}
                    priority={t.priority}
                    onRemove={() => onChange({ ...value, [t.key]: value[t.key].filter((x) => x !== skill) })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-text-tertiary">None</p>
            )}
          </div>
        ))}
      </div>
      {(yearsLabel || leftOut.length > 0) && (
        <div className="mt-3 space-y-1 border-t border-[#E4DAFD] pt-3 text-[12px] leading-[1.5] text-text-secondary">
          {yearsLabel && (
            <p>
              <span className="font-medium text-text-primary">Experience:</span> {yearsLabel}, set in Min and Max years.
            </p>
          )}
          {leftOut.length > 0 && (
            <p>
              <span className="font-medium text-text-primary">Left for the interview and other fields:</span> {leftOut.join(' · ')}
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onApply} disabled={total === 0}>
          {replacing ? 'Replace current skills' : 'Use these skills'}
        </Button>
      </div>
    </div>
  )
}
