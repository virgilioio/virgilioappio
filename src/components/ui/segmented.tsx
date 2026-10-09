import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Motion & Feel §14 segmented controls: one layer slides between options, like tabs
 * (§2); options never crossfade their own fill.
 *
 * Use on any hand-rolled control:
 *   const segRef = useSegmentLayer<HTMLDivElement>()
 *   <div ref={segRef} className="… gio-seg">
 *     {options.map(o => <button data-seg-option data-active={o === value || undefined} …>)}
 *     <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.06)" />
 *   </div>
 *
 * Options mark themselves with `data-seg-option` and `data-active` when selected; they
 * keep their own text colour and weight but draw no active background. An option may
 * carry `data-seg-fill="#FEF3C7"` to give the layer its own colour while it's active.
 * The layer is a fill clipped to the active option (clip-path slides at --dur-tabs on
 * --ease-in-out); its shadow is a drop-shadow on the wrapper, so it follows the clip.
 * First paint, resizes and keyboard changes jump; reduced motion never slides.
 */

let lastInput: 'pointer' | 'key' = 'pointer'
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { lastInput = 'key' }, true)
  window.addEventListener('pointerdown', () => { lastInput = 'pointer' }, true)
}

function attachSegmentLayer(root: HTMLElement) {
  let ready = false
  let frame = 0
  const options = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-seg-option]')).filter(
      (o) => o.closest('.gio-seg') === root,
    )
  const measure = (animate: boolean) => {
    const layer = root.querySelector<HTMLElement>(':scope > .gio-seg-layer')
    const active = options().find((o) => o.hasAttribute('data-active'))
    if (!active || !layer) {
      root.removeAttribute('data-seg-ready')
      ready = false
      return
    }
    const slide = ready && animate
    if (!slide) layer.style.setProperty('--seg-transition', 'none')
    const rb = root.getBoundingClientRect()
    const ab = active.getBoundingClientRect()
    // Screen boxes include any scale on the way up (a dialog growing in, a pressed
    // button); divide it out so the clip is in the container's own pixels.
    // (offsetWidth is rounded, so near-1 ratios are rounding, not scale.)
    const ratio = root.offsetWidth ? rb.width / root.offsetWidth : 1
    const s = ratio && Math.abs(ratio - 1) > 0.01 ? ratio : 1
    const x = (ab.left - rb.left) / s - root.clientLeft
    const y = (ab.top - rb.top) / s - root.clientTop
    const w = ab.width / s
    const h = ab.height / s
    root.style.setProperty('--seg-x', `${x}px`)
    root.style.setProperty('--seg-y', `${y}px`)
    root.style.setProperty('--seg-right', `${root.clientWidth - x - w}px`)
    root.style.setProperty('--seg-bottom', `${root.clientHeight - y - h}px`)
    root.style.setProperty('--seg-radius', getComputedStyle(active).borderRadius)
    const fill = active.dataset.segFill
    if (fill) root.style.setProperty('--seg-fill', fill)
    else root.style.removeProperty('--seg-fill')
    root.setAttribute('data-seg-ready', '')
    ready = true
    if (!slide) {
      void layer.offsetWidth
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => layer.style.removeProperty('--seg-transition'))
    }
  }
  measure(false)
  const resize = new ResizeObserver(() => measure(false))
  resize.observe(root)
  options().forEach((o) => resize.observe(o))
  const mutation = new MutationObserver((records) => {
    if (records.some((r) => r.type === 'childList')) options().forEach((o) => resize.observe(o))
    const changed = records.some((r) => r.type === 'attributes' && r.attributeName === 'data-active')
    measure(changed && lastInput === 'pointer')
  })
  mutation.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-active', 'data-seg-fill'] })
  document.fonts?.ready.then(() => measure(false))
  return () => {
    resize.disconnect()
    mutation.disconnect()
    cancelAnimationFrame(frame)
  }
}

/** Returns a stable callback ref for the `.gio-seg` container (works when it mounts later). */
export function useSegmentLayer<T extends HTMLElement = HTMLDivElement>() {
  const cleanup = React.useRef<(() => void) | null>(null)
  return React.useCallback((el: T | null) => {
    cleanup.current?.()
    cleanup.current = el ? attachSegmentLayer(el) : null
  }, [])
}

/** The sliding fill. Put it last inside the `.gio-seg` container. */
export function SegmentLayer({
  fill,
  shadow,
  className,
}: {
  /** The active option's background. */
  fill: string
  /** Its shadow, written like a box-shadow with one layer and no spread ("0 1px 2px rgba(…)"). */
  shadow?: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('gio-seg-layer', className)}
      style={{ ['--seg-default-fill' as string]: fill, filter: shadow ? `drop-shadow(${shadow})` : undefined }}
    >
      <span className="gio-seg-fill" />
    </span>
  )
}
