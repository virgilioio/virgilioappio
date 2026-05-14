import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface PipelineBarStage {
  stage_id: string
  stage_name: string
  stage_type?: string | null
  count: number
  position?: number
}

/**
 * Color map by stage_type. Falls back to a rotating palette by index when
 * stage_type is missing/unknown so each stage still gets its own swatch.
 */
const TYPE_COLORS: Record<string, string> = {
  sourcing: 'bg-[#9CA3AF]',       // gray-400 (early funnel)
  application: 'bg-[#9CA3AF]',
  applied: 'bg-[#9CA3AF]',
  screen: 'bg-[#22D3EE]',         // cyan
  screening: 'bg-[#22D3EE]',
  phone: 'bg-[#22D3EE]',
  assessment: 'bg-[#EC4899]',     // pink
  interview: 'bg-[#7C5CFA]',      // virgilio purple
  onsite: 'bg-[#7C5CFA]',
  offer: 'bg-[#F59E0B]',          // amber
  hired: 'bg-[#10B981]',          // emerald
  rejected: 'bg-[#E5E7EB]',       // gray-200
}

const FALLBACK_PALETTE = [
  'bg-[#9CA3AF]',
  'bg-[#22D3EE]',
  'bg-[#7C5CFA]',
  'bg-[#F59E0B]',
  'bg-[#EC4899]',
  'bg-[#10B981]',
]

function colorFor(stage: PipelineBarStage, index: number) {
  const t = (stage.stage_type || '').toLowerCase()
  return TYPE_COLORS[t] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]
}

/**
 * Multi-color segmented pipeline bar.
 * - If there are candidates, segments are sized by count share.
 * - If empty, renders a flat gray track.
 * - Right-side "+N" shows total active candidates.
 */
export function PipelineBar({
  stages,
  total,
  className,
}: {
  stages: PipelineBarStage[]
  total: number
  className?: string
}) {
  const ordered = [...(stages || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  )
  const sum = ordered.reduce((s, st) => s + (st.count || 0), 0)

  return (
    <TooltipProvider delayDuration={120}>
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative h-1.5 w-[120px] rounded-full bg-[#EEECE6] overflow-hidden flex">
          {sum > 0 ? (
            ordered.map((st, i) => {
              const pct = (st.count / sum) * 100
              if (pct <= 0) return null
              return (
                <Tooltip key={st.stage_id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('h-full', colorFor(st, i))}
                      style={{ width: `${pct}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {st.stage_name} · {st.count}
                  </TooltipContent>
                </Tooltip>
              )
            })
          ) : null}
        </div>
        <span className="font-poppins text-[11.5px] tabular-nums text-text-tertiary">
          +{total}
        </span>
      </div>
    </TooltipProvider>
  )
}
