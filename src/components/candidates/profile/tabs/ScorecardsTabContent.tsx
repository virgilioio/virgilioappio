import { useState } from 'react'
import { BarChart3, Plus, Sparkles } from 'lucide-react'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

type Verdict =
  | { label: 'Strong yes'; tone: 'green' }
  | { label: 'Yes'; tone: 'green' }
  | { label: 'Lean yes'; tone: 'yellow' }
  | { label: 'Lean no'; tone: 'orange' }
  | { label: 'Strong no'; tone: 'red' }

interface PanelistScorecard {
  id: string
  name: string
  role: string
  meta: string
  verdict: Verdict
  scores: { label: string; value: number }[]
  feedback: string
}

const SUBMITTED: PanelistScorecard[] = [
  {
    id: 'tb',
    name: 'Tom Bell',
    role: 'Hiring manager',
    meta: 'May 12 · Onsite Day 1',
    verdict: { label: 'Strong yes', tone: 'green' },
    scores: [
      { label: 'Craft', value: 5 },
      { label: 'Systems thinking', value: 5 },
      { label: 'Communication', value: 5 },
      { label: 'Culture', value: 4 },
    ],
    feedback:
      'Best portfolio for this role in months. Linear case study maps 1:1 to the nav refresh.',
  },
  {
    id: 'al',
    name: 'An Le',
    role: 'Panel · Design',
    meta: 'May 12 · Onsite Day 1',
    verdict: { label: 'Yes', tone: 'green' },
    scores: [
      { label: 'Craft', value: 5 },
      { label: 'Systems thinking', value: 4 },
      { label: 'Communication', value: 4 },
      { label: 'Culture', value: 4 },
    ],
    feedback:
      'Strong systems thinking and craft. Some concerns about stakeholder management at scale.',
  },
  {
    id: 'jk',
    name: 'Jo Khan',
    role: 'Panel · Design',
    meta: 'May 12 · Onsite Day 1',
    verdict: { label: 'Lean yes', tone: 'yellow' },
    scores: [
      { label: 'Craft', value: 5 },
      { label: 'Systems thinking', value: 4 },
      { label: 'Communication', value: 3 },
      { label: 'Culture', value: 4 },
    ],
    feedback:
      "Solid craft. Would've liked more leadership examples — she has them, just didn't surface in our 45 min.",
  },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function SegmentBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1 w-3 rounded-full',
            i < value ? 'bg-[#0d0d09]' : 'bg-[#E7E8EE]',
          )}
        />
      ))}
    </div>
  )
}

function PanelistRow({ p, isLast }: { p: PanelistScorecard; isLast: boolean }) {
  return (
    <div
      className={cn(
        'px-5 py-4',
        !isLast && 'border-b border-[#F1F0EC]',
      )}
    >
      {/* Header line */}
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-[#FAFAF7] text-[#5A6072] font-poppins font-semibold text-[12px]">
            {initials(p.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-poppins font-semibold text-[13.5px] tracking-[-0.005em] text-[#1F2230]">
              {p.name}
            </span>
            <Badge tone="neutral" size="xs">
              {p.role}
            </Badge>
          </div>
          <div className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5">
            {p.meta}
          </div>
        </div>
        <Badge tone={p.verdict.tone} size="md" dot>
          {p.verdict.label}
        </Badge>
      </div>

      {/* Area scores grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        {p.scores.map((s) => (
          <div
            key={s.label}
            className="bg-[#FAFAF7] border border-[#F1F0EC] rounded-lg p-2.5"
          >
            <div className="font-inter font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#8B8F9E]">
              {s.label}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <SegmentBar value={s.value} />
              <div className="font-poppins font-semibold text-[13px] text-[#0d0d09] tabular-nums">
                {s.value}
                <span className="text-[#8B8F9E]">/5</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Written feedback */}
      <div className="mt-3 bg-white border border-[#E7E8EE] rounded-[10px] p-3">
        <div className="font-inter font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#8B8F9E]">
          Written feedback
        </div>
        <p className="mt-1 font-inter text-[12.5px] leading-[1.6] text-[#1F2230]">
          “{p.feedback}”
        </p>
      </div>
    </div>
  )
}

export interface ScorecardsTabContentProps {
  onCompare?: () => void
  onAddMine?: () => void
}

export function ScorecardsTabContent({
  onCompare,
  onAddMine,
}: ScorecardsTabContentProps) {
  return (
    <div className="space-y-4">
      {/* Card 1 · Submitted scorecards */}
      <ProfileCard
        title="Submitted scorecards"
        subtitle="3 of 5 panelists have submitted · panel debrief is scheduled for Thu 4:00 PM"
        bodyPadding="none"
        action={
          <>
            <Button variant="secondary" size="sm" icon={BarChart3} onClick={onCompare}>
              Compare side-by-side
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={onAddMine}>
              My scorecard
            </Button>
          </>
        }
      >
        <div>
          {SUBMITTED.map((p, i) => (
            <PanelistRow
              key={p.id}
              p={p}
              isLast={i === SUBMITTED.length - 1}
            />
          ))}
        </div>
      </ProfileCard>

      {/* Card 2 · Side-by-side comparison */}
      <ProfileCard
        title="Side-by-side comparison"
        action={
          <Badge tone="purple" size="sm" icon={Sparkles}>
            Gio synthesis
          </Badge>
        }
      >
        <div className="bg-[#FAF8FF] border border-[#EDE4FF] rounded-[10px] p-3 font-inter text-[12.5px] leading-[1.6] text-[#1F2230]">
          <span className="font-semibold">Consensus:</span> all 3 panelists rate
          craft at 5/5. Communication is split — Tom (5), An (4), Jo (3) —
          suggesting a follow-up to test stakeholder scenarios before the offer.
        </div>
      </ProfileCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar pending row with nudge state

export interface ScorecardsPendingPanelist {
  id: string
  name: string
  role: string
}

export const PENDING_PANELISTS: ScorecardsPendingPanelist[] = [
  { id: 'mr', name: 'Maya Reyes', role: 'Recruiter' },
  { id: 'ky', name: 'Karl Yu', role: 'Panel · Eng' },
]

export function PendingNudgeRow({ row }: { row: ScorecardsPendingPanelist }) {
  const [nudged, setNudged] = useState(false)
  return (
    <div className="flex items-center gap-2 bg-[#FAFAF7] border border-[#F1F0EC] rounded-lg px-2.5 py-2">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarFallback className="bg-white border border-[#F1F0EC] text-[#5A6072] font-poppins font-semibold text-[10px]">
          {initials(row.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="font-inter font-medium text-[11.5px] text-[#1F2230] truncate">
          {row.name}
        </div>
        <div className="font-inter text-[10.5px] text-[#8B8F9E] truncate">
          {row.role}
        </div>
      </div>
      {nudged ? (
        <span className="font-inter text-[11px] text-[#5A6072] px-2">
          Nudged
        </span>
      ) : (
        <Button
          variant="purple"
          size="sm"
          onClick={() => {
            setNudged(true)
            toast({
              title: 'Nudge sent',
              description: `Reminder sent to ${row.name}.`,
            })
          }}
        >
          Nudge
        </Button>
      )}
    </div>
  )
}
