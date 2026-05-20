import { useCallback, useEffect, useState } from 'react'

export interface RecentSearch {
  query: string
  scope: string // 'all' | 'candidates' | 'jobs' | 'saved'
  ts: number
}

const KEY_PREFIX = 'gio:recent-searches:'
const MAX = 8

function load(userId: string | null): RecentSearch[] {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX)
  } catch {
    return []
  }
}

function save(userId: string | null, items: RecentSearch[]) {
  if (!userId) return
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* noop */
  }
}

export function useRecentSearches(userId: string | null) {
  const [items, setItems] = useState<RecentSearch[]>(() => load(userId))

  useEffect(() => {
    setItems(load(userId))
  }, [userId])

  const push = useCallback(
    (query: string, scope: string) => {
      const trimmed = query.trim()
      if (trimmed.length < 2) return
      setItems(prev => {
        const next = [
          { query: trimmed, scope, ts: Date.now() },
          ...prev.filter(p => !(p.query === trimmed && p.scope === scope)),
        ].slice(0, MAX)
        save(userId, next)
        return next
      })
    },
    [userId]
  )

  const clear = useCallback(() => {
    save(userId, [])
    setItems([])
  }, [userId])

  return { items, push, clear }
}
