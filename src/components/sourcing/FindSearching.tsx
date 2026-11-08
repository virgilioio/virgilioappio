import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Find's "Gio is searching" loader (2026-11-08, Allan's spec): while a search is in
 * flight, source tiles (résumés, profiles, locations, LinkedIn, past employers) seed
 * on the orbit, glide in and land on the centre, one beat each; when results arrive it
 * resolves from the current frame into the static Find hero (SoftFind) and the found
 * badge pops last. One rAF clock writes to refs (no React render per frame); it stops
 * once resolved, when unmounted and while the tab is hidden. Flat fills only. Reduced
 * motion: the static frame, and only the status text changes.
 */

// ── Curves ───────────────────────────────────────────────────────────────────────
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x
      if (Math.abs(e) < 1e-6) return sy(t)
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 30; i++) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-6) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}
const GLIDE = cubicBezier(0.7, 0, 0.25, 1)
const POP = cubicBezier(0.3, 1.5, 0.5, 1)
const BLOOM = cubicBezier(0.2, 0.9, 0.3, 1)
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, p: number) => a + (b - a) * p

// ── Scene ────────────────────────────────────────────────────────────────────────
type Kind = 'spark' | 'doc' | 'user' | 'location' | 'linkedin' | 'company'
const TILES: Record<Kind, { w: number; h: number; rx: number; fill: string; label: string }> = {
  spark: { w: 56, h: 56, rx: 28, fill: '#6F3FF5', label: 'Gio is thinking' },
  doc: { w: 46, h: 58, rx: 9, fill: '#6F3FF5', label: 'Reading résumés' },
  user: { w: 56, h: 56, rx: 28, fill: '#6F3FF5', label: 'Scanning profiles' },
  location: { w: 64, h: 50, rx: 15, fill: '#3E98AE', label: 'Matching locations' },
  linkedin: { w: 54, h: 54, rx: 13, fill: '#0A66C2', label: 'Checking LinkedIn' },
  company: { w: 52, h: 58, rx: 9, fill: '#2F9A57', label: 'Reviewing past employers' },
}
const KINDS = Object.keys(TILES) as Kind[]
const ORDER: Kind[] = ['doc', 'user', 'location', 'linkedin', 'company']
const SPAWN: [number, number][] = [[52, -14], [-54, -10], [46, 30], [-48, 28], [0, -40]]
const SATS = [
  { fill: '#9BD9E6', r: 5.5, a0: 1.06 * Math.PI, rest: [42, 56] },
  { fill: '#BBE3A9', r: 6.5, a0: 1.86 * Math.PI, rest: [146, 58] },
  { fill: '#D7C5FB', r: 4.5, a0: 0.32 * Math.PI, rest: [140, 100] },
] as const
const BLOB = 'M95 16 C134 12 173 34 175 74 C177 110 147 136 104 136 C64 136 19 125 17 82 C15 42 56 20 95 16 Z'
const SPARK = 'M95 56 Q99.76 65.24 109 70 Q99.76 74.76 95 84 Q90.24 74.76 81 70 Q90.24 65.24 95 56 Z'
const BEAT = 1050
const SEED = 800
const RESOLVE = 900
const BADGE_AT = 495
const BADGE_FOR = 420
const BLOOM_AT = 336
const BLOOM_FOR = 450
const IMPACT_AT = 0.72 * SEED
const IMPACT_FOR = 380
const ROT = (-12 * Math.PI) / 180
/** Screen px of blur → user units (the 190-wide scene drawn 208 wide). */
const BLUR_UNITS = 190 / 208

function orbitPoint(a: number): [number, number] {
  const px = 56 * Math.cos(a), py = 34 * Math.sin(a)
  return [95 + px * Math.cos(ROT) - py * Math.sin(ROT), 72 + px * Math.sin(ROT) + py * Math.cos(ROT)]
}

