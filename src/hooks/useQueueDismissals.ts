import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Server-side persistence for dashboard "Your queue" dismissals.
 *
 * Previously dismissals lived in localStorage with a 7-day expiry, so they were
 * lost across devices/browsers/origins and silently came back after a week.
 * They now live in `dashboard_queue_dismissals`, keyed by a stable *semantic*
 * key (see buildQueue in Dashboard.tsx) so a row can't resurface under a new
 * database row id.
 *
 * NOTE: the react-query cache is persisted to localStorage as JSON, and a Set
 * does not survive JSON serialisation (it round-trips as `{}`). Query data is
 * therefore a plain string[] of item keys; the Set consumers use is derived
 * with useMemo below.
 */

/** Coerce any legacy/stale persisted value (Set, plain object, etc.) to an array. */
function toKeyArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

export function useQueueDismissals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null
  const queryKey = ['queue-dismissals', userId]
  const migratedRef = useRef<string | null>(null)

  const { data: dismissedKeys, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_queue_dismissals')
        .select('item_key')
        .eq('user_id', userId!)
      if (error) throw error
      return (data ?? []).map(r => r.item_key)
    },
  })

  const dismissed = useMemo(() => new Set<string>(toKeyArray(dismissedKeys)), [dismissedKeys])

  const setLocal = (mutate: (prev: string[]) => string[]) => {
    queryClient.setQueryData<string[]>(queryKey, prev => mutate(toKeyArray(prev)))
  }

  const dismiss = useMutation({
    mutationFn: async (itemKey: string) => {
      if (!userId) return
      const { error } = await supabase
        .from('dashboard_queue_dismissals')
        .upsert(
          { user_id: userId, item_key: itemKey },
          { onConflict: 'user_id,item_key' },
        )
      if (error) throw error
    },
    onMutate: (itemKey: string) => {
      setLocal(prev => (prev.includes(itemKey) ? prev : [...prev, itemKey]))
    },
    onError: (_e, itemKey) => {
      setLocal(prev => prev.filter(k => k !== itemKey))
    },
  })

  const undo = useMutation({
    mutationFn: async (itemKey: string) => {
      if (!userId) return
      const { error } = await supabase
        .from('dashboard_queue_dismissals')
        .delete()
        .eq('user_id', userId)
        .eq('item_key', itemKey)
      if (error) throw error
    },
    onMutate: (itemKey: string) => {
      setLocal(prev => prev.filter(k => k !== itemKey))
    },
    onError: (_e, itemKey) => {
      setLocal(prev => (prev.includes(itemKey) ? prev : [...prev, itemKey]))
    },
  })

  const toggle = (itemKey: string) => {
    if (dismissed.has(itemKey)) undo.mutate(itemKey)
    else dismiss.mutate(itemKey)
  }

  // One-time best-effort migration of legacy localStorage dismissals.
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    if (migratedRef.current === userId) return
    migratedRef.current = userId
    const legacyKey = `dashboard.queue.dismissed.${userId}`
    let stored: { id: string; dismissedAt: number }[] = []
    try {
      const raw = window.localStorage.getItem(legacyKey)
      if (!raw) return
      stored = JSON.parse(raw) as { id: string; dismissedAt: number }[]
    } catch {
      return
    }
    const rows = (stored ?? [])
      .filter(p => p?.id)
      .map(p => ({
        user_id: userId,
        item_key: p.id,
        dismissed_at: new Date(p.dismissedAt || Date.now()).toISOString(),
      }))
    const finish = () => {
      try {
        window.localStorage.removeItem(legacyKey)
      } catch {
        /* ignore */
      }
    }
    if (rows.length === 0) {
      finish()
      return
    }
    supabase
      .from('dashboard_queue_dismissals')
      .upsert(rows, { onConflict: 'user_id,item_key' })
      .then(({ error }) => {
        if (!error) {
          finish()
          queryClient.invalidateQueries({ queryKey })
        }
      })
  }, [userId, queryClient])

  return { dismissed, isLoading, toggle }
}
