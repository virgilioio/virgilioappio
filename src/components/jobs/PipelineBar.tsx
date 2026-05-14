import { cn } from '@/lib/utils'

/**
 * Slim presentational pipeline bar for the Jobs list table.
 * Renders a subtle gray track with a purple fill proportional to the job's
 * candidate count vs. the largest count in the visible set, plus a "+N" chip.
 */
export function PipelineBar({
  count,
  max,
  className,
}: {
  count: number
  max: number
  className?: string
}) {
  const ratio = max > 0 ? Math.min(1, count / max) : 0
  const pct = Math.max(count > 0 ? 0.06 : 0, ratio)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-1.5 w-[120px] rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-virgilio-purple/80 transition-[width] duration-300"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="font-poppins text-[11.5px] tabular-nums text-text-tertiary">
        +{count}
      </span>
    </div>
  )
}
