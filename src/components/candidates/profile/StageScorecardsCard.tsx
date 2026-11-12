import { useMemo, useState } from 'react'
import { BarChart3, Plus, Sparkles, Send, Check, PenLine, MoreHorizontal, ScrollText, Trash2 } from 'lucide-react'
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
   * Step 5c (2026-11-12): one status per row beside the name (Gio draft, Required,
   * Pending or the rating), "(you)" as plain text with your row first, a line under the
   * name only when it says something, at most one action on the right.
   */
  const gioChip = (
    <span className="inline-flex h-[18px] items-center gap-1 whitespace-nowrap rounded-full border border-[#DCC9FA] bg-[#F5F1FE] px-1.5 font-inter text-[11px] font-medium text-[#5B21B6]">
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      Gio draft
    </span>
  )

  /** The line under your name: Gio's draft, Gio at work, or why there are no notes. */
  const mineLine = (stageId: string, draft: ScorecardWithAuthor | undefined, fallback: string | null) => {
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
    return fallback ? <span className="truncate">{fallback}</span> : null
  }

  /** One person's row: avatar, name, (you), one status, a line when it says something, actions. */
  const renderRow = (o: {
    name: string
    isMe: boolean
    status: React.ReactNode
    sub: React.ReactNode
    actions: React.ReactNode
    onOpen?: () => void
    extra?: React.ReactNode
  }) => {
    const body = (
      <>
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className="text-[10.5px] font-medium">{initials(o.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 basis-[180px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-poppins font-medium text-[13px] text-text-primary">{o.name}</span>
            {o.isMe && <span className="shrink-0 font-poppins text-[12px] text-text-tertiary">(you)</span>}
            {o.status}
          </div>
          {o.sub && <div className="mt-0.5 flex min-w-0 text-[12px] text-text-tertiary font-poppins">{o.sub}</div>}
          {o.extra}
        </div>
        {o.actions && <div className="ml-auto flex shrink-0 items-center gap-2">{o.actions}</div>}
      </>
    )
    const cls = 'group flex w-full flex-wrap items-start gap-x-[9px] gap-y-2 px-5 sm:px-6 py-2.5 text-left'
    return o.onOpen ? (
      <button type="button" onClick={o.onOpen} className={`${cls} hover:bg-[hsl(var(--menu-hover))]`}>{body}</button>
    ) : (
      <div className={cls}>{body}</div>
    )
  }

  /** A submitted scorecard's 1–5 scores, under its line. */
  const criterionGrid = (s: ScorecardWithAuthor) => (
    <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
      {(s.criterion_scores ?? []).map((c) => {
        const meta = coerceRating(c.rating) ? RATING_META[coerceRating(c.rating)!] : null
        const n = meta?.numeric ?? 0
        const color = meta?.bg ?? '#E0DDD3'
        return (
          <div key={c.questionId} className="rounded-[9px] border border-virgilio-border bg-white px-3 py-2.5">
            <div className="font-poppins uppercase tracking-[0.06em] truncate text-[10.5px] font-semibold text-[#8B8F9E]">
              {c.questionText}
            </div>
            <div className="mt-1.5 flex items-center gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-[3px] flex-1 rounded-full" style={{ background: i < n ? color : '#E7E8EE' }} />
              ))}
            </div>
            <div className="mt-1.5 font-poppins text-[13px] font-semibold text-[#1F2230]">
              {n}<span className="text-text-tertiary font-medium">/5</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  /** Review draft, with its ⋯ menu to the left (shown on hover with a mouse), so the button lines up. */
  const draftActions = (draft: ScorecardWithAuthor, stageId: string) => (
    <>
      {((onOpenTranscript && draft.source_booking_id) || onDismissAiDraft) && (
        <DropdownMenu modal={false}>
          <IconTip label="More">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More"
                className="gio-pressable [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity duration-hover inline-flex h-button-sm-v2 w-button-sm-v2 shrink-0 items-center justify-center rounded-lg border border-[#E7E8EE] bg-white text-[#5A6072] hover:bg-[#F6F5F1] data-[state=open]:bg-[#F6F5F1]"
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
      <Button variant="primary" size="sm" icon={Sparkles} onClick={() => onOpenFullSheet(draft.id, stageId)}>
        Review draft
      </Button>
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
            const othersPending = g.pending.some(p => p.userId !== currentUserId)
            // Gio's draft of your scorecard folds into your pending row; one with no
            // pending row (you weren't on the required list) gets a row of its own.
            const mePending = !!currentUserId && g.pending.some(p => p.userId === currentUserId)
            const myDraft = drafts.find(d => d.created_by === currentUserId)
            const ownRowDrafts = drafts.filter(d => !(mePending && d === myDraft))

            // One row per person: yours first, then everyone else's, each with one
            // status beside the name (step 5c, 2026-11-12).
            const rows: { key: string; mine: boolean; node: React.ReactNode }[] = []

            for (const p of g.pending) {
              const isMe = !!currentUserId && p.userId === currentUserId
              const draft = isMe ? myDraft : undefined
              const requested = !!p.lastRequestedAt
              const isBusy = requestingKey === `${g.stageInstanceId}:${p.userId}`
              const sub = isMe
                ? mineLine(g.stageInstanceId, draft, null)
                : requested
                  ? <span className="truncate">Requested {timeAgoShort(p.lastRequestedAt)}</span>
                  : p.roleLabel ? <span className="truncate">{p.roleLabel}</span> : null
              rows.push({
                key: `p:${p.userId}`,
                mine: isMe,
                node: renderRow({
                  name: p.name,
                  isMe,
                  status: draft ? gioChip : (
                    <Badge tone="yellow" size="xs" dot className="shrink-0">{g.required ? 'Required' : 'Pending'}</Badge>
                  ),
                  sub,
                  actions: draft ? draftActions(draft, g.stageInstanceId) : isMe && onCompleteMine ? (
                    <Button variant="primary" size="sm" icon={PenLine} onClick={() => onCompleteMine(g.stageInstanceId)}>
                      Complete scorecard
                    </Button>
                  ) : !isMe && onRequest ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={requested ? Check : Send}
                      onClick={() => handleRequest(g.stageInstanceId, p.userId)}
                      loading={isBusy}
                    >
                      {requested ? 'Requested' : 'Request'}
                    </Button>
                  ) : null,
                }),
              })
            }

            for (const d of ownRowDrafts) {
              const isMe = d.created_by === currentUserId
              rows.push({
                key: `d:${d.id}`,
                mine: isMe,
                node: renderRow({
                  name: d.author_name || d.author_email || 'Reviewer',
                  isMe,
                  status: gioChip,
                  sub: isMe ? mineLine(g.stageInstanceId, d, null) : <span className="truncate">{draftLine(d)}</span>,
                  actions: draftActions(d, g.stageInstanceId),
                }),
              })
            }

            for (const s of submitted) {
              const isMine = s.created_by === currentUserId
              const name = s.author_name || s.author_email || 'Reviewer'
              const overview = (s.general_overview ?? '').replace(/<[^>]+>/g, '').trim()
              rows.push({
                key: `s:${s.id}`,
                mine: isMine,
                node: renderRow({
                  name,
                  isMe: isMine,
                  status: (
                    <Badge tone={ratingTone(s.rating)} size="xs" dot className="shrink-0">{ratingLabel(s.rating)}</Badge>
                  ),
                  sub: s.moved_from_stage_name
                    ? <span className="truncate">From {s.moved_from_stage_name} · stage removed</span>
                    : overview ? <span className="truncate italic">“{overview}”</span> : null,
                  actions: <span className="text-[12px] text-text-tertiary font-poppins tabular-nums">{timeAgoConcise(s.created_at)}</span>,
                  onOpen: () => onOpenFullSheet(s.id, g.stageInstanceId),
                  extra: s.criterion_scores && s.criterion_scores.length > 0 ? criterionGrid(s) : null,
                }),
              })
            }

            rows.sort((a, b) => Number(b.mine) - Number(a.mine))

            return (
              <div key={g.stageInstanceId} className="border-t border-virgilio-border/60 first:border-t-0">
                {/* Stage header: one line, with what the stage asks for on the right */}
                <div className="px-5 sm:px-6 py-2.5 bg-[#FAFAF7] flex items-center gap-x-2 gap-y-1 flex-wrap min-h-[38px]">
                  <span className="font-inter uppercase tracking-[0.06em] text-[10.5px] font-semibold text-[#8B8F9E]">
                    {g.stageName}
                  </span>
                  {g.isCurrent && (
                    <span className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#6F3FF5]">· Current</span>
                  )}
                  {bannerActive && (
                    <span className="ml-auto inline-flex items-center gap-2 font-poppins text-[11.5px] text-[#5A6072]">
                      Required to advance
                      {othersPending && onRequest && (
                        <>
                          <span aria-hidden="true" className="text-[#B5B9C4]">·</span>
                          <button
                            type="button"
                            onClick={() => handleRequestAll(g.stageInstanceId)}
                            disabled={requestingAllStage === g.stageInstanceId}
                            className="gio-pressable inline-flex items-center gap-1 whitespace-nowrap font-medium text-[#5B21B6] underline-offset-2 hover:underline disabled:opacity-60"
                          >
                            {requestingAllStage === g.stageInstanceId && <span className="gio-spinner gio-spinner-current h-3 w-3" aria-hidden="true" />}
                            Request all
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-virgilio-border/60">
                  {rows.map(r => <div key={r.key}>{r.node}</div>)}
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
