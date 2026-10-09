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
