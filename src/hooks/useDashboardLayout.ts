import { useState, useCallback, useRef } from 'react'

// ── Widget size system ──────────────────────────────────────────────

export type WidgetSize = 'small' | 'medium' | 'large'
export type DashboardCardId = 'agenda' | 'tasks' | 'app-review' | 'onboarding' | 'jobs' | 'world-clock'

export interface WidgetMeta {
  id: DashboardCardId
  label: string
  allowedSizes: WidgetSize[]
  defaultSize: WidgetSize
  fixed: boolean // true = user cannot resize
}

export const WIDGET_REGISTRY: Record<DashboardCardId, WidgetMeta> = {
  'tasks':       { id: 'tasks',       label: 'Tasks',                allowedSizes: ['small'],                  defaultSize: 'small',  fixed: true },
  'agenda':      { id: 'agenda',      label: 'Agenda & Calendar',    allowedSizes: ['small'],                  defaultSize: 'small',  fixed: true },
  'app-review':  { id: 'app-review',  label: 'Application Review',   allowedSizes: ['small', 'medium', 'large'], defaultSize: 'small',  fixed: false },
  'onboarding':  { id: 'onboarding',  label: 'Onboarding Checklist', allowedSizes: ['small', 'medium', 'large'], defaultSize: 'small',  fixed: false },
  'jobs':        { id: 'jobs',        label: 'Jobs Overview',        allowedSizes: ['small', 'medium', 'large'], defaultSize: 'medium', fixed: false },
  'world-clock': { id: 'world-clock', label: 'World Clock',          allowedSizes: ['small'],                  defaultSize: 'small',  fixed: true },
}

export const SIZE_TO_COLS: Record<WidgetSize, number> = {
  small: 2,
  medium: 3,
  large: 4,
}

export const CARD_SIZE_RULES: Record<DashboardCardId, WidgetSize[]> = {
  'tasks':       ['small'],
  'agenda':      ['small'],
  'app-review':  ['small', 'medium', 'large'],
  'onboarding':  ['small', 'medium', 'large'],
  'jobs':        ['small', 'medium', 'large'],
  'world-clock': ['small'],
}

const ALL_CARD_IDS: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs', 'world-clock']
const TOTAL_COLS = 6

// ── Layout data model ───────────────────────────────────────────────

export interface WidgetLayout {
  id: DashboardCardId
  size: WidgetSize
  order: number
}

interface StoredLayout {
  version: number
  widgets: WidgetLayout[]
  hidden: DashboardCardId[]
}

const STORAGE_KEY = 'dashboard-layout-v3'

const DEFAULT_WIDGETS: WidgetLayout[] = [
  { id: 'tasks',       size: 'small',  order: 0 },
  { id: 'agenda',      size: 'small',  order: 1 },
  { id: 'world-clock', size: 'small',  order: 2 },
  { id: 'app-review',  size: 'small',  order: 3 },
  { id: 'onboarding',  size: 'small',  order: 4 },
  { id: 'jobs',        size: 'medium', order: 5 },
]

// ── Grid placement engine ───────────────────────────────────────────

export interface GridPlacement {
  id: DashboardCardId
  gridColumn: string   // e.g. "1 / span 3"
  gridRow: number
  colSpan: number
}

/**
 * Deterministic row-packing algorithm.
 * Walks widgets in order, placing each into the first row
 * that has enough contiguous free columns starting from the left.
 */
export function computePlacements(widgets: WidgetLayout[], totalCols: number = TOTAL_COLS): GridPlacement[] {
  // Track which cells are occupied: rows are created on demand
  // occupied[row] = Set of column indices (0-based)
  const occupied: Map<number, Set<number>> = new Map()

  const getRow = (r: number) => {
    if (!occupied.has(r)) occupied.set(r, new Set())
    return occupied.get(r)!
  }

  const placements: GridPlacement[] = []

  for (const widget of widgets) {
    const span = SIZE_TO_COLS[widget.size] ?? 2
    const clampedSpan = Math.min(span, totalCols)
    let placed = false

    // Scan rows from top
    for (let row = 1; !placed; row++) {
      const rowSet = getRow(row)
      // Scan columns left to right
      for (let col = 0; col <= totalCols - clampedSpan; col++) {
        let fits = true
        for (let c = col; c < col + clampedSpan; c++) {
          if (rowSet.has(c)) { fits = false; break }
        }
        if (fits) {
          // Place it
          for (let c = col; c < col + clampedSpan; c++) {
            rowSet.add(c)
          }
          placements.push({
            id: widget.id,
            gridColumn: `${col + 1} / span ${clampedSpan}`,
            gridRow: row,
            colSpan: clampedSpan,
          })
          placed = true
          break
        }
      }
      // If row is too full, continue to next row
      if (row > 100) break // safety
    }
  }

  return placements
}

