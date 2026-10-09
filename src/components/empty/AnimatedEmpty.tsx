import * as React from 'react'
import { EmptyAction } from '@/components/ui/empty-state'
import { PaperPlaneScene } from './PaperPlaneScene'
import { CalendarScene, FlagScene, MagnifierScene } from './scenes'
import type { SceneProps } from './scene-kit'

/**
 * AnimatedEmpty — the empty state for lists, with one of the four animated scenes
 * (§16–§17). The host draws the container; this is the centred block inside it.
 *
 * - `scene`: candidates (paper plane), jobs (flag), search (magnifier), scheduling
 *   (calendar). Filtered empty always uses `search` with Clear filters and never a
 *   create/add action.
 * - Loading is not empty: render this only once the request resolved with zero rows.
 * - `compact` (148px scene) for columns, cards and panels narrower than ~420px.
 * - One animated scene at a time: a scene that mounts while another is flying shows
 *   its rest state; `onceKey` plays a surface's scene once per session.
 *
 * Typography and buttons are the ATS empty-state ones (ui/empty-state.tsx).
 */

export type EmptyScene = 'candidates' | 'jobs' | 'search' | 'scheduling'

export interface EmptyStateAction {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
}

const SCENES: Record<EmptyScene, React.ComponentType<SceneProps>> = {
  candidates: PaperPlaneScene,
  jobs: FlagScene,
  search: MagnifierScene,
  scheduling: CalendarScene,
}

export function AnimatedEmpty({
  scene,
  title,
  body,
  primary,
  secondary,
  size = 'default',
  onceKey,
  animate = true,
  sceneKey,
}: {
  scene: EmptyScene
  title: React.ReactNode
  body?: React.ReactNode
  primary?: EmptyStateAction
  secondary?: EmptyStateAction
  size?: 'default' | 'compact'
  onceKey?: string
  /** false: show the resting graphic without animating. */
  animate?: boolean
  /** Changing it remounts the scene (replays it, subject to onceKey). */
  sceneKey?: React.Key
}) {
  const compact = size === 'compact'
  const Scene = SCENES[scene]
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
      {/* Keyed by scene too: swapping empty ↔ filtered changes the picture. */}
      <Scene key={`${scene}:${sceneKey ?? ''}`} width={compact ? 148 : 208} onceKey={onceKey ? `${onceKey}:${scene}` : undefined} still={!animate} />
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

/** The card an empty state sits in when no list or table hosts it (the canonical
 *  EmptyState card: white, hairline border, radius 18, card shadow). */
export function EmptyCard({ children, minHeight = 300 }: { children: React.ReactNode; minHeight?: number }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 18,
        boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: '32px 20px',
      }}
    >
      {children}
    </div>
  )
}
