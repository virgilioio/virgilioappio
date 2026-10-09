import * as React from 'react'
import { EmptyAction } from '@/components/ui/empty-state'
import { PaperPlaneScene } from './PaperPlaneScene'

/**
 * CandidatesEmpty — the one empty state for every list that holds candidates
 * (Empty State — Candidates). Same illustration everywhere; only copy and actions
 * change. The host draws the container; this is the centred block inside it.
 *
 * - Loading is not empty: render this only once the request resolved with zero rows.
 * - Filtered empty (rows exist but filters or a search hide them) keeps the
 *   illustration, says "No candidates match these filters" and offers Clear filters,
 *   never an "add" action.
 * - `compact` for columns, cards and panels narrower than ~420px.
 * - At most one animated scene in view: pass `animate={false}` to any extra one, and an
 *   `onceKey` so returning to a surface shows the scene at rest.
 *
 * Typography and buttons are the ATS empty-state ones (ui/empty-state.tsx).
 */

export interface CandidatesEmptyAction {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
}

export function CandidatesEmpty({
  title,
  body,
  primary,
  secondary,
  size = 'default',
  onceKey,
  animate = true,
  sceneKey,
}: {
  title: React.ReactNode
  body?: React.ReactNode
  primary?: CandidatesEmptyAction
  secondary?: CandidatesEmptyAction
  size?: 'default' | 'compact'
  onceKey?: string
  /** false: show the resting graphic without the flight. */
  animate?: boolean
  /** Changing it remounts the scene (replays it, subject to onceKey). */
  sceneKey?: React.Key
}) {
  const compact = size === 'compact'
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <PaperPlaneScene
        key={sceneKey}
        width={compact ? 148 : 208}
        onceKey={onceKey}
        still={!animate}
      />
      <div
        style={{
          marginTop: compact ? 2 : 4,
          fontFamily: "'Poppins', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: compact ? 15 : 18,
          letterSpacing: '-0.025em',
          color: '#0d0d09',
        }}
      >
        {title}
      </div>
      {body ? (
        <p
          style={{
            margin: compact ? '6px auto 0' : '8px auto 0',
            maxWidth: compact ? 240 : 320,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: compact ? 12.5 : 13,
            lineHeight: 1.55,
            color: '#5A6072',
            textWrap: 'pretty' as React.CSSProperties['textWrap'],
          }}
        >
          {body}
        </p>
      ) : null}
      {(primary || secondary) && (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: compact ? 14 : 20 }}>
          {primary && (
            <EmptyAction icon={primary.icon} onClick={primary.onClick}>
              {primary.label}
            </EmptyAction>
          )}
          {secondary && (
            <EmptyAction variant="secondary" icon={secondary.icon} onClick={secondary.onClick}>
              {secondary.label}
            </EmptyAction>
          )}
        </div>
      )}
    </div>
  )
}
