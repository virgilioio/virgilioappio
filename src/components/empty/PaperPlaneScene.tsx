import * as React from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * The canonical Candidates illustration, animated (Empty State — Candidates, §2–§3).
 *
 * On mount the paper plane appears at the head of the dotted trail, flies along the
 * trail's real geometry (sampled per frame with getPointAtLength), the trail reveals
 * beneath it, and everything settles on the exact static graphic (`SoftPlane` in
 * ui/EmptyIllustrations.tsx): plane rotate(-18 120 58), trail drawn, shadow 120/78,
 * sparkle 142/96, dot 58/50. 2.8s, once, then it rests. Reduced motion: static.
 *
 * `onceKey`: a scene with the same key plays only once per session, so switching
 * tabs or sections and back shows it at rest instead of flying again.
 * `playKey`: change it to replay (remounts the SVG).
 */

const LILAC0 = '#F0E9FF'
const LILAC1 = '#D7C5FB'
const PURPLE = '#6F3FF5'
const PURPLE2 = '#8B6FE8'
const DOT = '#C4B0F5'

/** The dotted trail, and the plane's flight path: one source of truth. */
const PATH = 'M50 116 Q66 78 98 92 Q130 106 124 66'
const MS = 2800
const ANCHOR = { x: 123.1, y: 57.0 } // plane centroid at rest
const HOVER = 9 // how far above the trail it flies
const BANK = 0.55 // damping on the tangent-following roll
const FLY = 0.8 // share of the timeline spent flying; the rest is the settle

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

// UI-only session bookkeeping; never data.
const played = new Set<string>()

function Spark({ x, y, s, className }: { x: number; y: number; s: number; className?: string }) {
  const k = s * 0.34
  return (
    <path
      className={className}
      d={`M${x} ${y - s} C ${x + k} ${y - k} ${x + k} ${y - k} ${x + s} ${y} C ${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + s} C ${x - k} ${y + k} ${x - k} ${y + k} ${x - s} ${y} C ${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - s} Z`}
      fill={PURPLE}
    />
  )
}

export function PaperPlaneScene({
  width = 176,
  playKey = 0,
  onceKey,
  still: forceStill = false,
}: {
  width?: number
  playKey?: number
  onceKey?: string
  /** Show the resting graphic without flying (a second scene in view). */
  still?: boolean
}) {
  const height = Math.round((width / 176) * 140)
  const uid = React.useId().replace(/:/g, '')
  const maskId = `gio-plane-mask-${uid}-${playKey}`
  const geoId = `gio-plane-geo-${uid}-${playKey}`

  // Decided once per mount: fly, or show the resting graphic.
  const [still] = React.useState(() => forceStill || prefersReducedMotion() || (!!onceKey && played.has(onceKey)))
  const atRest = still

  const plane = React.useRef<SVGGElement>(null)
  const shadow = React.useRef<SVGGElement>(null)
  const mask = React.useRef<SVGPathElement>(null)
  const geo = React.useRef<SVGPathElement>(null)
  const svg = React.useRef<SVGSVGElement>(null)

  React.useLayoutEffect(() => {
    const p = plane.current
    const sh = shadow.current
    const m = mask.current
    const g = geo.current
    if (!p || !sh || !m || !g) return
    const rest = () => {
      p.style.transform = 'none'
      p.style.opacity = '1'
      sh.style.transform = 'none'
      sh.style.opacity = '1'
      m.style.strokeDashoffset = '0'
      // Drop the finished CSS animations too, so the resting frame is the plain graphic.
      svg.current?.classList.add('gio-plane-still')
    }
    if (atRest || prefersReducedMotion()) {
      rest()
      return
    }
    if (onceKey) played.add(onceKey)
    const len = g.getTotalLength()
    const end = g.getPointAtLength(len)
    const before = g.getPointAtLength(len - 1.5)
    const endRoll = ((Math.atan2(end.y - before.y, end.x - before.x) * 180) / Math.PI + 18) * BANK
    const endDx = end.x - ANCHOR.x
    const endDy = end.y - HOVER - ANCHOR.y
    let raf = 0
    let start: number | null = null
    const frame = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / MS)
      if (t < FLY) {
        const k = easeInOut(t / FLY)
        const l = k * len
        const pt = g.getPointAtLength(l)
        const a = g.getPointAtLength(Math.max(0, l - 1.5))
        const b = g.getPointAtLength(Math.min(len, l + 1.5))
        const roll = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 18) * BANK
        p.style.transform = `translate(${pt.x - ANCHOR.x}px,${pt.y - HOVER * k - ANCHOR.y}px) rotate(${roll}deg) scale(${0.86 + 0.14 * k})`
        p.style.opacity = String(Math.min(1, k * 8))
        sh.style.transform = `translate(${pt.x - 120}px,${pt.y + 12 - 78}px) scale(${0.5 + 0.5 * k})`
        sh.style.opacity = String(Math.min(1, k * 4))
        m.style.strokeDashoffset = String(1 - k)
      } else {
        // Settle: ease the last of the roll and hover out onto the resting graphic.
        const s = easeOut((t - FLY) / (1 - FLY))
        p.style.transform = `translate(${endDx * (1 - s)}px,${endDy * (1 - s)}px) rotate(${endRoll * (1 - s)}deg)`
        p.style.opacity = '1'
        sh.style.transform = `translate(${(end.x - 120) * (1 - s)}px,${(end.y + 12 - 78) * (1 - s)}px)`
        sh.style.opacity = '1'
        m.style.strokeDashoffset = '0'
      }
      if (t < 1) raf = requestAnimationFrame(frame)
      else rest()
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      rest()
    }
  }, [playKey, atRest, onceKey])

  return (
    <svg
      ref={svg}
      key={playKey}
      className={atRest ? 'gio-plane gio-plane-still' : 'gio-plane'}
      width={width}
      height={height}
      viewBox="0 0 190 150"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <mask id={maskId}>
          <path
            ref={mask}
            d={PATH}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={atRest ? 0 : 1}
            stroke="#fff"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
        </mask>
        <path ref={geo} id={geoId} d={PATH} fill="none" stroke="none" />
      </defs>
      <path
        className="gio-plane-blob"
        d="M95 16 C134 12 173 34 175 74 C177 110 147 136 104 136 C64 136 19 125 17 82 C15 42 56 20 95 16 Z"
        fill={LILAC0}
      />
      <g mask={`url(#${maskId})`}>
        <path d={PATH} stroke={DOT} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 9" fill="none" />
      </g>
      {/* Origins: the shadow scales about its own centre; the plane rolls and scales
          about its resting centroid (ANCHOR), so translate() places that centroid. */}
      <g ref={shadow} style={{ opacity: atRest ? 1 : 0, transformBox: 'view-box', transformOrigin: '120px 78px' }}>
        <ellipse cx="120" cy="78" rx="20" ry="5" fill="#000" opacity="0.05" />
      </g>
      <g ref={plane} style={{ opacity: atRest ? 1 : 0, transformBox: 'view-box', transformOrigin: `${ANCHOR.x}px ${ANCHOR.y}px` }}>
        <g transform="rotate(-18 120 58)">
          <path d="M100 56 L146 44 L124 74 Z" fill={PURPLE2} />
          <path d="M100 56 L124 74 L116 60 Z" fill={PURPLE} />
          <path d="M146 44 L116 60" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <circle className="gio-plane-dot" cx="58" cy="50" r="3.5" fill={LILAC1} />
      <Spark className="gio-plane-spark" x={142} y={96} s={7} />
    </svg>
  )
}
