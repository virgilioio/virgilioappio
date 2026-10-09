import { useEffect, useMemo, useRef } from 'react'
import { motionToken, prefersReducedMotion } from '@/lib/motion'

/**
 * Motion & Feel §6 Charts (CLAUDE.md) for recharts. Spread the returned props on the
 * series and put `ref` on a wrapper around the chart:
 *
 *   const motion = useRechartsMotion('ti.skills', data, { bars: 'x' })
 *   <div ref={motion.ref}><ResponsiveContainer>…<Bar {...motion.bar} />…
 *
 * - First view this session: bars grow from their baseline, --stagger-chart apart (first
 *   12), over --dur-chart on --ease-in-out; lines, areas and pies draw in over --dur-chart.
 * - Later data (a period or filter change): every series morphs to its new values over
 *   --dur-chart on --ease-in-out. Recharts interpolates from the previous values.
 * - A remount after the first view (coming back to the page) renders statically: the
 *   panel never re-grows. Reduced motion: no chart animation at all.
 * `bars`: 'x' for horizontal bars (layout="vertical"), 'y' for columns.
 */

// UI-only session identifiers; never chart data.
const seen = new Set<string>()

type Easing = 'ease-in-out'

export function useRechartsMotion(id: string, data: unknown, opts: { bars?: 'x' | 'y' } = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const firstView = useRef(!seen.has(id))
  const signature = useMemo(() => {
    try {
      return JSON.stringify(data) ?? ''
    } catch {
      return String(Math.random())
    }
  }, [data])
  const mountSignature = useRef(signature)
  const changed = useRef(false)
  if (signature !== mountSignature.current) changed.current = true
  const hasData = signature !== '' && signature !== '[]' && signature !== 'null' && signature !== '{}'
  const reduced = prefersReducedMotion()

  // First view: claim it once real data is on screen, and grow the bars with a stagger.
  useEffect(() => {
    if (!hasData || seen.has(id)) return
    seen.add(id)
    const root = ref.current
    if (!firstView.current || !opts.bars || !root || reduced) return
    const axis = opts.bars
    const duration = motionToken('--dur-chart', 320)
    const stagger = motionToken('--stagger-chart', 30)
    const easing = motionToken('--ease-in-out', 'ease-in-out')
    const scale = axis === 'x' ? 'scaleX' : 'scaleY'
    let done = false
    const grow = () => {
      const rects = root.querySelectorAll<SVGGElement>('.recharts-bar-rectangle')
      if (!rects.length || done) return
      done = true
      observer.disconnect()
      rects.forEach((g, i) => {
        g.style.transformBox = 'fill-box'
        g.style.transformOrigin = axis === 'x' ? 'left center' : 'center bottom'
        const index = i % 13
        const a = g.animate([{ transform: `${scale}(0)` }, { transform: `${scale}(1)` }], {
          duration,
          delay: index * stagger,
          easing,
          fill: 'backwards',
        })
        a.onfinish = () => a.cancel()
      })
    }
    // ResponsiveContainer draws after it measures; catch the bars before their first paint.
    const observer = new MutationObserver(grow)
    observer.observe(root, { childList: true, subtree: true })
    grow()
    const timer = setTimeout(() => observer.disconnect(), 2000)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [hasData, id, opts.bars, reduced])

  const common = {
    animationBegin: 0,
    animationDuration: motionToken('--dur-chart', 320),
    animationEasing: motionToken('--ease-in-out', 'ease-in-out') as Easing,
  }
  return {
    ref,
    /** Bar series: first view grows via the stagger above; later data morphs. */
    bar: { ...common, isAnimationActive: !reduced && changed.current },
    /** Line, Area and Pie series: draw in on first view; later data morphs. */
    series: { ...common, isAnimationActive: !reduced && (changed.current || firstView.current) },
  }
}
