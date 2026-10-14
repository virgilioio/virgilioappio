import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Download,
  GraduationCap,
  MapPin,
  Minus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserRound,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { GioFitLanguageControl, GioFitLanguageProvenance } from './GioFitLanguageControl'
import { GioFitColdSkeleton } from './loading/GioFitColdSkeleton'
import { GioFitBlockedCard, GioFitErrorCard } from './loading/GioFitFailureCard'
import { GioFitRescoringBar } from './loading/GioFitRescoringBar'
import { buildNarrationSteps, stepProgress, useGioFitNarration } from './loading/GioFitNarration'
import { useCandidateFitInsights, type FitDimension, type MustHave, type ValidationPoint } from '@/hooks/useCandidateFitInsights'
import { useDossierShare } from '@/hooks/useDossierShare'
import { TRIGGER_LABEL, useFitScoreHistory, type FitScorePoint } from '@/hooks/useFitScoreHistory'
import { SkillPriorityLegend } from '@/components/jobs/SkillPill'
import { SKILL_PRIORITY, readSkillPriorities, sortByPriority } from '@/lib/skillPriority'
import { usePermissions } from '@/hooks/usePermissions'
import { useAssociationScorecards } from '@/hooks/useAssociationScorecards'
import { useApplicationScorecardRequirements } from '@/hooks/useApplicationScorecardRequirements'
import { ShareDossierMenu } from '@/components/candidates/insights/ShareDossierMenu'
import { InterviewScorecardsSection } from './dossier/InterviewScorecardsSection'
import { DossierExperienceGroups } from '@/components/candidates/experience/DossierExperienceGroups'
import { GioFitExportDialog, type DossierExportOptions } from './dossier/GioFitExportDialog'
import type { DossierPrintProps } from './dossier/DossierPrintDocument'
import { normalizeScorecardRichText, richTextParagraphs, type DossierScorecard } from './dossier/dossierScorecards'
import {
  asString,
  asStringArray,
  buildSkillGroups,
  computeExperienceStats,
  getScoreBand,
  readSkillEvidence,
  splitExecutiveSummary,
  stripHtml,
} from './dossier/dossierData'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getGioFitLanguage } from '@/lib/gioFitLanguages'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { formatSalaryExpectation } from '@/lib/candidateHelpers'
import { coerceRating } from '@/lib/scorecardRatings'

interface CandidateInsightsTabProps {
  candidateId: string
  jobId: string
  jobDescription?: string | null
  job?: Record<string, unknown> | null
  candidate?: Record<string, unknown> | null
  workExperience: CandidateWorkExperience[]
  education: CandidateEducation[]
  /** False for people nobody has interviewed — an empty scorecards section would be a lie. */
  showScorecards?: boolean
  /**
   * Present when the dossier is read before an application exists. It drops the
   * identity repeat and the client-ready toggle, and puts the pipeline decision
   * where "Share with client" normally sits.
   */
  suggested?: {
    statusText: string
    chips?: string[]
    overflow?: number
    note?: string | null
    actions?: React.ReactNode
  } | null
  /**
   * False where an assessment must be asked for rather than assumed — a suggestion
   * below the automatic threshold. Opening the tab then spends nothing.
   */
  autoGenerate?: boolean
  /** Rendered instead of the cold skeleton when nothing is stored and nothing is running. */
  renderEmpty?: (options: { generate: () => void; isGenerating: boolean }) => React.ReactNode
  /**
   * A strip pinned above the body while a score is being produced or re-produced,
   * and while it has failed — the decision it carries must stay available throughout.
   */
  renderWaitStrip?: (context: { state: 'loading' | 'rescoring' | 'failed'; generatedAt: string | null }) => React.ReactNode
  /** Lets the screen mirror the wait in its own chrome (the hero score pill). */
  onStateChange?: (state: 'ready' | 'loading' | 'rescoring') => void
}

const cardClass = 'rounded-[14px] border border-virgilio-border bg-surface-primary'
const sectionHeadingClass = 'flex items-center gap-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-fit-subtle'
const dimensionColors = [
  { dot: 'bg-fit-violet-deep', fill: 'bg-fit-violet-deep' },
  { dot: 'bg-virgilio-purple', fill: 'bg-virgilio-purple' },
  { dot: 'bg-fit-violet-mid', fill: 'bg-fit-violet-mid' },
  { dot: 'bg-fit-violet-bright', fill: 'bg-fit-violet-bright' },
  { dot: 'bg-fit-stone', fill: 'bg-fit-stone' },
  { dot: 'bg-fit-violet-soft', fill: 'bg-fit-violet-soft' },
  { dot: 'bg-fit-lilac', fill: 'bg-fit-lilac' },
]


function EvidenceItem({ kind, children }: { kind: 'match' | 'gap'; children: string }) {
  const config = kind === 'match'
    ? { Icon: Check, icon: 'bg-fit-match-soft text-fit-match-dark', rail: 'border-l-virgilio-success' }
    : { Icon: X, icon: 'bg-fit-gap-soft text-fit-gap-dark', rail: 'border-l-virgilio-error' }
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-fit-row-border border-l-2 bg-surface-primary px-[11px] py-[9px]', config.rail)}>
      <span className={cn('mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full', config.icon)}>
        <config.Icon className="h-2.5 w-2.5" />
      </span>
      <span className="text-[12px] leading-[1.45] text-fit-ink">{children}</span>
    </div>
  )
}

