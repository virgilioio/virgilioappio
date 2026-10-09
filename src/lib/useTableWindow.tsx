import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Motion & Feel §9: tables that can pass a few hundred rows render only the rows in view
 * (plus an overscan) between two spacer rows, inside whatever element already scrolls
 * them. Rows are assumed to share one height, measured from the first rendered row.
 * Below `threshold` rows nothing changes: every row renders as before.
 *
 *   const win = useTableWindow(rows.length)
 *   <TableBody ref={win.bodyRef}>
 *     {win.topSpacer}{rows.slice(win.start, win.end).map(...)}{win.bottomSpacer}
 */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY
    if (o === 'auto' || o === 'scroll') return n
  }
  return null
}

export function useTableWindow(count: number, { threshold = 150, overscan = 12, estimate = 56 } = {}) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const [rowHeight, setRowHeight] = useState(estimate)
  const [range, setRange] = useState({ start: 0, end: Math.min(count, threshold) })
  const active = count > threshold

  const update = useCallback(() => {
    const body = bodyRef.current
    if (!body || !active) return
    const scroller = scrollParent(body)
    const viewTop = scroller ? scroller.getBoundingClientRect().top : 0
    const viewHeight = scroller ? scroller.clientHeight : window.innerHeight
    const bodyTop = body.getBoundingClientRect().top
    const offset = Math.max(0, viewTop - bodyTop)
    const first = Math.max(0, Math.floor(offset / rowHeight) - overscan)
    const last = Math.min(count, Math.ceil((offset + viewHeight) / rowHeight) + overscan)
    setRange((r) => (r.start === first && r.end === last ? r : { start: first, end: last }))
  }, [active, count, rowHeight, overscan])

  useLayoutEffect(() => {
    if (!active) return
    const row = bodyRef.current?.querySelector<HTMLElement>('tr[data-window-row]')
    if (row && row.offsetHeight > 0 && Math.abs(row.offsetHeight - rowHeight) > 0.5) setRowHeight(row.offsetHeight)
  })

  useEffect(() => {
    if (!active) return
    const scroller = scrollParent(bodyRef.current)
    const target: HTMLElement | Window = scroller ?? window
    update()
    target.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      target.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [active, update])

  const start = active ? range.start : 0
  const end = active ? Math.min(range.end, count) : count
  const spacer = (h: number, key: string) =>
    h > 0 ? <tr key={key} aria-hidden="true" style={{ height: h }} data-window-spacer="" /> : null
  return {
    bodyRef,
    active,
    start,
    end,
    topSpacer: active ? spacer(start * rowHeight, 'win-top') : null,
    bottomSpacer: active ? spacer((count - end) * rowHeight, 'win-bottom') : null,
  }
}
