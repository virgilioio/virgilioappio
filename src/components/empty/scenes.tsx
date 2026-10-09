import * as React from 'react'
import {
  BLOB_PATH,
  SCENE_MS,
  SceneSvg,
  Spark,
  clamp,
  easeInOut,
  easeOut,
  useSceneMode,
  type SceneProps,
} from './scene-kit'

/**
 * Jobs (flag), Search (magnifier) and Scheduling (calendar) — the animated empty
 * states that join the paper plane (§17). Each plays once on mount and rests on its
 * exact static graphic in ui/EmptyIllustrations.tsx (SoftFlag, SoftMagnifier,
 * SoftCalendar). The flag and calendar are CSS-only (2.6s, `gio-e2-*` in
 * src/index.css); the magnifier follows its trail per frame like the plane.
 */

const PURPLE = '#6F3FF5'
const DOT = '#C4B0F5'
const CYAN0 = '#DFF3F7'
const CYAN1 = '#9BD9E6'
const CYAN2 = '#5FB6C8'
const GREEN0 = '#E0F0D6'
const GREEN1 = '#BBE3A9'
const GREEN2 = '#46B86A'
const POLE = '#9A8FA8'
const CSS_MS = 2600

// ── Jobs: the pole is planted (draws up out of its shadow), the knob pops, the
// pennant unfurls and waves to rest. Resting frame === SoftFlag.
export function FlagScene(props: SceneProps) {
  const { width = 176, playKey = 0 } = props
  const { still, paused, svgRef } = useSceneMode(props, CSS_MS)
  return (
    <SceneSvg ref={svgRef} width={width} still={still} paused={paused} playKey={playKey}>
      <path className="gio-scene-blob" d={BLOB_PATH} fill={GREEN0} />
      {/* The fade runs on a wrapper: animating the ellipse's own opacity would
          override its 0.05 and flash a solid shadow. */}
      <g className="gio-e2 gio-e2-fshadow">
        <ellipse cx="95" cy="116" rx="26" ry="6" fill="#000" opacity="0.05" />
      </g>
      <path className="gio-e2 gio-e2-pole" d="M95 116 V52" pathLength={1} stroke={POLE} strokeWidth="6" strokeLinecap="round" />
      <circle className="gio-e2 gio-e2-knob" cx="95" cy="50" r="5" fill={POLE} />
      <path className="gio-e2 gio-e2-pennant" d="M98 52 Q116 56 132 50 Q120 64 132 78 Q116 72 98 78 Z" fill={PURPLE} />
      <circle className="gio-e2 gio-e2-g1" cx="120" cy="40" r="3.5" fill={GREEN1} />
      <circle className="gio-e2 gio-e2-g2" cx="70" cy="62" r="3" fill={GREEN2} opacity="0.7" />
      <Spark className="gio-scene-spark" x={126} y={92} s={6.5} />
    </SceneSvg>
  )
}

// ── Search: the magnifier scans along the dotted trail (revealing it), then lands
// with a small "found" pulse while the glint draws. Resting frame === SoftMagnifier.
const SEARCH_PATH = 'M50 110 Q72 74 102 90 Q126 102 122 70'
const SEARCH_END = { x: 122, y: 70 }
const SEARCH_FLY = 0.78

