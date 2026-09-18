import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  GraduationCap,
  Loader2,
  MapPin,
  Minus,
  RefreshCw,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { NoJobDescriptionCard } from './NoJobDescriptionCard'
import { useCandidateFitInsights, type FitDimension, type ValidationPoint } from '@/hooks/useCandidateFitInsights'
import { cn } from '@/lib/utils'

interface CandidateInsightsTabProps {
  candidateId: string
  jobId: string
  jobDescription?: string | null
  job?: Record<string, unknown> | null
  candidate?: Record<string, unknown> | null
  workExperience: CandidateWorkExperience[]
  education: CandidateEducation[]
  onExportPdf: () => void
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

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter((item): item is string => !!item)
}

function stripHtml(value?: string | null) {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatDuration(startValue?: string, endValue?: string) {
  if (!startValue) return null
  const start = new Date(startValue)
  const end = endValue ? new Date(endValue) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / 2_629_746_000))
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (!years) return `${months} mo`
  return `${years} yr${years === 1 ? '' : 's'}${remainder ? ` ${remainder} mo` : ''}`
}

function normalizeSkill(value: string) {
  let normalized = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
  normalized = normalized
    .split(' ')
    .map((word) => {
      if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
      if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2)
      if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1)
      return word
    })
    .join(' ')
  return normalized
}

function getScoreBand(score: number) {
  if (score >= 90) return 'Exceptional'
  if (score >= 75) return 'Strong'
  if (score >= 60) return 'Mixed'
  if (score >= 40) return 'Weak'
  return 'Poor'
}

function splitExecutiveSummary(summary: string) {
  const match = summary.match(/strongest signal\s*[:—-]\s*([\s\S]+?)\s+biggest risk\s*[:—-]\s*([\s\S]+)/i)
  if (!match) return null
  const strongest = match[1]?.trim()
  const risk = match[2]?.trim()
  return strongest && risk ? { strongest, risk } : null
}

function computeExperienceStats(experience: CandidateWorkExperience[]) {
  const validRows = experience
    .map((entry) => {
      const start = entry.start_date ? new Date(entry.start_date) : null
      const end = entry.end_date ? new Date(entry.end_date) : new Date()
      if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
      return { entry, start, end }
    })
    .filter((row): row is { entry: CandidateWorkExperience; start: Date; end: Date } => !!row)

  const totalMonths = validRows.reduce((sum, row) => sum + Math.max(1, Math.round((row.end.getTime() - row.start.getTime()) / 2_629_746_000)), 0)
  const seniorPattern = /\b(senior|sr\.?|lead|head|director|vp|vice president|chief|principal|manager)\b/i
  const seniorMonths = validRows
    .filter(({ entry }) => seniorPattern.test(`${entry.job_title} ${entry.standardized_title || ''}`))
    .reduce((sum, row) => sum + Math.max(1, Math.round((row.end.getTime() - row.start.getTime()) / 2_629_746_000)), 0)
  const companies = new Set(experience.map((entry) => entry.company_name?.trim().toLocaleLowerCase()).filter(Boolean)).size
  const teamSizes = experience.flatMap((entry) => {
    const description = stripHtml(entry.description)
    const matches = [...description.matchAll(/(?:team(?: of)?|managed|led|supervised)\s+(?:a\s+)?(?:team\s+of\s+)?(\d{1,4})\b/gi)]
    return matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0)
  })

  return [
    ...(totalMonths > 0 ? [{ value: `${(totalMonths / 12).toFixed(totalMonths % 12 ? 1 : 0)} yrs`, label: 'Total experience' }] : []),
    ...(seniorMonths > 0 ? [{ value: `${(seniorMonths / 12).toFixed(seniorMonths % 12 ? 1 : 0)} yrs`, label: 'Senior or above', footnote: 'Based on role titles' }] : []),
    ...(companies > 0 ? [{ value: String(companies), label: 'Companies' }] : []),
    ...(teamSizes.length ? [{ value: String(Math.max(...teamSizes)), label: 'Largest team led', footnote: 'Explicitly stated in experience' }] : []),
  ]
}

