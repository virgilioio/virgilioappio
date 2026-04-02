import { useState, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'

export type DashboardCardId = 'agenda' | 'tasks' | 'app-review' | 'onboarding' | 'jobs'

const STORAGE_KEY = 'dashboard-layout'
const DEFAULT_ORDER: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']

function loadOrder(): DashboardCardId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ORDER
    const parsed = JSON.parse(raw) as string[]
    // Validate: must contain exactly the known IDs
    const valid = parsed.filter((id): id is DashboardCardId =>
      DEFAULT_ORDER.includes(id as DashboardCardId)
    )
    // Add any missing cards at the end
    const missing = DEFAULT_ORDER.filter(id => !valid.includes(id))
    return [...valid, ...missing]
  } catch {
    return DEFAULT_ORDER
  }
}

function saveOrder(order: DashboardCardId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // storage full or unavailable
  }
}

export function useDashboardLayout() {
  const [cardOrder, setCardOrder] = useState<DashboardCardId[]>(loadOrder)
  const [isCustomizing, setIsCustomizing] = useState(false)

  const reorderCards = useCallback((activeId: string, overId: string) => {
    setCardOrder(prev => {
      const oldIndex = prev.indexOf(activeId as DashboardCardId)
      const newIndex = prev.indexOf(overId as DashboardCardId)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      saveOrder(next)
      return next
    })
  }, [])

  const resetLayout = useCallback(() => {
    setCardOrder(DEFAULT_ORDER)
    saveOrder(DEFAULT_ORDER)
  }, [])

  const toggleCustomizing = useCallback(() => {
    setIsCustomizing(prev => !prev)
  }, [])

  return {
    cardOrder,
    isCustomizing,
    reorderCards,
    resetLayout,
    toggleCustomizing,
  }
}
