import { BarChart3, Plus, Sparkles } from 'lucide-react'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftRosette } from '@/components/ui/EmptyIllustrations'

export type SubmittedVerdict =
  | { label: 'Strong yes'; tone: 'green' }
  | { label: 'Yes'; tone: 'green' }
  | { label: 'No'; tone: 'red' }
  | { label: 'Definitely no'; tone: 'red' }

export interface SubmittedScorecardRow {
  id: string
  name: string
  meta?: string | null
  verdict: SubmittedVerdict | null
  feedback?: string | null
  isMine?: boolean
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function PanelistRow({ p, isLast }: { p: SubmittedScorecardRow; isLast: boolean }) {
  const cleanFeedback = p.feedback
    ? p.feedback.replace(/<[^>]+>/g, '').trim()
    : ''
  return (
    <div className={cn('px-5 py-4', !isLast && 'border-b border-[#F1F0EC]')}>
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
            {p.isMine && (
              <Badge tone="lilac" size="xs">
                You
              </Badge>
            )}
          </div>
          {p.meta && (
            <div className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5">
              {p.meta}
            </div>
          )}
        </div>
        {p.verdict && (
          <Badge tone={p.verdict.tone} size="md" dot>
            {p.verdict.label}
          </Badge>
        )}
      </div>

      {cleanFeedback && (
        <div className="mt-3 bg-white border border-[#E7E8EE] rounded-[10px] p-3">
          <div className="font-inter font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#8B8F9E]">
            Written feedback
          </div>
          <p className="mt-1 font-inter text-[12.5px] leading-[1.6] text-[#1F2230]">
            “{cleanFeedback}”
          </p>
        </div>
      )}
    </div>
  )
}

export interface ScorecardsTabContentProps {
  submitted: SubmittedScorecardRow[]
  pendingCount: number
  onCompare?: () => void
  onAddMine?: () => void
}

export function ScorecardsTabContent({
  submitted,
  pendingCount,
  onCompare,
  onAddMine,
}: ScorecardsTabContentProps) {
  const total = submitted.length + pendingCount
  const subtitle =
    total === 0
      ? 'No scorecards yet'
      : `${submitted.length} of ${total} panelist${total === 1 ? '' : 's'} submitted`

  const canCompare = submitted.length >= 2

  return (
    <div className="space-y-4">
      <ProfileCard
        title="Submitted scorecards"
        subtitle={subtitle}
        bodyPadding="none"
        action={
          <>
            {canCompare && (
              <Button variant="secondary" size="sm" icon={BarChart3} onClick={onCompare}>
                Compare side-by-side
              </Button>
            )}
            {onAddMine && (
              <Button variant="primary" size="sm" icon={Plus} onClick={onAddMine}>
                My scorecard
              </Button>
            )}
          </>
        }
      >
        {submitted.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              variant="inline"
              title="No scorecards submitted yet"
              description={
                pendingCount > 0
                  ? `${pendingCount} panelist${pendingCount === 1 ? '' : 's'} pending`
                  : 'Add the first scorecard for this stage.'
              }
            />
          </div>
        ) : (
          <div>
            {submitted.map((p, i) => (
              <PanelistRow key={p.id} p={p} isLast={i === submitted.length - 1} />
            ))}
          </div>
        )}
      </ProfileCard>

      {submitted.length >= 2 && (
        <ProfileCard
          title="Side-by-side comparison"
          action={
            <Badge tone="purple" size="sm" icon={Sparkles}>
              Gio synthesis
            </Badge>
          }
        >
          <div className="bg-[#FAF8FF] border border-[#EDE4FF] rounded-[10px] p-3 font-inter text-[12.5px] leading-[1.6] text-[#1F2230]">
            {summarize(submitted)}
          </div>
        </ProfileCard>
      )}
    </div>
  )
}

function summarize(rows: SubmittedScorecardRow[]): string {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const k = r.verdict?.label ?? 'Pending'
    counts[k] = (counts[k] || 0) + 1
  }
  const parts = Object.entries(counts).map(
    ([label, n]) => `${n} ${label.toLowerCase()}`,
  )
  return `Across ${rows.length} submitted scorecard${rows.length === 1 ? '' : 's'}: ${parts.join(' · ')}.`
}
