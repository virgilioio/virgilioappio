import { useMemo, useState } from 'react'
import { BarChart3, Plus, Sparkles, ClipboardCheck, Send, Check, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { InlineEmpty } from '@/components/ui/empty-state'
import type { RequiredPanelist } from '@/hooks/useStageScorecardRequirement'
import { timeAgoShort } from '@/hooks/useStageScorecardRequirement'
import type { ScorecardWithAuthor } from '@/hooks/useAllStageScorecards'
import { ratingLabel as sharedRatingLabel, ratingTone as sharedRatingTone, RATING_META, coerceRating } from '@/lib/scorecardRatings'

export interface ScorecardStageGroup {
  stageInstanceId: string
  stageName: string
  /** True for the candidate's current stage (drives the "required to advance" banner). */
  isCurrent: boolean
  /** All scorecards (submitted + AI drafts) belonging to this stage. */
  scorecards: ScorecardWithAuthor[]
  /** Interviewers who still owe a scorecard for this stage. */
  pending: RequiredPanelist[]
  /** Whether this stage is configured with require_scorecard. */
  required: boolean
  totalExpected: number
}

interface StageScorecardsCardProps {
  groups: ScorecardStageGroup[]
  currentUserId?: string
  loading?: boolean
  onOpenFullSheet: (scorecardId: string, stageInstanceId: string) => void
  onSubmitScorecard?: () => void
  onCompare?: () => void
  onDismissAiDraft?: (scorecardId: string) => Promise<void>
  /** Request a scorecard for a given stage; omit the user id to request all pending. */
  onRequest?: (stageInstanceId: string, interviewerUserId?: string) => Promise<void>
  /** Opens the current user's own scorecard editor for that stage. */
  onCompleteMine?: (stageInstanceId: string) => void
}

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
  groups,
  currentUserId,
  loading,
  onOpenFullSheet, onSubmitScorecard, onCompare, onDismissAiDraft,
  onRequest, onCompleteMine,
}: StageScorecardsCardProps) {
  const [requestingKey, setRequestingKey] = useState<string | null>(null)
  const [requestingAllStage, setRequestingAllStage] = useState<string | null>(null)

  const visibleGroups = useMemo(
    () =>
      groups.filter(
        g => g.isCurrent || g.scorecards.length > 0 || g.pending.length > 0,
      ),
    [groups],
  )

  const totals = useMemo(() => {
    let submitted = 0
    let pending = 0
    let requiredActive = false
    for (const g of groups) {
      submitted += g.scorecards.filter(s => !s.is_ai_draft && !!s.rating).length
      pending += g.pending.length
      if (g.isCurrent && g.required && g.pending.length > 0) requiredActive = true
    }
    return { submitted, pending, requiredActive }
  }, [groups])

  const handleRequest = async (stageId: string, uid: string) => {
    if (!onRequest) return
    setRequestingKey(`${stageId}:${uid}`)
    try { await onRequest(stageId, uid) } finally { setRequestingKey(null) }
  }
  const handleRequestAll = async (stageId: string) => {
    if (!onRequest) return
    setRequestingAllStage(stageId)
    try { await onRequest(stageId) } finally { setRequestingAllStage(null) }
  }

  const anyContent = visibleGroups.some(g => g.scorecards.length > 0 || g.pending.length > 0)

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5">
        <div className="min-w-0">
          <h3 className="font-poppins font-semibold text-[15px] tracking-[-0.01em] text-text-primary">
            Scorecards
          </h3>
          <p className="mt-1 text-[12.5px] text-text-tertiary font-poppins">
            {totals.submitted} submitted{totals.pending > 0 && <> · {totals.pending} pending</>}
            {totals.requiredActive && <> · required to advance</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onCompare && totals.submitted >= 2 && (
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

      {loading && !anyContent ? (
        <div className="px-5 sm:px-6 py-6 text-[13px] text-text-tertiary">Loading scorecards…</div>
      ) : !anyContent ? (
        <div className="px-5 sm:px-6 py-4">
          <InlineEmpty
            text="No scorecards yet"
            action={onSubmitScorecard ? 'Submit scorecard' : undefined}
            onAction={onSubmitScorecard}
          />
        </div>
      ) : (
        <div className="mt-3">
          {visibleGroups.map((g) => {
            const submitted = g.scorecards.filter(s => !s.is_ai_draft && !!s.rating)
            const drafts = g.scorecards.filter(s => s.is_ai_draft)
            if (submitted.length === 0 && drafts.length === 0 && g.pending.length === 0) return null

            const bannerActive = g.isCurrent && g.required && g.pending.length > 0
            const onlyMinePending =
              !!currentUserId && g.pending.length === 1 && g.pending[0]?.userId === currentUserId

            return (
              <div key={g.stageInstanceId} className="border-t border-virgilio-border/60 first:border-t-0">
                {/* Stage header */}
                <div className="px-5 sm:px-6 py-2.5 bg-[#FAFAF7] flex items-center gap-2 flex-wrap">
                  <span className="font-inter uppercase tracking-[0.06em] text-[10.5px] font-semibold text-[#8B8F9E]">
                    {g.stageName}
                  </span>
                  {g.isCurrent && <Badge tone="lilac" size="xs">Current stage</Badge>}
                  <span className="ml-auto font-poppins text-[11.5px] text-text-tertiary">
                    {submitted.length} submitted
                    {g.pending.length > 0 && <> · {g.pending.length} pending</>}
                  </span>
                </div>

                {/* Required-to-advance banner (current stage only) */}
                {bannerActive && (
                  <div className="mx-5 sm:mx-6 mt-3 flex items-center gap-3 rounded-[10px] border border-[#EDE4FF] bg-[#FAF8FF] px-3.5 py-3">
                    <div className="h-8 w-8 rounded-lg bg-[#EDE4FF] text-[#6F3FF5] inline-flex items-center justify-center shrink-0">
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
                        {g.pending.length} of {g.totalExpected} interviewer
                        {g.totalExpected === 1 ? '' : 's'} still owe{g.pending.length === 1 ? 's' : ''} a scorecard for this stage.
                      </div>
                    </div>
                    {onlyMinePending && onCompleteMine ? (
                      <Button variant="primary" size="sm" icon={PenLine} onClick={() => onCompleteMine(g.stageInstanceId)}>
                        Complete scorecard
                      </Button>
                    ) : onRequest ? (
                      <Button
                        variant="purple"
                        size="sm"
                        icon={Send}
                        onClick={() => handleRequestAll(g.stageInstanceId)}
                        loading={requestingAllStage === g.stageInstanceId}
                      >
                        Request all
                      </Button>
                    ) : null}
                  </div>
                )}

                <div className="mt-1 divide-y divide-virgilio-border/60">
                  {/* Submitted scorecards */}
                  {submitted.map((s) => {
                    const isMine = s.created_by === currentUserId
                    const name = s.author_name || s.author_email || 'Reviewer'
                    const tone = ratingTone(s.rating)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onOpenFullSheet(s.id, g.stageInstanceId)}
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
                  {drafts.map((s) => (
                    <div key={s.id} className="px-5 sm:px-6 py-3 flex items-center gap-3 bg-[hsl(var(--menu-selected))]/40">
                      <Sparkles className="h-4 w-4 text-virgilio-purple shrink-0" />
                      <div className="text-[12.5px] font-poppins text-text-primary flex-1 min-w-0">
                        AI notes analysis available — review your draft
                      </div>
                      <Button variant="purple" size="xs" onClick={() => onOpenFullSheet(s.id, g.stageInstanceId)}>
                        Review
                      </Button>
                      {onDismissAiDraft && (
                        <Button variant="ghost" size="xs" onClick={() => onDismissAiDraft(s.id)}>
                          Dismiss
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Pending rows */}
                  {g.pending.map((p) => {
                    const requested = !!p.lastRequestedAt
                    const timeStr = requested ? timeAgoShort(p.lastRequestedAt) : ''
                    const isBusy = requestingKey === `${g.stageInstanceId}:${p.userId}`
                    const isMe = !!currentUserId && p.userId === currentUserId
                    return (
                      <div key={`${g.stageInstanceId}:${p.userId}`} className="px-5 sm:px-6 py-4 flex items-start gap-3">
                        <Avatar className="h-[26px] w-[26px] shrink-0">
                          <AvatarFallback className="text-[10.5px] font-medium">{initials(p.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-poppins font-medium text-[13px] text-text-primary">{p.name}</span>
                            {isMe && <Badge tone="lilac" size="xs">You</Badge>}
                            {g.required && <Badge tone="purple" size="xs" dot>Required</Badge>}
                          </div>
                          <div className="mt-0.5 text-[12px] text-text-tertiary font-poppins">
                            {p.roleLabel ? `${p.roleLabel} · ` : ''}
                            {!g.isCurrent ? `still pending from ${g.stageName}` : isMe
                              ? 'your scorecard is pending'
                              : requested
                                ? `requested ${timeStr}`
                                : 'awaiting scorecard'}
                          </div>
                        </div>
                        {isMe && onCompleteMine ? (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={PenLine}
                            onClick={() => onCompleteMine(g.stageInstanceId)}
                          >
                            Complete scorecard
                          </Button>
                        ) : onRequest ? (
                          requested ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Check}
                              onClick={() => handleRequest(g.stageInstanceId, p.userId)}
                              loading={isBusy}
                            >
                              Requested
                            </Button>
                          ) : (
                            <Button
                              variant="purple"
                              size="sm"
                              icon={Send}
                              onClick={() => handleRequest(g.stageInstanceId, p.userId)}
                              loading={isBusy}
                            >
                              Request
                            </Button>
                          )
                        ) : null}
                        <Badge tone="yellow" size="sm" dot className="shrink-0">Pending</Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="h-2" />
    </section>
  )
}

export default StageScorecardsCard