export function MagnifierScene(props: SceneProps) {
  const { width = 176, playKey = 0 } = props
  const { still, paused, svgRef, uid } = useSceneMode(props)
  const maskId = `gio-search-mask-${uid}`
  const lens = React.useRef<SVGGElement>(null)
  const shadow = React.useRef<SVGGElement>(null)
  const mask = React.useRef<SVGPathElement>(null)
  const geo = React.useRef<SVGPathElement>(null)
  const glint = React.useRef<SVGPathElement>(null)

  React.useLayoutEffect(() => {
    const ln = lens.current
    const sh = shadow.current
    const m = mask.current
    const g = geo.current
    const gl = glint.current
    if (!ln || !sh || !m || !g || !gl) return
    const rest = () => {
      ln.style.transform = 'none'
      ln.style.opacity = '1'
      // No compositing layer at rest, so the final frame rasterises like the static graphic.
      ln.style.willChange = 'auto'
      sh.style.transform = 'none'
      sh.style.opacity = '1'
      m.style.strokeDashoffset = '0'
      gl.style.strokeDashoffset = '0'
    }
    if (still) {
      rest()
      return
    }
    if (paused) return // blank until it's on screen and claims the flight
    const len = g.getTotalLength()
    let raf = 0
    let start: number | null = null
    const frame = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / SCENE_MS)
      if (t < SEARCH_FLY) {
        const p = easeInOut(t / SEARCH_FLY)
        const l = p * len
        const pt = g.getPointAtLength(l)
        const a = g.getPointAtLength(Math.max(0, l - 1.5))
        const b = g.getPointAtLength(Math.min(len, l + 1.5))
        // (1-p)²: the trail ends pointing almost straight up, so the tilt must be
        // gone before landing or the lens snaps.
        const tilt = clamp(((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) * 0.18, -14, 14) * (1 - p) * (1 - p)
        const bob = Math.sin(p * Math.PI * 3) * 2.2 * (1 - p)
        ln.style.transform = `translate(${pt.x - SEARCH_END.x}px,${pt.y - SEARCH_END.y + bob}px) rotate(${tilt}deg) scale(${0.84 + 0.16 * p})`
        ln.style.opacity = String(Math.min(1, p * 8))
        sh.style.transform = `translate(${pt.x - SEARCH_END.x}px,${pt.y - SEARCH_END.y}px) scale(${0.5 + 0.5 * p})`
        sh.style.opacity = String(Math.min(1, p * 4))
        m.style.strokeDashoffset = String(1 - p)
        gl.style.strokeDashoffset = '1'
      } else {
        const s = (t - SEARCH_FLY) / (1 - SEARCH_FLY)
        // The "found" pulse ends at exactly 1.
        ln.style.transform = `scale(${1 + 0.08 * Math.sin(Math.min(1, s * 1.6) * Math.PI)})`
        ln.style.opacity = '1'
        sh.style.transform = 'none'
        sh.style.opacity = '1'
        m.style.strokeDashoffset = '0'
        gl.style.strokeDashoffset = String(1 - easeOut(Math.min(1, s * 1.4)))
      }
      if (t < 1) raf = requestAnimationFrame(frame)
      else rest()
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      rest()
    }
  }, [still, paused, playKey])

  return (
    <SceneSvg ref={svgRef} width={width} still={still} paused={paused} playKey={playKey}>
      <defs>
        <mask id={maskId}>
          <path
            ref={mask}
            d={SEARCH_PATH}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={still ? 0 : 1}
            stroke="#fff"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
        </mask>
        <path ref={geo} d={SEARCH_PATH} fill="none" stroke="none" />
      </defs>
      <path className="gio-scene-blob" d={BLOB_PATH} fill={CYAN0} />
      <g mask={`url(#${maskId})`}>
        <path d={SEARCH_PATH} stroke={CYAN1} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 9" fill="none" />
      </g>
      <g ref={shadow} style={{ opacity: still ? 1 : 0, transformBox: 'view-box', transformOrigin: '120px 86px' }}>
        <ellipse cx="120" cy="86" rx="18" ry="5" fill="#000" opacity="0.05" />
      </g>
      <g
        ref={lens}
        style={{
          opacity: still ? 1 : 0,
          transformBox: 'view-box',
          transformOrigin: '122px 66px',
          willChange: still ? undefined : 'transform',
        }}
      >
        <path d="M129 71 L142 84" stroke={CYAN2} strokeWidth="7" strokeLinecap="round" />
        <circle cx="118" cy="58" r="18" fill="#fff" stroke={CYAN2} strokeWidth="4.5" />
        <path
          ref={glint}
          d="M110 56 a8 8 0 0 1 8 -7"
          pathLength={1}
          strokeDasharray={still ? undefined : '1 1'}
          strokeDashoffset={still ? undefined : 1}
          stroke={CYAN1}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <circle className="gio-scene-dot" cx="58" cy="52" r="3.5" fill={CYAN1} />
      <Spark className="gio-scene-spark" x={140} y={100} s={6.5} c={CYAN2} />
    </SceneSvg>
  )
}

// ── Scheduling: the calendar drops in and settles, the binder rings click in, then
// the purple event is booked into its slot. Resting frame === SoftCalendar.
export function CalendarScene(props: SceneProps) {
  const { width = 176, playKey = 0 } = props
  const { still, paused, svgRef } = useSceneMode(props, CSS_MS)
  return (
    <SceneSvg ref={svgRef} width={width} still={still} paused={paused} playKey={playKey}>
      <path className="gio-scene-blob" d={BLOB_PATH} fill={CYAN0} />
      <g className="gio-e2 gio-e2-cshadow">
        <ellipse cx="95" cy="114" rx="32" ry="5" fill="#000" opacity="0.05" />
      </g>
      <g className="gio-e2 gio-e2-cal">
        <rect x="60" y="56" width="70" height="58" rx="11" fill="#fff" stroke={CYAN1} strokeWidth="3.5" />
        <path d="M60 71 H130" stroke={CYAN1} strokeWidth="3.5" />
      </g>
      <path className="gio-e2 gio-e2-ring1" d="M76 50 v12" stroke={CYAN2} strokeWidth="5" strokeLinecap="round" />
      <path className="gio-e2 gio-e2-ring2" d="M114 50 v12" stroke={CYAN2} strokeWidth="5" strokeLinecap="round" />
      <rect className="gio-e2 gio-e2-event" x="84" y="82" width="22" height="20" rx="6" fill={PURPLE} />
      <circle className="gio-e2 gio-e2-cd1" cx="73" cy="92" r="2.6" fill={DOT} />
      <circle className="gio-e2 gio-e2-cd2" cx="117" cy="92" r="2.6" fill={DOT} />
      <Spark className="gio-scene-spark" x={128} y={54} s={6} />
    </SceneSvg>
  )
}