function Glyph({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'spark': return <path d={SPARK} fill="#fff" />
    case 'doc': return (
      <g stroke="#fff" strokeWidth="3.2" strokeLinecap="round">
        <path d="M86 58 H98" /><path d="M86 66 H104" /><path d="M86 74 H104" /><path d="M86 82 H96" />
      </g>
    )
    case 'user': return <g fill="#fff"><circle cx="95" cy="63" r="7" /><path d="M82 85 a13 11 0 0 1 26 0 Z" /></g>
    case 'location': return (
      <g>
        <path d="M74 62 H116 M74 78 H116" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.5 5" />
        <path d="M95 86 C88 78 85 73 85 67.5 A10 10 0 0 1 105 67.5 C105 73 102 78 95 86 Z" fill="#fff" />
        <circle cx="95" cy="67.5" r="3.6" fill="#3E98AE" />
      </g>
    )
    case 'linkedin': return (
      <g fill="#fff" transform="translate(-2 0)">
        <circle cx="86" cy="60" r="3.3" />
        <rect x="83" y="66" width="6.4" height="16" rx="1.4" />
        <path d="M93 82 V66 H99 V68.6 C100.4 66.6 102.6 65.5 105.2 65.5 C109.2 65.5 111.4 68 111.4 72.6 V82 H105.2 V73.8 C105.2 71.7 104.2 70.6 102.4 70.6 C100.5 70.6 99.2 71.9 99.2 74.2 V82 Z" />
      </g>
    )
    case 'company': return (
      <g fill="#fff">
        <rect x="86" y="53" width="6" height="6" rx="1.4" /><rect x="98" y="53" width="6" height="6" rx="1.4" />
        <rect x="86" y="63" width="6" height="6" rx="1.4" /><rect x="98" y="63" width="6" height="6" rx="1.4" />
        <rect x="91.5" y="76" width="7" height="12" rx="1.6" />
      </g>
    )
  }
}

interface LayerRefs {
  g: SVGGElement | null
  rect: SVGRectElement | null
  glyph: SVGGElement | null
  blur: SVGFEGaussianBlurElement | null
  glyphs: Partial<Record<Kind, SVGGElement | null>>
  kind?: Kind
}

function setKind(layer: LayerRefs, kind: Kind) {
  if (layer.kind === kind || !layer.rect) return
  layer.kind = kind
  const t = TILES[kind]
  layer.rect.setAttribute('x', String(95 - t.w / 2))
  layer.rect.setAttribute('y', String(70 - t.h / 2))
  layer.rect.setAttribute('width', String(t.w))
  layer.rect.setAttribute('height', String(t.h))
  layer.rect.setAttribute('rx', String(t.rx))
  layer.rect.setAttribute('fill', t.fill)
  for (const k of KINDS) layer.glyphs[k]?.setAttribute('display', k === kind ? 'inline' : 'none')
}

function placeLayer(layer: LayerRefs, x: number, y: number, s: number, opacity: number) {
  if (!layer.g) return
  if (s <= 0.001 || opacity <= 0) {
    layer.g.setAttribute('display', 'none')
    return
  }
  layer.g.setAttribute('display', 'inline')
  layer.g.setAttribute('transform', `translate(${x} ${y}) scale(${s}) translate(-95 -70)`)
  layer.g.setAttribute('opacity', String(opacity))
}

/** The glyph's bloom: opacity 0→1, scale .94→1, blur 2px→0, by p (already eased). */
function bloomGlyph(layer: LayerRefs, p: number, filterRef: string) {
  if (!layer.glyph) return
  const s = 0.94 + 0.06 * p
  layer.glyph.setAttribute('opacity', String(p))
  layer.glyph.setAttribute('transform', p >= 1 ? '' : `translate(95 70) scale(${s}) translate(-95 -70)`)
  const blur = 2 * (1 - p) * BLUR_UNITS
  if (blur > 0.01) {
    layer.blur?.setAttribute('stdDeviation', String(blur))
    layer.glyph.setAttribute('filter', `url(#${filterRef})`)
  } else layer.glyph.removeAttribute('filter')
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!m) return
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return !!reduced
}

