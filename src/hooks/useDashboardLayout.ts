import { useState, useCallback, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'

export type DashboardCardId = 'agenda' | 'tasks' | 'app-review' | 'onboarding' | 'jobs'
export type ColumnId = 'left' | 'center' | 'right'

export interface DashboardColumns {
  left: DashboardCardId[]
  center: DashboardCardId[]
  right: DashboardCardId[]
}

interface StoredLayout {
  columns: DashboardColumns
  hidden: DashboardCardId[]
}

const STORAGE_KEY = 'dashboard-layout-v2'
const ALL_CARD_IDS: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']

const DEFAULT_COLUMNS: DashboardColumns = {
  left: ['app-review', 'jobs'],
  center: ['tasks', 'onboarding'],
  right: ['agenda'],
}

function loadLayout(): { columns: DashboardColumns; hidden: DashboardCardId[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { columns: DEFAULT_COLUMNS, hidden: [] }
    const parsed = JSON.parse(raw)

    // Backwards compatibility: old format stored columns directly
    const cols: DashboardColumns = parsed.columns ?? parsed
    const hidden: DashboardCardId[] = parsed.hidden ?? []

    if (!cols.left || !cols.center || !cols.right) return { columns: DEFAULT_COLUMNS, hidden: [] }

    const validLeft = cols.left.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))
    const validCenter = cols.center.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))
    const validRight = cols.right.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))
    const validHidden = hidden.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))

    const present = new Set([...validLeft, ...validCenter, ...validRight, ...validHidden])
    const missing = ALL_CARD_IDS.filter(id => !present.has(id))

    return {
      columns: {
        left: validLeft,
        center: validCenter,
        right: [...validRight, ...missing],
      },
      hidden: validHidden,
    }
  } catch {
    return { columns: DEFAULT_COLUMNS, hidden: [] }
  }
}

function saveLayout(columns: DashboardColumns, hidden: DashboardCardId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns, hidden }))
  } catch {
    // storage full or unavailable
  }
}

function findCardColumn(columns: DashboardColumns, cardId: string): ColumnId | null {
  if (columns.left.includes(cardId as DashboardCardId)) return 'left'
  if (columns.center.includes(cardId as DashboardCardId)) return 'center'
  if (columns.right.includes(cardId as DashboardCardId)) return 'right'
  return null
}

export function useDashboardLayout() {
  const [layoutState] = useState(() => loadLayout())
  const [columns, setColumns] = useState<DashboardColumns>(layoutState.columns)
  const [hiddenCards, setHiddenCards] = useState<DashboardCardId[]>(layoutState.hidden)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const columnsBeforeDrag = useRef<DashboardColumns | null>(null)

  const persist = useCallback((cols: DashboardColumns, hidden: DashboardCardId[]) => {
    saveLayout(cols, hidden)
  }, [])

  const saveDragStart = useCallback(() => {
    columnsBeforeDrag.current = JSON.parse(JSON.stringify(columns))
  }, [columns])

  const moveCardToColumn = useCallback((
    activeId: string,
    overColumnId: ColumnId,
    overIndex: number,
  ) => {
    setColumns(prev => {
      const sourceCol = findCardColumn(prev, activeId)
      if (!sourceCol) return prev

      const cardId = activeId as DashboardCardId
      const next = {
        left: [...prev.left],
        center: [...prev.center],
        right: [...prev.right],
      }

      next[sourceCol] = next[sourceCol].filter(id => id !== cardId)
      const idx = Math.min(overIndex, next[overColumnId].length)
      next[overColumnId].splice(idx, 0, cardId)

      return next
    })
  }, [])

  const reorderWithinColumn = useCallback((
    columnId: ColumnId,
    activeId: string,
    overId: string,
  ) => {
    setColumns(prev => {
      const col = [...prev[columnId]]
      const oldIndex = col.indexOf(activeId as DashboardCardId)
      const newIndex = col.indexOf(overId as DashboardCardId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return { ...prev, [columnId]: arrayMove(col, oldIndex, newIndex) }
    })
  }, [])

  const finalizeLayout = useCallback(() => {
    setColumns(prev => {
      setHiddenCards(h => {
        persist(prev, h)
        return h
      })
      columnsBeforeDrag.current = null
      return prev
    })
  }, [persist])

  const cancelDrag = useCallback(() => {
    if (columnsBeforeDrag.current) {
      setColumns(columnsBeforeDrag.current)
      columnsBeforeDrag.current = null
    }
  }, [])

  const hideCard = useCallback((cardId: DashboardCardId) => {
    setColumns(prev => {
      const sourceCol = findCardColumn(prev, cardId)
      if (!sourceCol) return prev
      const next = {
        left: [...prev.left],
        center: [...prev.center],
        right: [...prev.right],
      }
      next[sourceCol] = next[sourceCol].filter(id => id !== cardId)
      setHiddenCards(h => {
        const newHidden = [...h, cardId]
        persist(next, newHidden)
        return newHidden
      })
      return next
    })
  }, [persist])

  const showCard = useCallback((cardId: DashboardCardId) => {
    setHiddenCards(prev => {
      const newHidden = prev.filter(id => id !== cardId)
      setColumns(cols => {
        const counts = {
          left: cols.left.length,
          center: cols.center.length,
          right: cols.right.length,
        }
        const shortest = (Object.keys(counts) as ColumnId[]).reduce((a, b) => counts[a] <= counts[b] ? a : b)
        const next = {
          left: [...cols.left],
          center: [...cols.center],
          right: [...cols.right],
        }
        next[shortest] = [...next[shortest], cardId]
        persist(next, newHidden)
        return next
      })
      return newHidden
    })
  }, [persist])

  const resetLayout = useCallback(() => {
    setColumns(DEFAULT_COLUMNS)
    setHiddenCards([])
    saveLayout(DEFAULT_COLUMNS, [])
  }, [])

  const toggleCustomizing = useCallback(() => {
    setIsCustomizing(prev => !prev)
  }, [])

  return {
    columns,
    hiddenCards,
    isCustomizing,
    findCardColumn: (cardId: string) => findCardColumn(columns, cardId),
    saveDragStart,
    moveCardToColumn,
    reorderWithinColumn,
    finalizeLayout,
    cancelDrag,
    hideCard,
    showCard,
    resetLayout,
    toggleCustomizing,
  }
}
