import React, { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CandidateSheetSection } from './CandidateSheetSection'
import { GeneratingCard } from './GeneratingCard'
import { getSkillColor } from '@/utils/skillColors'

type EnrichStep = 'idle' | 'working' | 'done'

interface SkillsSectionProps {
  enrich: EnrichStep
  skills: string[]
  onAdd: (skill: string) => void
  onRemove: (skill: string) => void
  maxVisible?: number
  isEdit?: boolean
}

const SKILL_VARIANT_TO_TONE: Record<string, any> = {
  'pastel-blue': 'blue',
  'pastel-purple': 'purple',
  'pastel-green': 'green',
  'pastel-pink': 'pink',
  'pastel-yellow': 'yellow',
  'pastel-orange': 'orange',
}

export function SkillsSection({
  enrich,
  skills,
  onAdd,
  onRemove,
  maxVisible = 8,
}: SkillsSectionProps) {
  const [newSkill, setNewSkill] = useState('')
  const [showAll, setShowAll] = useState(false)

  const commit = () => {
    const v = newSkill.trim()
    if (v && !skills.includes(v)) {
      onAdd(v)
      setNewSkill('')
    }
  }

  const visible = showAll ? skills : skills.slice(0, maxVisible)
  const hidden = Math.max(0, skills.length - maxVisible)

  const rightMeta =
    enrich === 'done' && skills.length > 0 ? (
      <Badge tone="green" dot size="xs">
        {skills.length} detected
      </Badge>
    ) : null

  return (
    <CandidateSheetSection label="Skills" rightMeta={rightMeta}>
      {/* idle — no résumé yet */}
      {enrich === 'idle' && (
        <input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          placeholder="Type a skill, or drop a résumé to auto-detect…"
          className="w-full h-10 rounded-md bg-white px-3 text-[13px] font-inter text-virgilio-text placeholder:text-virgilio-muted focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30"
          style={{ border: '1px solid #E0DDD3' }}
        />
      )}

      {/* working — generating */}
      {enrich === 'working' && (
        <GeneratingCard label="Detecting skills…" variant="pills" />
      )}

      {/* done — chip cloud */}
      {enrich === 'done' && (
        <div className="flex flex-wrap items-center gap-2">
          {visible.map((skill) => (
            <Badge
              key={skill}
              tone={SKILL_VARIANT_TO_TONE[getSkillColor(skill)] || 'neutral'}
              size="md"
              onRemove={() => onRemove(skill)}
            >
              {skill}
            </Badge>
          ))}
          {!showAll && hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex h-badge-md items-center rounded-full bg-muted px-[11px] text-[12px] font-inter font-medium text-virgilio-muted hover:bg-virgilio-border/60 transition-colors"
            >
              + {hidden} more
            </button>
          )}
          <input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
            }}
            onBlur={commit}
            placeholder="Add skill…"
            className="flex-1 min-w-[120px] h-badge-md bg-transparent px-2 text-[12px] font-inter text-virgilio-text placeholder:text-virgilio-muted focus:outline-none"
          />
        </div>
      )}
    </CandidateSheetSection>
  )
}

export default SkillsSection
