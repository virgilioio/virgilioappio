import { useLayoutEffect, useRef, type RefObject } from 'react'
import { motionToken, prefersReducedMotion } from '@/lib/motion'

/**
 * Motion & Feel §7 filter chips and §12 email chips (CLAUDE.md). Put the returned ref on
 * the chip container and `data-chip={stableKey}` on every chip:
 *   - a new chip pops in from scale 0.9 + opacity (--dur-press); several added at once
 *     (a paste) come in --stagger apart;
 *   - a removed chip shrinks out (--dur-menu-out) as a ghost, then its neighbours FLIP
 *     over to close the gap (--dur-board-flip, --ease-in-out);
 *   - the first render never animates; reduced motion keeps the fades only.
 * Works by remembering every chip's box after each commit and comparing on the next.
 */
// Boxes are relative to the container, so a page scroll or a container move between
// commits never reads as chip movement.
type Box = { rect: { left: number; top: number; width: number; height: number }; ghost: HTMLElement }

export function useChipMotion<T extends HTMLElement = HTMLDivElement>(existing?: RefObject<T>) {
  const own = useRef<T>(null)
  const ref = existing ?? own
  const last = useRef<Map<string, Box> | null>(null)
  const width = useRef(0)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative'
    const rootRect = root.getBoundingClientRect()
    const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-chip]'))
    // Layout box relative to the container, ignoring any transform still in flight.
    const boxOf = (chip: HTMLElement) => {
      if (chip.offsetParent === root) {
        return { left: chip.offsetLeft, top: chip.offsetTop, width: chip.offsetWidth, height: chip.offsetHeight }
      }
      const r = chip.getBoundingClientRect()
      return { left: r.left - rootRect.left, top: r.top - rootRect.top, width: r.width, height: r.height }
    }
    const before = last.current
    const sameWidth = Math.abs(rootRect.width - width.current) < 0.5
    width.current = rootRect.width

    if (before && sameWidth) {
      const reduced = prefersReducedMotion()
      const easeOut = motionToken('--ease-out', 'ease-out')
      const easeInOut = motionToken('--ease-in-out', 'ease-in-out')
      const removed = [...before.keys()].filter((k) => !chips.some((c) => c.dataset.chip === k))
      const gap = removed.length ? motionToken('--dur-menu-out', 120) : 0
      let added = 0
      for (const chip of chips) {
        const key = chip.dataset.chip!
        const old = before.get(key)
        if (!old) {
          chip.animate(
            reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: motionToken('--dur-press', 160), delay: added++ * motionToken('--stagger', 40), easing: easeOut, fill: 'backwards' },
          )
          continue
        }
        if (reduced) continue
        const box = boxOf(chip)
        const dx = old.rect.left - box.left
        const dy = old.rect.top - box.top
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          chip.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration: motionToken('--dur-board-flip', 200),
            delay: gap,
            easing: easeInOut,
            fill: 'backwards',
          })
        }
      }
      for (const key of removed) {
        const { rect, ghost } = before.get(key)!
        Object.assign(ghost.style, {
          position: 'absolute',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: '0',
          pointerEvents: 'none',
        })
        ghost.removeAttribute('data-chip')
        ghost.setAttribute('aria-hidden', 'true')
        root.appendChild(ghost)
        const a = ghost.animate(
          reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
          { duration: motionToken('--dur-menu-out', 120), easing: easeOut, fill: 'forwards' },
        )
        a.onfinish = () => ghost.remove()
      }
    }

    const next = new Map<string, Box>()
    for (const chip of chips) {
      next.set(chip.dataset.chip!, { rect: boxOf(chip), ghost: chip.cloneNode(true) as HTMLElement })
    }
    last.current = next
  })

  return ref
}
