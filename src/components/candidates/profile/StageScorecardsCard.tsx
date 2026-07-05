import { useMemo, useState } from 'react'
import { BarChart3, Plus, Sparkles, ClipboardCheck, Send, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAllStageScorecards } from '@/hooks/useAllStageScorecards'
import { InlineEmpty } from '@/components/ui/empty-state'
import type { RequiredPanelist } from '@/hooks/useStageScorecardRequirement'
import { timeAgoShort } from '@/hooks/useStageScorecardRequirement'

interface PanelistRow {
  userId: string
  name: string
  roleLabel?: string  // e.g. "Hiring manager", "Panel", "Recruiter"
}

export interface ScorecardRequirementInfo {
  active: boolean
  totalExpected: number
  pendingRequired: RequiredPanelist[]
  onRequest: (interviewerUserId: string) => Promise<void>
  onRequestAll: () => Promise<void>
}

interface StageScorecardsCardProps {
  stageInstanceId: string
  associationId: string
  currentUserId?: string
  /** Optional list of expected panelists (e.g. from useStageBookings). Used to render pending rows. */
  expectedPanelists?: PanelistRow[]
  onOpenFullSheet: (scorecardId: string) => void
  onSubmitScorecard?: () => void
  onCompare?: () => void
  /** Optional dismiss handler for AI drafts */
  onDismissAiDraft?: (scorecardId: string) => Promise<void>
  /** Bump to force the internal scorecards fetch to refresh (e.g. after submit). */
  refreshNonce?: number
  /** When set + active, renders the "required to advance" banner and request actions. */
  requirement?: ScorecardRequirementInfo
}

import { ratingLabel as sharedRatingLabel, ratingTone as sharedRatingTone, RATING_META, coerceRating } from '@/lib/scorecardRatings'

function ratingTone(r?: string | null): 'green' | 'yellow' | 'orange' | 'red' | 'neutral' {
  return sharedRatingTone(r)
}

function ratingLabel(r?: string | null): string {
  return sharedRatingLabel(r)
}

function timeAgoConcise(iso?: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'today'
  return `${days}d ago`
}