export interface FindSearchingProps {
  state: 'searching' | 'done' | 'error'
  query: string
  /** Strong matches found (shown once it resolves). */
  count?: number
  /** Overrides "Found {count} strong matches". */
  foundText?: string
  onStop?: () => void
  onViewResults?: () => void
  onSearchAgain?: () => void
  /** The resolve has played to its last frame. */
  onResolved?: () => void
}

export function FindSearching({ state, query, count = 0, foundText, onStop, onViewResults, onSearchAgain, onResolved }: FindSearchingProps) {
  const uid = useId().replace(/:/g, '')
  const reduced = usePrefersReducedMotion()
  const [label, setLabel] = useState(TILES.spark.label)
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState(false)

  const blobRef = useRef<SVGPathElement | null>(null)
  const orbitRef = useRef<SVGEllipseElement | null>(null)
  const satRefs = useRef<(SVGCircleElement | null)[]>([])
  const ringRef = useRef<SVGCircleElement | null>(null)
  const badgeRef = useRef<SVGGElement | null>(null)
  const layerHost = useRef<SVGGElement | null>(null)
  const finishRef = useRef<(() => void) | null>(null)
  const layers = useRef<[LayerRefs, LayerRefs]>([{ g: null, rect: null, glyph: null, blur: null, glyphs: {} }, { g: null, rect: null, glyph: null, blur: null, glyphs: {} }])
  const stateRef = useRef(state)
  stateRef.current = state
  const onResolvedRef = useRef(onResolved)
  onResolvedRef.current = onResolved
  const labelRef = useRef(label)

  /** The final, static frame: SoftFind (badge only when results arrived). */
  const paintStatic = (withBadge: boolean) => {
    blobRef.current?.removeAttribute('transform')
    orbitRef.current?.setAttribute('stroke-dashoffset', '0')
    SATS.forEach((s, i) => {
      const c = satRefs.current[i]
      if (!c) return
      c.setAttribute('cx', String(s.rest[0]))
      c.setAttribute('cy', String(s.rest[1]))
      c.setAttribute('r', String(s.r))
    })
    ringRef.current?.setAttribute('display', 'none')
    const [a, b] = layers.current
    setKind(a, 'spark')
    placeLayer(a, 95, 70, 1, 1)
    bloomGlyph(a, 1, `${uid}-blur-0`)
    placeLayer(b, 95, 70, 0, 0)
    if (badgeRef.current) {
      badgeRef.current.setAttribute('display', withBadge ? 'inline' : 'none')
      badgeRef.current.removeAttribute('transform')
    }
  }

  // Reduced motion: the static frame; only the text changes.
  useLayoutEffect(() => {
    if (!reduced) return
    paintStatic(state === 'done')
    if (state === 'searching') {
      let n = 0
      setLabel(TILES.spark.label)
      const id = window.setInterval(() => {
        setLabel(TILES[ORDER[n % ORDER.length]].label)
        n++
      }, BEAT)
      return () => window.clearInterval(id)
    }
    setResolving(true)
    setResolved(true)
    onResolvedRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, state])

  // The clock.
  useEffect(() => {
    if (reduced) return
    let raf = 0
    let running = false
    const start = performance.now()
    let resolveAt: number | null = null
    let resolveKind: Kind = 'spark'
    let resolveIdx = 0
    let resolveLocal = 0
    let lastBeat = -1
    let fromSats: [number, number][] = []
    let fromBlob = 1
    let fromDash = 0
    let toDash = 0
    let finished = false
    const blurId = (i: number) => `${uid}-blur-${i}`

    const satAngle = (i: number, burst: number) => SATS[i].a0 + burst * 0.7
    const putLabel = (l: string) => {
      if (labelRef.current !== l) {
        labelRef.current = l
        setLabel(l)
      }
    }

    const finish = () => {
      finished = true
      paintStatic(stateRef.current === 'done')
      setResolved(true)
      onResolvedRef.current?.()
    }

    const frame = (now: number) => {
      raf = 0
      if (finished) return
      // A frame's timestamp can come before the moment the clock started.
      const t = Math.max(0, now - start)
      const n = Math.floor(t / BEAT)
      const local = t - n * BEAT
      const x = Math.min(local / SEED, 1)
      const burst = n + GLIDE(clamp((x - 0.45) / 0.4))
      const incoming = layers.current[n % 2]
      const outgoing = layers.current[(n + 1) % 2]
      const inKind = ORDER[n % ORDER.length]
      const outKind: Kind = n === 0 ? 'spark' : ORDER[(n - 1) % ORDER.length]
      // The incoming tile draws over the outgoing one, whichever layer it is this beat.
      if (resolveAt === null && n !== lastBeat) {
        lastBeat = n
        if (incoming.g && layerHost.current && layerHost.current.lastChild !== incoming.g) layerHost.current.appendChild(incoming.g)
      }

      // A resolve waits for a seed in flight to land, never for the hold.
      if (stateRef.current !== 'searching' && resolveAt === null && x >= 1) {
        resolveAt = now
        resolveKind = inKind
        resolveIdx = n % 2
        resolveLocal = local
        setResolving(true)
        fromSats = SATS.map((_, i) => orbitPoint(satAngle(i, burst)))
        fromBlob = 1 + 0.014 * Math.sin(t / 800)
        fromDash = -(t * 0.004 + burst * 22)
        // The dash pattern repeats every 8.5: end on a whole period, then it reads as 0.
        toDash = Math.floor(fromDash / 8.5) * 8.5
      }

      // Impact ring and satellite pop: from the landing (they finish even mid-resolve).
      const sinceBeat = resolveAt === null ? local : resolveLocal + (now - resolveAt)
      const ringKind = resolveAt === null ? inKind : resolveKind
      const q = (sinceBeat - IMPACT_AT) / IMPACT_FOR
      const ring = ringRef.current
      if (ring) {
        if (q > 0 && q < 1) {
          ring.setAttribute('display', 'inline')
          ring.setAttribute('r', String(30 + 16 * BLOOM(q)))
          ring.setAttribute('opacity', String(0.5 * (1 - q)))
          ring.setAttribute('stroke', TILES[ringKind].fill)
        } else ring.setAttribute('display', 'none')
      }
      const pop = q > 0 && q < 1 ? 0.55 + 0.45 * POP(q) : 1

      if (resolveAt === null) {
        // ── Searching ──
        blobRef.current?.setAttribute('transform', `translate(95 76) scale(${1 + 0.014 * Math.sin(t / 800)}) translate(-95 -76)`)
        orbitRef.current?.setAttribute('stroke-dashoffset', String(-(t * 0.004 + burst * 22)))
        SATS.forEach((s, i) => {
          const c = satRefs.current[i]
          if (!c) return
          const [px, py] = orbitPoint(satAngle(i, burst))
          c.setAttribute('cx', String(px))
          c.setAttribute('cy', String(py))
          c.setAttribute('r', String(s.r * pop))
        })

        // Outgoing: holds to 50%, gone by 70%, so the seed lands in the space it leaves.
        setKind(outgoing, outKind)
        const outS = x < 0.5 ? 1 : 1 - GLIDE(clamp((x - 0.5) / 0.2))
        placeLayer(outgoing, 95, 70, outS, 1)
        bloomGlyph(outgoing, 1, blurId((n + 1) % 2))

        // Incoming seed: appear → inflate on the orbit → glide → land.
        setKind(incoming, inKind)
        const [ox, oy] = SPAWN[n % SPAWN.length]
        let px: number, py: number, s: number
        if (x < 0.18) { const p = GLIDE(x / 0.18); px = ox; py = oy; s = lerp(0.18, 0.24, p) }
        else if (x < 0.45) { const p = GLIDE((x - 0.18) / 0.27); px = ox; py = oy; s = lerp(0.24, 0.62, p) }
        else if (x < 0.72) { const p = GLIDE((x - 0.45) / 0.27); px = lerp(ox, 0, p); py = lerp(oy, 0, p); s = lerp(0.62, 0.92, p) }
        else { const p = GLIDE((x - 0.72) / 0.28); px = 0; py = 0; s = lerp(0.92, 1, p) }
        placeLayer(incoming, 95 + px, 70 + py, s, clamp(x / 0.12))
        bloomGlyph(incoming, BLOOM(clamp((local - BLOOM_AT) / BLOOM_FOR)), blurId(n % 2))

        putLabel(TILES[x >= 0.62 ? inKind : outKind].label)
        if (badgeRef.current) badgeRef.current.setAttribute('display', 'none')
      } else {
        // ── Resolve (900ms) ──
        const rt = now - resolveAt
        const r = clamp(rt / RESOLVE)
        const tile = layers.current[resolveIdx]
        layers.current[1 - resolveIdx].g?.setAttribute('display', 'none')
        let s: number
        if (r < 0.3) s = lerp(1, 0.22, GLIDE(r / 0.3))
        else if (r < 0.66) s = lerp(0.22, 1.16, GLIDE((r - 0.3) / 0.36))
        else s = lerp(1.16, 1, GLIDE((r - 0.66) / 0.34))
        setKind(tile, r < 0.3 ? resolveKind : 'spark')
        placeLayer(tile, 95, 70, s, 1)
        bloomGlyph(tile, r < 0.3 ? 1 : BLOOM(clamp((rt - 0.3 * RESOLVE) / BLOOM_FOR)), blurId(resolveIdx))

        const e = GLIDE(r)
        blobRef.current?.setAttribute('transform', `translate(95 76) scale(${lerp(fromBlob, 1, e)}) translate(-95 -76)`)
        orbitRef.current?.setAttribute('stroke-dashoffset', String(lerp(fromDash, toDash, e)))
        SATS.forEach((sat, i) => {
          const c = satRefs.current[i]
          if (!c) return
          c.setAttribute('cx', String(lerp(fromSats[i][0], sat.rest[0], e)))
          c.setAttribute('cy', String(lerp(fromSats[i][1], sat.rest[1], e)))
          // A pop still running finishes; nothing new pops.
          c.setAttribute('r', String(sat.r * pop))
        })

        const badge = badgeRef.current
        if (badge) {
          const bq = (rt - BADGE_AT) / BADGE_FOR
          if (stateRef.current === 'done' && bq > 0) {
            badge.setAttribute('display', 'inline')
            badge.setAttribute('transform', bq >= 1 ? '' : `translate(116 89) scale(${Math.max(0, POP(clamp(bq)))}) translate(-116 -89)`)
          } else badge.setAttribute('display', 'none')
        }
        const end = stateRef.current === 'done' ? BADGE_AT + BADGE_FOR : RESOLVE
        if (rt >= end) {
          finish()
          return
        }
      }
      schedule()
    }

    const schedule = () => {
      if (!running || finished || raf) return
      raf = requestAnimationFrame(frame)
    }
    const startClock = () => {
      if (running || finished) return
      running = true
      schedule()
    }
    const stopClock = () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    const onVisibility = () => {
      if (document.hidden) {
        stopClock()
        // Results arrived while hidden: no point playing to an empty room.
        if (stateRef.current !== 'searching' && !finished) finish()
      } else startClock()
    }

    setKind(layers.current[0], 'doc')
    setKind(layers.current[1], 'spark')
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) startClock()
    else if (stateRef.current !== 'searching') finish()
    // Results arriving in a hidden tab finish at once (the clock is idle there).
    finishRef.current = () => { if (document.hidden && stateRef.current !== 'searching' && !finished) finish() }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      finishRef.current = null
      stopClock()
    }
    // One clock per mount; state is read through stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, uid])

  // Results arriving while the tab is hidden: straight to the last frame.
  useEffect(() => {
    finishRef.current?.()
  }, [state])

  const searching = !resolving
  const found = state === 'done'
  const statusText = resolving ? (found ? foundText ?? `Found ${count} strong ${count === 1 ? 'match' : 'matches'}` : labelRef.current) : label

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center text-center" aria-live="polite">
      {/* 1 · The query */}
      {query && (
        <div className="relative flex w-full items-start gap-2 overflow-hidden text-left" style={{ background: '#fff', border: '1px solid #E7E2F3', borderRadius: 16, padding: '11px 14px' }}>
          <Sparkles aria-hidden className="mt-[1px] shrink-0" style={{ width: 16, height: 16, color: '#6F3FF5' }} />
          <span className="line-clamp-2 font-inter" style={{ fontSize: 13, lineHeight: 1.45, color: '#1F2230' }}>{query}</span>
          {searching && !reduced && <span aria-hidden className="gio-find-sweep" />}
        </div>
      )}

      {/* 2 · The scene */}
      <svg width={208} height={165} viewBox="0 0 190 150" fill="none" aria-hidden className="mt-4 block" style={{ overflow: 'visible' }}>
        <defs>
          {[0, 1].map((i) => (
            <filter key={i} id={`${uid}-blur-${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur ref={(el) => { layers.current[i].blur = el }} stdDeviation="0" />
            </filter>
          ))}
        </defs>
        <path ref={blobRef} d={BLOB} fill="#F0E9FF" />
        <ellipse ref={orbitRef} cx="95" cy="72" rx="56" ry="34" transform="rotate(-12 95 72)" stroke="#C4B0F5" strokeWidth="2.4" strokeDasharray="0.5 8" strokeLinecap="round" fill="none" />
        {SATS.map((s, i) => (
          <circle key={i} ref={(el) => { satRefs.current[i] = el }} cx={s.rest[0]} cy={s.rest[1]} r={s.r} fill={s.fill} />
        ))}
        <circle ref={ringRef} cx="95" cy="70" r="30" fill="none" strokeWidth="2" display="none" />
        <g ref={layerHost}>
        {[1, 0].map((i) => (
          <g key={i} ref={(el) => { layers.current[i].g = el }} display={i === 0 ? 'inline' : 'none'}>
            <rect ref={(el) => { layers.current[i].rect = el }} x="67" y="42" width="56" height="56" rx="28" fill="#6F3FF5" />
            <g ref={(el) => { layers.current[i].glyph = el }}>
              {KINDS.map((k) => (
                <g key={k} ref={(el) => { layers.current[i].glyphs[k] = el }} display={k === 'spark' ? 'inline' : 'none'}>
                  <Glyph kind={k} />
                </g>
              ))}
            </g>
          </g>
        ))}
        </g>
        <g ref={badgeRef} display="none">
          <circle cx="116" cy="89" r="7.5" fill="#fff" />
          <circle cx="116" cy="89" r="5" fill="#46B86A" />
        </g>
      </svg>

      {/* 3 · Status */}
      <p className="mt-3 flex items-center justify-center gap-1 font-inter" style={{ fontSize: 14, fontWeight: 500, color: resolving && found ? '#2F9A57' : '#5B5F6E', minHeight: 20 }}>
        <span key={statusText} className={reduced ? undefined : 'gio-find-bloom'}>{statusText}</span>
        {searching && (
          <span aria-hidden className="ml-0.5 inline-flex items-center gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className={reduced ? undefined : 'gio-find-dot'} style={{ width: 3, height: 3, borderRadius: 9, background: 'currentColor', opacity: reduced ? 0.6 : undefined, animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        )}
      </p>

      {/* 4 · Sub-copy */}
      <p className="mt-1 font-inter" style={{ fontSize: 12.5, lineHeight: 1.5, color: '#8B8F9E' }}>
        {resolving && found ? 'Ranked by fit to your criteria.' : 'Searching résumés, profiles and LinkedIn. This usually takes under a minute.'}
      </p>

      {/* 5 · Actions */}
      <div className={cn('mt-5 flex items-center justify-center gap-2')}>
        {!resolving && onStop && (
          <Button variant="secondary" onClick={onStop}>Stop</Button>
        )}
        {resolved && found && (
          <>
            {onSearchAgain && <Button variant="secondary" onClick={onSearchAgain}>Search again</Button>}
            {onViewResults && <Button onClick={onViewResults}>View results</Button>}
          </>
        )}
      </div>
    </div>
  )
}
