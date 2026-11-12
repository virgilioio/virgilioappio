import { useMemo, useState } from 'react'
import { BarChart3, Plus, Sparkles, ClipboardCheck, Send, Check, PenLine, MoreHorizontal, ScrollText, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { draftLine, notesStatusView, type MyStageInterview } from '@/lib/interviewNotes'
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
  /** Your interview at each stage and where Gio's notes on it got to (step 5b). */
  myNotes?: Record<string, MyStageInterview>
  /** Ask Gio to write an interview's notes again. */
  onRetryNotes?: (bookingId: string) => Promise<void>
  /** Opens a draft in the scorecard sheet on its Transcript tab. */
  onOpenTranscript?: (scorecardId: string, stageInstanceId: string) => void
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
  onRequest, onCompleteMine, myNotes, onRetryNotes, onOpenTranscript,
}: StageScorecardsCardProps) {
  const [requestingKey, setRequestingKey] = useState<string | null>(null)
  const [retryingBooking, setRetryingBooking] = useState<string | null>(null)

  const retry = async (bookingId: string) => {
    if (!onRetryNotes) return
    setRetryingBooking(bookingId)
    try { await onRetryNotes(bookingId) } finally { setRetryingBooking(null) }
  }

  /**
   * Interview notes step 5b (2026-11-12): Gio's draft lives in your own row, not in a
   * banner above it: a "Gio draft" chip, a line saying what Gio found (or that it is
   * still writing, or couldn't, with Retry), Review draft where Complete scorecard was,
   * and the rest (Show transcript, Dismiss) in a ⋯ menu.
   */
  const gioChip = (
    <span className="inline-flex h-[18px] items-center gap-1 whitespace-nowrap rounded-full border border-[#DCC9FA] bg-[#F5F1FE] px-1.5 font-inter text-[11px] font-medium text-[#5B21B6]">
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      Gio draft
    </span>
  )

  /** The line under your name: Gio's draft, Gio at work, or why there are no notes. */
  const mineLine = (stageId: string, draft: ScorecardWithAuthor | undefined, fallback: string) => {
    const notes = myNotes?.[stageId]
    const view = notes ? notesStatusView(notes.row, { submitted: false }) : null
    if (view?.tone === 'working') {
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[#5B21B6]">
          <span className="gio-spinner gio-spinner-current h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{draft ? 'Gio is rewriting your notes…' : view.text}</span>
        </span>
      )
    }
    if (draft) return <span className="truncate text-[#5B21B6]">{draftLine(draft)}</span>
    if (notes && view && (view.tone === 'problem' || view.tone === 'note')) {
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className={view.tone === 'problem' ? 'truncate text-[#B91C1C]' : 'truncate'}>{view.text}</span>
          {view.retry && onRetryNotes && (
            <>
              <span aria-hidden="true" className="text-[#B5B9C4]">·</span>
              <button
                type="button"
                onClick={() => void retry(notes.bookingId)}
                disabled={retryingBooking === notes.bookingId}
                className="gio-pressable inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-[#5B21B6] underline-offset-2 hover:underline disabled:opacity-60"
              >
                {retryingBooking === notes.bookingId && <span className="gio-spinner gio-spinner-current h-3 w-3" aria-hidden="true" />}
                {view.retry}
              </button>
            </>
          )}
        </span>
      )
    }
    return <span className="truncate">{fallback}</span>
  }

  /** Review draft and its ⋯ menu. */
  const draftActions = (draft: ScorecardWithAuthor, stageId: string) => (
    <>
      <Button variant="primary" size="sm" icon={Sparkles} onClick={() => onOpenFullSheet(draft.id, stageId)}>
        Review draft
      </Button>
      {((onOpenTranscript && draft.source_booking_id) || onDismissAiDraft) && (
        <DropdownMenu modal={false}>
          <IconTip label="More">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className="gio-pressable inline-flex h-button-sm-v2 w-button-sm-v2 shrink-0 items-center justify-center rounded-lg border border-[#E7E8EE] bg-white text-[#5A6072] hover:bg-[#F6F5F1] data-[state=open]:bg-[#F6F5F1]"
              >
                <MoreHorizontal className="h-[15px] w-[15px]" strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
          </IconTip>
          <DropdownMenuContent align="end" sideOffset={6} className="z-[90] w-[240px]">
            {onOpenTranscript && draft.source_booking_id && (
              <DropdownMenuItem onSelect={() => onOpenTranscript(draft.id, stageId)}>
                <ScrollText aria-hidden />
                <span className="truncate">Show transcript</span>
              </DropdownMenuItem>
            )}
            {onDismissAiDraft && (
              <>
                {onOpenTranscript && draft.source_booking_id && <DropdownMenuSeparator />}
                <DropdownMenuItem className="text-destructive" onSelect={() => void onDismissAiDraft(draft.id)}>
                  <Trash2 aria-hidden />
                  <span className="truncate">Dismiss Gio's draft</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
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
            // Gio's draft of your scorecard folds into your pending row; one with no
            // pending row (you weren't on the required list) gets a row of its own.
            const mePending = !!currentUserId && g.pending.some(p => p.userId === currentUserId)
            const myDraft = drafts.find(d => d.created_by === currentUserId)
            const ownRowDrafts = drafts.filter(d => !(mePending && d === myDraft))

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
                  <div className="mx-5 sm:mx-6 mt-3 flex items-center gap-2.5 rounded-[9px] border border-[#EDE4FF] bg-[#FAF8FF] px-3 py-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#EDE4FF] text-[#6F3FF5] inline-flex items-center justify-center shrink-0">
                      <ClipboardCheck className="h-[15px] w-[15px]" />
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
                    {/* When the only scorecard owed is yours, your row below has the button. */}
                    {onlyMinePending ? null : onRequest ? (
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
                        className="w-full text-left px-5 sm:px-6 py-2.5 hover:bg-[hsl(var(--menu-hover))] transition-colors"
                      >
                        <div className="flex items-start gap-[9px]">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className="text-[10.5px] font-medium">{initials(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-[9px] flex-wrap">
                              <span className="font-poppins font-medium text-[13px] text-text-primary truncate">
                                {name}
                              </span>
                              {isMine && <Badge tone="lilac" size="xs">You</Badge>}
                              {s.moved_from_stage_name && (
                                <span className="text-[11.5px] text-text-tertiary font-poppins">
                                  From {s.moved_from_stage_name} · stage removed
                                </span>
                              )}
                              <span className="text-[12px] text-text-tertiary font-poppins ml-auto pl-2">
                                {timeAgoConcise(s.created_at)}
                              </span>
                            </div>
                            {s.general_overview && (
                              <p className="mt-[5px] italic text-[12.5px] text-text-secondary font-poppins line-clamp-2">
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
                                      className="rounded-[9px] border border-virgilio-border bg-white px-3 py-2.5"
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

                  {/* Gio's drafts with no pending row to fold into */}
                  {ownRowDrafts.map((d) => {
                    const name = d.author_name || d.author_email || 'You'
                    const isMine = d.created_by === currentUserId
                    return (
                      <div key={d.id} className="px-5 sm:px-6 py-2.5 flex flex-wrap items-start gap-x-[9px] gap-y-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[10.5px] font-medium">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 basis-[220px]">
                          <div className="flex items-center gap-[9px] flex-wrap">
                            <span className="font-poppins font-medium text-[13px] text-text-primary">{name}</span>
                            {isMine && <Badge tone="lilac" size="xs">You</Badge>}
                            {gioChip}
                          </div>
                          <div className="mt-0.5 flex min-w-0 text-[12px] text-text-tertiary font-poppins">
                            {isMine ? mineLine(g.stageInstanceId, d, '') : <span className="truncate">{draftLine(d)}</span>}
                          </div>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                          {draftActions(d, g.stageInstanceId)}
                          <Badge tone="lilac" size="sm" dot className="shrink-0">Draft</Badge>
                        </div>
                      </div>
                    )
                  })}

                  {/* Pending rows */}
                  {g.pending.map((p) => {
                    const requested = !!p.lastRequestedAt
                    const timeStr = requested ? timeAgoShort(p.lastRequestedAt) : ''
                    const isBusy = requestingKey === `${g.stageInstanceId}:${p.userId}`
                    const isMe = !!currentUserId && p.userId === currentUserId
                    const draft = isMe ? myDraft : undefined
                    const fallback = !g.isCurrent ? `still pending from ${g.stageName}` : isMe
                      ? 'your scorecard is pending'
                      : requested
                        ? `requested ${timeStr}`
                        : 'awaiting scorecard'
                    return (
                      <div key={`${g.stageInstanceId}:${p.userId}`} className="px-5 sm:px-6 py-2.5 flex flex-wrap items-start gap-x-[9px] gap-y-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[10.5px] font-medium">{initials(p.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 basis-[220px]">
                          <div className="flex items-center gap-[9px] flex-wrap">
                            <span className="font-poppins font-medium text-[13px] text-text-primary">{p.name}</span>
                            {isMe && <Badge tone="lilac" size="xs">You</Badge>}
                            {g.required && <Badge tone="purple" size="xs" dot>Required</Badge>}
                            {draft && gioChip}
                          </div>
                          <div className="mt-0.5 flex min-w-0 text-[12px] text-text-tertiary font-poppins">
                            {p.roleLabel && !draft && <span className="shrink-0">{p.roleLabel} ·&nbsp;</span>}
                            {isMe ? mineLine(g.stageInstanceId, draft, fallback) : <span className="truncate">{fallback}</span>}
                          </div>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                        {draft ? (
                          draftActions(draft, g.stageInstanceId)
                        ) : isMe && onCompleteMine ? (
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
