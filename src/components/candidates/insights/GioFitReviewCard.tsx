import { useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUpRight, RefreshCw, ShieldCheck, Sparkles, CheckCircle2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCandidateFitInsights, type ValidationPoint } from '@/hooks/useCandidateFitInsights'
import { cn } from '@/lib/utils'
import { getScoreBand, splitExecutiveSummary } from './dossier/dossierData'
import './loading/gioFitLoading.css'
import { FIT_DIMENSION_COLORS, MUST_HAVE_STYLE, fitCardClass, fitSectionHeadingClass } from './fitParts'

/**
 * Gio Fit, condensed (2026-11-07): the application review's read of the profile's
 * Gio Fit tab, in the same parts. The score and its band, the strongest signal and
 * the biggest risk, the job's must-haves, the dimensions as bars and the first
 * questions still to settle; everything else is one click away in the full tab.
 */
/** First letter up: "high confidence" → "High confidence". */
const sentence = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)

const PRIORITY_RANK: Record<ValidationPoint['priority'], number> = { high: 0, medium: 1, low: 2 }

export function GioFitReviewCard({ candidateId, jobId }: { candidateId: string; jobId: string }) {
  const { insights, isLoading, isRefreshing, isBlocked, generationError, refreshInsights } = useCandidateFitInsights(candidateId, jobId)
  const analysis = insights?.analysis ?? null

  // Generate only when nothing is stored at all, once per candidate, never on reopen.
  const triggered = useRef<string | null>(null)
  useEffect(() => {
    if (isLoading || isRefreshing || isBlocked || triggered.current === candidateId) return
    if (insights && !insights.analysis) {
      triggered.current = candidateId
      void refreshInsights()
    }
  }, [isLoading, isRefreshing, isBlocked, insights, candidateId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openFull = () => window.open(`/jobs/${jobId}/candidates/${candidateId}?tab=fit`, '_blank', 'noopener')

  const header = (
    <div className="flex items-center gap-2">
      <h3 className={cn(fitSectionHeadingClass, 'flex-1 text-virgilio-purple')}><Sparkles className="h-3 w-3" /> Gio Fit</h3>
      {analysis && (
        <IconTip label="Score again">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Score again" onClick={() => void refreshInsights({ force: true })} disabled={isRefreshing}>
            {isRefreshing ? <span className="gio-spinner gio-spinner-current h-3.5 w-3.5" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </IconTip>
      )}
      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[12px] text-fit-muted" onClick={openFull}>
        Open full Gio Fit <ArrowUpRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )

  if (isBlocked) {
    return (
      <section className={cn(fitCardClass, 'p-4')}>
        {header}
        <p className="mt-3 text-[12.5px] leading-[1.5] text-fit-muted">This job needs a description before Gio can score. Once one is added, every candidate is scored automatically.</p>
      </section>
    )
  }

  if (!analysis || insights?.score == null) {
    if (generationError && !isRefreshing) {
      return (
        <section className={cn(fitCardClass, 'p-4')}>
          {header}
          <p className="mt-3 text-[12.5px] leading-[1.5] text-fit-muted">Gio couldn't finish scoring this candidate. Nothing was saved.</p>
          <Button variant="secondary" size="sm" className="mt-3" icon={RefreshCw} onClick={() => void refreshInsights({ force: true })}>Try again</Button>
        </section>
      )
    }
    return <GioFitReviewSkeleton header={header} scoring={!isLoading} />
  }

  const score = Math.round(insights.score)
  const split = splitExecutiveSummary(analysis.executive_summary || '')
  const mustHaves = analysis.must_haves || []
  const dimensions = analysis.dimensions || []
  const questions = [...(analysis.validation_points || [])]
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3))
    .slice(0, 3)

  return (
    <section className={cn(fitCardClass, 'p-4', isRefreshing && 'gf-rescore-dim')} aria-busy={isRefreshing || undefined}>
      {header}

      <div className="mt-3 flex items-end gap-3">
        <p className="font-poppins text-[36px] font-semibold leading-none tracking-[-0.04em] text-virgilio-purple tabular-nums">{score}</p>
        <div className="min-w-0 pb-[2px]">
          <p className="font-poppins text-[13px] font-semibold text-fit-ink">{getScoreBand(score)} fit</p>
          <p className="mt-0.5 truncate text-[11px] text-fit-subtle">
            <Tooltip>
              <TooltipTrigger asChild><span className="cursor-help">{sentence(`${analysis.confidence} confidence`)}</span></TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px]"><p className="text-[11.5px]">{analysis.confidence_reason}</p></TooltipContent>
            </Tooltip>
            {insights.generatedAt && <> · {isRefreshing ? 'Scoring again…' : `Scored ${formatDistanceToNow(new Date(insights.generatedAt), { addSuffix: true })}`}</>}
          </p>
        </div>
      </div>

      {split ? (
        <div className="mt-3 grid gap-2">
          <div className="rounded-lg border border-fit-match-border bg-fit-match-panel px-3 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase text-fit-match-dark">Strongest signal</p>
            <p className="mt-1 text-[12px] leading-[1.5] text-fit-match-copy">{sentence(split.strongest)}</p>
          </div>
          <div className="rounded-lg border border-fit-risk-border bg-fit-risk-panel px-3 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase text-fit-risk-label">Biggest risk</p>
            <p className="mt-1 text-[12px] leading-[1.5] text-fit-risk-copy">{sentence(split.risk)}</p>
          </div>
        </div>
      ) : analysis.executive_summary ? (
        <p className="mt-3 text-[12.5px] leading-[1.55] text-fit-muted">{analysis.executive_summary}</p>
      ) : null}

      {mustHaves.length > 0 && (
        <div className="mt-4">
          <p className={fitSectionHeadingClass}><ShieldCheck className="h-3 w-3" /> Must-haves from the job</p>
          <ul className="mt-2 space-y-1.5">
            {mustHaves.map((item) => {
              const style = MUST_HAVE_STYLE[item.status] ?? MUST_HAVE_STYLE.unknown
              return (
                <li key={item.requirement} className="flex items-start gap-2">
                  <span className={cn('mt-px inline-flex h-[20px] w-[84px] shrink-0 items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-medium', style.className)}>
                    {style.Icon && <style.Icon className="h-3 w-3" />}{style.label}
                  </span>
                  {item.evidence ? (
                    <Tooltip>
                      <TooltipTrigger asChild><span className="min-w-0 cursor-help text-[12px] leading-[1.45] text-fit-ink">{item.requirement}</span></TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px]"><p className="text-[11.5px] leading-relaxed">“{item.evidence}”</p></TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="min-w-0 text-[12px] leading-[1.45] text-fit-ink">{item.requirement}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {dimensions.length > 0 && (
        <div className="mt-4">
          <p className={fitSectionHeadingClass}><BarChart3 className="h-3 w-3" /> Dimensions</p>
          <ul className="mt-2 space-y-2">
            {dimensions.map((dimension, index) => {
              const color = FIT_DIMENSION_COLORS[index % FIT_DIMENSION_COLORS.length]
              return (
                <li key={dimension.name}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-fit-ink">{dimension.name}</span>
                    <span className={cn('text-[12px] font-semibold tabular-nums', dimension.score === null ? 'text-fit-warning' : 'text-fit-ink')}>
                      {dimension.score === null ? 'Data needed' : dimension.score}
                    </span>
                  </div>
                  <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-fit-hairline">
                    {dimension.score !== null && (
                      <div className={cn('h-full w-full origin-left rounded-full', color.fill)} style={{ transform: `scaleX(${Math.max(0, Math.min(100, dimension.score)) / 100})` }} />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-4">
          <p className={fitSectionHeadingClass}><CheckCircle2 className="h-3 w-3" /> Still to verify</p>
          <ul className="mt-2 space-y-2">
            {questions.map((point, index) => (
              <li key={`${point.question}-${index}`} className="flex items-start gap-2">
                <span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full border border-fit-null" aria-hidden />
                <span className="text-[12px] leading-[1.45] text-fit-ink">{point.question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** The card's own shape while Gio scores: same footprint, no lone spinner (§6, §16). */
function GioFitReviewSkeleton({ header, scoring }: { header: React.ReactNode; scoring: boolean }) {
  return (
    <section className={cn(fitCardClass, 'p-4')} aria-busy>
      {header}
      <div className="mt-3 flex items-end gap-3">
        <Skeleton className="h-9 w-14" />
        <div className="space-y-1.5 pb-[2px]"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-32" /></div>
      </div>
      <Skeleton className="mt-3 h-[68px] w-full rounded-lg" />
      <Skeleton className="mt-2 h-[68px] w-full rounded-lg" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
      {scoring && <p className="mt-3 text-[11.5px] text-fit-subtle">Gio is scoring this candidate. It takes about a minute.</p>}
    </section>
  )
}
