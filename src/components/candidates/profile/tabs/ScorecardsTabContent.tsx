import { useState } from 'react'
import { BarChart3, Plus, Sparkles, ClipboardCheck, Send, Check, PenLine } from 'lucide-react'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftRosette } from '@/components/ui/EmptyIllustrations'
import { RATING_META } from '@/lib/scorecardRatings'
import type { ScoreRating } from '@/hooks/useScorecards'
import type { RequiredPanelist, ScorecardReminderCadence } from '@/hooks/useStageScorecardRequirement'
import { cadenceLabel, timeAgoShort } from '@/hooks/useStageScorecardRequirement'

export type SubmittedVerdict =
  | { label: 'Strong yes'; tone: 'green' }
  | { label: 'Yes'; tone: 'green' }
  | { label: 'Lean yes'; tone: 'yellow' }
  | { label: 'Lean no'; tone: 'orange' }
  | { label: 'Strong no'; tone: 'red' }
  | { label: 'No'; tone: 'red' }
  | { label: 'Definitely no'; tone: 'red' }

export interface SubmittedQuestionScore {
  questionId: string
  questionText: string
  rating: ScoreRating
}

export interface SubmittedScorecardRow {
  id: string
  name: string
  meta?: string | null
  verdict: SubmittedVerdict | null
  feedback?: string | null
  isMine?: boolean
  scores?: SubmittedQuestionScore[]
  submittedAt?: string | null
}

// Verdict-distribution palette (matches Scorecards Summary sidebar).
const VERDICT_BAR_COLOR: Record<ScoreRating, string> = {
  strong_no: '#EF4444',
  lean_no: '#F97316',
  lean_yes: '#F59E0B',
  yes: '#12B886',
  strong_yes: '#12B886',
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

function ScoreQuestionCard({ score }: { score: SubmittedQuestionScore }) {
  const n = RATING_META[score.rating]?.numeric ?? 0
  const color = VERDICT_BAR_COLOR[score.rating] ?? '#12B886'
  return (
    <div
      style={{
        background: '#FAFAF7',
        border: '1px solid #F1F0EC',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div
        title={score.questionText}
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#8B8F9E',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {score.questionText}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= n ? color : '#E7E8EE',
            }}
          />
        ))}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: 16,
          color: '#1F2230',
          lineHeight: 1,
        }}
      >
        {n}
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 12,
            color: '#8B8F9E',
            marginLeft: 2,
          }}
        >
          /5
        </span>
      </div>
    </div>
  )
}

function PanelistRow({ p, isLast }: { p: SubmittedScorecardRow; isLast: boolean }) {
  const cleanFeedback = p.feedback
    ? p.feedback.replace(/<[^>]+>/g, '').trim()
    : ''
  const scores = p.scores ?? []
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
          {(() => {
            const dateStr = p.submittedAt
              ? new Date(p.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : null
            const parts = [dateStr, p.meta].filter(Boolean) as string[]
            return parts.length > 0 ? (
              <div className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5">
                {parts.join(' · ')}
              </div>
            ) : null
          })()}
        </div>
        {p.verdict && (
          <Badge tone={p.verdict.tone} size="md" dot>
            {p.verdict.label}
          </Badge>
        )}
      </div>

      {scores.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}
        >
          {scores.map((s) => (
            <ScoreQuestionCard key={s.questionId} score={s} />
          ))}
        </div>
      )}

      {cleanFeedback && (
        <div className="mt-3 bg-white border border-[#E7E8EE] rounded-[10px] p-3">
          <div className="font-inter font-medium text-[10.5px] tracking-[0.06em] uppercase text-[#8B8F9E]">
            Key takeaways
          </div>
          <p className="mt-1 font-inter text-[12.5px] leading-[1.6] text-[#1F2230]">
            “{cleanFeedback}”
          </p>
        </div>
      )}
    </div>
  )
}

export interface ScorecardsRequirementUiInfo {
  active: boolean
  totalExpected: number
  pendingRequired: RequiredPanelist[]
  remindersEnabled: boolean
  cadence: ScorecardReminderCadence
  candidateFirstName: string | null
  nextStageName: string | null
  onRequest: (interviewerUserId: string) => Promise<void>
  onRequestAll: () => Promise<void>
  /** Opens the current user's own scorecard editor. */
  onCompleteMine?: () => void
  /** So we can swap Request → Complete for the current user. */
  currentUserId?: string
}

export interface ScorecardsTabContentProps {
  submitted: SubmittedScorecardRow[]
  pendingCount: number
  onCompare?: () => void
  onAddMine?: () => void
  requirement?: ScorecardsRequirementUiInfo
}

