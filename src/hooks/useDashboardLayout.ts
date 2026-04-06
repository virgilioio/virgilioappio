import { useState, useCallback, useRef } from 'react'

// ── Widget size system ──────────────────────────────────────────────

export type WidgetSize = 'xsmall' | 'small' | 'medium' | 'large'
export type DashboardCardId = 'agenda' | 'tasks' | 'app-review' | 'onboarding' | 'jobs' | 'world-clock' | 'currency-converter' | 'photo-carousel'

export interface WidgetMeta {
  id: DashboardCardId
  label: string
  allowedSizes: WidgetSize[]
  defaultSize: WidgetSize
  fixed: boolean
}

export const WIDGET_REGISTRY: Record<DashboardCardId, WidgetMeta> = {
  'tasks':       { id: 'tasks',       label: 'Tasks',                allowedSizes: ['small'],                  defaultSize: 'small',  fixed: true },
  'agenda':      { id: 'agenda',      label: 'Agenda & Calendar',    allowedSizes: ['small'],                  defaultSize: 'small',  fixed: true },
  'app-review':  { id: 'app-review',  label: 'Application Review',   allowedSizes: ['small', 'medium', 'large'], defaultSize: 'small',  fixed: false },
  'onboarding':  { id: 'onboarding',  label: 'Onboarding Checklist', allowedSizes: ['small', 'medium', 'large'], defaultSize: 'small',  fixed: false },
  'jobs':        { id: 'jobs',        label: 'Jobs Overview',        allowedSizes: ['small', 'medium', 'large'], defaultSize: 'medium', fixed: false },
  'world-clock':        { id: 'world-clock',        label: 'World Clock',          allowedSizes: ['xsmall'],                 defaultSize: 'xsmall', fixed: true },
  'currency-converter': { id: 'currency-converter', label: 'Currency Converter',   allowedSizes: ['xsmall'],                 defaultSize: 'xsmall', fixed: true },
  'photo-carousel':     { id: 'photo-carousel',     label: 'Photo Frame',          allowedSizes: ['xsmall', 'small'],        defaultSize: 'xsmall', fixed: false },
}

export const SIZE_TO_COLS: Record<WidgetSize, number> = {
  xsmall: 1,
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
  'world-clock':        ['xsmall'],
  'currency-converter': ['xsmall'],
  'photo-carousel':     ['xsmall', 'small'],
}

const ALL_CARD_IDS: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs', 'world-clock', 'currency-converter', 'photo-carousel']
const TOTAL_COLS = 6

// ── Layout data model (position-based) ──────────────────────────────

export interface WidgetLayout {
  id: DashboardCardId
  size: WidgetSize
  col: number   // 0-based column index
  row: number   // logical row (used for ordering, not pixel position)
}

// Keep order-based type for legacy migration
interface LegacyWidgetLayout {
  id: DashboardCardId
  size: WidgetSize
  order: number
}

interface StoredLayout {
  version: number
  widgets: WidgetLayout[]
  hidden: DashboardCardId[]
}

interface LegacyStoredLayout {
  version: number
  widgets: LegacyWidgetLayout[]
  hidden: DashboardCardId[]
}

const STORAGE_KEY = 'dashboard-layout-v4'
const LEGACY_STORAGE_KEY = 'dashboard-layout-v3'

// ── Grid placement engine ───────────────────────────────────────────

export interface GridPlacement {
  id: DashboardCardId
  gridColumn: string
  gridRow: number
  colSpan: number
}

/**
 * Pack widgets by order into a grid — used ONLY for initial layout generation.
 */
