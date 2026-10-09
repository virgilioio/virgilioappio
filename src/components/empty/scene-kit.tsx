import * as React from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Shared pieces of the animated empty-state scenes (§16–§17). Every scene:
 * - plays once on mount and rests exactly on its static graphic in
 *   ui/EmptyIllustrations.tsx (SoftPlane, SoftFlag, SoftMagnifier, SoftCalendar);
 * - shows that rest state immediately with reduced motion;
 * - uses ids unique per instance;
 * - never flies while another scene is flying (one animated scene at a time), and
 *   with an `onceKey` plays only once per surface per session.
 */

export const SCENE_MS = 2800
export const BLOB_PATH =
  'M95 16 C134 12 173 34 175 74 C177 110 147 136 104 136 C64 136 19 125 17 82 C15 42 56 20 95 16 Z'

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
/** Hermite smoothstep of x between a and b. */
export const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1)
  return u * u * (3 - 2 * u)
}

/** cubic-bezier(x1, y1, x2, y2) as a function of time (Newton, then bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u
  const sy = (u: number) => ((ay * u + by) * u + cy) * u
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let u = x
    for (let i = 0; i < 6; i++) {
      const e = sx(u) - x
      const d = dx(u)
      if (Math.abs(e) < 1e-5) return sy(u)
      if (Math.abs(d) < 1e-6) break
      u -= e / d
    }
    let lo = 0
    let hi = 1
    u = x
    for (let i = 0; i < 24; i++) {
      const v = sx(u)
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = u
      else hi = u
      u = (lo + hi) / 2
    }
    return sy(u)
  }
}
/** Gentle take-off, long glide, soft landing: zero velocity at both ends. */
export const glide = cubicBezier(0.45, 0, 0.15, 1)

export function Spark({
  x,
  y,
  s,
  c = '#6F3FF5',
  className,
}: {
  x: number
  y: number
  s: number
  c?: string
  className?: string
}) {
  const k = s * 0.34
  return (
    <path
      className={className}
      d={`M${x} ${y - s} C ${x + k} ${y - k} ${x + k} ${y - k} ${x + s} ${y} C ${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + s} C ${x - k} ${y + k} ${x - k} ${y + k} ${x - s} ${y} C ${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - s} Z`}
      fill={c}
    />
  )
}

// UI-only session bookkeeping; never data.
const played = new Set<string>()
let flyingUntil = 0

export function useReducedMotion() {
  const [reduced] = React.useState(prefersReducedMotion)
  return reduced
}

export interface SceneProps {
  width?: number
  /** Change it to replay (remounts the SVG). */
  playKey?: number
  /** Plays once per key per session; later mounts show the rest state. */
  onceKey?: string
  /** Show the rest state without animating. */
  still?: boolean
}

/**
 * Decides once per mount whether the scene animates, claims the "one flying at a
 * time" slot when it does, and drops the finished CSS entrances afterwards so the
 * resting frame is the plain static graphic.
 *
 * A scene that can animate waits (`paused`: drawn blank, which is its own first
 * frame) until at least a third of it is on screen, then claims the flight. So a
 * scene below the fold plays when it's scrolled to, and a copy in a CSS-hidden
 * desktop/phone branch never takes the flight from the one the user can see. If
 * another scene is flying when it comes into view, it shows the rest state.
 */
export function useSceneMode({ onceKey, still: forceStill = false, playKey = 0 }: SceneProps, ms = SCENE_MS) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [mode, setMode] = React.useState<'still' | 'wait' | 'fly'>(() =>
    forceStill || prefersReducedMotion() || (!!onceKey && played.has(onceKey)) ? 'still' : 'wait',
  )
  const uid = React.useId().replace(/:/g, '')

  React.useLayoutEffect(() => {
    if (mode !== 'wait') return
    const svg = svgRef.current
    const claim = () => {
      if (typeof performance === 'undefined' || performance.now() < flyingUntil) return setMode('still')
      if (onceKey) played.add(onceKey)
      flyingUntil = performance.now() + ms
      setMode('fly')
    }
    if (!svg || typeof IntersectionObserver === 'undefined') {
      claim()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          claim()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(svg)
    return () => io.disconnect()
    // Decided once per mount (or replay); later prop changes don't re-decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, playKey])

  React.useEffect(() => {
    if (mode !== 'fly') return
    const until = flyingUntil
    let done = false
    const timer = setTimeout(() => {
      done = true
      svgRef.current?.classList.add('gio-scene-still')
    }, ms + 50)
    return () => {
      clearTimeout(timer)
      if (done) return
      // Unmounted mid-flight: free the slot, and don't count a flight nobody saw end.
      if (flyingUntil === until) flyingUntil = 0
      if (onceKey) played.delete(onceKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ms])

  return { still: mode === 'still', paused: mode === 'wait', svgRef, uid: `${uid}-${playKey}` }
}

/** The 190×150 scene canvas, at the requested width (default 176×140). */
export const SceneSvg = React.forwardRef<
  SVGSVGElement,
  { width: number; still: boolean; paused?: boolean; playKey: number; children: React.ReactNode }
>(({ width, still, paused = false, playKey, children }, ref) => (
  <svg
    ref={ref}
    key={playKey}
    className={still ? 'gio-scene gio-scene-still' : paused ? 'gio-scene gio-scene-wait' : 'gio-scene'}
    width={width}
    height={Math.round((width / 176) * 140)}
    viewBox="0 0 190 150"
    fill="none"
    aria-hidden="true"
    style={{ display: 'block', overflow: 'visible' }}
  >
    {children}
  </svg>
))
SceneSvg.displayName = 'SceneSvg'
