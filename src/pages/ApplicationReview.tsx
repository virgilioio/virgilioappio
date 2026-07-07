import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ThumbsDown,
  SkipForward,
  ArrowRight,
  MapPin,
  Calendar as CalendarIcon,
  Globe,
  Briefcase,
  Sparkles,
  Loader2,
  PartyPopper,
  Settings2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  CheckCircle2,
  Hash,
  Type,
  FileText,
  AlertTriangle,
  Undo2,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { ensureAbsoluteUrl } from '@/lib/utils'
import { useApplicationReview, RejectionConfig } from '@/hooks/useApplicationReview'
import { useCandidateFitInsights } from '@/hooks/useCandidateFitInsights'
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates'
import { useRejectionReasons } from '@/hooks/useRejectionReasons'
import { CandidateApplicationResponses } from '@/components/candidates/CandidateApplicationResponses'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { RejectionReasonSelector } from '@/components/candidates/RejectionReasonSelector'
import { ScheduleDelaySelector } from '@/components/candidates/ScheduleDelaySelector'
import { SafeHtml } from '@/components/ui/safe-html'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/* ------------------------------------------------------------------ */
/*  Small primitives                                                   */
/* ------------------------------------------------------------------ */

function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={
        'inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-[5px] font-mono text-[10.5px] font-medium ' +
        (dark
          ? 'bg-white/12 text-[#fffcf9]/85 border border-white/15'
          : 'bg-[#F1F0EC] text-[#5A6072] border border-[#E4E2DB]')
      }
    >
      {children}
    </kbd>
  )
}

function Chip({
  icon,
  children,
  variant = 'default',
}: {
  icon?: React.ReactNode
  children: React.ReactNode
  variant?: 'default' | 'role'
}) {
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4px] font-inter text-[11.5px] ' +
        (variant === 'role'
          ? 'bg-[#F4F3EF] border border-[#EAE8E1] uppercase font-semibold tracking-[0.05em] text-[#1F2230]'
          : 'bg-[#F4F3EF] border border-[#EAE8E1] text-[#1F2230]')
      }
    >
      {icon ? <span className="text-[#8B8F9E]">{icon}</span> : null}
      {children}
    </span>
  )
}

