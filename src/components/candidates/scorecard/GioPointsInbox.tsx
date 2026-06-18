import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Sparkles, X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCandidateFitInsights } from '@/hooks/useCandidateFitInsights'
import { useValidationPointResolutions } from '@/hooks/useValidationPointResolutions'
import { toast } from '@/hooks/use-toast'
import { CandidateSheetSection } from '../form/CandidateSheetSection'

interface Props {
  candidateId: string
  jobId: string
  associationId: string
  stageName: string
  scorecardId?: string | null
  onAdd: (sourceIndex: number, question: string) => void
  onRemoveAdded: (sourceIndex: number) => void
  readOnly?: boolean
}

export function GioPointsInbox({
  candidateId,
  jobId,
  associationId,
  stageName,
  scorecardId,
  onAdd,
  onRemoveAdded,
  readOnly,
}: Props) {
  const [open, setOpen] = useState(true)
  const { insights } = useCandidateFitInsights(candidateId, jobId)
  const { resolutions, addPoint, dismissPoint, clearResolution } =
    useValidationPointResolutions(associationId)

  const points = insights?.analysis?.validation_points
  if (!points?.length) return null

  const statusOf = (i: number) => {
    const r = resolutions.get(i)
    if (!r) return 'pending' as const
    if (r.status === 'added' || r.status === 'validated' || r.status === 'flagged') return 'added' as const
    return r.status
  }

  const pending = points
    .map((p, i) => ({ point: p, index: i }))
    .filter(({ index }) => statusOf(index) === 'pending')
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as Record<string, number>
      const aMatch = a.point.suggested_stage?.toLowerCase() === stageName?.toLowerCase() ? 0 : 1
      const bMatch = b.point.suggested_stage?.toLowerCase() === stageName?.toLowerCase() ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return (order[a.point.priority] ?? 2) - (order[b.point.priority] ?? 2)
    })

  const addedCount = points.filter((_, i) => statusOf(i) === 'added').length
  const pendingCount = pending.length
  const allReviewed = pendingCount === 0

  const handleAdd = async (i: number, question: string) => {
    try {
      await addPoint(i, question, stageName, scorecardId ?? undefined)
      onAdd(i, question)
    } catch (e: any) {
      toast({ title: 'Could not add', description: e?.message, variant: 'destructive' })
    }
  }

  const handleDismiss = async (i: number, question: string) => {
    try {
      await dismissPoint(i, question, stageName, scorecardId ?? undefined)
      toast({
        title: 'Dismissed',
        description: 'Suggestion hidden from this scorecard.',
        action: (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await clearResolution(i)
              } catch {}
            }}
          >
            Undo
          </Button>
        ) as any,
      })
    } catch (e: any) {
      toast({ title: 'Could not dismiss', description: e?.message, variant: 'destructive' })
    }
  }

  const action = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="flex items-center gap-2"
      aria-label={open ? 'Collapse points to validate' : 'Expand points to validate'}
    >
      {allReviewed ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F4FBF6] border border-[#BBE3C9] px-2 py-1 text-[11px] font-medium text-[#0F8A56]">
          <CheckCircle2 className="h-3 w-3" /> All reviewed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EDE4FF] border border-[#D7C5FB] px-2 py-1 text-[11px] font-medium text-[#5B21B6]">
          <Sparkles className="h-3 w-3" /> {pendingCount} from Gio
        </span>
      )}
      {open ? (
        <ChevronDown className="h-4 w-4 text-[#8B8F9E]" />
      ) : (
        <ChevronRight className="h-4 w-4 text-[#8B8F9E]" />
      )}
    </button>
  )

  if (!open) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <h3 className="font-poppins font-semibold uppercase tracking-[0.06em] text-[11.5px] text-virgilio-text">
            POINTS TO VALIDATE
          </h3>
          <div className="flex items-center gap-2">{action}</div>
        </div>
      </section>
    )
  }

  return (
    <CandidateSheetSection label="POINTS TO VALIDATE" action={action}>
      {allReviewed ? (
        <div className="flex items-center gap-2 text-[12.5px] text-[#5A6072]">
          <Sparkles className="h-3.5 w-3.5 text-[#6F3FF5]" />
          <span>
            You&rsquo;ve reviewed all of Gio&rsquo;s suggestions
            {addedCount > 0 ? ` · ${addedCount} added to your scorecard` : ''}.
          </span>
        </div>
      ) : (
        <div className="-my-2">
          {pending.map(({ point, index }, i) => (
            <div
              key={index}
              className={
                'flex items-start gap-3 py-4 ' +
                (i > 0 ? 'border-t border-virgilio-border/60' : '')
              }
            >
              <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-[#EDE4FF]">
                <Sparkles className="h-3.5 w-3.5 text-[#6F3FF5]" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[12.5px] font-medium text-[#1F2230] leading-snug">
                  {point.question}
                </p>
                {point.reason && (
                  <p className="text-[11px] text-[#8B8F9E] leading-snug">{point.reason}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {point.priority === 'high' && (
                    <span className="inline-flex items-center rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#92400E]">
                      High
                    </span>
                  )}
                  {point.priority === 'medium' && (
                    <span className="inline-flex items-center rounded-full bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#92400E]">
                      Medium
                    </span>
                  )}
                  {point.suggested_stage && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#5A6072]">
                      <ArrowRight className="h-3 w-3" /> {point.suggested_stage}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[12px] text-[#5A6072] hover:text-[#1F2230]"
                      onClick={() => handleDismiss(index, point.question)}
                      disabled={readOnly}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[12px] border-[#D7C5FB] text-[#5B21B6] hover:bg-[#EDE4FF]"
                      onClick={() => handleAdd(index, point.question)}
                      disabled={readOnly}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add to scorecard
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CandidateSheetSection>
  )
}
