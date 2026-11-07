import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  ArrowRight, Briefcase, Calendar, ChevronLeft, ChevronRight, Clock, Eye, Globe, Keyboard,
  Lock, MapPin, SkipForward, ThumbsDown, UserRound, Send,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Loadable } from '@/components/ui/loadable'
import { MetricStrip } from '@/components/ui/metric-strip'
import { IconTip } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { SafeHtml } from '@/components/ui/safe-html'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { CandidateApplicationResponses } from '@/components/candidates/CandidateApplicationResponses'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { GioFitReviewCard } from '@/components/candidates/insights/GioFitReviewCard'
import { RejectionReasonSelector } from '@/components/candidates/RejectionReasonSelector'
import { ScheduleDelaySelector } from '@/components/candidates/ScheduleDelaySelector'
import { MentionComposer } from '@/components/candidates/comments/MentionComposer'
import { CommentRow } from '@/components/candidates/comments/CommentsCard'
import { Seg } from '@/components/sign/templates/parts'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { useApplicationReview, type RejectionConfig, type ReviewCandidate } from '@/hooks/useApplicationReview'
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates'
import { useCandidateComments, useCommentPeople, type CandidateComment } from '@/hooks/useCandidateComments'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { draftHasTag, encodeMentions, type MentionPerson } from '@/lib/mentions'
import { sourceLabel, seniorityLabel } from '@/lib/candidateLabels'
import { useReviewEmailContext, reviewEmailValues, previewReviewEmail } from '@/lib/reviewEmail'
import { undoToast } from '@/lib/undoToast'
import { toast } from '@/hooks/use-toast'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'

/**
 * Application review (2026-11-07): one candidate at a time from the job's
 * Application review stage. Three columns: the résumé; Gio Fit (condensed) over
 * the application answers in one scroll; and the decision column, Comments
 * first, then Rejection settings, with Reject · Pass · Advance pinned at the
 * bottom so they never move. Built from the profile's own parts (header style,
 * ProfileCard, the comment box, the Gio Fit parts) and the Motion & Feel rules.
 *
 * A comment is written for one candidate: drafts are kept per candidate, never
 * with the settings. Text left in the box is posted when you act, and on Reject
 * it is also the rejection note. Keys: R reject · P pass · A advance · U undo ·
 * ← → previous / next, never while typing or with a menu open.
 */

interface ApplicationReviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  jobTitle?: string
  onComplete?: () => void
}

interface Draft {
  text: string
  picked: MentionPerson[]
  wantsPrivate: boolean
}
const EMPTY_DRAFT: Draft = { text: '', picked: [], wantsPrivate: false }

/** A menu, popover or dialog open over the review: keys belong to it (the sheet is a dialog itself). */
const layerOverReview = () =>
  !!document.querySelector('[data-radix-popper-content-wrapper], [role="alertdialog"]') ||
  document.querySelectorAll('[role="dialog"]').length > 1

/** The draft with tags as names, for the rejection note. */
const plainNote = (d: Draft) => d.text.trim()