function initials(name?: string | null) {
  if (!name) return '—'
  return name
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function StageScorecardsCard({
  stageInstanceId, associationId, currentUserId,
  expectedPanelists,
  onOpenFullSheet, onSubmitScorecard, onCompare, onDismissAiDraft,
  refreshNonce,
  requirement,
}: StageScorecardsCardProps) {
  const { scorecards, loading } = useAllStageScorecards(stageInstanceId, associationId, refreshNonce)

  const submitted = useMemo(
    () => scorecards.filter(s => !s.is_ai_draft && !!s.rating),
    [scorecards],
  )

  // If a requirement is active use its list (authoritative). Otherwise, fall
  // back to any explicitly-provided expected panelist list.
  const requiredActive = !!requirement?.active
  const requiredPending = requirement?.pendingRequired ?? []
  const fallbackPending = useMemo(() => {
    if (requiredActive || !expectedPanelists) return []
    const submittedIds = new Set(submitted.map(s => s.created_by))
    return expectedPanelists.filter(p => !submittedIds.has(p.userId))
  }, [requiredActive, expectedPanelists, submitted])

  const pendingCount = requiredActive
    ? requiredPending.length
    : fallbackPending.length || Math.max(0, (expectedPanelists?.length ?? submitted.length) - submitted.length)

  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [requestingAll, setRequestingAll] = useState(false)

  const handleRequest = async (uid: string) => {
    if (!requirement) return
    setRequestingId(uid)
    try { await requirement.onRequest(uid) } finally { setRequestingId(null) }
  }
  const handleRequestAll = async () => {
    if (!requirement) return
    setRequestingAll(true)
    try { await requirement.onRequestAll() } finally { setRequestingAll(false) }
  }

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5">
        <div className="min-w-0">
          <h3 className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-text-primary">
            Scorecards
          </h3>
          <p className="mt-1 text-[12.5px] text-text-tertiary font-poppins">
            {submitted.length} submitted{pendingCount > 0 && <> · {pendingCount} pending</>}
            {requiredActive && <> · required to advance</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onCompare && submitted.length >= 2 && (
            <Button variant="ghost" size="sm" icon={BarChart3} onClick={onCompare}>
              Compare
            </Button>
          )}
          {onSubmitScorecard && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={onSubmitScorecard}>
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Required-to-advance banner */}
      {requiredActive && requiredPending.length > 0 && (
        <div className="mx-5 sm:mx-6 mt-4 flex items-center gap-3 rounded-[10px] border border-[#EDE4FF] bg-[#FAF8FF] px-3.5 py-3">
          <div
            className="h-8 w-8 rounded-lg bg-[#EDE4FF] text-[#6F3FF5] inline-flex items-center justify-center shrink-0"
          >
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-poppins font-semibold text-[12.5px] text-[#1F2230]">
                Scorecard required to advance
              </span>
              <Badge tone="purple" size="xs" dot>Required</Badge>
            </div>
            <div className="mt-0.5 font-inter text-[11px] text-[#5A6072]">
              {requiredPending.length} of {requirement!.totalExpected} interviewer
              {requirement!.totalExpected === 1 ? '' : 's'} still owe{requiredPending.length === 1 ? 's' : ''} a scorecard for this stage.
            </div>
          </div>
          <Button
            variant="purple"
            size="sm"
            icon={Send}
            onClick={handleRequestAll}
            loading={requestingAll}
          >
            Request all
          </Button>
        </div>
      )}

      {/* Rows */}
      <div className="mt-4 divide-y divide-virgilio-border/60">
        {loading && submitted.length === 0 && fallbackPending.length === 0 && requiredPending.length === 0 ? (
          <div className="px-5 sm:px-6 py-6 text-[13px] text-text-tertiary">Loading scorecards…</div>
        ) : submitted.length === 0 && fallbackPending.length === 0 && requiredPending.length === 0 ? (
          <div className="px-5 sm:px-6 py-4">
            <InlineEmpty
              text="No scorecards yet"
              action={onSubmitScorecard ? 'Submit scorecard' : undefined}
              onAction={onSubmitScorecard}
            />
          </div>
        ) : (
          <>
            {submitted.map((s) => {
              const isMine = s.created_by === currentUserId
              const name = s.author_name || s.author_email || 'Reviewer'
              const tone = ratingTone(s.rating)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenFullSheet(s.id)}
                  className="w-full text-left px-5 sm:px-6 py-4 hover:bg-[hsl(var(--menu-hover))] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10.5px] font-medium">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-poppins font-medium text-[13px] text-text-primary truncate">
                          {name}
                        </span>
                        {isMine && <Badge tone="lilac" size="xs">You</Badge>}
                        <span className="text-[12px] text-text-tertiary font-poppins ml-auto pl-2">
                          {timeAgoConcise(s.created_at)}
                        </span>
                      </div>
                      {s.general_overview && (
                        <p className="mt-1.5 italic text-[12.5px] text-text-secondary font-poppins line-clamp-2">
                          “{s.general_overview.replace(/<[^>]+>/g, '').trim()}”
                        </p>
                      )}
                      {s.criterion_scores && s.criterion_scores.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {s.criterion_scores.map((c) => {
                            const meta = coerceRating(c.rating) ? RATING_META[coerceRating(c.rating)!] : null
                            const n = meta?.numeric ?? 0
                            const color = meta?.bg ?? '#E0DDD3'
                            return (
                              <div
                                key={c.questionId}
                                className="rounded-[10px] border border-virgilio-border bg-white px-3 py-2.5"
                              >
                                <div
                                  className="font-poppins uppercase tracking-[0.06em] truncate"
                                  style={{ fontSize: 10.5, color: '#8B8F9E', fontWeight: 600 }}
                                  title={c.questionText}
                                >
                                  {c.questionText}
                                </div>
                                <div className="mt-1.5 flex items-center gap-[3px]">
                                  {[0, 1, 2, 3, 4].map((i) => (
                                    <span
                                      key={i}
                                      className="h-[3px] flex-1 rounded-full"
                                      style={{ background: i < n ? color : '#E7E8EE' }}
                                    />
                                  ))}
                                </div>
                                <div
                                  className="mt-1.5 font-poppins"
                                  style={{ fontSize: 13, fontWeight: 700, color: '#1F2230' }}
                                >
                                  {n}<span className="text-text-tertiary font-medium">/5</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 ml-2">
                      <Badge tone={tone} size="sm" dot>
                        {ratingLabel(s.rating)}
                      </Badge>
                    </div>
                  </div>
                </button>
              )
            })}

            {/* AI drafts (visible to author) */}
            {scorecards.filter(s => s.is_ai_draft).map((s) => (
              <div key={s.id} className="px-5 sm:px-6 py-3 flex items-center gap-3 bg-[hsl(var(--menu-selected))]/40">
                <Sparkles className="h-4 w-4 text-virgilio-purple shrink-0" />
                <div className="text-[12.5px] font-poppins text-text-primary flex-1 min-w-0">
                  AI notes analysis available — review your draft
                </div>
                <Button variant="purple" size="xs" onClick={() => onOpenFullSheet(s.id)}>
                  Review
                </Button>
                {onDismissAiDraft && (
                  <Button variant="ghost" size="xs" onClick={() => onDismissAiDraft(s.id)}>
                    Dismiss
                  </Button>
                )}
              </div>
            ))}

            {/* Pending rows — required or fallback */}
            {requiredActive
              ? requiredPending.map((p) => {
                  const requested = !!p.lastRequestedAt
                  const timeStr = requested ? timeAgoShort(p.lastRequestedAt) : ''
                  const isBusy = requestingId === p.userId
                  return (
                    <div key={p.userId} className="px-5 sm:px-6 py-4 flex items-start gap-3">
                      <Avatar className="h-[26px] w-[26px] shrink-0">
                        <AvatarFallback className="text-[10.5px] font-medium">{initials(p.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-poppins font-medium text-[13px] text-text-primary">{p.name}</span>
                          <Badge tone="purple" size="xs" dot>Required</Badge>
                        </div>
                        <div className="mt-0.5 text-[12px] text-text-tertiary font-poppins">
                          {p.roleLabel ? `${p.roleLabel} · ` : ''}
                          {requested ? `requested ${timeStr}` : 'awaiting scorecard'}
                        </div>
                      </div>
                      {requested ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Check}
                          onClick={() => handleRequest(p.userId)}
                          loading={isBusy}
                        >
                          Requested
                        </Button>
                      ) : (
                        <Button
                          variant="purple"
                          size="sm"
                          icon={Send}
                          onClick={() => handleRequest(p.userId)}
                          loading={isBusy}
                        >
                          Request
                        </Button>
                      )}
                      <Badge tone="yellow" size="sm" dot className="shrink-0">Pending</Badge>
                    </div>
                  )
                })
              : fallbackPending.map((p) => (
                  <div key={p.userId} className="px-5 sm:px-6 py-4 flex items-start gap-3">
                    <Avatar className="h-7 w-7 shrink-0 opacity-70">
                      <AvatarFallback className="text-[10.5px] font-medium">{initials(p.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-poppins font-medium text-[13px] text-text-primary">{p.name}</span>
                        {p.roleLabel && <Badge tone="neutral" size="xs">{p.roleLabel}</Badge>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-text-tertiary font-poppins">
                        Pending submission
                      </div>
                    </div>
                    <Badge tone="yellow" size="sm" dot className="shrink-0">Pending</Badge>
                  </div>
                ))}
          </>
        )}
      </div>
      <div className="h-2" />
    </section>
  )
}

export default StageScorecardsCard
