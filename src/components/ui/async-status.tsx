import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AsyncValidationState } from '@/hooks/useAsyncValidation'

/**
 * Motion & Feel §12 async validation status: a reserved 18px line. While checking it
 * shows a small spinner and "Checking …"; then a ✓ or ✕ grows in (scale 0.6 + blur 2px,
 * --dur-tick) with a specific message. Nothing moves when it appears or clears.
 */
export function AsyncStatus({
  state,
  checking,
  className,
}: {
  state: AsyncValidationState
  /** e.g. "Checking addresses…" */
  checking: string
  className?: string
}) {
  return (
    <div
      className={cn('flex min-h-[18px] items-center gap-1.5 text-xs leading-[18px]', className)}
      aria-live="polite"
    >
      {state.status === 'checking' && (
        <>
          <span className="gio-spinner shrink-0" style={{ width: 11, height: 11, borderWidth: 1.5 }} aria-hidden="true" />
          <span className="text-virgilio-muted">{checking}</span>
        </>
      )}
      {(state.status === 'valid' || state.status === 'invalid') && (
        <span
          // A new result re-runs the grow-in.
          key={`${state.status}:${state.message}`}
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5',
            state.status === 'valid' ? 'text-virgilio-success' : 'text-virgilio-error font-medium',
          )}
        >
          <span className="gio-tick-in inline-flex shrink-0" aria-hidden="true">
            {state.status === 'valid' ? <Check size={12} strokeWidth={2.2} /> : <X size={12} strokeWidth={2.2} />}
          </span>
          <span className="min-w-0 truncate">{state.message}</span>
        </span>
      )}
    </div>
  )
}
