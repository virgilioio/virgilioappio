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

/* ── Delete dialogs (Block B §16, 2026-10-13) ─────────────────────────────── */

export interface RowExit {
  /** Resolves when the rows have closed their gap (instantly under reduced motion). */
  done: Promise<void>
  /** Puts the rows back as they were (a failed delete). */
  revert: () => void
}

/**
 * After a delete: each row collapses (height and opacity to 0 over --dur-collapse,
 * --ease-in-out) and the list closes the gap. With `stagger` (bulk) the rows first
 * slide out 16px (--dur-exit, --stagger-exit apart). Rows stay in the DOM: remove
 * them from state once `done` resolves. Reduced motion: nothing moves.
 */
export function collapseRows(els: Array<Element | null | undefined>, opts: { stagger?: boolean } = {}): RowExit {
  const rows = els.filter((e): e is HTMLElement => e instanceof HTMLElement)
  if (!rows.length || prefersReducedMotion() || typeof rows[0].animate !== 'function') {
    return { done: Promise.resolve(), revert: () => {} }
  }
  const easeOut = motionToken('--ease-out', 'cubic-bezier(0.23, 1, 0.32, 1)')
  const easeInOut = motionToken('--ease-in-out', 'cubic-bezier(0.77, 0, 0.175, 1)')
  const exit = motionToken('--dur-exit', 180)
  const stagger = motionToken('--stagger-exit', 40)
  const collapse = motionToken('--dur-collapse', 240)
  const anims: Animation[] = []
  const done = Promise.all(
    rows.map(async (el, i) => {
      if (opts.stagger) {
        const a = el.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(16px)' }],
          { duration: exit, delay: i * stagger, easing: easeOut, fill: 'forwards' },
        )
        anims.push(a)
        await a.finished.catch(() => {})
      }
      const h = el.getBoundingClientRect().height
      const cs = getComputedStyle(el)
      el.style.overflow = 'hidden'
      const b = el.animate(
        [
          { height: `${h}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: opts.stagger ? 0 : 1 },
          { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', opacity: 0 },
        ],
        { duration: collapse, easing: easeInOut, fill: 'forwards' },
      )
      anims.push(b)
      await b.finished.catch(() => {})
    }),
  ).then(() => undefined)
  return {
    done,
    revert: () => {
      anims.forEach((a) => a.cancel())
      rows.forEach((el) => { el.style.overflow = '' })
    },
  }
}

/** Undo: restored rows fade in from 4px above (--dur-dialog-in), --stagger apart. */
export function restoreRows(els: Array<Element | null | undefined>) {
  if (prefersReducedMotion()) return
  const easeOut = motionToken('--ease-out', 'cubic-bezier(0.23, 1, 0.32, 1)')
  const dur = motionToken('--dur-dialog-in', 220)
  const stagger = motionToken('--stagger', 40)
  els.filter((e): e is HTMLElement => e instanceof HTMLElement).forEach((el, i) => {
    el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], {
      duration: dur, delay: i * stagger, easing: easeOut, fill: 'backwards',
    })
  })
}

/** Rows by `data-row-id` (put it on the row element to collapse or restore). */
export const rowsById = (ids: string[], scope: ParentNode = document) =>
  ids.map((id) => scope.querySelector(`[data-row-id="${CSS.escape(id)}"]`))
