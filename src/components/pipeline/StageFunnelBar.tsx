/**
 * StageFunnelBar — fixed 360w segmented bar, one segment per job stage.
 * Width ∝ (count + 0.45); empty stages stay visible.
 * Filled ramp gray→purple. Empty segments are same color at ~18% opacity.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface FunnelStage {
  id: string
  name: string
  count: number
}

const RAMP = ['#ADB2BD', '#C9B8FB', '#A98BFA', '#8456F6', '#6F3FF5']

function colorForIndex(i: number, total: number) {
  if (total <= 1) return RAMP[RAMP.length - 1]
  if (i === 0) return RAMP[0]
  if (i === total - 1) return RAMP[RAMP.length - 1]
  // Interpolate index across middle ramp positions
  const t = i / (total - 1)
  const idx = Math.round(t * (RAMP.length - 1))
  return RAMP[idx]
}

function shortLabel(name: string) {
  // Common abbreviations
  const map: Record<string, string> = {
    'application review': 'App',
    'final candidate review': 'Review',
    'recruiter screening': 'Screen',
    'phone screening': 'Screen',
    'screening': 'Screen',
    'hiring manager interview': 'HM',
    'home task': 'Task',
    'panel interview': 'Panel',
    'final interview': 'Final',
    'offer': 'Offer',
  }
  const key = name.toLowerCase().trim()
  if (map[key]) return map[key]
  // Otherwise first word, max 6 chars
  const w = name.split(/\s+/)[0]
  return w.length > 6 ? w.slice(0, 6) : w
}

export function StageFunnelBar({ stages, className }: { stages: FunnelStage[]; className?: string }) {
  if (!stages || stages.length === 0) {
    return <div className={cn('w-[360px]', className)} />
  }
  const weights = stages.map(s => s.count + 0.45)
  const totalW = weights.reduce((a, b) => a + b, 0)

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('w-[360px] shrink-0', className)}>
        <div className="flex" style={{ height: 20, gap: 2 }}>
          {stages.map((s, i) => {
            const pct = (weights[i] / totalW) * 100
            const filled = s.count > 0
            const color = colorForIndex(i, stages.length)
            return (
              <Tooltip key={s.id}>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center justify-center overflow-hidden"
                    style={{
                      width: `${pct}%`,
                      height: 20,
                      borderRadius: 4,
                      background: filled ? color : `${color}2E`, // ~18% opacity hex
                      transition: 'background 120ms ease',
                    }}
                  >
                    <span
                      className="font-poppins tabular-nums"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: filled ? '#FFFFFF' : '#9CA0AD',
                        lineHeight: 1,
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {s.name} · {s.count}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <div className="mt-1 flex" style={{ gap: 2 }}>
          {stages.map((s, i) => {
            const pct = (weights[i] / totalW) * 100
            return (
              <div
                key={s.id}
                className="truncate text-center font-inter"
                style={{ width: `${pct}%`, fontSize: 9, color: '#8B8F9E', lineHeight: 1.3 }}
                title={s.name}
              >
                {shortLabel(s.name)}
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
