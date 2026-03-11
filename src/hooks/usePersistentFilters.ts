import { useCallback, useEffect, useRef } from 'react'
import type { PageContext } from './useSavedViews'

const STORAGE_PREFIX = 'virgilio_filters_'
const VIEW_PREFIX = 'virgilio_active_view_'

/**
 * Serialize filters to sessionStorage so they persist across navigation and tab switches.
 * Handles Date objects specially.
 */
function serializeFilters(filters: Record<string, unknown>): string {
  return JSON.stringify(filters, (_, value) => {
    if (value instanceof Date) return { __date: value.toISOString() }
    return value
  })
}

function deserializeFilters<T extends Record<string, unknown>>(raw: string): T {
  return JSON.parse(raw, (_, value) => {
    if (value && typeof value === 'object' && '__date' in value) return new Date(value.__date)
    return value
  }) as T
}

export function usePersistentFilters<T>(
  pageContext: PageContext,
  currentFilters: T,
  setFilters: (filters: T) => void,
  defaultFilters: T,
) {
  const initialized = useRef(false)
  const storageKey = `${STORAGE_PREFIX}${pageContext}`
  const viewKey = `${VIEW_PREFIX}${pageContext}`

  // On mount, restore from sessionStorage
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) {
        const restored = deserializeFilters<T>(stored)
        setFilters(restored)
      }
    } catch {
      // ignore
    }
  }, [storageKey, setFilters])

  // Persist filters whenever they change
  useEffect(() => {
    if (!initialized.current) return
    try {
      sessionStorage.setItem(storageKey, serializeFilters(currentFilters))
    } catch {
      // storage full, ignore
    }
  }, [currentFilters, storageKey])

  const setActiveViewId = useCallback((viewId: string | null) => {
    if (viewId) sessionStorage.setItem(viewKey, viewId)
    else sessionStorage.removeItem(viewKey)
  }, [viewKey])

  const getActiveViewId = useCallback((): string | null => {
    return sessionStorage.getItem(viewKey)
  }, [viewKey])

  const clearPersistedFilters = useCallback(() => {
    sessionStorage.removeItem(storageKey)
    sessionStorage.removeItem(viewKey)
  }, [storageKey, viewKey])

  return { setActiveViewId, getActiveViewId, clearPersistedFilters }
}
