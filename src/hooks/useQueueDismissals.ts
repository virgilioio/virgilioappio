import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { hiddenState, type HiddenEntry } from '@/lib/queue'

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

/**
 * Coerce any legacy/stale persisted value to entries. Older caches hold plain key strings
 * (hidden for good); a Set round-trips as `{}` and reads as nothing.
 */
function toEntries(value: unknown): HiddenEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v): HiddenEntry | null =>
      typeof v === 'string'
        ? { key: v, until: null }
        : v && typeof v === 'object' && typeof (v as HiddenEntry).key === 'string'
          ? { key: (v as HiddenEntry).key, until: (v as HiddenEntry).until ?? null }
          : null,
    )
    .filter((e): e is HiddenEntry => !!e)
}

export function useQueueDismissals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null
  const queryKey = ['queue-dismissals', userId]
  const migratedRef = useRef<string | null>(null)
  // Re-renders when the next snooze runs out, so its row comes back by itself.
  const [, setTick] = useState(0)

  const { data: rawEntries, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<HiddenEntry[]> => {
      const { data, error } = await supabase
        .from('dashboard_queue_dismissals')
        .select('item_key, snoozed_until')
        .eq('user_id', userId!)
      if (error) throw error
      return ((data ?? []) as unknown as { item_key: string; snoozed_until: string | null }[]).map(r => ({
        key: r.item_key,
        until: r.snoozed_until,
      }))
    },
  })

  const entries = useMemo(() => toEntries(rawEntries), [rawEntries])
  const state = hiddenState(entries)
  const { hidden: dismissed, snoozed, nextWake } = state
  const hiddenForGood = useMemo(() => new Set(entries.filter(e => !e.until).map(e => e.key)), [entries])

  useEffect(() => {
    if (nextWake === null) return
    const wait = Math.min(Math.max(nextWake - Date.now() + 500, 1000), 2 ** 31 - 1)
    const t = window.setTimeout(() => setTick(n => n + 1), wait)
    return () => window.clearTimeout(t)
  }, [nextWake])

  const setLocal = (mutate: (prev: HiddenEntry[]) => HiddenEntry[]) => {
    queryClient.setQueryData<HiddenEntry[]>(queryKey, prev => mutate(toEntries(prev)))
  }
  const withKeys = (prev: HiddenEntry[], keys: string[], until: string | null) => [
    ...prev.filter(e => !keys.includes(e.key)),
    ...keys.map(key => ({ key, until })),
  ]

  /**
   * Hide (until null) or snooze (until a time) several rows at once (a job's applications
   * are one row holding a key per applicant), or show them again. Optimistic; a failed
   * save puts the entries back as they were.
   */
  const write = useMutation({
    mutationFn: async ({ keys, until, show }: { keys: string[]; until: string | null; show?: boolean }) => {
      if (!userId || keys.length === 0) return
      if (show) {
        const { error } = await supabase
          .from('dashboard_queue_dismissals')
          .delete()
          .eq('user_id', userId)
          .in('item_key', keys)
        if (error) throw error
        return
      }
      const { error } = await supabase
        .from('dashboard_queue_dismissals')
        .upsert(
          keys.map(item_key => ({ user_id: userId, item_key, snoozed_until: until })) as never,
          { onConflict: 'user_id,item_key' },
        )
      if (error) throw error
    },
    onMutate: ({ keys, until, show }) => {
      const before = toEntries(queryClient.getQueryData(queryKey))
      setLocal(prev => (show ? prev.filter(e => !keys.includes(e.key)) : withKeys(prev, keys, until)))
      return { before }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.before) queryClient.setQueryData(queryKey, ctx.before)
    },
  })

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

  return {
    /** Every key hidden right now: for good, or snoozed until a time still ahead. */
    dismissed,
    hiddenForGood,
    /** Snoozed keys and when each comes back. */
    snoozed,
    isLoading,
    hide: (keys: string[]) => write.mutateAsync({ keys, until: null }),
    snooze: (keys: string[], until: Date) => write.mutateAsync({ keys, until: until.toISOString() }),
    show: (keys: string[]) => write.mutateAsync({ keys, until: null, show: true }),
  }
}
