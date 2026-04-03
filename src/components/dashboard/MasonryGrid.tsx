import { ReactNode, useRef, useState, useEffect, useCallback, useMemo } from 'react'

const GAP = 20 // px gap between items

interface MasonryItem {
  id: string
  colStart: number  // 0-based column index
  colSpan: number
}

interface GhostSlot {
  colStart: number
  colSpan: number
  row: number  // logical row hint (used to position ghost near a target)
  targetId?: string // id of the widget the ghost is near
}

interface MasonryGridProps {
  items: MasonryItem[]
  totalCols: number
  children: ReactNode[]
  className?: string
  ghost?: GhostSlot | null
}

interface Position {
  top: number
  left: string
  width: string
}

export function MasonryGrid({ items, totalCols, children, className, ghost }: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [heights, setHeights] = useState<Map<string, number>>(new Map())
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      let changed = false
      const newHeights = new Map(heights)
      for (const entry of entries) {
        const el = entry.target as HTMLElement
        const id = el.dataset.masonryId
        if (!id) continue
        const h = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
        if (newHeights.get(id) !== h) {
          newHeights.set(id, h)
          changed = true
        }
      }
      if (changed) setHeights(newHeights)
    })

    const refs = itemRefs.current
    refs.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(i => i.id).join(',')])

  const positions = useMemo(() => {
    const colBottoms = new Array(totalCols).fill(0)
    const posMap = new Map<string, Position>()
    const colWidthPct = 100 / totalCols

    for (const item of items) {
      const h = heights.get(item.id) ?? 0
      const spannedCols = []
      for (let c = item.colStart; c < item.colStart + item.colSpan; c++) {
        spannedCols.push(c)
      }
      const top = Math.max(...spannedCols.map(c => colBottoms[c]))

      const leftPct = item.colStart * colWidthPct
      const widthPct = item.colSpan * colWidthPct
      const gapPerCol = GAP
      const totalGapSpace = (totalCols - 1) * gapPerCol
      const gapShare = totalGapSpace / totalCols

      const leftCalc = `calc(${leftPct}% + ${item.colStart * gapPerCol - item.colStart * gapShare}px)`
      const widthCalc = `calc(${widthPct}% - ${item.colSpan * gapShare - (item.colSpan - 1) * gapPerCol}px)`

      posMap.set(item.id, { top, left: leftCalc, width: widthCalc })

      const newBottom = top + h + GAP
      for (const c of spannedCols) {
        colBottoms[c] = newBottom
      }
    }

    return { posMap, containerHeight: Math.max(0, Math.max(...colBottoms) - GAP), colBottoms }
  }, [items, heights, totalCols])

  // Compute ghost position
  const ghostPosition = useMemo(() => {
    if (!ghost) return null

    const colWidthPct = 100 / totalCols
    const gapPerCol = GAP
    const totalGapSpace = (totalCols - 1) * gapPerCol
    const gapShare = totalGapSpace / totalCols

    const leftPct = ghost.colStart * colWidthPct
    const widthPct = ghost.colSpan * colWidthPct
    const leftCalc = `calc(${leftPct}% + ${ghost.colStart * gapPerCol - ghost.colStart * gapShare}px)`
    const widthCalc = `calc(${widthPct}% - ${ghost.colSpan * gapShare - (ghost.colSpan - 1) * gapPerCol}px)`

    // Position ghost near the target widget
    let top = 0
    if (ghost.targetId) {
      const targetPos = positions.posMap.get(ghost.targetId)
      const targetHeight = heights.get(ghost.targetId) ?? 0
      if (targetPos) {
        top = targetPos.top + targetHeight + GAP
      }
    }

    return { top, left: leftCalc, width: widthCalc }
  }, [ghost, totalCols, positions.posMap, heights])

  useEffect(() => {
    setContainerHeight(positions.containerHeight)
  }, [positions.containerHeight])

  const setRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      el.dataset.masonryId = id
      itemRefs.current.set(id, el)
    } else {
      itemRefs.current.delete(id)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        height: containerHeight > 0 ? containerHeight : undefined,
        minHeight: containerHeight > 0 ? undefined : 200,
      }}
    >
      {items.map((item, index) => {
        const pos = positions.posMap.get(item.id)
        const hasHeight = heights.has(item.id)
        return (
          <div
            key={item.id}
            ref={setRef(item.id)}
            style={{
              position: 'absolute',
              top: pos?.top ?? 0,
              left: pos?.left ?? '0%',
              width: pos?.width ?? '100%',
              transition: hasHeight ? 'top 250ms ease, left 250ms ease, width 250ms ease' : 'none',
              opacity: hasHeight ? 1 : 0,
            }}
          >
            {children[index]}
          </div>
        )
      })}

      {/* Ghost drop placeholder */}
      {ghostPosition && (
        <div
          style={{
            position: 'absolute',
            top: ghostPosition.top,
            left: ghostPosition.left,
            width: ghostPosition.width,
            height: 60,
            transition: 'top 200ms ease, left 200ms ease, width 200ms ease, opacity 150ms ease',
          }}
          className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 pointer-events-none z-10"
        />
      )}
    </div>
  )
}