export function ApplicationReviewSheet({ open, onOpenChange, jobId, jobTitle, onComplete }: ApplicationReviewSheetProps) {
  const review = useApplicationReview(jobId)
  const [retryKey, setRetryKey] = useState(0)
  const timedOut = useLoadTimeout(review.isLoading, retryKey)

  useEffect(() => {
    if (open) review.loadQueue()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = review.currentCandidate
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const draft = (current && drafts[current.associationId]) || EMPTY_DRAFT
  const setDraft = (next: Draft) => {
    if (!current) return
    const id = current.associationId
    setDrafts((all) => ({ ...all, [id]: next }))
  }
  useEffect(() => {
    if (!open) setDrafts({})
  }, [open])

  const { addComment, isAdding } = useCandidateComments(current?.candidateId)
  const [acting, setActing] = useState<'reject' | 'pass' | 'advance' | null>(null)
  /** The candidate whose comment was posted by their action, for the Undo note. */
  const commentedRef = useRef<string | null>(null)

  /** Posts what's in the box; false when it couldn't (the action then waits). */
  const postDraft = async (c: ReviewCandidate, d: Draft): Promise<boolean> => {
    if (!d.text.trim()) return true
    try {
      await addComment({
        candidate_id: c.candidateId,
        job_id: jobId,
        organization_id: null,
        content: encodeMentions(d.text.trim(), d.picked),
        is_private: d.wantsPrivate && !draftHasTag(d.text, d.picked),
      })
      setDrafts((all) => ({ ...all, [c.associationId]: EMPTY_DRAFT }))
      return true
    } catch {
      toast({ title: "Couldn't post your comment", description: 'Nothing was changed. Try again.', variant: 'destructive' })
      return false
    }
  }

  const act = async (type: 'reject' | 'pass' | 'advance') => {
    if (!current || acting || review.isActioning) return
    if (type === 'advance' && !review.firstStageId) return
    const c = current
    const d = draft
    setActing(type)
    try {
      if (!(await postDraft(c, d))) return
      commentedRef.current = d.text.trim() ? c.associationId : null
      if (type === 'reject') await review.handleReject(plainNote(d))
      else if (type === 'pass') review.handlePass()
      else await review.handleAdvance()
    } finally {
      setActing(null)
    }
  }

  // The same Undo as the Application review page: each action stays instant and
  // gets a toast with Undo; Undo only acts while that action is still the latest one.
  const lastActionRef = useRef(review.lastAction)
  const undoRef = useRef(review.handleUndo)
  undoRef.current = review.handleUndo
  useEffect(() => {
    const la = review.lastAction
    if (la && la !== lastActionRef.current) {
      const cfg = review.rejectionConfig
      const emailed = la.type === 'reject' && cfg.sendEmail && !!cfg.rejectionEmailTemplateId && cfg.sendOption !== 'later'
      const commented = commentedRef.current === la.candidate.associationId
      const verb = la.type === 'reject' ? 'Rejected' : la.type === 'pass' ? 'Passed' : 'Advanced'
      const notes = [
        emailed ? 'Their rejection email has already been sent.' : null,
        commented ? 'Your comment stays on their profile.' : null,
      ].filter(Boolean).join(' ')
      undoToast(
        `${verb} ${la.candidate.candidateName || 'candidate'}`,
        () => { if (lastActionRef.current === la) void undoRef.current() },
        notes || undefined,
      )
    }
    lastActionRef.current = la
  }, [review.lastAction]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (review.stats.rejected > 0 || review.stats.advanced > 0) {
      review.invalidateQueries()
      onComplete?.()
    }
    onOpenChange(false)
  }

  // Keys, as on the Application review page. Never while typing or with a menu open.
  const actRef = useRef(act)
  actRef.current = act
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      if (layerOverReview()) return
      const k = e.key.toLowerCase()
      if (k === 'r') { e.preventDefault(); void actRef.current('reject') }
      else if (k === 'p') { e.preventDefault(); void actRef.current('pass') }
      else if (k === 'a') { e.preventDefault(); void actRef.current('advance') }
      else if (k === 'u') { e.preventDefault(); void undoRef.current() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); review.navigateTo(review.currentIndex - 1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); review.navigateTo(review.currentIndex + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, review.currentIndex, review.navigateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const reviewed = review.stats.rejected + review.stats.passed + review.stats.advanced
  const progress = review.totalInQueue + reviewed > 0 ? reviewed / (review.totalInQueue + reviewed) : 0

  let body: ReactNode = null
  if (review.loadError || (timedOut && review.isLoading)) {
    body = (
      <div className="flex h-full items-center justify-center p-8">
        <LoadError what="the candidates to review" timedOut={!review.loadError} onRetry={() => { setRetryKey((k) => k + 1); void review.loadQueue() }} />
      </div>
    )
  } else if (review.isComplete) {
    body = <DoneState stats={review.stats} onClose={handleClose} />
  } else if (review.totalInQueue === 0) {
    body = (
      <div className="flex h-full items-center justify-center p-8">
        <AnimatedEmpty
          scene="candidates"
          title="Nobody is waiting for review"
          body="New applications for this job land here first."
          primary={{ label: 'Close', onClick: handleClose }}
        />
      </div>
    )
  } else if (current) {
    body = (
      <div className="flex h-full min-h-0 flex-col">
        <ReviewHeader
          candidate={current}
          jobTitle={jobTitle}
          position={review.currentPosition}
          total={review.totalInQueue}
          progress={progress}
          hasPrev={review.currentIndex > 0}
          hasNext={review.currentIndex < review.totalInQueue - 1}
          onPrev={() => review.navigateTo(review.currentIndex - 1)}
          onNext={() => review.navigateTo(review.currentIndex + 1)}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_300px] md:overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Reading: résumé | Gio Fit over the answers. One scroll below xl, Gio Fit first. */}
          <div className="flex min-h-0 flex-col md:overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] xl:overflow-hidden">
            <div className="order-2 p-5 xl:order-1 xl:min-h-0 xl:overflow-y-auto">
              <div className="overflow-hidden rounded-[14px] border border-[#E7E8EE] bg-white">
                <CandidateResumeViewer key={current.candidateId} candidateId={current.candidateId} height={72} />
              </div>
            </div>
            <div key={current.associationId} className="order-1 space-y-4 p-5 xl:order-2 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-[#ECEAE2] xl:pl-4">
              <GioFitReviewCard candidateId={current.candidateId} jobId={jobId} />
              <ProfileCard title="Application answers" bodyPadding="tight">
                <CandidateApplicationResponses candidateId={current.candidateId} jobId={jobId} />
              </ProfileCard>
            </div>
          </div>

          {/* Decision: comments, rejection settings, and the three actions pinned. */}
          <aside className="flex min-h-0 flex-col border-[#ECEAE2] md:border-l">
            <div className="min-h-0 flex-1 space-y-3 p-4 md:overflow-y-auto">
              <ReviewComments
                key={current.associationId}
                candidate={current}
                jobId={jobId}
                draft={draft}
                onDraft={setDraft}
                isPosting={isAdding && !acting}
                onPost={() => void postDraft(current, draft)}
              />
              <RejectionSettings config={review.rejectionConfig} onChange={review.persistRejectionConfig} jobId={jobId} candidate={current} stageName={review.reviewStageName} />
            </div>
            <ReviewActions
              acting={acting}
              disabled={review.isActioning || !!acting}
              canAdvance={!!review.firstStageId}
              advanceTo={review.firstStageName}
              onAct={(t) => void act(t)}
            />
          </aside>
        </div>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[calc(100vw-88px)]" showOverlay>
        <SheetTitle className="sr-only">Application review</SheetTitle>
        <Loadable loading={review.isLoading && !timedOut && !review.loadError} skeleton={<ReviewSkeleton />} className="min-h-0 flex-1 grid-rows-[minmax(0,1fr)] [&>*]:min-h-0">
          <div className="h-full min-h-0">{body}</div>
        </Loadable>
      </SheetContent>
    </Sheet>
  )
}

/* ── Header: the in-job profile's identity line ─────────────────────────────── */

function ReviewHeader({
  candidate, jobTitle, position, total, progress, hasPrev, hasNext, onPrev, onNext,
}: {
  candidate: ReviewCandidate
  jobTitle?: string
  position: number
  total: number
  progress: number
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const location = [candidate.locationCity, candidate.locationState, candidate.locationCountry].filter(Boolean).join(', ')
  const source = sourceLabel(candidate.source)
  const seniority = seniorityLabel(candidate.seniority)
  const meta: { icon: typeof MapPin; text: string }[] = [
    candidate.currentJobTitle ? { icon: Briefcase, text: candidate.currentJobTitle } : null,
    location ? { icon: MapPin, text: location } : null,
    { icon: Calendar, text: `Applied ${format(new Date(candidate.appliedAt), 'MMM d, yyyy')}` },
    source ? { icon: Globe, text: source } : null,
    seniority ? { icon: UserRound, text: seniority } : null,
  ].filter((m): m is { icon: typeof MapPin; text: string } => !!m)

  return (
    <header className="relative shrink-0 border-b border-[#ECEAE2] bg-virgilio-cream px-6 pb-4 pt-5 pr-14">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-inter text-[10.5px] font-semibold uppercase tracking-[0.1em] text-virgilio-purple">
          Application review{jobTitle ? ` · ${jobTitle}` : ''}
        </p>
        <span className="shrink-0 font-inter text-[12px] tabular-nums text-[#5A6072]">{position} of {total}</span>
        <IconTip label="Previous candidate (←)">
          <Button variant="secondary" size="sm" iconOnly icon={ChevronLeft} aria-label="Previous candidate" onClick={onPrev} disabled={!hasPrev} />
        </IconTip>
        <IconTip label="Next candidate (→)">
          <Button variant="secondary" size="sm" iconOnly icon={ChevronRight} aria-label="Next candidate" onClick={onNext} disabled={!hasNext} />
        </IconTip>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <h2 className="truncate pb-[0.14em] -mb-[0.14em] font-poppins text-[28px] font-semibold leading-none tracking-[-0.04em] text-[#1F2230]">
          {candidate.candidateName || 'Unnamed candidate'}
          <span className="text-[#D7C5FB]">.</span>
        </h2>
        {candidate.linkedinUrl && (
          <IconTip label="Open LinkedIn profile">
            <button
              type="button"
              onClick={() => window.open(ensureAbsoluteUrl(candidate.linkedinUrl!), '_blank', 'noopener')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8B8F9E] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#5A6072]"
              aria-label="Open LinkedIn profile"
            >
              <LinkedInFilled className="h-4 w-4" />
            </button>
          </IconTip>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-inter text-[12.5px] text-[#5A6072]">
        {meta.map(({ icon: Icon, text }) => (
          <span key={text} className="inline-flex min-w-0 max-w-[320px] items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#8B8F9E]" aria-hidden />
            <span className="truncate">{text}</span>
          </span>
        ))}
      </div>
      {/* Reviewed so far: a full-width fill that scales, never a width transition. */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent" aria-hidden>
        <div className="gio-progress-fill h-full w-full bg-virgilio-purple" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </header>
  )
}

/* ── Comments: the profile's comment box, one draft per candidate ─────────── */

function ReviewComments({
  candidate, jobId, draft, onDraft, isPosting, onPost,
}: {
  candidate: ReviewCandidate
  jobId: string
  draft: Draft
  onDraft: (d: Draft) => void
  isPosting: boolean
  onPost: () => void
}) {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const myName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null
  const { comments, isLoading } = useCandidateComments(candidate.candidateId)
  const { data: people = [] } = useCommentPeople(candidate.candidateId)
  const tagged = draftHasTag(draft.text, draft.picked)
  const isPrivate = draft.wantsPrivate && !tagged
  const names = useMemo(() => new Map(people.map((p) => [p.user_id, p.name])), [people])
  const authorName = (c: CandidateComment) => (c.author_id === user?.id ? 'You' : names.get(c.author_id) || c.author_email || 'Someone')

  const onJob = comments.filter((c) => c.job_id === jobId)
  const latest = onJob.slice(0, 1)
  const more = onJob.length - latest.length
  const noteId = `review-comment-note-${candidate.associationId}`

  return (
    <ProfileCard title={isLoading || !onJob.length ? 'Comments' : `Comments (${onJob.length})`} bodyPadding="tight">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); onPost() }}>
        <MentionComposer
          id={`review-comment-${candidate.associationId}`}
          value={draft.text}
          onChange={(text) => onDraft({ ...draft, text })}
          people={people}
          picked={draft.picked}
          onPick={(p) => onDraft({ ...draft, picked: draft.picked.some((x) => x.id === p.id) ? draft.picked : [...draft.picked, p] })}
          onSubmit={onPost}
          disabled={isPosting}
          placeholder="Add a comment. Type @ to tag a teammate."
          aria-describedby={noteId}
        />
        <div className="flex items-center gap-2">
          <label className={cn('inline-flex items-center gap-1.5 font-inter text-[12px] text-[#5A6072]', tagged ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
            <Switch
              checked={isPrivate}
              disabled={tagged || isPosting}
              onCheckedChange={(wantsPrivate) => onDraft({ ...draft, wantsPrivate })}
              aria-describedby={noteId}
              className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
            />
            <Lock className="h-3 w-3" aria-hidden />
            Private
          </label>
          <Button type="submit" variant="secondary" size="sm" className="ml-auto" disabled={!draft.text.trim()} loading={isPosting}>
            Comment
          </Button>
        </div>
        <p id={noteId} className="min-h-[18px] font-inter text-[11px] leading-[1.4] text-[#8B8F9E]">
          {tagged ? 'Tagged comments can’t be private.' : draft.text.trim() ? 'Posted when you comment, or when you reject, pass or advance.' : isPrivate ? 'Only you will see this comment.' : 'Everyone who can see this candidate will see it.'}
        </p>
      </form>
      {latest.length > 0 && (
        <ul className="mt-1 border-t border-[#F1F0EC] pt-2.5 [&_p]:line-clamp-2">
          {latest.map((c) => (
            <CommentRow key={c.id} c={c} me={user?.id} jobId={jobId} author={authorName(c)} canDelete={false} onDelete={() => {}} people={people} myName={myName} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <button
          type="button"
          className="mt-1 font-inter text-[12px] font-medium text-virgilio-purple hover:underline"
          onClick={() => window.open(`/jobs/${jobId}/candidates/${candidate.candidateId}`, '_blank', 'noopener')}
        >
          {more} more on the profile
        </button>
      )}
    </ProfileCard>
  )
}

/* ── Rejection settings: the Reject dialog's fields, compact ──────────────── */

/**
 * The rejection email as this candidate gets it (2026-11-07): the same values the send
 * uses (src/lib/reviewEmail.ts); a variable with nothing to fill shows as an amber chip
 * with its name, listed under the email.
 */
function EmailPreview({
  subject, body, jobId, candidate, stageName,
}: { subject: string; body: string; jobId: string; candidate: ReviewCandidate | null; stageName: string }) {
  const { user } = useAuth()
  const ctx = useReviewEmailContext(jobId, user?.id)
  const filled = useMemo(() => {
    if (!ctx.data || !candidate) return null
    const values = reviewEmailValues(ctx.data, candidate, stageName)
    const sub = previewReviewEmail(subject, values, false)
    const bod = previewReviewEmail(body, values, true)
    return { subject: sub.out, body: bod.out, empty: [...new Set([...sub.empty, ...bod.empty])] }
  }, [ctx.data, candidate, stageName, subject, body])

  return (
    <div className="max-h-[420px] overflow-y-auto p-4">
      <p className="font-inter text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8B8F9E]">Subject</p>
      {filled ? (
        <p className="mt-1 font-inter text-[13px] text-[#1F2230]">
          {filled.subject.split('\u0000').map((part, i) => (i % 2 ? <span key={i} className="gio-var-empty">{part}</span> : part))}
        </p>
      ) : ctx.isError ? (
        <p className="mt-1 font-inter text-[13px] text-[#1F2230]">{subject}</p>
      ) : (
        <Skeleton className="mt-1.5 h-4 w-4/5" />
      )}
      <div className="mt-3 border-t border-[#F1F0EC] pt-3">
        {filled ? (
          <SafeHtml content={filled.body} className="prose-sm font-inter text-[12.5px] leading-relaxed text-[#1F2230]" />
        ) : ctx.isError ? (
          <SafeHtml content={body} className="prose-sm font-inter text-[12.5px] leading-relaxed text-[#1F2230]" />
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        )}
      </div>
      <p className="mt-3 font-inter text-[11px] leading-[1.45] text-[#8B8F9E]">
        {ctx.isError
          ? 'Couldn’t load the job’s details, so the variables show as written. They’re filled in when it’s sent.'
          : filled && filled.empty.length
            ? <>Empty for this candidate: {filled.empty.join(', ')}. {filled.empty.length === 1 ? 'It goes' : 'They go'} out blank.</>
            : `As ${candidate?.candidateName?.split(' ')[0] || 'this candidate'} will get it.`}
      </p>
    </div>
  )
}

function RejectionSettings({
  config, onChange, jobId, candidate, stageName,
}: {
  config: RejectionConfig
  onChange: (c: RejectionConfig) => void
  jobId: string
  candidate: ReviewCandidate | null
  stageName: string
}) {
  const { templates, isLoading: templatesLoading } = useRejectionEmailTemplates('organization')
  const template = templates.find((t) => t.id === config.rejectionEmailTemplateId)

  return (
    <ProfileCard title="Rejection settings" bodyPadding="tight">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="w-[44px] shrink-0 font-inter text-[12px] font-medium text-[#1F2230]">Reason</p>
          <div className="min-w-0 flex-1">
            <RejectionReasonSelector value={config.rejectionReasonId} onValueChange={(v) => onChange({ ...config, rejectionReasonId: v })} />
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="min-w-0 font-inter text-[12.5px] font-medium text-[#1F2230]">Send a rejection email</span>
          <Switch checked={config.sendEmail} onCheckedChange={(sendEmail) => onChange({ ...config, sendEmail })} />
        </label>

        <Collapsible open={config.sendEmail}>
          <CollapsibleContent>
            <div className="space-y-3 pt-0.5">
              <div className="flex items-center gap-1.5">
                <Select value={config.rejectionEmailTemplateId || ''} onValueChange={(v) => onChange({ ...config, rejectionEmailTemplateId: v || undefined })}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 text-[13px]" aria-label="Rejection email template">
                    <SelectValue placeholder={templatesLoading ? 'Loading templates…' : 'Pick a template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover>
                  <IconTip label="Preview the email">
                    <PopoverTrigger asChild>
                      <Button type="button" variant="secondary" size="md" iconOnly icon={Eye} aria-label="Preview the email" disabled={!template} />
                    </PopoverTrigger>
                  </IconTip>
                  <PopoverContent side="left" align="start" className="w-[380px] max-w-[calc(100vw-32px)] p-0">
                    {template && <EmailPreview subject={template.subject} body={template.body} jobId={jobId} candidate={candidate} stageName={stageName} />}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="font-inter text-[12px] font-medium text-[#1F2230]">When</p>
                <Seg
                  label="When to send"
                  value={config.sendOption === 'later' ? 'later' : 'now'}
                  onChange={(v) => onChange({ ...config, sendOption: v })}
                  options={[{ value: 'now', label: 'Now', icon: Send }, { value: 'later', label: 'Later', icon: Clock }]}
                />
              </div>
              <Collapsible open={config.sendOption === 'later'}>
                <CollapsibleContent>
                  <ScheduleDelaySelector
                    value={{ preset: config.schedulePreset || '', customDate: config.customScheduledDate, customTime: config.customScheduledTime }}
                    onChange={(v) => onChange({ ...config, schedulePreset: v.preset, customScheduledDate: v.customDate, customScheduledTime: v.customTime })}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ProfileCard>
  )
}

/* ── Actions: pinned, the same place for every candidate ─────────────────── */

function ReviewActions({
  acting, disabled, canAdvance, advanceTo, onAct,
}: {
  acting: 'reject' | 'pass' | 'advance' | null
  disabled: boolean
  canAdvance: boolean
  advanceTo: string | null
  onAct: (t: 'reject' | 'pass' | 'advance') => void
}) {
  return (
    <div className="sticky bottom-0 shrink-0 border-t border-[#ECEAE2] bg-white px-4 pb-3 pt-3">
      <div className="grid grid-cols-3 gap-2">
        <IconTip label="Reject (R)">
          <Button variant="danger" icon={ThumbsDown} loading={acting === 'reject'} disabled={disabled} onClick={() => onAct('reject')}>Reject</Button>
        </IconTip>
        <IconTip label="Pass for now (P)">
          <Button variant="secondary" icon={SkipForward} loading={acting === 'pass'} disabled={disabled} onClick={() => onAct('pass')}>Pass</Button>
        </IconTip>
        <IconTip label={advanceTo ? `Advance to ${advanceTo} (A)` : 'Advance (A)'}>
          <Button variant="primary" icon={ArrowRight} loading={acting === 'advance'} disabled={disabled || !canAdvance} onClick={() => onAct('advance')} aria-label={advanceTo ? `Advance to ${advanceTo}` : 'Advance'}>Advance</Button>
        </IconTip>
      </div>
      <p className="mt-2 flex items-center gap-1.5 truncate font-inter text-[11px] text-[#8B8F9E]">
        <Keyboard className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">
          Keys <Kbd>R</Kbd><Kbd>P</Kbd><Kbd>A</Kbd> · <Kbd>U</Kbd> undo · <Kbd>←</Kbd><Kbd>→</Kbd> move
        </span>
      </p>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-[1px] inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] border border-[#E7E8EE] bg-[#FAFAF7] px-1 font-inter text-[10px] font-medium text-[#5A6072]">{children}</kbd>
}

/* ── States ─────────────────────────────────────────────────────────────────── */

/** The three columns' footprint while the queue loads (§6). */
function ReviewSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#ECEAE2] px-6 pb-4 pt-5">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="mt-3 h-7 w-72" />
        <div className="mt-3 flex gap-3">{[120, 140, 110, 90].map((w) => <Skeleton key={w} className="h-3.5" style={{ width: w }} />)}</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_420px_320px]">
        <Skeleton className="h-full min-h-[320px] rounded-[14px]" />
        <div className="hidden space-y-4 xl:block"><Skeleton className="h-[280px] rounded-[14px]" /><Skeleton className="h-[200px] rounded-[14px]" /></div>
        <div className="hidden space-y-3 md:block"><Skeleton className="h-[170px] rounded-[14px]" /><Skeleton className="h-[150px] rounded-[14px]" /></div>
      </div>
    </div>
  )
}

function DoneState({ stats, onClose }: { stats: { rejected: number; passed: number; advanced: number }; onClose: () => void }) {
  const total = stats.rejected + stats.passed + stats.advanced
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-[520px] text-center">
        <h2 className="font-poppins text-[26px] font-semibold tracking-[-0.04em] text-[#1F2230]">Review done<span className="text-[#D7C5FB]">.</span></h2>
        <p className="mt-2 font-inter text-[13px] text-[#5A6072]">You reviewed {total} candidate{total === 1 ? '' : 's'} in this session.</p>
        <div className="mt-6 text-left">
          <MetricStrip
            phoneColumns={2}
            items={[
              { icon: ThumbsDown, tone: 'pink', label: 'Rejected', value: stats.rejected },
              { icon: SkipForward, tone: 'neutral', label: 'Passed', value: stats.passed },
              { icon: ArrowRight, tone: 'green', label: 'Advanced', value: stats.advanced },
            ]}
          />
        </div>
        <Button className="mt-6" variant="primary" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