function RequiredPendingRow({
  p,
  cadence,
  remindersEnabled,
  onRequest,
  isLast,
  isMe,
  onCompleteMine,
}: {
  p: RequiredPanelist
  cadence: ScorecardReminderCadence
  remindersEnabled: boolean
  onRequest: (uid: string) => Promise<void>
  isLast: boolean
  isMe?: boolean
  onCompleteMine?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const requested = !!p.lastRequestedAt
  const handle = async () => {
    setBusy(true)
    try { await onRequest(p.userId) } finally { setBusy(false) }
  }
  const subline = isMe
    ? 'Your scorecard is pending — this is holding up the pipeline'
    : requested
      ? `Requested ${timeAgoShort(p.lastRequestedAt)}${remindersEnabled ? ` · reminder emailed ${cadenceLabel(cadence)}` : ''}`
      : 'Awaiting scorecard'
  return (
    <div className={cn('px-5 py-4 bg-[#FCFCFA]', !isLast && 'border-b border-[#F1F0EC]')}>
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
            {isMe && <Badge tone="lilac" size="xs">You</Badge>}
            {p.roleLabel && <Badge tone="neutral" size="xs">{p.roleLabel}</Badge>}
            <Badge tone="purple" size="xs" dot>Required</Badge>
          </div>
          <div className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5">{subline}</div>
        </div>
        {isMe && onCompleteMine ? (
          <Button variant="primary" size="sm" icon={PenLine} onClick={onCompleteMine}>
            Complete scorecard
          </Button>
        ) : requested ? (
          <Button variant="ghost" size="sm" icon={Check} onClick={handle} loading={busy}>
            Requested
          </Button>
        ) : (
          <Button variant="purple" size="sm" icon={Send} onClick={handle} loading={busy}>
            Request scorecard
          </Button>
        )}
        <Badge tone="yellow" size="md" dot>Pending</Badge>
      </div>
    </div>
  )
}

export function ScorecardsTabContent({
  submitted,
  pendingCount,
  onCompare,
  onAddMine,
  requirement,
}: ScorecardsTabContentProps) {
  const total = submitted.length + pendingCount
  const requiredActive = !!requirement?.active
  const requiredPending = requirement?.pendingRequired ?? []
  const [requestingAll, setRequestingAll] = useState(false)

  const baseSubtitle =
    total === 0
      ? 'No scorecards yet'
      : `${submitted.length} of ${total} panelist${total === 1 ? '' : 's'} submitted`
  const subtitle = requiredActive && requiredPending.length > 0
    ? `${baseSubtitle} · ${requiredPending.length} required scorecard${requiredPending.length === 1 ? '' : 's'} pending`
    : baseSubtitle

  const canCompare = submitted.length >= 2

  const bannerSubline = (() => {
    if (!requirement) return ''
    const first = requirement.candidateFirstName || 'This candidate'
    const next = requirement.nextStageName || 'the next stage'
    const remaining = requiredPending.length
    const base = `${first} can't move to ${next} until the ${remaining} remaining interviewer${remaining === 1 ? '' : 's'} submit${remaining === 1 ? 's' : ''}.`
    return requirement.remindersEnabled
      ? `${base} Reminders are emailed ${cadenceLabel(requirement.cadence)}.`
      : base
  })()

  const handleRequestAll = async () => {
    if (!requirement) return
    setRequestingAll(true)
    try { await requirement.onRequestAll() } finally { setRequestingAll(false) }
  }

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
        {requiredActive && requiredPending.length > 0 && (
          <div className="mt-3 mx-5 flex items-center gap-3 rounded-[10px] border border-[#EDE4FF] bg-[#FAF8FF] px-4 py-3">
            <div className="h-[34px] w-[34px] rounded-lg bg-[#EDE4FF] text-[#6F3FF5] inline-flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-poppins font-semibold text-[13px] text-[#1F2230]">
                  Scorecard required to advance
                </span>
                <Badge tone="purple" size="xs" dot>Required this stage</Badge>
              </div>
              <div className="mt-0.5 font-inter text-[11.5px] text-[#5A6072]">{bannerSubline}</div>
            </div>
            <Button variant="purple" size="sm" icon={Send} onClick={handleRequestAll} loading={requestingAll}>
              Request all
            </Button>
          </div>
        )}
        {submitted.length === 0 && !(requiredActive && requiredPending.length > 0) ? (
          <EmptyState
            size="card"
            illustration={<SoftRosette />}
            title="No scorecards submitted yet"
            body={
              pendingCount > 0
                ? `${pendingCount} panelist${pendingCount === 1 ? '' : 's'} pending`
                : 'Add the first scorecard for this stage.'
            }
          />
        ) : (
          <div className={submitted.length > 0 || requiredActive ? 'mt-3' : ''}>
            {submitted.map((p, i) => (
              <PanelistRow
                key={p.id}
                p={p}
                isLast={i === submitted.length - 1 && !(requiredActive && requiredPending.length > 0)}
              />
            ))}
            {requiredActive && requiredPending.map((p, i) => (
              <RequiredPendingRow
                key={p.userId}
                p={p}
                cadence={requirement!.cadence}
                remindersEnabled={requirement!.remindersEnabled}
                onRequest={requirement!.onRequest}
                isLast={i === requiredPending.length - 1}
              />
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
