import { useState, useCallback, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'

export type DashboardCardId = 'agenda' | 'tasks' | 'app-review' | 'onboarding' | 'jobs'
export type ColumnId = 'left' | 'center' | 'right'

export interface DashboardColumns {
  left: DashboardCardId[]
  center: DashboardCardId[]
  right: DashboardCardId[]
}

export type CardSpans = Partial<Record<DashboardCardId, number>>

export const CARD_SIZE_RULES: Record<DashboardCardId, { allowed: number[]; default: number }> = {
  'tasks':      { allowed: [2], default: 2 },
  'agenda':     { allowed: [2], default: 2 },
  'app-review': { allowed: [2, 3, 4], default: 2 },
  'onboarding': { allowed: [2, 3, 4], default: 2 },
  'jobs':       { allowed: [2, 3, 4], default: 2 },
}

interface StoredLayout {
  columns: DashboardColumns
  hidden: DashboardCardId[]
  spans: CardSpans
}

const STORAGE_KEY = 'dashboard-layout-v3'
const ALL_CARD_IDS: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']
const COLUMN_IDS: ColumnId[] = ['left', 'center', 'right']

const DEFAULT_COLUMNS: DashboardColumns = {
  left: ['app-review', 'jobs'],
  center: ['tasks', 'onboarding'],
  right: ['agenda'],
}

export function getCardSpan(spans: CardSpans, cardId: DashboardCardId): number {
  const stored = spans[cardId]
  const rules = CARD_SIZE_RULES[cardId]
  if (stored && rules.allowed.includes(stored)) return stored
  return rules.default
}

// --- Uniqueness helpers ---

/**
 * Find which column a card currently lives in.
 * Returns null if not found in any column (e.g. it's hidden).
 */
function findColumnForCard(columns: DashboardColumns, cardId: string): ColumnId | null {
  for (const colId of COLUMN_IDS) {
    if (columns[colId].includes(cardId as DashboardCardId)) return colId
  }
  return null
}

/**
 * Remove a card from ALL columns. Returns a new columns object.
 * This is the key invariant enforcer — call before every insert
 * so a card can never exist in two places simultaneously.
 */
function removeCardFromAllColumns(columns: DashboardColumns, cardId: DashboardCardId): DashboardColumns {
  return {
    left: columns.left.filter(id => id !== cardId),
    center: columns.center.filter(id => id !== cardId),
    right: columns.right.filter(id => id !== cardId),
  }
}

/**
 * Defensive deduplication pass. Walks columns left→center→right
 * and keeps only the first occurrence of each card id.
 */
function normalizeColumns(columns: DashboardColumns): DashboardColumns {
  const seen = new Set<DashboardCardId>()
  const dedup = (arr: DashboardCardId[]) =>
    arr.filter(id => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  return {
    left: dedup(columns.left),
    center: dedup(columns.center),
    right: dedup(columns.right),
  }
}

function loadLayout(): { columns: DashboardColumns; hidden: DashboardCardId[]; spans: CardSpans } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { columns: DEFAULT_COLUMNS, hidden: [], spans: {} }
    const parsed = JSON.parse(raw)

    const cols: DashboardColumns = parsed.columns ?? parsed
    const hidden: DashboardCardId[] = parsed.hidden ?? []
    const spans: CardSpans = parsed.spans ?? {}

    if (!cols.left || !cols.center || !cols.right) return { columns: DEFAULT_COLUMNS, hidden: [], spans: {} }

    const rawLeft = cols.left.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))
    const rawCenter = cols.center.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))
    const rawRight = cols.right.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))
    const rawHidden = hidden.filter((id): id is DashboardCardId => ALL_CARD_IDS.includes(id))

    // Deduplicate: each card must appear exactly once across all columns + hidden
    const seen = new Set<DashboardCardId>()
    const dedup = (arr: DashboardCardId[]) =>
      arr.filter(id => { if (seen.has(id)) return false; seen.add(id); return true })

    const validLeft = dedup(rawLeft)
    const validCenter = dedup(rawCenter)
    const validRight = dedup(rawRight)
    const validHidden = dedup(rawHidden)

    const present = new Set([...validLeft, ...validCenter, ...validRight, ...validHidden])
    const missing = ALL_CARD_IDS.filter(id => !present.has(id))

    const validSpans: CardSpans = {}
    for (const [k, v] of Object.entries(spans)) {
      const cardId = k as DashboardCardId
      if (ALL_CARD_IDS.includes(cardId) && typeof v === 'number' && CARD_SIZE_RULES[cardId].allowed.includes(v)) {
        validSpans[cardId] = v
      }
    }

    return {
      columns: {
        left: validLeft,
        center: validCenter,
        right: [...validRight, ...missing],
      },
      hidden: validHidden,
      spans: validSpans,
    }
  } catch {
    return { columns: DEFAULT_COLUMNS, hidden: [], spans: {} }
  }
}

function saveLayout(columns: DashboardColumns, hidden: DashboardCardId[], spans: CardSpans) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns, hidden, spans }))
  } catch {
    // storage full or unavailable
  }
}