export function computePlacements(widgets: { id: DashboardCardId; size: WidgetSize }[], totalCols: number = TOTAL_COLS): GridPlacement[] {
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

    for (let row = 1; !placed; row++) {
      const rowSet = getRow(row)
      for (let col = 0; col <= totalCols - clampedSpan; col++) {
        let fits = true
        for (let c = col; c < col + clampedSpan; c++) {
          if (rowSet.has(c)) { fits = false; break }
        }
        if (fits) {
          for (let c = col; c < col + clampedSpan; c++) rowSet.add(c)
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
      if (row > 100) break
    }
  }

  return placements
}

export function computeTabletPlacements(widgets: { id: DashboardCardId; size: WidgetSize }[]): GridPlacement[] {
  return computePlacements(
    widgets.map(w => ({
      ...w,
      size: SIZE_TO_COLS[w.size] > 4 ? 'large' as WidgetSize : w.size,
    })),
    4,
  )
}

// ── Convert placements to WidgetLayout with positions ───────────────

function placementsToPositionWidgets(
  placements: GridPlacement[],
  sizeMap: Record<string, WidgetSize>
): WidgetLayout[] {
  return placements.map(p => {
    const m = p.gridColumn.match(/(\d+)\s*\/\s*span\s+(\d+)/)
    const col = m ? parseInt(m[1]) - 1 : 0
    return {
      id: p.id,
      size: sizeMap[p.id] ?? 'small',
      col,
      row: p.gridRow,
    }
  })
}

// ── Default layout ──────────────────────────────────────────────────

function generateDefaultWidgets(): WidgetLayout[] {
  const defaults: { id: DashboardCardId; size: WidgetSize }[] = [
    { id: 'tasks',       size: 'small' },
    { id: 'agenda',      size: 'small' },
    { id: 'world-clock',        size: 'xsmall' },
    { id: 'currency-converter', size: 'xsmall' },
    { id: 'photo-carousel',     size: 'xsmall' },
    { id: 'app-review',  size: 'small' },
    { id: 'onboarding',  size: 'small' },
    { id: 'jobs',        size: 'medium' },
  ]
  const placements = computePlacements(defaults)
  const sizeMap = Object.fromEntries(defaults.map(d => [d.id, d.size]))
  return placementsToPositionWidgets(placements, sizeMap)
}

// ── Load / Save ─────────────────────────────────────────────────────

function loadLayout(): { widgets: WidgetLayout[]; hidden: DashboardCardId[] } {
  try {
    // Try v4 first
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: StoredLayout = JSON.parse(raw)
      if (parsed.version === 4 && Array.isArray(parsed.widgets)) {
        const validWidgets = parsed.widgets
          .filter(w => ALL_CARD_IDS.includes(w.id) && WIDGET_REGISTRY[w.id])
          .map(w => {
            const meta = WIDGET_REGISTRY[w.id]
            const size = meta.allowedSizes.includes(w.size) ? w.size : meta.defaultSize
            return { id: w.id, size, col: w.col ?? 0, row: w.row ?? 1 }
          })

        const validHidden = (parsed.hidden ?? []).filter(id => ALL_CARD_IDS.includes(id))
        const presentIds = new Set([...validWidgets.map(w => w.id), ...validHidden])
        const missing = ALL_CARD_IDS.filter(id => !presentIds.has(id))

        if (missing.length > 0) {
          // Add missing widgets using packer for their placement
          const maxRow = validWidgets.length > 0 ? Math.max(...validWidgets.map(w => w.row)) : 0
          missing.forEach((id, i) => {
            validWidgets.push({
              id,
              size: WIDGET_REGISTRY[id].defaultSize,
              col: 0,
              row: maxRow + 1 + i,
            })
          })
        }

        return { widgets: validWidgets, hidden: validHidden }
      }
    }

    // Try migrating from v3 (order-based)
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const parsed: LegacyStoredLayout = JSON.parse(legacyRaw)
      if (Array.isArray(parsed.widgets)) {
        const sorted = [...parsed.widgets]
          .filter(w => ALL_CARD_IDS.includes(w.id))
          .sort((a, b) => a.order - b.order)

        const sizeMap = Object.fromEntries(sorted.map(w => [w.id, w.size]))
        const placements = computePlacements(sorted)
        const widgets = placementsToPositionWidgets(placements, sizeMap)

        const hidden = (parsed.hidden ?? []).filter(id => ALL_CARD_IDS.includes(id))

        // Save as v4
        saveLayout(widgets, hidden)
        return { widgets, hidden }
      }
    }

    // Default
    const widgets = generateDefaultWidgets()
    return { widgets, hidden: [] }
  } catch {
    return { widgets: generateDefaultWidgets(), hidden: [] }
  }
}