function ExperienceRow({ entry }: { entry: CandidateWorkExperience }) {
  const [expanded, setExpanded] = useState(false)
  const description = stripHtml(entry.description)
  const start = formatDate(entry.start_date)
  const end = entry.is_current ? 'Present' : formatDate(entry.end_date)
  const dates = [start, end].filter(Boolean).join(' – ')
  const duration = formatDuration(entry.start_date, entry.is_current ? undefined : entry.end_date)
  const canExpand = description.length > 230

  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5">
      <div>
        {(dates || duration) && <p className="font-inter text-[12.5px] font-semibold text-fit-ink">{[dates, duration].filter(Boolean).join(' · ')}</p>}
        {entry.location && <p className="mt-1 text-[11.5px] text-fit-subtle">{entry.location}</p>}
      </div>
      <div className="min-w-0">
        <p className="font-poppins text-[14.5px] font-semibold text-fit-ink">
          {entry.job_title}
          {entry.company_name && <span className="font-medium text-fit-subtle"> · {entry.company_name}</span>}
        </p>
        {description && (
          <div className="mt-2">
            <p className={cn('text-[12.5px] leading-[1.6] text-fit-muted', !expanded && canExpand && 'line-clamp-3')}>{description}</p>
            {canExpand && (
              <Button variant="link" size="xs" className="mt-1 h-auto px-0" onClick={() => setExpanded((value) => !value)}>
                {expanded ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

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

export function CandidateInsightsTab({ candidateId, jobId, jobDescription, job, candidate, workExperience, education, onExportPdf }: CandidateInsightsTabProps) {
  const { insights, isLoading, isRefreshing, refreshInsights } = useCandidateFitInsights(candidateId, jobId)
  const [openDimension, setOpenDimension] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'internal' | 'client'>('internal')
  const hasTriggered = useRef(false)
  const jdText = stripHtml(jobDescription)

  useEffect(() => {
    if (!isLoading && !insights?.analysis && !hasTriggered.current && jdText.length >= 30) {
      hasTriggered.current = true
      refreshInsights()
    }
  }, [isLoading, insights?.analysis, jdText])

  const requiredSkills = useMemo(() => {
    const mustHave = asStringArray(job?.must_have_skills)
    return mustHave.length ? mustHave : asStringArray(job?.skills)
  }, [job])
  const candidateSkills = useMemo(() => asStringArray(candidate?.skills), [candidate])
  const skillGroups = useMemo(() => {
    const candidateMap = new Map(candidateSkills.map((skill) => [normalizeSkill(skill), skill]))
    const requiredMap = new Map(requiredSkills.map((skill) => [normalizeSkill(skill), skill]))
    const evidenced = requiredSkills.filter((skill) => candidateMap.has(normalizeSkill(skill)))
    const notEvidenced = requiredSkills.filter((skill) => !candidateMap.has(normalizeSkill(skill)))
    const additional = candidateSkills.filter((skill) => !requiredMap.has(normalizeSkill(skill)))
    return { evidenced, notEvidenced, additional }
  }, [candidateSkills, requiredSkills])
  const experienceStats = useMemo(() => computeExperienceStats(workExperience), [workExperience])

  if (jdText.length < 30) return <NoJobDescriptionCard jobId={jobId} />
  if (isLoading || (isRefreshing && !insights?.analysis)) {
    return (
      <div className={cn(cardClass, 'flex min-h-[280px] flex-col items-center justify-center gap-3')}>
        <Loader2 className="h-7 w-7 animate-spin text-virgilio-purple" />
        <p className="font-poppins text-[13px] font-medium text-fit-muted">Preparing the Gio dossier…</p>
      </div>
    )
  }
  if (!insights?.analysis || insights.score === null) {
    return (
      <div className={cn(cardClass, 'flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center')}>
        <Sparkles className="h-6 w-6 text-virgilio-purple" />
        <div>
          <p className="font-poppins text-[14px] font-semibold text-fit-ink">No Gio Fit analysis yet</p>
          <p className="mt-1 text-[12px] text-fit-muted">Generate the dossier from the candidate and job information already on file.</p>
        </div>
        <Button variant="purple" size="md" icon={Sparkles} loading={isRefreshing} onClick={refreshInsights}>Generate insights</Button>
      </div>
    )
  }

  const { analysis } = insights
  const score = insights.score
  const currentRole = asString(candidate?.role_current) || asString(candidate?.current_job_title)
  const currentCompany = asString(candidate?.company_current)
  const roleLine = [currentRole, currentCompany].filter(Boolean).join(currentRole && currentCompany ? ' at ' : '')
  const location = [candidate?.location_city, candidate?.location_state, candidate?.location_country].map(asString).filter(Boolean).join(', ')
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
  const visibleValidationPoints = clientReady
    ? (analysis.validation_points || []).filter((point) => !/salary|compensation|pay|remuneration/i.test(`${point.question} ${point.reason}`))
    : (analysis.validation_points || [])

  return (
    <div className="space-y-3.5">
      <section className={cn(cardClass, 'p-[22px]')}>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-virgilio-purple">
              <Sparkles className="h-3 w-3" /> Gio dossier · prepared for {asString(job?.title)}
            </p>
            <h2 className="font-poppins text-[26px] font-semibold leading-[1.1] tracking-[-0.04em] text-fit-ink">
              {asString(candidate?.candidate_name)}<span className="text-fit-lilac">.</span>
            </h2>
            {roleLine && <p className="mt-1.5 text-[13.5px] font-medium text-fit-ink">{roleLine}</p>}
            {location && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fit-muted"><MapPin className="h-3 w-3 text-fit-subtle" />{location}</p>}
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
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {analysis.data_sources_used.map((source) => (
            <span key={`used-${source}`} className="inline-flex items-center gap-1 rounded-md bg-fit-chip px-2 py-[3px] text-[11px] font-medium text-fit-muted"><Check className="h-3 w-3" />{source.replace(/_/g, ' ')}</span>
          ))}
          {analysis.data_sources_missing.map((source) => (
            <span key={`missing-${source}`} className="inline-flex items-center gap-1 rounded-md bg-fit-warning-soft px-2 py-[3px] text-[11px] font-medium text-fit-warning"><Minus className="h-3 w-3" />{source.replace(/_/g, ' ')}</span>
          ))}
          <p className="ml-auto shrink-0 text-[11.5px] text-fit-subtle">v{insights.version}{insights.generatedAt ? ` · updated ${formatDistanceToNow(new Date(insights.generatedAt), { addSuffix: true })}` : ''}</p>
        </div>
        <div className="mt-[18px] flex flex-nowrap items-center gap-2.5 border-t border-fit-hairline pt-4">
          <div className="flex shrink-0 rounded-lg bg-fit-chip p-[3px]" role="group" aria-label="Dossier view">
            {(['internal', 'client'] as const).map((mode) => (
              <Button key={mode} type="button" variant="ghost" size="xs" onClick={() => setViewMode(mode)} className={cn('h-[26px] rounded-md px-3 text-[12px]', viewMode === mode ? 'border border-fit-row-border bg-surface-primary font-semibold text-fit-ink shadow-[0_1px_2px_rgba(13,13,9,0.08)] hover:bg-surface-primary' : 'font-medium text-fit-subtle')}>
                {mode === 'internal' ? 'Internal' : 'Client-ready'}
              </Button>
            ))}
          </div>
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-fit-subtle">
            {clientReady ? 'Scoring mechanics and salary are hidden. This is what the client sees.' : 'Full view with weights, nulls, and validation priorities.'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={isRefreshing} onClick={refreshInsights}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={onExportPdf}>Export PDF</Button>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className={cardClass}>
          {(asString(candidate?.profile_summary) || analysis.executive_summary || experienceStats.length > 0) && (
            <div className="p-5 sm:p-6">
              <h3 className={sectionHeadingClass}><UserRound className="h-3 w-3" /> Summary</h3>
              <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-7">
                <div className="min-w-0">
                  {asString(candidate?.profile_summary) && <p className="whitespace-pre-line text-[13.5px] leading-[1.65] text-fit-ink">{asString(candidate?.profile_summary)}</p>}
                  <div className="mt-4">
                    {executiveSplit ? (
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="rounded-lg border border-fit-match-border bg-fit-match-panel p-3"><p className="text-[10.5px] font-semibold uppercase text-fit-match-dark">Strongest signal</p><p className="mt-1.5 text-[12px] leading-[1.55] text-fit-match-copy">{executiveSplit.strongest}</p></div>
                        <div className="rounded-lg border border-fit-risk-border bg-fit-risk-panel p-3"><p className="text-[10.5px] font-semibold uppercase text-fit-risk-label">Biggest risk</p><p className="mt-1.5 text-[12px] leading-[1.55] text-fit-risk-copy">{executiveSplit.risk}</p></div>
                      </div>
                    ) : (
                      <p className="text-[12.5px] leading-[1.6] text-fit-muted">{analysis.executive_summary}</p>
                    )}
                  </div>
                </div>
                {experienceStats.length > 0 && (
                  <div className="divide-y divide-fit-chip">
                    {experienceStats.map((stat) => <div key={stat.label} className="py-3 first:pt-0 last:pb-0"><p className="font-poppins text-[20px] font-semibold text-fit-ink">{stat.value}</p><p className="text-[12px] font-medium text-fit-ink">{stat.label}</p>{stat.footnote && <p className="mt-0.5 text-[11px] text-fit-subtle">{stat.footnote}</p>}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {(skillGroups.evidenced.length > 0 || skillGroups.notEvidenced.length > 0 || skillGroups.additional.length > 0) && (
            <div className="border-t border-fit-hairline p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionHeadingClass}><Sparkles className="h-3 w-3" /> Identified skills</h3>
                {requiredSkills.length > 0 && <span className="text-[11.5px] text-fit-subtle">{skillGroups.evidenced.length} of {requiredSkills.length} required skills evidenced</span>}
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Required and evidenced', items: skillGroups.evidenced, className: 'border-fit-skill-evidenced-border bg-fit-skill-evidenced-bg text-fit-skill-evidenced-text', Icon: Check },
                  { label: 'Required, not evidenced', items: skillGroups.notEvidenced, className: 'border-fit-risk-border bg-fit-warning-soft text-fit-risk-copy', Icon: Minus },
                  { label: 'Additional — beyond the job spec', items: skillGroups.additional, className: 'border-fit-row-border bg-fit-paper text-fit-muted', Icon: null },
                ].filter((group) => group.items.length > 0).map((group) => (
                  <div key={group.label} className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-3">
                    <p className="pt-1 text-[11.5px] font-medium text-fit-muted">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((skill) => <span key={`${group.label}-${skill}`} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium', group.className)}>{group.Icon && <group.Icon className="h-3 w-3" />}{skill}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workExperience.length > 0 && (
            <div className="border-t border-fit-hairline p-5 sm:p-6">
              <h3 className={sectionHeadingClass}><BriefcaseBusiness className="h-3 w-3" /> Experience</h3>
              <div className="mt-4 divide-y divide-fit-chip">{workExperience.map((entry) => <ExperienceRow key={entry.id} entry={entry} />)}</div>
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
              <p className="mt-2 text-[12px] leading-[1.5] text-fit-muted">Seven dimensions, weighted for this role. Open a row for its matches and gaps.</p>
            </div>
            <div>{visibleDimensions.map((dimension) => {
              const payloadIndex = dimensions.indexOf(dimension)
              return <DimensionRow key={`${dimension.name}-${payloadIndex}`} dimension={dimension} colorIndex={payloadIndex} clientReady={clientReady} open={openDimension === payloadIndex} onToggle={() => setOpenDimension(openDimension === payloadIndex ? null : payloadIndex)} />
            })}</div>
            {!clientReady && <div className="bg-fit-paper px-4 py-3.5">
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
  )
}