/** Tablet: 4-column grid, clamp spans */
export function computeTabletPlacements(widgets: WidgetLayout[]): GridPlacement[] {
  return computePlacements(
    widgets.map(w => ({
      ...w,
      size: SIZE_TO_COLS[w.size] > 4 ? 'large' as WidgetSize : w.size,
    })),
    4,
  )
}

// ── Load / Save ─────────────────────────────────────────────────────

function loadLayout(): { widgets: WidgetLayout[]; hidden: DashboardCardId[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { widgets: DEFAULT_WIDGETS, hidden: [] }
    const parsed: StoredLayout = JSON.parse(raw)
    if (!parsed.version || !Array.isArray(parsed.widgets)) {
      return { widgets: DEFAULT_WIDGETS, hidden: [] }
    }

    const validWidgets = parsed.widgets
      .filter(w => ALL_CARD_IDS.includes(w.id) && WIDGET_REGISTRY[w.id])
      .map(w => {
        const meta = WIDGET_REGISTRY[w.id]
        const size = meta.allowedSizes.includes(w.size) ? w.size : meta.defaultSize
        return { id: w.id, size, order: w.order }
      })
      .sort((a, b) => a.order - b.order)

    const validHidden = (parsed.hidden ?? []).filter(id => ALL_CARD_IDS.includes(id))
    const presentIds = new Set([...validWidgets.map(w => w.id), ...validHidden])
    const missing = ALL_CARD_IDS.filter(id => !presentIds.has(id))

    // Add missing widgets at end
    const maxOrder = validWidgets.length > 0 ? Math.max(...validWidgets.map(w => w.order)) : -1
    missing.forEach((id, i) => {
      validWidgets.push({ id, size: WIDGET_REGISTRY[id].defaultSize, order: maxOrder + 1 + i })
    })

    return { widgets: validWidgets, hidden: validHidden }
  } catch {
    return { widgets: DEFAULT_WIDGETS, hidden: [] }
  }
}

