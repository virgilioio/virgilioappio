import { motionToken, prefersReducedMotion } from '@/lib/motion'

/**
 * Motion & Feel §15 — "Opening filled" (Mark hired), the only delight in Gio ATS.
 * Once per opening per session (this page load); never for bulk actions, imports or
 * automations — only the single Mark hired confirm calls it. Reduced motion: nothing
 * extra, the state change is the whole moment.
 */
const celebrated = new Set<string>()

/** Claim the moment for an opening; false if it already played or motion is reduced. */
export function claimOpeningFilled(openingId: string) {
  if (celebrated.has(openingId)) return false
  celebrated.add(openingId)
  return !prefersReducedMotion()
}

const DOT_COLORS = ['#12B886', '#6F3FF5', '#F59E0B', '#0EA5E9', '#8456F6']

/** 10 dots fly 34–50px out from the centre of `from`, fading, over 560ms --ease-out. */
export function burstFrom(from: Element) {
  const rect = from.getBoundingClientRect()
  if (!rect.width || prefersReducedMotion()) return
  const ease = motionToken('--ease-out', 'ease-out')
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.className = 'gio-burst'
  layer.style.left = `${rect.left + rect.width / 2}px`
  layer.style.top = `${rect.top + rect.height / 2}px`
  document.body.appendChild(layer)
  const turn = Math.random() * Math.PI * 2
  const animations = Array.from({ length: 10 }, (_, i) => {
    const dot = document.createElement('span')
    dot.style.background = DOT_COLORS[i % DOT_COLORS.length]
    layer.appendChild(dot)
    const angle = turn + (i / 10) * Math.PI * 2
    const distance = 34 + Math.random() * 16
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance
    return dot.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.6)`, opacity: 0 },
      ],
      { duration: 560, easing: ease, fill: 'forwards' },
    )
  })
  void Promise.allSettled(animations.map((a) => a.finished)).then(() => layer.remove())
}

/** The soft green tint on the hired candidate's card or row, fading out over 900ms. */
export function tintHired(element: HTMLElement | null) {
  if (!element || prefersReducedMotion()) return
  const rest = getComputedStyle(element).backgroundColor
  element.animate([{ backgroundColor: '#E4F3EC' }, { backgroundColor: rest }], {
    duration: 900,
    easing: motionToken('--ease-out', 'ease-out'),
  })
}
