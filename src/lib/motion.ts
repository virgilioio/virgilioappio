import { useLayoutEffect, useRef, type CSSProperties } from 'react'

/** Motion & Feel helpers shared by the motion primitives (CLAUDE.md). */

/** Read a motion token from :root as a number (ms) or a string (easing). */
export function motionToken(name: string, fallback: number): number
export function motionToken(name: string, fallback: string): string
export function motionToken(name: string, fallback: number | string): number | string {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  if (typeof fallback === 'number') {
    const n = parseFloat(raw) * (raw.endsWith('ms') ? 1 : raw.endsWith('s') ? 1000 : 1)
    return Number.isFinite(n) ? n : fallback
  }
  return raw
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A JS easing function for a `cubic-bezier(…)` token, for the few motions that run in
 * requestAnimationFrame (SVG geometry WAAPI can't animate). Unknown values fall back to linear.
 */
export function easingFunction(css: string): (t: number) => number {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(css)
  if (!m) return (t) => t
  const [x1, y1, x2, y2] = m.slice(1).map(Number)
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (bez(mid, x1, x2) < x) lo = mid
      else hi = mid
    }
    return bez((lo + hi) / 2, y1, y2)
  }
}

/**
 * §7 invalid submit: focus the first invalid field inside `scope` and shake it once
 * (6px, --dur-shake). Reduced motion: focus only. Runs after React has rendered the
 * errors, so call it from a form library's invalid callback.
 */
export function shakeFirstInvalid(scope?: Element | null) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const root: ParentNode = scope ?? document
      const field = root.querySelector<HTMLElement>('[aria-invalid="true"]')
      if (!field) return
      if (document.activeElement !== field) field.focus({ preventScroll: false })
      if (prefersReducedMotion()) return
      field.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(-3px)' },
          { transform: 'translateX(2px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: motionToken('--dur-shake', 300), easing: 'ease-out' },
      )
    }),
  )
}

/**
 * Slide content in from the side it came from when `orderKey` changes: from +distance
 * when the key grows, −distance when it shrinks, with opacity, over `durationToken` on
 * --ease-out. Reduced motion: opacity only. `selector` animates matching descendants
 * instead of the element itself.
 */
export function useDirectionalSlide(
  ref: { current: Element | null },
  orderKey: number,
  distance: number,
  durationToken: string,
  selector?: string,
) {
  const previous = useRef(orderKey)
  useLayoutEffect(() => {
    const before = previous.current
    previous.current = orderKey
    if (before === orderKey) return
    const root = ref.current
    if (!root) return
    const targets = selector ? Array.from(root.querySelectorAll(selector)) : [root]
    const dx = (orderKey > before ? 1 : -1) * distance
    const still = prefersReducedMotion()
    const from = still ? { opacity: 0 } : { opacity: 0, transform: `translateX(${dx}px)` }
    const to = still ? { opacity: 1 } : { opacity: 1, transform: 'translateX(0)' }
    targets.forEach((el) =>
      el.animate([from, to], { duration: motionToken(durationToken, 200), easing: motionToken('--ease-out', 'ease-out') }),
    )
  }, [orderKey, ref, selector, distance, durationToken])
}

/** §7 Date picker: the day grid slides 12px toward the month you moved to (--dur-switch). */
export function useMonthSlide(ref: { current: Element | null }, monthKey: number, selector?: string) {
  useDirectionalSlide(ref, monthKey, 12, '--dur-switch', selector)
}

/** §7 Wizard: Next slides the step in from +16px, Back from −16px (220ms, --ease-out). */
export function useStepSlide(ref: { current: Element | null }, step: number) {
  useDirectionalSlide(ref, step, 16, '--dur-dialog-in')
}

// UI-only session identifiers; never list data.
const staggered = new Set<string>()

/**
 * §9 List stagger: the first time a list appears this session, its first 8 rows rise in
 * from 6px + opacity, --stagger (40ms) apart. Never on re-sort, filter, pagination or
 * scroll, never blocking input; reduced motion fades only. Returns props for row `index`.
 */
export function useFirstLoadStagger(id: string, ready: boolean) {
  const play = useRef<boolean | null>(null)
  if (play.current === null && ready) {
    play.current = !staggered.has(id)
    staggered.add(id)
  }
  return (index: number): { className?: string; style?: CSSProperties } =>
    play.current && index < 8
      ? { className: 'gio-list-in', style: { animationDelay: `calc(${index} * var(--stagger))` } }
      : {}
}