function MatchChip({ score }: { score: number | null | undefined }) {
  if (score == null) return null
  const tone =
    score >= 85
      ? { bg: '#E7F7EF', border: '#C7ECD9', dot: '#0F9D58', text: '#116A3F' }
      : score >= 70
      ? { bg: '#FEF4E2', border: '#F6E2BC', dot: '#B45309', text: '#7A4A0B' }
      : { bg: '#F4F3EF', border: '#EAE8E1', dot: '#8B8F9E', text: '#1F2230' }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4px] font-inter text-[11.5px] font-medium"
      style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {Math.round(score)}% match
    </span>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[10px] bg-[#F1F0EC] p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              'inline-flex items-center gap-1.5 rounded-[7px] px-[13px] py-[7px] font-poppins text-[12px] transition-colors ' +
              (active
                ? 'bg-white text-[#1F2230] font-semibold shadow-[0_1px_2px_rgba(13,13,9,0.06)]'
                : 'text-[#5A6072] font-medium hover:text-[#1F2230]')
            }
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApplicationReviewPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const review = useApplicationReview(jobId || '')

  // Load queue on mount
  useEffect(() => {
    if (jobId) review.loadQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // Job title for return-header context
  const [jobTitle, setJobTitle] = useState<string>('')
  useEffect(() => {
    if (!jobId) return
    supabase.from('jobs').select('title').eq('id', jobId).single().then(({ data }) => {
      if (data?.title) setJobTitle(data.title)
    })
  }, [jobId])

  // Sync URL ?candidate= with current candidate
  const initialCandidateParam = useRef(searchParams.get('candidate'))
  useEffect(() => {
    if (initialCandidateParam.current && review.queue.length > 0) {
      review.selectByCandidateId(initialCandidateParam.current)
      initialCandidateParam.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.queue.length])

  useEffect(() => {
    const cid = review.currentCandidate?.candidateId
    const current = searchParams.get('candidate')
    if (cid && cid !== current) {
      const next = new URLSearchParams(searchParams)
      next.set('candidate', cid)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.currentCandidate?.candidateId])

  // Undo toast state
  const [toastAction, setToastAction] = useState<
    { type: 'reject' | 'pass' | 'advance'; name: string; token: number } | null
  >(null)
  const lastActionRef = useRef<typeof review.lastAction>(null)
  useEffect(() => {
    const la = review.lastAction
    if (la && la !== lastActionRef.current) {
      setToastAction({ type: la.type, name: la.candidate.candidateName, token: Date.now() })
    }
    lastActionRef.current = la
  }, [review.lastAction])

  useEffect(() => {
    if (!toastAction) return
    const t = setTimeout(() => setToastAction(null), 4800)
    return () => clearTimeout(t)
  }, [toastAction])

  const handleClose = () => {
    if (review.stats.rejected > 0 || review.stats.advanced > 0) review.invalidateQueries()
    navigate(`/jobs/${jobId}?tab=application-review`)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }
      if (inField) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'r') { e.preventDefault(); review.handleReject() }
      else if (k === 'p') { e.preventDefault(); review.handlePass() }
      else if (k === 'a') { e.preventDefault(); review.handleAdvance() }
      else if (k === 'u') { e.preventDefault(); review.handleUndo() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); review.navigateTo(review.currentIndex - 1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); review.navigateTo(review.currentIndex + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.currentIndex, review.currentCandidate?.candidateId])

  const total = review.totalInQueue
  const reviewed = Math.min(
    review.stats.rejected + review.stats.passed + review.stats.advanced,
    Math.max(total, 1)
  )
  const progressPct = total > 0 ? Math.min(100, (reviewed / total) * 100) : 0

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#F6F5F1] flex flex-col">
      {/* Progress hairline */}
      <div className="h-[3px] w-full bg-[#EAE8E1] relative">
        <div
          className="h-full bg-[#6F3FF5] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Close (top-right) */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close review"
        className="fixed top-4 right-5 z-40 h-[34px] w-[34px] rounded-full bg-white border border-[#E7E8EE] text-[#5A6072] hover:text-[#1F2230] hover:border-[#D0D3DE] flex items-center justify-center shadow-[0_4px_14px_-4px_rgba(13,13,9,0.14)]"
      >
        <X className="h-4 w-4" />
      </button>

      {review.isLoading ? (
        <LoadingState />
      ) : review.isComplete ? (
        <CompletionState
          stats={review.stats}
          stageName={review.firstStageName || 'the next stage'}
          onDone={handleClose}
        />
      ) : total === 0 ? (
        <EmptyState onClose={handleClose} />
      ) : review.currentCandidate ? (
        <ReviewBody
          review={review}
          jobId={jobId!}
          jobTitle={jobTitle}
          reviewed={reviewed}
        />
      ) : null}

      {/* Undo toast */}
      {toastAction && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex items-center gap-3 rounded-[12px] bg-[#0d0d09] text-[#fffcf9] px-4 py-3 shadow-[0_16px_38px_-10px_rgba(13,13,9,0.55)]">
            {toastAction.type === 'reject' && <ThumbsDown className="h-4 w-4 text-[#FA5252]" />}
            {toastAction.type === 'pass' && <SkipForward className="h-4 w-4 text-[#C2C6D2]" />}
            {toastAction.type === 'advance' && <ArrowRight className="h-4 w-4 text-[#8AE0B4]" />}
            <span className="font-inter text-[13px]">
              {toastAction.type === 'reject' ? 'Rejected' : toastAction.type === 'pass' ? 'Passed' : 'Advanced'}{' '}
              <span className="font-semibold">{toastAction.name}</span>
            </span>
            <button
              type="button"
              onClick={() => { review.handleUndo(); setToastAction(null) }}
              className="ml-2 inline-flex items-center gap-1.5 rounded-[8px] bg-white/10 hover:bg-white/16 px-2.5 py-1 font-inter text-[12px] font-medium"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
              <Kbd dark>U</Kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Body                                                               */
/* ------------------------------------------------------------------ */

function ReviewBody({
  review,
  jobId,
  jobTitle,
  reviewed,
}: {
  review: ReturnType<typeof useApplicationReview>
  jobId: string
  jobTitle: string
  reviewed: number
}) {
  const c = review.currentCandidate!
  const { insights } = useCandidateFitInsights(c.candidateId, jobId)
  const analysis = insights?.analysis
  const score = analysis?.overall_score ?? null

  return (
    <>
      {/* Header band */}
      <header className="bg-white border-b border-[#E7E8EE]" style={{ padding: '22px 32px 16px' }}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="font-poppins text-[#0d0d09]"
                style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1 }}
              >
                {c.candidateName}
                <span className="text-[#D7C5FB]">.</span>
              </h1>
              {c.linkedinUrl && (
                <a
                  href={ensureAbsoluteUrl(c.linkedinUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open LinkedIn profile"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-[7px] bg-[#0A66C2] text-white hover:opacity-90"
                >
                  <LinkedInFilled className="h-4 w-4" />
                </a>
              )}
              <MatchChip score={score} />
            </div>
            <p className="mt-1 font-inter text-[13px] text-[#5A6072]">
              {[c.currentJobTitle, jobTitle].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {c.currentJobTitle && <Chip variant="role">{c.currentJobTitle}</Chip>}
              {(c.locationCity || c.locationCountry) && (
                <Chip icon={<MapPin className="h-3 w-3" />}>
                  {[c.locationCity, c.locationCountry].filter(Boolean).join(', ')}
                </Chip>
              )}
              <Chip icon={<CalendarIcon className="h-3 w-3" />}>
                Applied {format(new Date(c.appliedAt), 'MMM d, yyyy')}
              </Chip>
              {c.source && <Chip icon={<Globe className="h-3 w-3" />}>{c.source}</Chip>}
              {c.seniority && <Chip icon={<Briefcase className="h-3 w-3" />}>{c.seniority}</Chip>}
            </div>
          </div>

          {/* Right — pager */}
          <div className="flex items-center gap-3 shrink-0 pr-12">
            <span className="font-inter text-[12.5px] tabular-nums text-[#5A6072]">
              {review.currentPosition} of {review.totalInQueue}
            </span>
            <div className="flex items-center gap-1">
              <PagerButton
                onClick={() => review.navigateTo(review.currentIndex - 1)}
                disabled={review.currentIndex === 0}
                icon={<ChevronLeft className="h-3.5 w-3.5" />}
                label="Previous"
              />
              <PagerButton
                onClick={() => review.navigateTo(review.currentIndex + 1)}
                disabled={review.currentIndex >= review.totalInQueue - 1}
                icon={<ChevronRight className="h-3.5 w-3.5" />}
                label="Next"
                iconRight
              />
            </div>
          </div>
        </div>
      </header>

      {/* 3-column body */}
      <div
        className="grid flex-1 min-h-0"
        style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,0.95fr) 384px' }}
      >
        {/* Column 1 — Résumé */}
        <section className="min-w-0 flex flex-col" style={{ padding: '20px 20px 20px 32px' }}>
          <div className="flex-1 min-h-0 flex flex-col rounded-[14px] border border-[#E7E8EE] bg-white overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <CandidateResumeViewer candidateId={c.candidateId} height={78} />
            </div>
            <ResumeFooter candidateId={c.candidateId} />
          </div>
        </section>

        {/* Column 2 — Responses / Insights */}
        <section className="min-w-0 flex flex-col overflow-hidden" style={{ padding: '20px 8px' }}>
          <ResponsesInsightsColumn candidateId={c.candidateId} jobId={jobId} analysis={analysis} />
        </section>

        {/* Column 3 — Decision rail */}
        <aside className="border-l border-[#E7E8EE] bg-[#FCFBF8] overflow-y-auto" style={{ padding: '20px 24px 28px' }}>
          <DecisionRail review={review} reviewed={reviewed} />
        </aside>
      </div>
    </>
  )
}

function PagerButton({
  onClick,
  disabled,
  icon,
  label,
  iconRight,
}: {
  onClick: () => void
  disabled?: boolean
  icon: React.ReactNode
  label: string
  iconRight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-white border border-[#E7E8EE] font-inter text-[12.5px] font-medium transition-colors ' +
        (disabled ? 'text-[#C2C6D2] cursor-not-allowed' : 'text-[#1F2230] hover:bg-[#FAFAF7]')
      }
    >
      {!iconRight && icon}
      {label}
      {iconRight && icon}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Résumé footer                                                       */
/* ------------------------------------------------------------------ */

function ResumeFooter({ candidateId }: { candidateId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('candidates')
        .select('resume_url')
        .eq('id', candidateId)
        .single()
      const raw = (data as any)?.resume_url as string | null
      if (!raw || cancelled) return
      if (/^https?:\/\//i.test(raw)) {
        setUrl(raw)
        return
      }
      const { data: signed } = await supabase.storage
        .from('resumes')
        .createSignedUrl(raw, 60 * 60)
      if (!cancelled) setUrl(signed?.signedUrl ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [candidateId])

  return (
    <div className="border-t border-[#E7E8EE] flex items-center gap-2" style={{ padding: '10px 14px' }}>
      <a
        href={url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!url}
        onClick={(e) => { if (!url) e.preventDefault() }}
        className={
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-white border border-[#E7E8EE] font-inter text-[12px] font-medium ' +
          (url ? 'text-[#1F2230] hover:bg-[#FAFAF7]' : 'text-[#C2C6D2] cursor-not-allowed')
        }
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in new tab
      </a>
      <a
        href={url ?? '#'}
        download
        aria-disabled={!url}
        onClick={(e) => { if (!url) e.preventDefault() }}
        className={
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-white border border-[#E7E8EE] font-inter text-[12px] font-medium ' +
          (url ? 'text-[#1F2230] hover:bg-[#FAFAF7]' : 'text-[#C2C6D2] cursor-not-allowed')
        }
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </a>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Responses / Insights column                                        */
/* ------------------------------------------------------------------ */

function ResponsesInsightsColumn({
  candidateId,
  jobId,
  analysis,
}: {
  candidateId: string
  jobId: string
  analysis: any
}) {
  const [tab, setTab] = useState<'responses' | 'insights'>('responses')
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: 'responses', label: 'Application Responses' },
            {
              value: 'insights',
              label: 'AI Insights',
              icon: <Sparkles className="h-3.5 w-3.5 text-[#6F3FF5]" />,
            },
          ]}
        />
      </div>
      <div className="mt-4 flex-1 min-h-0 overflow-y-auto px-3">
        {tab === 'responses' ? (
          <ResponsesPanel candidateId={candidateId} jobId={jobId} />
        ) : (
          <InsightsPanel analysis={analysis} />
        )}
      </div>
    </div>
  )
}

function ResponsesPanel({ candidateId, jobId }: { candidateId: string; jobId: string }) {
  const { responses, isLoading } = useApplicationResponses(candidateId, jobId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (!responses || responses.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#E7E8EE] bg-white p-6 text-center">
        <p className="font-inter text-[13px] text-[#5A6072]">No application responses were captured.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3.5">
      {responses.map((r: any, i: number) => {
        const kind = (r.question_type || '').toLowerCase()
        const Icon = kind.includes('num') ? Hash : kind.includes('long') || kind.includes('text_area') ? FileText : Type
        const isLong = kind.includes('long') || kind.includes('text_area')
        const val = Array.isArray(r.answer) ? r.answer.join(', ') : String(r.answer ?? '')
        return (
          <div key={r.id || i} className="flex items-start gap-3">
            <div className="h-[30px] w-[30px] rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-[#5A6072]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-inter text-[13px] font-semibold text-[#1F2230]">{r.question_text || r.question || 'Question'}</p>
              <p
                className={
                  'mt-1 font-inter text-[13px] ' +
                  (isLong ? 'text-[#5A6072]' : 'font-semibold text-[#1F2230]')
                }
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {val || '—'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InsightsPanel({ analysis }: { analysis: any }) {
  if (!analysis) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#E7E8EE] bg-white p-6 text-center">
        <p className="font-inter text-[13px] text-[#5A6072]">AI insights aren't ready for this candidate yet.</p>
      </div>
    )
  }
  const score = analysis.overall_score ?? 0
  const strong = score >= 80
  const bg = strong ? '#E7F7EF' : '#FEF4E2'
  const border = strong ? '#C7ECD9' : '#F6E2BC'

  const insightRows: { title: string; detail?: string; kind: 'good' | 'warn' }[] = []
  if (Array.isArray(analysis.strengths)) {
    analysis.strengths.slice(0, 4).forEach((s: any) => {
      insightRows.push({
        title: typeof s === 'string' ? s : s?.title || s?.dimension || 'Strength',
        detail: typeof s === 'object' ? s?.detail || s?.evidence : undefined,
        kind: 'good',
      })
    })
  }
  if (Array.isArray(analysis.gaps)) {
    analysis.gaps.slice(0, 4).forEach((g: any) => {
      insightRows.push({
        title: typeof g === 'string' ? g : g?.title || g?.dimension || 'Gap',
        detail: typeof g === 'object' ? g?.detail || g?.evidence : undefined,
        kind: 'warn',
      })
    })
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-[12px] p-3 flex items-start gap-3"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div className="h-9 w-9 rounded-[9px] bg-[#F8F5FF] border border-[#ECE3FF] flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-[#6F3FF5]" />
        </div>
        <div className="min-w-0">
          <p className="font-poppins text-[14px] font-semibold text-[#1F2230]">
            {strong ? 'Strong fit' : 'Worth review'} <span className="text-[#5A6072]">· {Math.round(score)}%</span>
          </p>
          {analysis.executive_summary && (
            <p className="mt-0.5 font-inter text-[12.5px] text-[#5A6072] leading-relaxed">
              {analysis.executive_summary}
            </p>
          )}
        </div>
      </div>

      {insightRows.length > 0 && (
        <div className="space-y-2.5">
          {insightRows.map((row, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="h-[26px] w-[26px] rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: row.kind === 'good' ? '#E7F7EF' : '#FEF4E2',
                }}
              >
                {row.kind === 'good' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#0F9D58]" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-inter text-[13px] font-semibold text-[#1F2230]">{row.title}</p>
                {row.detail && (
                  <p className="mt-0.5 font-inter text-[12.5px] text-[#5A6072] leading-relaxed">{row.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Decision rail                                                       */
/* ------------------------------------------------------------------ */

function DecisionRail({
  review,
  reviewed,
}: {
  review: ReturnType<typeof useApplicationReview>
  reviewed: number
}) {
  const c = review.currentCandidate!
  const total = review.totalInQueue
  const progressPct = total > 0 ? Math.min(100, (reviewed / total) * 100) : 0

  const { insights } = useCandidateFitInsights(c.candidateId, '')
  const analysis = insights?.analysis
  const gioAdvance = analysis ? (analysis.overall_score ?? 0) >= 70 : null

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between">
          <h3
            className="font-poppins text-[#0d0d09]"
            style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}
          >
            Decision<span className="text-[#D7C5FB]">.</span>
          </h3>
          <span className="font-inter text-[11.5px] text-[#8B8F9E] tabular-nums">
            {reviewed} of {total} reviewed
          </span>
        </div>
        <div className="mt-2 h-[5px] rounded-full bg-[#EAE8E1] overflow-hidden">
          <div className="h-full bg-[#6F3FF5] transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Gio's read */}
      {analysis && gioAdvance !== null && (
        <div className="rounded-[12px] border border-[#ECE3FF] bg-[#F8F5FF] p-3 flex items-start gap-3">
          <div className="h-[30px] w-[30px] rounded-[9px] bg-white border border-[#ECE3FF] flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-[#6F3FF5]" />
          </div>
          <div className="min-w-0">
            <p className="font-inter text-[12.5px] text-[#1F2230]">
              Gio suggests{' '}
              <span
                className="font-semibold"
                style={{ color: gioAdvance ? '#0F9D58' : '#B45309' }}
              >
                {gioAdvance ? 'Advance' : 'Take a closer look'}
              </span>
            </p>
            <p className="mt-0.5 font-inter text-[11.5px] text-[#8B8F9E]">
              {gioAdvance ? 'Strong fit' : 'Worth review'} · {Math.round(analysis.overall_score ?? 0)}% match
            </p>
          </div>
        </div>
      )}

      {/* Decision buttons */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => review.handleReject()}
            disabled={review.isActioning}
            className="h-11 rounded-[10px] bg-white border font-poppins text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors hover:bg-[#FFF6F6] disabled:opacity-60"
            style={{ color: '#FA5252', borderColor: '#FBD0D0' }}
          >
            {review.isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
            Reject
            <Kbd>R</Kbd>
          </button>
          <button
            type="button"
            onClick={() => review.handlePass()}
            disabled={review.isActioning}
            className="h-11 rounded-[10px] bg-white border font-poppins text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors hover:bg-[#FAFAF7] disabled:opacity-60"
            style={{ color: '#1F2230', borderColor: '#E0DDD3' }}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Pass
            <Kbd>P</Kbd>
          </button>
        </div>
        <button
          type="button"
          onClick={() => review.handleAdvance()}
          disabled={review.isActioning || !review.firstStageId}
          className="mt-2 w-full h-[50px] rounded-[10px] bg-[#0d0d09] text-[#fffcf9] px-4 inline-flex items-center justify-between font-poppins text-[13.5px] font-semibold shadow-[0_10px_24px_-10px_rgba(13,13,9,0.5)] hover:bg-[#1a1a15] transition-colors disabled:opacity-60"
        >
          <span className="inline-flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Advance
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-inter text-[12px] font-medium text-[#fffcf9]/70">
              {review.firstStageName || 'Next stage'}
            </span>
            <Kbd dark>A</Kbd>
          </span>
        </button>
        <p className="mt-1 font-inter text-[11px] text-[#8B8F9E] flex items-center gap-1.5 flex-wrap">
          <Kbd>←</Kbd> <Kbd>→</Kbd> to move · <Kbd>U</Kbd> to undo
        </p>
      </div>

      {/* Rejection settings */}
      <RejectionSettingsPanel review={review} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Rejection settings (collapsible)                                    */
/* ------------------------------------------------------------------ */

function RejectionSettingsPanel({
  review,
}: {
  review: ReturnType<typeof useApplicationReview>
}) {
  const [expanded, setExpanded] = useState(false)
  const config = review.rejectionConfig
  const { templates } = useRejectionEmailTemplates('organization')
  const { reasons } = useRejectionReasons('organization')

  const reasonName = useMemo(() => {
    if (!config.rejectionReasonId) return 'No reason set'
    return reasons.find((r: any) => r.id === config.rejectionReasonId)?.name ?? 'No reason set'
  }, [config.rejectionReasonId, reasons])

  const template = templates.find((t: any) => t.id === config.rejectionEmailTemplateId)

  return (
    <div className="pt-4 border-t border-[#E7E8EE]">
      <div className="flex items-center justify-between">
        <h4 className="inline-flex items-center gap-2 font-poppins text-[13.5px] font-semibold text-[#1F2230]">
          <Settings2 className="h-3.5 w-3.5 text-[#5A6072]" />
          Rejection settings
        </h4>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 font-inter text-[11px] font-semibold text-[#6F3FF5] hover:text-[#5A2FD9]"
        >
          {expanded ? 'Done' : 'Edit'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {!expanded ? (
        <div className="mt-2.5">
          <div className="flex flex-wrap gap-1.5">
            <SummaryPill>{reasonName}</SummaryPill>
            <SummaryPill>{config.sendEmail ? 'Email on' : 'No email'}</SummaryPill>
            {config.sendEmail && (
              <SummaryPill>
                {config.sendOption === 'later' ? 'Scheduled' : 'Sends immediately'}
              </SummaryPill>
            )}
          </div>
          <p className="mt-2 font-inter text-[11px] text-[#8B8F9E]">
            Applied to every rejection until you change it.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6072]">
              Rejection reason
            </Label>
            <RejectionReasonSelector
              value={config.rejectionReasonId}
              onValueChange={(v) => review.persistRejectionConfig({ ...config, rejectionReasonId: v })}
            />
          </div>

          <div className="rounded-[10px] bg-[#FAFAF7] border border-[#E7E8EE] p-3 flex items-center justify-between">
            <div>
              <Label className="text-[12.5px] font-semibold text-[#1F2230] cursor-pointer">
                Send rejection email
              </Label>
              <p className="mt-0.5 font-inter text-[11px] text-[#8B8F9E]">
                Auto-send on Reject
              </p>
            </div>
            <Switch
              checked={config.sendEmail}
              onCheckedChange={(v) => review.persistRejectionConfig({ ...config, sendEmail: v })}
            />
          </div>

          {config.sendEmail && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6072]">
                  Email template
                </Label>
                <Select
                  value={config.rejectionEmailTemplateId || ''}
                  onValueChange={(v) =>
                    review.persistRejectionConfig({ ...config, rejectionEmailTemplateId: v || undefined })
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {template && (
                <div className="rounded-[10px] bg-[#FAFAF7] border border-[#E7E8EE] p-3 space-y-2 max-h-[220px] overflow-y-auto">
                  <div>
                    <p className="font-inter text-[10.5px] font-semibold uppercase tracking-wide text-[#8B8F9E]">Subject</p>
                    <p className="mt-0.5 font-inter text-[12.5px] text-[#1F2230]">{template.subject}</p>
                  </div>
                  <div className="border-t border-[#E7E8EE] pt-2">
                    <p className="font-inter text-[10.5px] font-semibold uppercase tracking-wide text-[#8B8F9E]">Body</p>
                    <SafeHtml
                      content={template.body}
                      className="mt-1 font-inter text-[12px] text-[#1F2230] leading-relaxed"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6072]">
                  When to send
                </Label>
                <RadioGroup
                  value={config.sendOption || 'now'}
                  onValueChange={(v) =>
                    review.persistRejectionConfig({ ...config, sendOption: v as 'now' | 'later' })
                  }
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="now" id="review-send-now" />
                    <Label htmlFor="review-send-now" className="text-[12.5px] font-normal cursor-pointer">
                      Send immediately
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="later" id="review-send-later" />
                    <Label htmlFor="review-send-later" className="text-[12.5px] font-normal cursor-pointer">
                      Schedule for later
                    </Label>
                  </div>
                </RadioGroup>

                {config.sendOption === 'later' && (
                  <ScheduleDelaySelector
                    value={{
                      preset: config.schedulePreset || '',
                      customDate: config.customScheduledDate,
                      customTime: config.customScheduledTime,
                    }}
                    onChange={(v) =>
                      review.persistRejectionConfig({
                        ...config,
                        schedulePreset: v.preset,
                        customScheduledDate: v.customDate,
                        customScheduledTime: v.customTime,
                      })
                    }
                    className="pl-6"
                  />
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6072]">
              Note (optional)
            </Label>
            <Textarea
              value={config.rejectionNotes || ''}
              onChange={(e) =>
                review.persistRejectionConfig({ ...config, rejectionNotes: e.target.value })
              }
              placeholder="Brief rejection note..."
              className="min-h-[60px] text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full h-10 rounded-[10px] bg-[#0d0d09] text-[#fffcf9] font-poppins text-[13px] font-semibold hover:bg-[#1a1a15]"
          >
            Save settings
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 bg-[#F1F0EC] border border-[#E4E2DB] font-inter text-[11px] text-[#5A6072]">
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading / empty / completion                                        */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[#6F3FF5]" />
        <p className="font-poppins text-[13px] text-[#5A6072]">Loading review queue…</p>
      </div>
    </div>
  )
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[#E7F7EF] flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-[#0F9D58]" />
        </div>
        <h2 className="font-poppins text-[20px] font-semibold text-[#0d0d09]">
          No applications to review<span className="text-[#D7C5FB]">.</span>
        </h2>
        <p className="mt-2 font-inter text-[13px] text-[#5A6072]">
          There are no candidates waiting in the application review queue for this job.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 px-5 rounded-[11px] bg-[#0d0d09] text-[#fffcf9] font-poppins text-[13px] font-semibold hover:bg-[#1a1a15]"
        >
          Back to pipeline
        </button>
      </div>
    </div>
  )
}

function CompletionState({
  stats,
  stageName,
  onDone,
}: {
  stats: { rejected: number; passed: number; advanced: number }
  stageName: string
  onDone: () => void
}) {
  const total = stats.rejected + stats.passed + stats.advanced

  const cards: { label: string; value: number; color: string }[] = [
    { label: 'Rejected', value: stats.rejected, color: '#FA5252' },
    { label: 'Passed', value: stats.passed, color: '#5A6072' },
    { label: 'Advanced', value: stats.advanced, color: '#0F9D58' },
  ]

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center px-6">
      <div className="w-full max-w-[520px] text-center">
        <div className="mx-auto mb-5 h-[74px] w-[74px] rounded-full bg-[#E7F7EF] flex items-center justify-center">
          <PartyPopper className="h-8 w-8 text-[#0F9D58]" />
        </div>
        <h2
          className="font-poppins text-[#0d0d09]"
          style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}
        >
          Review complete<span className="text-[#D7C5FB]">.</span>
        </h2>
        <p className="mt-2 font-inter text-[14px] text-[#5A6072]">
          You reviewed {total} candidate{total !== 1 ? 's' : ''} in this session.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-[14px] bg-white border border-[#E7E8EE] p-4">
              <p className="font-poppins" style={{ fontSize: 26, fontWeight: 700, color: c.color }}>
                {c.value}
              </p>
              <p className="mt-1 font-inter text-[12.5px] text-[#5A6072]">{c.label}</p>
            </div>
          ))}
        </div>

        {stats.advanced > 0 && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#F8F5FF] border border-[#ECE3FF] px-4 py-2">
            <ArrowRight className="h-3.5 w-3.5 text-[#6F3FF5]" />
            <span className="font-inter text-[12.5px] text-[#1F2230]">
              {stats.advanced} candidate{stats.advanced !== 1 ? 's' : ''} waiting for you in {stageName}
            </span>
          </div>
        )}

        <div className="mt-7">
          <button
            type="button"
            onClick={onDone}
            className="h-11 px-6 rounded-[11px] bg-[#0d0d09] text-[#fffcf9] font-poppins text-[13px] font-semibold hover:bg-[#1a1a15]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
