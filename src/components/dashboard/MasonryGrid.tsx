import { ReactNode, useRef, useState, useEffect, useCallback, useMemo } from 'react'

const GAP = 20 // px gap between items

interface MasonryItem {
  id: string
  colStart: number  // 0-based column index
  colSpan: number
}

interface MasonryGridProps {
  items: MasonryItem[]
  totalCols: number
  children: ReactNode[]
  /** Map from item id to ReactNode index — children must be in same order as items */
  className?: string
}

interface Position {
  top: number
  left: string   // percentage-based for responsiveness
  width: string  // percentage-based
}

export function MasonryGrid({ items, totalCols, children, className }: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [heights, setHeights] = useState<Map<string, number>>(new Map())
  const [containerHeight, setContainerHeight] = useState(0)

  // Observe height changes on all items
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
  // Re-run when items change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(i => i.id).join(',')])

  // Compute positions based on measured heights
  const positions = useMemo(() => {
    const colBottoms = new Array(totalCols).fill(0)
    const posMap = new Map<string, Position>()

    const colWidthPct = 100 / totalCols
    // Gap handling: each item gets horizontal gaps via calc
    // Width = (colSpan / totalCols * 100%) - gap adjustments
    // Left = (colStart / totalCols * 100%) + half gap

    for (const item of items) {
      const h = heights.get(item.id) ?? 0
      // Find the top for this item: max of all columns it spans
      const spannedCols = []
      for (let c = item.colStart; c < item.colStart + item.colSpan; c++) {
        spannedCols.push(c)
      }
      const top = Math.max(...spannedCols.map(c => colBottoms[c]))

      // Calculate percentage-based left and width
      const leftPct = item.colStart * colWidthPct
      const widthPct = item.colSpan * colWidthPct

      // Adjust for gaps: total gap space in the grid = (totalCols - 1) * GAP
      // Each column's share of gaps: ((totalCols - 1) * GAP) / totalCols
      // For an item spanning S columns starting at C:
      //   left = C * colWidthPct% + C * GAP / totalCols ... simplified:
      //   We use calc() for precision
      const gapPerCol = GAP // gap between columns
      const totalGapSpace = (totalCols - 1) * gapPerCol
      const gapShare = totalGapSpace / totalCols

      const leftCalc = `calc(${leftPct}% + ${item.colStart * gapPerCol - item.colStart * gapShare}px)`
      const widthCalc = `calc(${widthPct}% - ${item.colSpan * gapShare - (item.colSpan - 1) * gapPerCol}px)`

      posMap.set(item.id, {
        top,
        left: leftCalc,
        width: widthCalc,
      })

      // Update column bottoms
      const newBottom = top + h + GAP
      for (const c of spannedCols) {
        colBottoms[c] = newBottom
      }
    }

    return { posMap, containerHeight: Math.max(0, Math.max(...colBottoms) - GAP) }
  }, [items, heights, totalCols])

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
              // Only transition after initial measurement
              transition: hasHeight ? 'top 250ms ease, left 250ms ease, width 250ms ease' : 'none',
              // Hide until first measurement to avoid flash
              opacity: hasHeight ? 1 : 0,
            }}
          >
            {children[index]}
          </div>
        )
      })}
    </div>
  )
}