function DimensionRow({ dimension, colorIndex, open, clientReady, onToggle }: { dimension: FitDimension; colorIndex: number; open: boolean; clientReady: boolean; onToggle: () => void }) {
  const score = dimension.score
  const weight = Number(dimension.weight) || 0
  const contribution = score === null ? null : score * weight / 100
  const matches = dimension.matches || []
  const gaps = dimension.gaps || []
  const color = dimensionColors[colorIndex % dimensionColors.length]

  return (
    <div className={cn('overflow-hidden border-b border-fit-hairline last:border-b-0', open && 'border-l-2 border-l-virgilio-purple bg-fit-open-row')}>
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 text-left" aria-expanded={open}>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-[2.5px]', score === null ? 'bg-fit-null' : color.dot)} />
          <span className={cn('min-w-0 flex-1 text-[12.5px] text-fit-ink', open ? 'font-semibold' : 'font-medium')}>{dimension.name}</span>
          {score === null ? <Badge tone="yellow" size="xs" shape="square">Data needed</Badge> : <span className="font-poppins text-[14px] font-semibold tabular-nums text-fit-ink">{score}</span>}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-fit-subtle" /> : <ChevronDown className="h-3.5 w-3.5 text-fit-subtle" />}
        </div>
        <div className="mt-2 flex items-center gap-2 pl-4">
          <div className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-fit-hairline">
            {score !== null && <div className={cn('h-full rounded-full', color.fill)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />}
          </div>
          {!clientReady && (
            <span className={cn('w-[92px] text-right text-[11px] tabular-nums', score === null ? 'text-fit-warning' : 'text-fit-subtle')}>
              {score === null ? `${weight}% excluded` : `${weight}% · ${contribution?.toFixed(1)} pts`}
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-fit-row-border bg-fit-paper px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {score === null ? (
                <Badge tone="yellow" size="xs" shape="square">Not assessed</Badge>
              ) : !clientReady ? (
                <p className="text-[11px] tabular-nums text-fit-subtle">{score} × {weight}% = {contribution?.toFixed(1)} pts</p>
              ) : null}
            </div>
            {score !== null && <span className="text-right text-[11px] text-fit-subtle">{matches.length} matches · {gaps.length} gaps</span>}
          </div>
          {dimension.insight && <p className="mt-3 text-[12px] leading-[1.55] text-fit-muted">{dimension.insight}</p>}
          <div className="mt-3 space-y-2">
            {matches.map((item, index) => <EvidenceItem key={`match-${index}-${item}`} kind="match">{item}</EvidenceItem>)}
            {gaps.map((item, index) => <EvidenceItem key={`gap-${index}-${item}`} kind="gap">{item}</EvidenceItem>)}
          </div>
        </div>
      )}
    </div>
  )
}

const MUST_HAVE_STYLE: Record<MustHave['status'], { label: string; className: string; Icon: typeof Check | null }> = {
  met: { label: 'Met', className: 'border-fit-skill-evidenced-border bg-fit-skill-evidenced-bg text-fit-skill-evidenced-text', Icon: Check },
  partial: { label: 'Partly', className: 'border-fit-row-border bg-fit-paper text-fit-ink', Icon: CircleDashed },
  not_met: { label: 'Not met', className: 'border-fit-risk-border bg-fit-warning-soft text-fit-risk-copy', Icon: Minus },
  unknown: { label: 'Not verified', className: 'border-fit-row-border bg-surface-primary text-fit-subtle', Icon: null },
}

/** The requirements the job itself states as mandatory, each with the verdict that bounds the score (v4). */
function MustHaves({ items }: { items: MustHave[] }) {
  const counts = items.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc }, {} as Partial<Record<MustHave['status'], number>>)
  return (
    <div className="border-t border-fit-hairline p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={sectionHeadingClass}><ShieldCheck className="h-3 w-3" /> Must-haves from the job</h3>
        <span className="text-[11.5px] text-fit-subtle">
          {[counts.met ? `${counts.met} met` : null, counts.partial ? `${counts.partial} partly` : null, counts.not_met ? `${counts.not_met} not met` : null, counts.unknown ? `${counts.unknown} to verify` : null].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="mt-4 divide-y divide-fit-chip">
        {items.map((item) => {
          const style = MUST_HAVE_STYLE[item.status] ?? MUST_HAVE_STYLE.unknown
          return (
            <div key={item.requirement} className="grid gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
              <span className={cn('inline-flex h-[22px] w-fit items-center gap-1 rounded-md border px-2 text-[11px] font-medium', style.className)}>
                {style.Icon && <style.Icon className="h-3 w-3" />}{style.label}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-fit-ink">{item.requirement}</p>
                {item.evidence && <p className="mt-0.5 text-[11.5px] leading-[1.5] text-fit-muted">“{item.evidence}”</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** "72 → 69 → 81": how the score moved, with what moved it on hover. */
function ScoreTrajectory({ points }: { points: FitScorePoint[] }) {
  const shown = points.slice(-6)
  return (
    <p className="mt-2 flex flex-wrap items-center justify-end gap-1 text-[11px] text-fit-subtle">
      {points.length > shown.length && <span>…</span>}
      {shown.map((point, index) => {
        const previous = shown[index - 1]
        const delta = previous && typeof point.score === 'number' && typeof previous.score === 'number' ? point.score - previous.score : null
        return (
          <React.Fragment key={point.id}>
            {index > 0 && <span className="text-fit-null">→</span>}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('cursor-help tabular-nums', index === shown.length - 1 ? 'font-semibold text-fit-ink' : 'font-medium')}>
                  {point.score ?? '—'}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px]">
                <p className="text-[11px] font-medium">{TRIGGER_LABEL[point.trigger]} · {new Date(point.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{delta != null && delta !== 0 ? ` · ${delta > 0 ? '+' : ''}${delta}` : ''}</p>
                {point.changesSinceLast && <p className="mt-1 text-[11px] leading-[1.45] opacity-80">{point.changesSinceLast}</p>}
              </TooltipContent>
            </Tooltip>
          </React.Fragment>
        )
      })}
      <span className="ml-1 text-fit-null">{points.length} assessments</span>
    </p>
  )
}

function ValidationPoints({ points, clientReady }: { points: ValidationPoint[]; clientReady: boolean }) {
  if (!points.length) return null
  const priorityTone = { high: 'red', medium: 'yellow', low: 'neutral' } as const
  return (
    <section className={cardClass}>
      <div className="border-b border-fit-hairline px-4 py-4">
        <h3 className={sectionHeadingClass}><CheckCircle2 className="h-3 w-3" /> {clientReady ? 'Still to verify' : 'Validation points'}</h3>
        <p className="mt-2 text-[12px] leading-[1.5] text-fit-muted">{clientReady ? 'Questions to settle together during the next conversation.' : 'What the model could not settle, and where to settle it.'}</p>
      </div>
      <div className="divide-y divide-fit-hairline px-4">
        {points.map((point, index) => (
          <div key={`${point.question}-${index}`} className="flex items-start gap-2.5 py-3.5">
            <span className="mt-0.5 h-[15px] w-[15px] shrink-0 rounded-full border border-fit-null" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-[1.45] text-fit-ink">{point.question}</p>
              {point.reason && (!clientReady || !/points?|weight|score|calculation|rubric/i.test(point.reason)) && <p className="mt-1 text-[11.5px] leading-[1.45] text-fit-subtle">{point.reason}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!clientReady && <Badge tone={priorityTone[point.priority]} size="xs" shape="square" className="capitalize">{point.priority}</Badge>}
                {point.suggested_stage && <span className="text-[11.5px] text-fit-muted">→ {point.suggested_stage}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function CandidateInsightsTab({ candidateId, jobId, jobDescription, job, candidate, workExperience, education, showScorecards = true, suggested = null, autoGenerate = true, renderEmpty, renderWaitStrip, onStateChange }: CandidateInsightsTabProps) {
  const { insights, isLoading, isRefreshing, isBlocked, generationError, refreshInsights, cancelRefresh, updateLanguagePreferences, invalidate } = useCandidateFitInsights(candidateId, jobId)
  // The score's trajectory: every stored assessment, oldest first (2026-10-14).
  const { data: scoreHistory = [] } = useFitScoreHistory(insights?.associationId ?? null)
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  const [openDimension, setOpenDimension] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'internal' | 'client'>('internal')
  const [exportOpen, setExportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement | null>(null)
  const shareWrapperRef = useRef<HTMLDivElement | null>(null)
  // Read-only roles may reach the menu and copy the internal link, never publish.
  const { canEditCandidates } = usePermissions()
  // The share row is created the first time the menu opens — never before.
  const { share, isLoading: shareLoading, error: shareError, setPublic: setSharePublic } = useDossierShare(
    insights?.associationId ?? null,
    shareOpen,
  )
  const { scorecards: rawScorecards } = useAssociationScorecards(insights?.associationId ?? null)
  const scorecardRequirements = useApplicationScorecardRequirements(insights?.associationId ?? null, jobId, null)
  const hasTriggered = useRef(false)
  const jdText = stripHtml(jobDescription)

  // Every job skill is checked; its priority (must / nice / extra) colours the chip
  // and decides what a missing one costs (2026-10-14).
  const requiredSkills = useMemo(() => asStringArray(job?.skills), [job])
  const skillPriorities = useMemo(() => readSkillPriorities(job?.skill_priorities), [job])
  const candidateSkills = useMemo(() => asStringArray(candidate?.skills), [candidate])
  const skillEvidence = useMemo(() => readSkillEvidence(insights?.analysis, skillPriorities), [insights?.analysis, skillPriorities])
  const skillGroups = useMemo(
    () => buildSkillGroups(requiredSkills, candidateSkills, skillEvidence, skillPriorities),
    [candidateSkills, requiredSkills, skillEvidence, skillPriorities],
  )

  // An analysis produced before per-skill adjudication has no verdicts. That is a
  // format gap, not new information — it never triggers a regeneration on its own.
  const needsSkillVerdicts = Boolean(insights?.analysis) && requiredSkills.length > 0 && !skillEvidence
  const isStale = Boolean(insights?.isStale)
  // Generate only when nothing is stored, or when the candidate's inputs actually
  // changed after the stored analysis. Opening the tab alone never spends credits.
  useEffect(() => {
    if (isLoading || hasTriggered.current || jdText.length < 30 || !insights) return
    if (!autoGenerate) return
    if (!insights.analysis || isStale) {
      hasTriggered.current = true
      refreshInsights()
    }
  }, [isLoading, insights?.analysis, isStale, jdText])
  // A suggestion dossier may be produced by the background pass, not by this tab.
  // Poll while it is running so the page flips to the real dossier on its own.
  const suggestionPending = insights?.dossierStatus === 'pending' && !insights?.analysis
  useEffect(() => {
    if (!suggestionPending) return
    const timer = setInterval(() => invalidate(), 6000)
    return () => clearInterval(timer)
  }, [suggestionPending])

  const salaryExpectation = useMemo(
    () => formatSalaryExpectation(candidate as Parameters<typeof formatSalaryExpectation>[0]),
    [candidate],
  )
  const experienceStats = useMemo(() => computeExperienceStats(workExperience, salaryExpectation), [workExperience, salaryExpectation])
  const dossierScorecards = useMemo<DossierScorecard[]>(() => rawScorecards.flatMap((scorecard) => {
    const rating = coerceRating(scorecard.rating)
    const takeawayHtml = normalizeScorecardRichText(scorecard.general_overview)
    const takeawayParagraphs = richTextParagraphs(takeawayHtml)
    if (scorecard.is_ai_draft || !rating || takeawayParagraphs.length === 0) return []
    return [{
      id: scorecard.id,
      interviewerName: scorecard.author_name || scorecard.author_email || 'Interviewer',
      interviewerRole: scorecard.author_title || null,
      submittedAt: scorecard.updated_at || scorecard.created_at,
      stage: scorecard.stage_name || 'Interview',
      rating,
      takeawayHtml,
      takeawayParagraphs,
      areas: (scorecard.criterion_scores || []).flatMap((area) => {
        const areaRating = coerceRating(area.rating)
        return areaRating ? [{ label: area.questionText, rating: areaRating }] : []
      }),
    }]
  }), [rawScorecards])
  const pendingScorecards = useMemo(() => {
    const people = Object.values(scorecardRequirements.byStage).flatMap((stage) => stage.pending)
    return [...new Map(people.map((person) => [person.userId, { userId: person.userId, name: person.name }])).values()]
  }, [scorecardRequirements.byStage])
  // Narration is driven while a request is open; step 5 never completes early.
  const { stepIndex, progress } = useGioFitNarration(isRefreshing || suggestionPending)

  const candidateName = asString(candidate?.candidate_name) || 'Candidate'
  const currentRole = asString(candidate?.role_current) || asString(candidate?.current_job_title)
  const currentCompany = asString(candidate?.company_current)
  const roleLine = [currentRole, currentCompany].filter(Boolean).join(currentRole && currentCompany ? ' at ' : '')
  const location = [candidate?.location_city, candidate?.location_state, candidate?.location_country].map(asString).filter(Boolean).join(', ')
  const appliedLanguage = insights?.appliedOutputLanguage || insights?.resolvedOutputLanguage || 'en'
  const outputLanguageName = getGioFitLanguage(appliedLanguage).name
  const narrationSteps = buildNarrationSteps(outputLanguageName, suggested ? 'suggestion' : 'association')
  const hasStoredAnalysis = Boolean(insights?.analysis) && insights?.score !== null
  // The screen chrome mirrors the wait: dots while cold, previous score while re-scoring.
  const chromeState: 'ready' | 'loading' | 'rescoring' = (isRefreshing || suggestionPending)
    ? (hasStoredAnalysis ? 'rescoring' : 'loading')
    : (isLoading && !hasStoredAnalysis ? 'loading' : 'ready')
  useEffect(() => { onStateChange?.(chromeState) }, [chromeState, onStateChange])
  const waitStrip = (state: 'loading' | 'rescoring' | 'failed') =>
    renderWaitStrip ? <div className="mb-3.5">{renderWaitStrip({ state, generatedAt: insights?.generatedAt ?? null })}</div> : null

  // Under 30 characters of job description there is nothing to assess against, so
  // no call is made. Once the description passes 30 characters the effect above
  // generates on the next visit without being asked.
  if (jdText.length < 30 || isBlocked) {
    return <>{waitStrip('failed')}<GioFitBlockedCard jobId={jobId} onRetry={() => refreshInsights({ force: true })} isRetrying={isRefreshing} /></>
  }
  if (generationError && !hasStoredAnalysis) {
    return <>{waitStrip('failed')}<GioFitErrorCard onRetry={() => refreshInsights({ force: true })} isRetrying={isRefreshing} /></>
  }
  // Nothing stored and nothing running: the caller decides what stands in its place
  // (a suggestion offers the assessment rather than starting it unasked).
  const isGenerating = isRefreshing || insights?.dossierStatus === 'pending'
  if (!isLoading && !hasStoredAnalysis && !isGenerating && renderEmpty) {
    return <>{renderEmpty({ generate: () => { void refreshInsights() }, isGenerating: false })}</>
  }
  // Cold: nothing on file, so show the shape of what is coming plus the narration.
  if (isLoading || !hasStoredAnalysis) {
    return (
      <>
        {waitStrip('loading')}
        <GioFitColdSkeleton
          candidateName={candidateName}
          roleLine={roleLine || null}
          outputLanguageName={outputLanguageName}
          stepIndex={stepIndex}
          progress={progress}
          steps={suggested ? narrationSteps : undefined}
          identity={!suggested}
          eyebrow={suggested ? 'Gio is scoring this suggestion' : undefined}
        />
      </>
    )
  }

  if (!insights?.analysis || insights.score === null) return null
  const analysis = insights.analysis
  const score = insights.score
  const isRescoring = isRefreshing
  const executiveSplit = splitExecutiveSummary(analysis.executive_summary)
  const dimensions = analysis.dimensions || []
  const scoredDimensions = dimensions.filter((dimension) => dimension.score !== null)
  const scoredWeight = scoredDimensions.reduce((sum, dimension) => sum + (Number(dimension.weight) || 0), 0)
  const contributionTotal = scoredDimensions.reduce((sum, dimension) => sum + (Number(dimension.score) * (Number(dimension.weight) || 0) / 100), 0)
  const recomputedScore = scoredWeight > 0 ? contributionTotal * 100 / scoredWeight : null
  const scoreReconciles = recomputedScore !== null && Math.round(recomputedScore) === Math.round(score)
  const nullDimensions = dimensions.filter((dimension) => dimension.score === null)
  const clientReady = viewMode === 'client'
  const visibleDimensions = clientReady
    ? dimensions.filter((dimension) => !/salary|compensation/i.test(dimension.name))
    : dimensions
  const scoring = analysis.scoring ?? null
  const visibleMustHaves = (analysis.must_haves || []).filter((item) => !clientReady || !/salary|compensation|pay|remuneration/i.test(`${item.requirement} ${item.evidence ?? ''}`))
  const visibleValidationPoints = clientReady
    ? (analysis.validation_points || []).filter((point) => !/salary|compensation|pay|remuneration/i.test(`${point.question} ${point.reason}`))
    : (analysis.validation_points || [])
  const handleLanguageApply = async (language: string | null, keepProperNouns: boolean) => {
    setRewriteError(null)
    try {
      await updateLanguagePreferences(language, keepProperNouns)
    } catch (error) {
      setRewriteError(error instanceof Error ? error.message : 'The dossier could not be re-written. Your previous version is unchanged.')
      throw error
    }
  }

  const jobTitle = asString(job?.title)
  const contactItems = [asString(candidate?.email), asString(candidate?.phone), asString(candidate?.linkedin_url)].filter((item): item is string => !!item)
  const preparedBy = asString((job?.organization as { name?: string } | null | undefined)?.name)
  const buildExportData = ({ clientReady: exportClientReady, includeContact, includeEvidence, includeValidation, pageSize }: DossierExportOptions): DossierPrintProps => ({
    analysis,
    score,
    candidateName,
    roleLine: roleLine || null,
    jobTitle,
    location: location || null,
    contactItems,
    requiredSkills,
    skillPriorities,
    candidateSkills,
    workExperience,
    education,
    salaryExpectation,
    scorecards: dossierScorecards,
    outputLanguageName: getGioFitLanguage(appliedLanguage).name,
    clientReady: exportClientReady,
    includeContact,
    includeEvidence,
    includeValidation,
    pageSize,
    preparedBy,
    preparedOn: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  })

  return (
    <TooltipProvider delayDuration={200}>
    {isRescoring && waitStrip('rescoring')}
    {generationError && !isRescoring && waitStrip('failed')}
    <div className="relative">
      {/* Re-scoring: the previous dossier stays mounted and readable underneath. */}
      {isRescoring && (
        <GioFitRescoringBar
          stepLabel={narrationSteps[stepIndex]?.label || 'working'}
          progress={stepProgress(stepIndex, narrationSteps.length)}
          previousGeneratedAt={insights.generatedAt}
          onCancel={cancelRefresh}
          noteForDate={suggested ? (date) => `Showing the dossier scored on ${date} until the new one lands` : undefined}
        />
      )}
      {generationError && !isRescoring && (
        <div className="mb-3.5"><GioFitErrorCard onRetry={() => refreshInsights({ force: true })} isRetrying={isRefreshing} /></div>
      )}
      <div key={insights.generatedAt || 'dossier'} className={cn('space-y-3.5', isRescoring ? 'gf-rescore-dim' : 'gf-fade-in')}>
      <section className={cn(cardClass, 'p-[22px]')}>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-virgilio-purple">
              <Sparkles className="h-3 w-3" /> Gio dossier · prepared for {asString(job?.title)}
            </p>
            {!suggested && (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="font-poppins text-[26px] font-semibold leading-[1.1] tracking-[-0.04em] text-fit-ink">
                    {asString(candidate?.candidate_name)}<span className="text-fit-lilac">.</span>
                  </h2>
                  {candidate?.linkedin_url ? (
                    <button
                      type="button"
                      onClick={() => window.open(ensureAbsoluteUrl(String(candidate.linkedin_url)), '_blank', 'noopener,noreferrer')}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[#8B8F9E] transition-colors hover:bg-[#F1F0EC] hover:text-[#5A6072]"
                      aria-label="Open LinkedIn profile"
                    >
                      <LinkedInFilled className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {roleLine && <p className="mt-1.5 text-[13.5px] font-medium text-fit-ink">{roleLine}</p>}
              </>
            )}
            {location && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fit-muted"><MapPin className="h-3 w-3 text-fit-subtle" />{location}</p>}
            {suggested && (
              <div className="mt-3">
                <p className="flex flex-wrap items-center gap-1.5 font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-fit-subtle">
                  Why Gio suggested them
                  <span className="text-fit-null">·</span>
                  <span className="normal-case tracking-normal font-medium">{suggested.statusText}</span>
                </p>
                {(suggested.chips?.length || suggested.overflow) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(suggested.chips || []).map((chip) => (
                      <span key={chip} className="inline-flex h-[22px] items-center rounded-[7px] border border-fit-skill-evidenced-border bg-fit-skill-evidenced-bg px-2 font-inter text-[11.5px] text-fit-skill-evidenced-text">{chip}</span>
                    ))}
                    {!!suggested.overflow && suggested.overflow > 0 && (
                      <span className="inline-flex h-[22px] items-center rounded-[7px] border border-fit-row-border bg-fit-paper px-2 font-inter text-[11.5px] text-fit-subtle">+{suggested.overflow} more</span>
                    )}
                  </div>
                )}
                {suggested.note && (
                  <p className="mt-2 flex items-center gap-1.5 font-inter text-[11px] text-fit-subtle">
                    <StickyNote className="h-[11px] w-[11px] text-fit-null" />
                    <span className="min-w-0 truncate">{suggested.note}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-fit-subtle">Gio fit</p>
            <div className="mt-1 flex items-end justify-end gap-3">
              <p className="font-poppins text-[44px] font-semibold leading-none tracking-[-0.04em] text-virgilio-purple">{Math.round(score)}</p>
              <div className="pb-[3px] text-left">
                <p className="font-poppins text-[13px] font-semibold text-fit-ink">{getScoreBand(score)} fit</p>
                <p className="mt-0.5 text-[11px] capitalize text-fit-subtle">{analysis.confidence} confidence</p>
              </div>
            </div>
            {!clientReady && scoreHistory.length > 1 && <ScoreTrajectory points={scoreHistory} />}
          </div>
        </div>
        <div className="mt-[18px] flex flex-wrap items-center gap-2.5 overflow-visible border-t border-fit-hairline pt-4">
          {!suggested && <div className="flex shrink-0 rounded-lg bg-fit-chip p-[3px]" role="group" aria-label="Dossier view">
            {(['internal', 'client'] as const).map((mode) => (
              <Button key={mode} type="button" variant="ghost" size="xs" aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)} className={cn('h-[26px] rounded-md px-3 text-[12px]', viewMode === mode ? 'border border-fit-row-border bg-surface-primary font-semibold text-fit-ink shadow-[0_1px_2px_rgba(13,13,9,0.08)] hover:bg-surface-primary' : 'font-medium text-fit-subtle')}>
                {mode === 'internal' ? 'Internal' : 'Client-ready'}
              </Button>
            ))}
          </div>}
          {!suggested && (
            <p className="min-w-0 flex-1 truncate text-[11.5px] text-fit-subtle">
              {clientReady ? 'Scoring mechanics and salary are hidden. This is what the client sees.' : 'Full view with weights, nulls, and validation priorities.'}
            </p>
          )}
          {suggested && <span className="min-w-0 flex-1" />}
          <div className="flex shrink-0 items-center gap-2">
            {needsSkillVerdicts && !isRefreshing && (
              <span className="text-[11.5px] text-fit-subtle">Refresh to update the skill read</span>
            )}
            <GioFitLanguageControl analysis={analysis} workspaceLanguage={insights.workspaceOutputLanguage} overrideLanguage={insights.outputLanguage} resolvedLanguage={insights.resolvedOutputLanguage} appliedLanguage={insights.appliedOutputLanguage} keepProperNouns={insights.keepProperNouns} isRewriting={isRefreshing} onApply={handleLanguageApply} />
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={() => refreshInsights({ force: true })}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={() => setExportOpen(true)}>Export PDF</Button>
            {suggested ? suggested.actions : (
            /* Share is the terminal action of this row, and the only primary. */
            <div ref={shareWrapperRef} className="relative shrink-0">
              <Button ref={shareButtonRef} variant="primary" size="sm" icon={Share2} onClick={() => setShareOpen((open) => !open)}>Share with client</Button>
              <ShareDossierMenu
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                share={share}
                isLoading={shareLoading}
                error={shareError}
                isRejected={Boolean(insights.isRejected)}
                rejectedAt={insights.rejectedAt}
                canPublish={canEditCandidates}
                candidateFirstName={candidateName.split(' ')[0] || candidateName}
                internalUrl={`${window.location.origin}/jobs/${jobId}/candidates/${candidateId}?tab=fit`}
                onTogglePublic={(next) => void setSharePublic(next)}
                wrapperRef={shareWrapperRef}
                triggerRef={shareButtonRef}
                jobId={jobId}
                candidateId={candidateId}
              />
            </div>
            )}
          </div>
        </div>
      </section>
      {rewriteError && <p role="alert" className="rounded-lg border border-fit-risk-border bg-fit-warning-soft px-3 py-2 text-[12px] text-fit-risk-copy">{rewriteError}</p>}

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className={cardClass}>
          {(asString(analysis.profile_summary) || asString(candidate?.profile_summary) || analysis.executive_summary || experienceStats.length > 0) && (
            <div className="p-5 sm:p-6">
              <h3 className={sectionHeadingClass}><UserRound className="h-3 w-3" /> Summary</h3>
              <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-7">
                <div className="min-w-0">
                  {(asString(analysis.profile_summary) || asString(candidate?.profile_summary)) && <p className="whitespace-pre-line text-[13.5px] leading-[1.65] text-fit-ink">{asString(analysis.profile_summary) || asString(candidate?.profile_summary)}</p>}
                  <div className="mt-4">
                    {executiveSplit ? (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="rounded-lg border border-fit-match-border bg-fit-match-panel p-3"><p className="text-[10.5px] font-semibold uppercase text-fit-match-dark">Strongest signal</p><p className="mt-1.5 text-[12px] leading-[1.55] text-fit-match-copy">{executiveSplit.strongest}</p></div>
                        {!clientReady && <div className="rounded-lg border border-fit-risk-border bg-fit-risk-panel p-3"><p className="text-[10.5px] font-semibold uppercase text-fit-risk-label">Biggest risk</p><p className="mt-1.5 text-[12px] leading-[1.55] text-fit-risk-copy">{executiveSplit.risk}</p></div>}
                      </div>
                    ) : (
                      <p className="text-[12.5px] leading-[1.6] text-fit-muted">{analysis.executive_summary}</p>
                    )}
                    {!clientReady && analysis.changes_since_last && (
                      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-fit-subtle">
                        <RefreshCw className="mt-[3px] h-[11px] w-[11px] shrink-0" />
                        <span><span className="font-medium text-fit-muted">Since the last assessment{typeof scoring?.previous_score === 'number' ? ` (${scoring.previous_score})` : ''}:</span> {analysis.changes_since_last}</span>
                      </p>
                    )}
                  </div>
                </div>
                {(experienceStats.length > 0 || analysis.detected_languages) && (
                  <div className="divide-y divide-fit-chip">
                    <GioFitLanguageProvenance analysis={analysis} outputLanguage={insights.appliedOutputLanguage || insights.resolvedOutputLanguage} />
                    {experienceStats.map((stat) => <div key={stat.label} className="py-3 first:pt-0 last:pb-0"><p className="font-poppins text-[20px] font-semibold text-fit-ink">{stat.value}</p><p className="text-[12px] font-medium text-fit-ink">{stat.label}</p>{stat.footnote && <p className="mt-0.5 text-[11px] text-fit-subtle">{stat.footnote}</p>}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {visibleMustHaves.length > 0 && <MustHaves items={visibleMustHaves} />}

          {(skillGroups.evidenced.length > 0 || skillGroups.partly.length > 0 || skillGroups.notEvidenced.length > 0 || skillGroups.additional.length > 0) && (
            <div className="border-t border-fit-hairline p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionHeadingClass}><Sparkles className="h-3 w-3" /> Identified skills</h3>
                {requiredSkills.length > 0 && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fit-subtle">
                    <SkillPriorityLegend />
                    <span>
                      {skillGroups.hasVerdicts
                        ? `${skillGroups.evidenced.length} evidenced · ${skillGroups.partly.length} partly · ${skillGroups.notEvidenced.length} not evidenced`
                        : `${skillGroups.evidenced.length} of ${requiredSkills.length} job skills evidenced`}
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Evidenced', items: skillGroups.evidenced, Icon: Check },
                  { label: 'Partly evidenced', items: skillGroups.partly, Icon: CircleDashed },
                  { label: 'Not evidenced', items: skillGroups.notEvidenced, Icon: Minus },
                ].filter((group) => group.items.length > 0).map((group) => (
                  <div key={group.label} className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-3">
                    <p className="pt-1 text-[11.5px] font-medium text-fit-muted">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sortByPriority(group.items, (entry) => entry.priority).map((entry) => {
                        // Colour is the job's priority; the icon and row are the verdict.
                        const chip = (
                          <span className={cn('inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[11px] font-medium', SKILL_PRIORITY[entry.priority].pill, entry.status === 'not_evidenced' && 'opacity-80 ring-1 ring-inset ring-fit-risk-border')}>
                            {group.Icon && <group.Icon className="h-3 w-3" />}{entry.skill}
                          </span>
                        )
                        return (
                          <Tooltip key={`${group.label}-${entry.skill}`}>
                            <TooltipTrigger asChild><span className={entry.evidence ? 'cursor-help' : undefined}>{chip}</span></TooltipTrigger>
                            <TooltipContent className="max-w-[280px]">
                              <p className="text-[10.5px] font-semibold uppercase tracking-wide opacity-70">{SKILL_PRIORITY[entry.priority].label} · {group.label.toLowerCase()}</p>
                              {entry.evidence && <p className="mt-1 text-[11.5px] leading-relaxed">“{entry.evidence}”</p>}
                              {entry.source && <p className="mt-1 text-[10.5px] opacity-70">{entry.source}</p>}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {skillGroups.additional.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-3">
                    <p className="pt-1 text-[11.5px] font-medium text-fit-muted">Additional — beyond the job spec</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillGroups.additional.map((skill) => (
                        <span key={`additional-${skill}`} className="inline-flex items-center rounded-md border border-fit-row-border bg-fit-paper px-2 py-1 text-[11px] font-medium text-fit-muted">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showScorecards && <InterviewScorecardsSection scorecards={dossierScorecards} pending={pendingScorecards} clientReady={clientReady} />}

          {workExperience.length > 0 && (
            <div className="border-t border-fit-hairline p-5 sm:p-6">
              <h3 className={sectionHeadingClass}><BriefcaseBusiness className="h-3 w-3" /> Experience</h3>
              <div className="mt-3"><DossierExperienceGroups items={workExperience} /></div>
            </div>
          )}

          {education.length > 0 && (
            <div className="border-t border-fit-hairline p-5 sm:p-6">
              <h3 className={sectionHeadingClass}><GraduationCap className="h-3 w-3" /> Education</h3>
              <div className="mt-4 divide-y divide-fit-chip">
                {education.map((item) => {
                  const year = item.end_date ? new Date(item.end_date).getFullYear() : item.start_date ? new Date(item.start_date).getFullYear() : null
                  return <div key={item.id} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5">{year && <p className="text-[12.5px] font-semibold text-fit-ink">{year}</p>}<p className="font-poppins text-[13px] font-semibold text-fit-ink">{item.degree_type || item.field_of_study || 'Education'}{item.institution_name && <span className="font-medium text-fit-subtle"> · {item.institution_name}</span>}</p></div>
                })}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-3.5">
          <section className={cardClass}>
            <div className="border-b border-fit-hairline px-4 py-4">
              <h3 className={sectionHeadingClass}><BarChart3 className="h-3 w-3" /> Dimension breakdown</h3>
              <p className="mt-2 text-[12px] leading-[1.5] text-fit-muted">{clientReady ? 'Open a row for the evidence behind this assessment.' : `${dimensions.length} dimensions, weighted for this role. Open a row for its matches and gaps.`}</p>
            </div>
            <div>{visibleDimensions.map((dimension) => {
              const payloadIndex = dimensions.indexOf(dimension)
              return <DimensionRow key={`${dimension.name}-${payloadIndex}`} dimension={dimension} colorIndex={payloadIndex} clientReady={clientReady} open={openDimension === payloadIndex} onToggle={() => setOpenDimension(openDimension === payloadIndex ? null : payloadIndex)} />
            })}</div>
            {!clientReady && scoring && <div className="bg-fit-paper px-4 py-3.5">
              {/* v4: the score is Gio's judgement of the whole case, held inside stated rules; the mean is context, not the answer. */}
              <div className="flex items-center gap-3"><span className="min-w-0 flex-1 text-[11.5px] font-medium text-fit-ink">Dimension mean</span><span className="text-[11.5px] tabular-nums text-fit-subtle">{contributionTotal.toFixed(1)} / {scoredWeight}</span><span className="w-8 text-right font-poppins text-[13px] font-semibold tabular-nums text-fit-muted">{scoring.weighted_mean == null ? '—' : Math.round(scoring.weighted_mean)}</span></div>
              <div className="mt-1.5 flex items-center gap-3"><span className="min-w-0 flex-1 text-[11.5px] font-medium text-fit-ink">Gio's judgement of the whole case</span><span className="w-8 text-right font-poppins text-[13px] font-semibold tabular-nums text-fit-muted">{scoring.model_score}</span></div>
              {scoring.rules_applied.map((rule) => (
                <p key={rule} className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-[1.45] text-fit-warning"><Minus className="mt-[3px] h-[10px] w-[10px] shrink-0" />{rule}</p>
              ))}
              <div className="mt-2 flex items-center gap-3 border-t border-fit-chip pt-2"><span className="min-w-0 flex-1 text-[11.5px] font-semibold text-fit-ink">Gio fit</span><span className="w-8 text-right font-poppins text-[15px] font-semibold tabular-nums text-virgilio-purple">{Math.round(score)}</span></div>
              {nullDimensions.length > 0 && <p className="mt-2 text-[11px] leading-[1.45] text-fit-subtle">{nullDimensions.map((dimension) => `${dimension.name} is nulled — its ${dimension.weight} points are excluded rather than guessed.`).join(' ')}</p>}
            </div>}
            {!clientReady && !scoring && <div className="bg-fit-paper px-4 py-3.5">
              <div className="flex items-center gap-3"><span className="min-w-0 flex-1 text-[11.5px] font-medium text-fit-ink">Weighted mean of scored dimensions</span><span className="text-[11.5px] tabular-nums text-fit-subtle">{contributionTotal.toFixed(1)} / {scoredWeight}</span><span className="font-poppins text-[15px] font-semibold tabular-nums text-virgilio-purple">{Math.round(score)}</span></div>
              {!scoreReconciles && (
                <p className="mt-2 rounded-md border border-fit-risk-border bg-fit-warning-soft px-2 py-1.5 text-[11px] leading-[1.45] text-fit-warning">
                  {recomputedScore === null
                    ? `The stored Gio Fit score is ${Math.round(score)}, but no scored dimension weights are available to verify it.`
                    : `The stored Gio Fit score is ${Math.round(score)}, while the scored dimensions calculate to ${recomputedScore.toFixed(1)}.`}
                </p>
              )}
              {(nullDimensions.length > 0 || score > 80) && <p className="mt-2 text-[11px] leading-[1.45] text-fit-subtle">{[...nullDimensions.map((dimension) => `${dimension.name} is nulled — its ${dimension.weight} points are excluded rather than guessed.`), ...(score > 80 ? ['Scores above 80 require no unresolved must-have gaps.'] : [])].join(' ')}</p>}
            </div>}
          </section>
          <ValidationPoints points={visibleValidationPoints} clientReady={clientReady} />
        </aside>
      </div>

      </div>

      <GioFitExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaultClientReady={clientReady}
        hasContactDetails={contactItems.length > 0}
        candidateName={candidateName}
        jobTitle={jobTitle || null}
        outputLanguageName={outputLanguageName}
        buildData={buildExportData}
      />
    </div>
    </TooltipProvider>
  )
}