
import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig {
  key: string | null
  direction: SortDirection
}

export function useSortableTable<T>(data: T[], defaultSort?: { key: string; direction: SortDirection }) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultSort?.key || null,
    direction: defaultSort?.direction || null
  })

  // §3 Sort FLIP: attach `bodyRef` to the <TableBody> whose rows are `sortedData` in
  // order (one <tr> per row). On a sort change each row slides from where it was to its
  // new place (--dur-move, --ease-in-out). Filtering, paging and data updates never
  // animate; more than 60 rows or reduced motion just re-render.
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const shownRef = useRef<T[]>(data)
  const snapshot = useRef<{ tops: Map<unknown, number> } | null>(null)
  const running = useRef<Animation[]>([])
  const keyOf = (row: T, i: number): unknown => (row as { id?: unknown })?.id ?? row ?? i

  const capture = useCallback(() => {
    snapshot.current = null
    const body = bodyRef.current
    const rows = shownRef.current
    if (!body || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const trs = Array.from(body.children) as HTMLElement[]
    if (trs.length !== rows.length || rows.length > 60) return
    const tops = new Map<unknown, number>()
    trs.forEach((tr, i) => tops.set(keyOf(rows[i], i), tr.getBoundingClientRect().top))
    snapshot.current = { tops }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A default chosen outside the table (e.g. a "Sort:" menu) takes over when it changes.
  const defaultKey = defaultSort?.key ?? null
  const defaultDirection = defaultSort?.direction ?? null
  const firstSync = useRef(true)
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false
      return
    }
    capture()
    setSortConfig({ key: defaultKey, direction: defaultDirection })
  }, [defaultKey, defaultDirection, capture])

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key!)
      const bValue = getNestedValue(b, sortConfig.key!)

      // Missing values always go last, whichever way the column is sorted
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle different data types
      let comparison = 0
      
      // Numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      }
      // Dates
      else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      }
      // Date strings
      else if (isDateString(aValue) && isDateString(bValue)) {
        comparison = new Date(aValue).getTime() - new Date(bValue).getTime()
      }
      // Strings
      else {
        comparison = String(aValue).localeCompare(String(bValue))
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [data, sortConfig])

  shownRef.current = sortedData

  useLayoutEffect(() => {
    const snap = snapshot.current
    snapshot.current = null
    const body = bodyRef.current
    if (!snap || !body) return
    const trs = Array.from(body.children) as HTMLElement[]
    if (trs.length !== sortedData.length) return
    const tokens = getComputedStyle(document.documentElement)
    const raw = tokens.getPropertyValue('--dur-move').trim()
    const duration = parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000)
    const easing = tokens.getPropertyValue('--ease-in-out').trim()
    if (!Number.isFinite(duration) || !easing) return
    const moves = trs.flatMap((tr, i) => {
      const before = snap.tops.get(keyOf(sortedData[i], i))
      return before === undefined ? [] : [{ tr, delta: before - tr.getBoundingClientRect().top }]
    })
    running.current.forEach((a) => a.cancel())
    running.current = moves
      .filter((m) => Math.abs(m.delta) >= 0.5)
      .map(({ tr, delta }) => {
        const a = tr.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration, easing })
        a.onfinish = () => a.cancel()
        return a
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedData])

  useEffect(() => () => running.current.forEach((a) => a.cancel()), [])

  const requestSort = (key: string) => {
    capture()
    let direction: SortDirection = 'asc'
    
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'
      } else if (sortConfig.direction === 'desc') {
        direction = null
      }
    }
    
    setSortConfig({ key: direction ? key : null, direction })
  }

  return { sortedData, sortConfig, requestSort, bodyRef }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function isDateString(value: any): boolean {
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !isNaN(date.getTime()) && value.includes('-')
}