function saveLayout(widgets: WidgetLayout[], hidden: DashboardCardId[]) {
  try {
    const data: StoredLayout = { version: 1, widgets, hidden }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export function useDashboardLayout() {
  const [layoutState] = useState(() => loadLayout())
  const [widgets, setWidgets] = useState<WidgetLayout[]>(layoutState.widgets)
  const [hiddenCards, setHiddenCards] = useState<DashboardCardId[]>(layoutState.hidden)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const widgetsBeforeDrag = useRef<WidgetLayout[] | null>(null)

  const persist = useCallback((ws: WidgetLayout[], hidden: DashboardCardId[]) => {
    saveLayout(ws, hidden)
  }, [])

  const visibleWidgets = widgets.filter(w => !hiddenCards.includes(w.id))

  // ── Drag helpers ──

  const saveDragStart = useCallback(() => {
    widgetsBeforeDrag.current = [...widgets]
  }, [widgets])

  const reorderWidgets = useCallback((activeId: string, overId: string) => {
    setWidgets(prev => {
      const activeWidget = prev.find(w => w.id === activeId)
      const overWidget = prev.find(w => w.id === overId)
      if (!activeWidget || !overWidget) return prev
      const activeOrder = activeWidget.order
      const overOrder = overWidget.order
      return prev.map(w => {
        if (w.id === activeId) return { ...w, order: overOrder }
        if (w.id === overId) return { ...w, order: activeOrder }
        return w
      }).sort((a, b) => a.order - b.order)
    })
  }, [])

  /** Insert activeId before targetId in the order, shifting others down */
  const moveWidgetBefore = useCallback((activeId: string, targetId: string) => {
    setWidgets(prev => {
      const without = prev.filter(w => w.id !== activeId)
      const activeWidget = prev.find(w => w.id === activeId)
      if (!activeWidget) return prev
      const targetIdx = without.findIndex(w => w.id === targetId)
      if (targetIdx === -1) return prev
      const reordered = [
        ...without.slice(0, targetIdx),
        activeWidget,
        ...without.slice(targetIdx),
      ]
      return reordered.map((w, i) => ({ ...w, order: i }))
    })
  }, [])

  /** Insert activeId after targetId in the order, shifting others down */
  const moveWidgetAfter = useCallback((activeId: string, targetId: string) => {
    setWidgets(prev => {
      const without = prev.filter(w => w.id !== activeId)
      const activeWidget = prev.find(w => w.id === activeId)
      if (!activeWidget) return prev
      const targetIdx = without.findIndex(w => w.id === targetId)
      if (targetIdx === -1) return prev
      const reordered = [
        ...without.slice(0, targetIdx + 1),
        activeWidget,
        ...without.slice(targetIdx + 1),
      ]
      return reordered.map((w, i) => ({ ...w, order: i }))
    })
  }, [])

  const finalizeLayout = useCallback(() => {
    setWidgets(prev => {
      setHiddenCards(h => {
        persist(prev, h)
        return h
      })
      widgetsBeforeDrag.current = null
      return prev
    })
  }, [persist])

  const cancelDrag = useCallback(() => {
    if (widgetsBeforeDrag.current) {
      setWidgets(widgetsBeforeDrag.current)
      widgetsBeforeDrag.current = null
    }
  }, [])

  // ── Widget visibility ──

  const hideCard = useCallback((cardId: DashboardCardId) => {
    setHiddenCards(prev => {
      const next = [...prev, cardId]
      setWidgets(ws => {
        persist(ws, next)
        return ws
      })
      return next
    })
  }, [persist])

  const showCard = useCallback((cardId: DashboardCardId) => {
    setHiddenCards(prev => {
      const next = prev.filter(id => id !== cardId)
      setWidgets(ws => {
        // If card isn't in widgets list, add it at the end
        if (!ws.find(w => w.id === cardId)) {
          const maxOrder = ws.length > 0 ? Math.max(...ws.map(w => w.order)) : -1
          const updated = [...ws, { id: cardId, size: WIDGET_REGISTRY[cardId].defaultSize, order: maxOrder + 1 }]
          persist(updated, next)
          return updated
        }
        persist(ws, next)
        return ws
      })
      return next
    })
  }, [persist])

  // ── Resize ──

  const cycleWidgetSize = useCallback((cardId: DashboardCardId) => {
    const meta = WIDGET_REGISTRY[cardId]
    if (meta.fixed || meta.allowedSizes.length <= 1) return

    setWidgets(prev => {
      const next = prev.map(w => {
        if (w.id !== cardId) return w
        const currentIdx = meta.allowedSizes.indexOf(w.size)
        const nextIdx = (currentIdx + 1) % meta.allowedSizes.length
        return { ...w, size: meta.allowedSizes[nextIdx] }
      })
      setHiddenCards(h => {
        persist(next, h)
        return h
      })
      return next
    })
  }, [persist])

  const setWidgetSize = useCallback((cardId: DashboardCardId, size: WidgetSize) => {
    const meta = WIDGET_REGISTRY[cardId]
    if (!meta.allowedSizes.includes(size)) return

    setWidgets(prev => {
      const next = prev.map(w => w.id === cardId ? { ...w, size } : w)
      setHiddenCards(h => {
        persist(next, h)
        return h
      })
      return next
    })
  }, [persist])

  // ── Reset ──

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS)
    setHiddenCards([])
    saveLayout(DEFAULT_WIDGETS, [])
  }, [])

  const toggleCustomizing = useCallback(() => {
    setIsCustomizing(prev => !prev)
  }, [])

  return {
    widgets,
    visibleWidgets,
    hiddenCards,
    isCustomizing,
    saveDragStart,
    reorderWidgets,
    finalizeLayout,
    cancelDrag,
    hideCard,
    showCard,
    cycleWidgetSize,
    setWidgetSize,
    resetLayout,
    toggleCustomizing,
  }
}
