import { ReactNode, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { EmptyGridCell } from './EmptyGridCell'

const GAP = 20 // px gap between items

interface MasonryItem {
  id: string
  colStart: number  // 0-based column index
  colSpan: number
}

interface GhostSlot {
  colStart: number
  colSpan: number
  row: number
  targetId?: string
}

interface MasonryGridProps {
  items: MasonryItem[]
  totalCols: number
  children: ReactNode[]
  className?: string
  ghost?: GhostSlot | null
  isDragActive?: boolean
}

interface Position {
  top: number
  left: string
  width: string
}

export function MasonryGrid({ items, totalCols, children, className, ghost, isDragActive }: MasonryGridProps) {
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

  // Compute empty cells for droppable zones
  const emptyCells = useMemo(() => {
    if (!isDragActive) return []

    // Build occupancy grid: for each row, which cols are taken
    const maxRow = items.length > 0 ? Math.max(...items.map(i => {
      // Find the logical row from colBottoms
      const pos = positions.posMap.get(i.id)
      return pos ? Math.floor(pos.top / 100) + 1 : 1
    })) : 1

    // Use colBottoms to find the bottom of content
    const maxBottom = Math.max(0, ...positions.colBottoms)

    // For each column, find if there's empty space at the bottom
    const cells: { col: number; row: number; top: number }[] = []
    for (let col = 0; col < totalCols; col++) {
      const colBottom = positions.colBottoms[col]
      // If this column is shorter than the tallest, there's empty space
      if (colBottom < maxBottom || maxBottom === 0) {
        cells.push({ col, row: 999, top: colBottom === 0 ? 0 : colBottom })
      }
    }

    // Also add a full row at the very bottom for any column
    for (let col = 0; col < totalCols; col++) {
      const bottom = positions.colBottoms[col]
      if (bottom >= maxBottom && maxBottom > 0) {
        cells.push({ col, row: 1000, top: maxBottom + GAP })
      }
    }

    return cells
  }, [isDragActive, items, positions.colBottoms, positions.posMap, totalCols])

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

  // Calc helpers for empty cell positioning
  const calcLeft = useCallback((col: number) => {
    const colWidthPct = 100 / totalCols
    const gapPerCol = GAP
    const totalGapSpace = (totalCols - 1) * gapPerCol
    const gapShare = totalGapSpace / totalCols
    return `calc(${col * colWidthPct}% + ${col * gapPerCol - col * gapShare}px)`
  }, [totalCols])

  const calcWidth = useCallback((span: number) => {
    const colWidthPct = 100 / totalCols
    const gapPerCol = GAP
    const totalGapSpace = (totalCols - 1) * gapPerCol
    const gapShare = totalGapSpace / totalCols
    return `calc(${span * colWidthPct}% - ${span * gapShare - (span - 1) * gapPerCol}px)`
  }, [totalCols])

  // Extra height for empty cell droppables at the bottom
  const extraHeight = isDragActive && emptyCells.length > 0 ? 80 : 0

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        height: containerHeight > 0 ? containerHeight + extraHeight : undefined,
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

      {/* Empty cell droppables */}
      {isDragActive && emptyCells.map((cell) => (
        <div
          key={`empty-${cell.col}-${cell.row}`}
          style={{
            position: 'absolute',
            top: cell.top,
            left: calcLeft(cell.col),
            width: calcWidth(1),
            height: 60,
          }}
        >
          <EmptyGridCell col={cell.col} row={cell.row} isDragActive />
        </div>
      ))}

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
