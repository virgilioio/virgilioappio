import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { EmptyAction } from '@/components/ui/empty-state'

/**
 * §16: what a list shows when its first load fails or takes longer than 15s —
 * never an empty state, never an endless skeleton. Inline, with Retry.
 */
export function LoadError({
  what,
  timedOut = false,
  onRetry,
  compact = false,
}: {
  /** What didn't load, e.g. "jobs", "candidates", "this pipeline". */
  what: string
  timedOut?: boolean
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 340, margin: '0 auto' }}>
      <div
        style={{
          fontFamily: "'Poppins', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: compact ? 15 : 18,
          letterSpacing: '-0.025em',
          color: '#0d0d09',
        }}
      >
        {timedOut ? `${capitalise(what)} ${what.endsWith('s') ? 'are' : 'is'} taking too long to load` : `Couldn't load ${what}`}
      </div>
      <p style={{ margin: '8px auto 0', fontFamily: "'Inter', system-ui, sans-serif", fontSize: compact ? 12.5 : 13, lineHeight: 1.55, color: '#5A6072' }}>
        {timedOut ? "They didn't arrive within 15 seconds. Try again in a moment." : 'Check your connection, then try again.'}
      </p>
      {onRetry && (
        <div style={{ marginTop: compact ? 14 : 20 }}>
          <EmptyAction variant="secondary" icon={<RotateCcw size={16} />} onClick={onRetry}>
            Retry
          </EmptyAction>
        </div>
      )}
    </div>
  )
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
