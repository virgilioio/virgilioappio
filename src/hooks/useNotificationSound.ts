import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { NotificationRow } from '@/hooks/useNotifications'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import {
  inQuietHours,
  installSoundUnlock,
  playNotificationSound,
  type NotificationSoundKind,
} from '@/lib/notificationSound'

/** Offer events that ask *you* to decide (the database's offer_approval_sync). */
const APPROVAL_EVENTS = new Set(['approval_requested', 'approval_reminder'])

/** Which sound a notification earns, if any: someone mentioned you, or an offer waits for your approval. */
export function soundFor(n: NotificationRow, me: string | undefined): NotificationSoundKind | null {
  if (n.read_at) return null
  if (me && n.actor_user_id === me) return null
  if (n.category === 'mention') return 'mention'
  if (n.category === 'offer_event' && APPROVAL_EVENTS.has(String(n.metadata?.event ?? ''))) return 'approval'
  return null
}

/** Only notifications that just arrived play: never the backlog on load. */
const FRESH_MS = 2 * 60_000

/**
 * The bell, live (2026-10-18): new notifications arrive through Supabase
 * Realtime and refresh the feed at once (the minute poll stays as the safety
 * net). When one is a mention of you or an offer that needs your approval,
 * and "Play a sound" is on outside your quiet hours, the notification sound
 * plays. Mounted once, in NotificationCenter.
 */
export function useNotificationSound(rows: NotificationRow[] | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { prefs } = useNotificationPreferences()
  const seen = useRef<Set<string> | null>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => installSoundUnlock(), [])

  // Live: a new or changed notification of yours refreshes the feed.
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifications-live:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['notifications', user.id] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, qc])

  // New rows since the last look: play once for the most important of them.
  useEffect(() => {
    if (!rows) return
    if (!seen.current) {
      seen.current = new Set(rows.map((r) => r.id))
      return
    }
    let kind: NotificationSoundKind | null = null
    const now = Date.now()
    for (const r of rows) {
      if (seen.current.has(r.id)) continue
      seen.current.add(r.id)
      if (now - new Date(r.created_at).getTime() > FRESH_MS) continue
      const k = soundFor(r, user?.id)
      if (k === 'approval') kind = 'approval'
      else if (k && !kind) kind = k
    }
    const p = prefsRef.current
    if (!kind || !p?.sound_on_mention) return
    if (p.quiet_hours_enabled && inQuietHours(p.quiet_hours_start, p.quiet_hours_end, p.quiet_hours_tz)) return
    void playNotificationSound(kind)
  }, [rows, user?.id])
}
