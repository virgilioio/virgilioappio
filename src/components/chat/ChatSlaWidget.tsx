import { Activity, AlertCircle, Clock } from 'lucide-react'
import { useChatSlaMetrics } from '@/hooks/chat/useChatSlaMetrics'
import { cn } from '@/lib/utils'

function formatMs(ms: number | null): string {
  if (ms === null) return '—'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 48) return `${hr}h`
  return `${Math.round(hr / 24)}d`
}

interface Props {
  className?: string
}

/**
 * ChatSlaWidget — admin-only chat SLA snapshot.
 * Surfaces awaiting-human pressure + recruiter first-response performance.
 */
export function ChatSlaWidget({ className }: Props) {
  const { data, isLoading } = useChatSlaMetrics()

  if (isLoading || !data) {
    return (
      <div
        className={cn(
          'rounded-lg border border-virgilio-border bg-surface-secondary px-3 py-2.5 animate-pulse h-[68px]',
          className,
        )}
      />
    )
  }

  const awaitingHigh = data.awaitingHumanCount > 0
  const oldestHigh = (data.oldestAwaitingMs ?? 0) > 15 * 60 * 1000

  return (
    <div
      className={cn(
        'rounded-lg border border-virgilio-border bg-surface-primary px-3 py-2.5 space-y-2',
        className,
      )}
      role="region"
      aria-label="Chat SLA snapshot"
    >
      <div className="flex items-center justify-between">
        <span className="font-poppins text-[10.5px] uppercase tracking-[0.06em] text-text-secondary">
          Chat SLA · {data.windowDays}d
        </span>
        <Activity className="h-3 w-3 text-text-secondary" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <div
          className={cn(
            'rounded-md px-2 py-1.5 border',
            awaitingHigh
              ? 'border-amber-200 bg-amber-50'
              : 'border-virgilio-border bg-surface-secondary',
          )}
        >
          <div className="flex items-center gap-1 text-text-secondary">
            <AlertCircle className="h-3 w-3" />
            Awaiting human
          </div>
          <div className="font-poppins font-semibold text-virgilio-text tabular-nums">
            {data.awaitingHumanCount}
            {oldestHigh && data.oldestAwaitingMs !== null && (
              <span className="ml-1 text-[10.5px] font-normal text-amber-700">
                · {formatMs(data.oldestAwaitingMs)} oldest
              </span>
            )}
          </div>
        </div>

        <div className="rounded-md px-2 py-1.5 border border-virgilio-border bg-surface-secondary">
          <div className="flex items-center gap-1 text-text-secondary">
            <Clock className="h-3 w-3" />
            First reply
          </div>
          <div className="font-poppins font-semibold text-virgilio-text tabular-nums">
            {formatMs(data.medianFirstResponseMs)}
            <span className="ml-1 text-[10.5px] font-normal text-text-secondary">
              · p95 {formatMs(data.p95FirstResponseMs)}
            </span>
          </div>
        </div>
      </div>

      {data.sampleSize === 0 && (
        <p className="text-[10.5px] text-text-secondary">No recruiter replies in window.</p>
      )}
    </div>
  )
}
