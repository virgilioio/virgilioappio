import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'

/**
 * useMarkThreadRead — per-recruiter read marker (Step 1.5/1.9 hardening).
 *
 * Upserts into `chat_thread_reads` so every recruiter has an independent
 * unread state. Runs on mount and whenever the thread's last message changes.
 */
export function useMarkThreadRead(threadId: string | undefined, lastMessageAt?: string | null) {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const qc = useQueryClient()

  useEffect(() => {
    if (!threadId || !user?.id || !tenant?.id) return
    let alive = true
    const now = new Date().toISOString()
    supabase
      .from('chat_thread_reads')
      .upsert(
        {
          thread_id: threadId,
          user_id: user.id,
          tenant_id: tenant.id,
          last_read_at: now,
          updated_at: now,
        },
        { onConflict: 'thread_id,user_id' },
      )
      .then(({ error }) => {
        if (!alive || error) return
        qc.invalidateQueries({ queryKey: ['chat-unread-count'] })
        qc.invalidateQueries({ queryKey: ['chat-thread-reads'] })
      })
    return () => {
      alive = false
    }
  }, [threadId, user?.id, tenant?.id, lastMessageAt, qc])
}
