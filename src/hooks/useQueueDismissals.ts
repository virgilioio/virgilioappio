import { useEffect, useRef } from 'react'
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
 */
export function useQueueDismissals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null
  const queryKey = ['queue-dismissals', userId]
  const migratedRef = useRef<string | null>(null)

  const { data: dismissed = new Set<string>(), isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_queue_dismissals')
        .select('item_key')
        .eq('user_id', userId!)
      if (error) throw error
      return new Set<string>((data ?? []).map(r => r.item_key))
    },
  })

  const setLocal = (mutate: (next: Set<string>) => void) => {
    queryClient.setQueryData<Set<string>>(queryKey, prev => {
      const next = new Set(prev ?? [])
      mutate(next)
      return next
    })
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
      setLocal(next => next.add(itemKey))
    },
    onError: (_e, itemKey) => {
      setLocal(next => next.delete(itemKey))
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
      setLocal(next => next.delete(itemKey))
    },
    onError: (_e, itemKey) => {
      setLocal(next => next.add(itemKey))
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