export function useDashboardLayout() {
  const [layoutState] = useState(() => loadLayout())
  const [columns, setColumns] = useState<DashboardColumns>(layoutState.columns)
  const [hiddenCards, setHiddenCards] = useState<DashboardCardId[]>(layoutState.hidden)
  const [cardSpans, setCardSpans] = useState<CardSpans>(layoutState.spans)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const columnsBeforeDrag = useRef<DashboardColumns | null>(null)

  const persist = useCallback((cols: DashboardColumns, hidden: DashboardCardId[], spans: CardSpans) => {
    saveLayout(cols, hidden, spans)
  }, [])

  const saveDragStart = useCallback(() => {
    columnsBeforeDrag.current = JSON.parse(JSON.stringify(columns))
  }, [columns])

  /**
   * Move a card to a target column at a given index.
   * IMPORTANT: removes the card from ALL columns first, then inserts once.
   * This prevents duplication even if called with stale source info.
   */
  const moveCardToColumn = useCallback((
    activeId: string,
    overColumnId: ColumnId,
    overIndex: number,
  ) => {
    setColumns(prev => {
      const cardId = activeId as DashboardCardId

      // Remove from every column first — guarantees uniqueness
      const cleaned = removeCardFromAllColumns(prev, cardId)

      // Insert at the target position
      const targetCol = [...cleaned[overColumnId]]
      const idx = Math.min(overIndex, targetCol.length)
      targetCol.splice(idx, 0, cardId)

      const next = { ...cleaned, [overColumnId]: targetCol }

      // Defensive normalization
      return normalizeColumns(next)
    })
  }, [])

  /**
   * Reorder a card within the same column.
   * Also normalizes to prevent any accumulated duplicates.
   */
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
      const reordered = arrayMove(col, oldIndex, newIndex)
      return normalizeColumns({ ...prev, [columnId]: reordered })
    })
  }, [])

  const finalizeLayout = useCallback(() => {
    setColumns(prev => {
      const normalized = normalizeColumns(prev)
      setHiddenCards(h => {
        setCardSpans(s => {
          persist(normalized, h, s)
          return s
        })
        return h
      })
      columnsBeforeDrag.current = null
      return normalized
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
      // Remove from all columns
      const next = removeCardFromAllColumns(prev, cardId)
      setHiddenCards(h => {
        // Ensure not already in hidden
        const newHidden = h.includes(cardId) ? h : [...h, cardId]
        setCardSpans(s => {
          const newSpans = { ...s }
          delete newSpans[cardId]
          persist(next, newHidden, newSpans)
          return newSpans
        })
        return newHidden
      })
      return normalizeColumns(next)
    })
  }, [persist])

  const showCard = useCallback((cardId: DashboardCardId) => {
    setHiddenCards(prev => {
      const newHidden = prev.filter(id => id !== cardId)
      setColumns(cols => {
        // Remove from all columns first in case of stale state
        const cleaned = removeCardFromAllColumns(cols, cardId)
        const counts = {
          left: cleaned.left.length,
          center: cleaned.center.length,
          right: cleaned.right.length,
        }
        const shortest = (Object.keys(counts) as ColumnId[]).reduce((a, b) => counts[a] <= counts[b] ? a : b)
        const next = { ...cleaned, [shortest]: [...cleaned[shortest], cardId] }
        const normalized = normalizeColumns(next)
        setCardSpans(s => {
          persist(normalized, newHidden, s)
          return s
        })
        return normalized
      })
      return newHidden
    })
  }, [persist])

  const toggleCardSpan = useCallback((cardId: DashboardCardId) => {
    const rules = CARD_SIZE_RULES[cardId]
    if (rules.allowed.length <= 1) return

    setCardSpans(prev => {
      const currentSpan = getCardSpan(prev, cardId)
      const currentIndex = rules.allowed.indexOf(currentSpan)
      const nextIndex = (currentIndex + 1) % rules.allowed.length
      const newSpan = rules.allowed[nextIndex]
      const newSpans = { ...prev, [cardId]: newSpan }

      setColumns(cols => {
        setHiddenCards(h => {
          persist(cols, h, newSpans)
          return h
        })
        return cols
      })

      return newSpans
    })
  }, [persist])

  const resetLayout = useCallback(() => {
    setColumns(DEFAULT_COLUMNS)
    setHiddenCards([])
    setCardSpans({})
    saveLayout(DEFAULT_COLUMNS, [], {})
  }, [])

  const toggleCustomizing = useCallback(() => {
    setIsCustomizing(prev => !prev)
  }, [])

  return {
    columns,
    hiddenCards,
    cardSpans,
    isCustomizing,
    // Expose the live-state lookup for use in DnD handlers
    findCardColumn: (cardId: string) => findColumnForCard(columns, cardId),
    saveDragStart,
    moveCardToColumn,
    reorderWithinColumn,
    finalizeLayout,
    cancelDrag,
    hideCard,
    showCard,
    toggleCardSpan,
    resetLayout,
    toggleCustomizing,
  }
}
