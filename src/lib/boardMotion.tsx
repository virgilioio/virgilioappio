import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react'
import { defaultDropAnimationSideEffects, type DropAnimation } from '@dnd-kit/core'
import { motionToken, prefersReducedMotion } from '@/lib/motion'

export { motionToken }

/**
 * Motion & Feel §4 Boards (CLAUDE.md) — shared by the job pipeline board and the
 * compact board on /pipeline.
 *
 *   BoardLift     the dragged copy lifts: scale 1.03, rotate 1.5°, --shadow-lift, over
 *                 --dur-press on --ease-out (reduced motion: shadow only).
 *   useBoardFlip  after a drop reflows the columns, every other card slides from where
 *                 it was to its new place (--dur-board-flip, --ease-in-out). The dropped
 *                 card itself is animated by DragOverlay's drop animation.
 *
 *   boardDropAnimation  the dropped copy settles into its slot on --ease-spring over
 *                 --dur-board-drop.
 *
 * Cards are found by `data-board-card` inside the board element.
 */

const reduced = prefersReducedMotion

export function BoardLift({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const lifted = reduced() ? 'none' : 'rotate(1.5deg) scale(1.03)'
    el.style.transform = lifted
    el.style.boxShadow = 'var(--shadow-lift)'
    const anim = el.animate(
      [
        { transform: 'none', boxShadow: '0 0 0 0 rgb(13 13 9 / 0)' },
        { transform: lifted, boxShadow: 'var(--shadow-lift)' },
      ],
      { duration: motionToken('--dur-press', 160), easing: motionToken('--ease-out', 'ease-out') },
    )
    return () => anim.cancel()
  }, [])
  return (
    <div ref={ref} className={className} data-board-lift="">
      {children}
    </div>
  )
}

/**
 * DragOverlay drop animation: settle on the spring curve; the slot stays hidden until it
 * lands. Reduced motion: no settle, the card simply appears in its place.
 */
export function boardDropAnimation(): DropAnimation | null {
  if (reduced()) return null
  return {
    duration: motionToken('--dur-board-drop', 280),
    easing: motionToken('--ease-spring', 'cubic-bezier(0.34, 1.4, 0.64, 1)'),
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } }),
  }
}

const MAX_FLIP_CARDS = 150

export function useBoardFlip(boardRef: React.RefObject<HTMLElement>, layoutKey: unknown) {
  const pending = useRef<{ tops: Map<string, DOMRect>; skip: Set<string> } | null>(null)
  const running = useRef<Animation[]>([])

  /** Call right before the state change that moves cards between columns. */
  const captureBoard = useCallback((skipIds: string[] = []) => {
    pending.current = null
    const board = boardRef.current
    if (!board || reduced()) return
    const cards = board.querySelectorAll<HTMLElement>('[data-board-card]')
    if (cards.length > MAX_FLIP_CARDS) return
    const tops = new Map<string, DOMRect>()
    cards.forEach((c) => tops.set(c.dataset.boardCard!, c.getBoundingClientRect()))
    pending.current = { tops, skip: new Set(skipIds) }
  }, [boardRef])

  useLayoutEffect(() => {
    const snap = pending.current
    pending.current = null
    const board = boardRef.current
    if (!snap || !board) return
    running.current.forEach((a) => a.cancel())
    const duration = motionToken('--dur-board-flip', 200)
    const easing = motionToken('--ease-in-out', 'ease-in-out')
    const moves: { el: HTMLElement; dx: number; dy: number }[] = []
    board.querySelectorAll<HTMLElement>('[data-board-card]').forEach((el) => {
      const id = el.dataset.boardCard!
      if (snap.skip.has(id)) return
      const before = snap.tops.get(id)
      if (!before) return
      const now = el.getBoundingClientRect()
      const dx = before.left - now.left
      const dy = before.top - now.top
      if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) moves.push({ el, dx, dy })
    })
    running.current = moves.map(({ el, dx, dy }) => {
      const a = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing })
      a.onfinish = () => a.cancel()
      return a
    })
  }, [layoutKey, boardRef])

  return { captureBoard }
}
