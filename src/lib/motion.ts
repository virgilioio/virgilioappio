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
