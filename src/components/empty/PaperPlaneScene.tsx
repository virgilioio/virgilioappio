import * as React from 'react'
import { SCENE_MS, SceneSvg, Spark, easeOut, glide, smooth, useSceneMode, BLOB_PATH, type SceneProps } from './scene-kit'

/**
 * Candidates — the paper plane (Empty State — Candidates; motion v2).
 *
 * One continuous timeline: the plane glides along the dotted trail's real geometry
 * (getPointAtLength per frame) with zero velocity at both ends, banks with a
 * time-smoothed heading (±6px look-ahead), levels out before landing, and rests on
 * the exact static `SoftPlane`: plane rotate(-18 120 58), trail drawn, shadow 120/78,
 * sparkle 142/96, dot 58/50. 2.8s, once. Reduced motion: static.
 */

const LILAC0 = '#F0E9FF'
const LILAC1 = '#D7C5FB'
const PURPLE = '#6F3FF5'
const PURPLE2 = '#8B6FE8'
const DOT = '#C4B0F5'

/** The dotted trail, and the plane's flight path: one source of truth. */
const PATH = 'M50 116 Q66 78 98 92 Q130 106 124 66'
const ANCHOR = { x: 123.1, y: 57.0 } // plane centroid at rest
const BANK = 0.55 // damping on the tangent-following roll

export function PaperPlaneScene(props: SceneProps) {
  const { width = 176, playKey = 0 } = props
  const { still, svgRef, uid } = useSceneMode(props)
  const maskId = `gio-plane-mask-${uid}`

  const plane = React.useRef<SVGGElement>(null)
  const shadow = React.useRef<SVGGElement>(null)
  const mask = React.useRef<SVGPathElement>(null)
  const geo = React.useRef<SVGPathElement>(null)

  React.useLayoutEffect(() => {
    const p = plane.current
    const sh = shadow.current
    const m = mask.current
    const g = geo.current
    if (!p || !sh || !m || !g) return
    const rest = () => {
      p.style.transform = 'none'
      p.style.opacity = '1'
      // No compositing layer at rest, so the final frame rasterises like the static graphic.
      p.style.willChange = 'auto'
      sh.style.transform = 'none'
      sh.style.opacity = '1'
      m.style.strokeDashoffset = '0'
    }
    if (still) {
      rest()
      return
    }
    const len = g.getTotalLength()
    const end = g.getPointAtLength(len)
    // The plane rides this far above the trail; zero at rest by construction.
    const off = { x: ANCHOR.x - end.x, y: ANCHOR.y - end.y }
    const heading = (l: number) => {
      const a = g.getPointAtLength(Math.max(0, l - 6))
      const b = g.getPointAtLength(Math.min(len, l + 6))
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    }
    let rollS = (heading(0) + 18) * BANK // start on the first heading: no swing
    let raf = 0
    let start: number | null = null
    let last = 0
    const frame = (now: number) => {
      if (start === null) {
        start = now
        last = now
      }
      const dt = now - last
      last = now
      const t = Math.min(1, (now - start) / SCENE_MS)
      const k = glide(t)
      const l = k * len
      const pt = g.getPointAtLength(l)
      const lift = Math.sin(Math.PI * k) * 4
      rollS += ((heading(l) + 18) * BANK - rollS) * (1 - Math.exp(-dt / 70))
      // Bank eases in, then levels out to 0 before landing.
      const roll = rollS * smooth(0, 0.14, k) * (1 - smooth(0.6, 1, k))
      p.style.transform = `translate(${pt.x + off.x - ANCHOR.x}px,${pt.y + off.y - ANCHOR.y - lift}px) rotate(${roll}deg) scale(${0.82 + 0.18 * easeOut(k)})`
      p.style.opacity = String(smooth(0, 0.1, t))
      sh.style.transform = `translate(${pt.x - end.x}px,${pt.y - end.y}px) scale(${(0.45 + 0.55 * k) * (1 - lift * 0.03)})`
      sh.style.opacity = String(smooth(0, 0.2, t))
      m.style.strokeDashoffset = String(1 - k)
      if (t < 1) raf = requestAnimationFrame(frame)
      else rest()
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      rest()
    }
  }, [still, playKey])

  return (
    <SceneSvg ref={svgRef} width={width} still={still} playKey={playKey}>
      <defs>
        <mask id={maskId}>
          <path
            ref={mask}
            d={PATH}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={still ? 0 : 1}
            stroke="#fff"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
        </mask>
        <path ref={geo} d={PATH} fill="none" stroke="none" />
      </defs>
      <path className="gio-scene-blob" d={BLOB_PATH} fill={LILAC0} />
      <g mask={`url(#${maskId})`}>
        <path d={PATH} stroke={DOT} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 9" fill="none" />
      </g>
      {/* Origins: the shadow scales about its own centre; the plane banks and scales
          about its resting centroid (ANCHOR), so translate() places that centroid. */}
      <g ref={shadow} style={{ opacity: still ? 1 : 0, transformBox: 'view-box', transformOrigin: '120px 78px' }}>
        <ellipse cx="120" cy="78" rx="20" ry="5" fill="#000" opacity="0.05" />
      </g>
      <g
        ref={plane}
        style={{
          opacity: still ? 1 : 0,
          transformBox: 'view-box',
          transformOrigin: `${ANCHOR.x}px ${ANCHOR.y}px`,
          willChange: still ? undefined : 'transform',
        }}
      >
        <g transform="rotate(-18 120 58)">
          <path d="M100 56 L146 44 L124 74 Z" fill={PURPLE2} />
          <path d="M100 56 L124 74 L116 60 Z" fill={PURPLE} />
          <path d="M146 44 L116 60" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <circle className="gio-scene-dot" cx="58" cy="50" r="3.5" fill={LILAC1} />
      <Spark className="gio-scene-spark" x={142} y={96} s={7} />
    </SceneSvg>
  )
}