function saveLayout(widgets: WidgetLayout[], hidden: DashboardCardId[]) {
  try {
    const data: StoredLayout = { version: 4, widgets, hidden }
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
    widgetsBeforeDrag.current = widgets.map(w => ({ ...w }))
  }, [widgets])

  /** Swap positions (col/row) of two widgets — only these two move */
  const swapWidgetPositions = useCallback((activeId: string, targetId: string) => {
    setWidgets(prev => {
      const active = prev.find(w => w.id === activeId)
      const target = prev.find(w => w.id === targetId)
      if (!active || !target) return prev
      if (active.col === target.col && active.row === target.row) return prev

      return prev.map(w => {
        if (w.id === activeId) return { ...w, col: target.col, row: target.row }
        if (w.id === targetId) return { ...w, col: active.col, row: active.row }
        return w
      })
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
        if (!ws.find(w => w.id === cardId)) {
          // Find first available gap
          const maxRow = ws.length > 0 ? Math.max(...ws.map(w => w.row)) : 0
          const updated = [...ws, {
            id: cardId,
            size: WIDGET_REGISTRY[cardId].defaultSize,
            col: 0,
            row: maxRow + 1,
          }]
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
      const widget = prev.find(w => w.id === cardId)
      if (!widget) return prev

      const currentIdx = meta.allowedSizes.indexOf(widget.size)
      const nextIdx = (currentIdx + 1) % meta.allowedSizes.length
      const newSize = meta.allowedSizes[nextIdx]

      // Clamp col so widget doesn't overflow grid
      const newSpan = SIZE_TO_COLS[newSize]
      const maxCol = TOTAL_COLS - newSpan
      const next = prev.map(w => {
        if (w.id !== cardId) return w
        const safeCol = Math.min(w.col, Math.max(0, maxCol))
        return { ...w, size: newSize, col: safeCol }
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
      const newSpan = SIZE_TO_COLS[size]
      const maxCol = TOTAL_COLS - newSpan
      const next = prev.map(w => {
        if (w.id !== cardId) return w
        const safeCol = Math.min(w.col, Math.max(0, maxCol))
        return { ...w, size, col: safeCol }
      })
      setHiddenCards(h => {
        persist(next, h)
        return h
      })
      return next
    })
  }, [persist])

  // ── Reset ──

  const resetLayout = useCallback(() => {
    const defaults = generateDefaultWidgets()
    setWidgets(defaults)
    setHiddenCards([])
    saveLayout(defaults, [])
  }, [])

  const toggleCustomizing = useCallback(() => {
    setIsCustomizing(prev => !prev)
  }, [])

  /** Move a widget to an exact col/row — nothing else moves */
  const moveWidgetTo = useCallback((widgetId: string, col: number, row: number) => {
    setWidgets(prev => {
      const widget = prev.find(w => w.id === widgetId)
      if (!widget) return prev
      const span = SIZE_TO_COLS[widget.size] ?? 1
      const safeCol = Math.min(Math.max(0, col), TOTAL_COLS - span)
      const next = prev.map(w => w.id === widgetId ? { ...w, col: safeCol, row } : w)
      setHiddenCards(h => {
        persist(next, h)
        return h
      })
      return next
    })
  }, [persist])

  return {
    widgets,
    visibleWidgets,
    hiddenCards,
    isCustomizing,
    saveDragStart,
    swapWidgetPositions,
    moveWidgetTo,
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
