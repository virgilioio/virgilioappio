import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface ChatSlaMetrics {
  awaitingHumanCount: number
  oldestAwaitingMs: number | null
  medianFirstResponseMs: number | null
  p95FirstResponseMs: number | null
  sampleSize: number
  windowDays: number
}

const WINDOW_DAYS = 7

/**
 * useChatSlaMetrics — admin-facing SLA snapshot for the Chat module.
 * Computes:
 *  - threads currently `awaiting_human` + oldest age
 *  - median + p95 recruiter first-response time over the last 7 days
 * Stays cheap: capped to 1k recent messages, client-side aggregation.
 */
export function useChatSlaMetrics(enabled: boolean = true) {
  const { organizationId } = useAuth()

  return useQuery<ChatSlaMetrics>({
    queryKey: ['chat', 'sla-metrics', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const [awaitingRes, msgsRes] = await Promise.all([
        supabase
          .from('chat_threads')
          .select('id, updated_at, last_message_at', { count: 'exact' })
          .eq('tenant_id', organizationId!)
          .eq('status', 'awaiting_human')
          .order('last_message_at', { ascending: true, nullsFirst: false })
          .limit(1),
        supabase
          .from('chat_messages')
          .select('thread_id, direction, sender_type, created_at')
          .eq('tenant_id', organizationId!)
          .gte('created_at', since)
          // Order by thread first so per-thread arrays stay chronological
          // after the group-by below; then by created_at within each thread.
          .order('thread_id', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1000),
      ])

      const awaitingHumanCount = awaitingRes.count ?? 0
      const oldestRow = awaitingRes.data?.[0]
      const oldestClockIso = oldestRow?.last_message_at ?? oldestRow?.updated_at ?? null
      const oldestAwaitingMs = oldestClockIso
        ? Date.now() - new Date(oldestClockIso).getTime()
        : null

      // Compute first-response latencies: for each inbound (candidate) message,
      // find the next outbound (recruiter human) message in the same thread.
      // NOTE: DB stores direction as 'in' / 'out' (not 'inbound' / 'outbound').
      const msgs = msgsRes.data ?? []
      const byThread = new Map<string, typeof msgs>()
      for (const m of msgs) {
        const arr = byThread.get(m.thread_id) ?? []
        arr.push(m)
        byThread.set(m.thread_id, arr)
      }

      const latencies: number[] = []
      for (const arr of byThread.values()) {
        let pendingInboundAt: number | null = null
        for (const m of arr) {
          const t = new Date(m.created_at).getTime()
          if (m.direction === 'in' && m.sender_type === 'candidate') {
            if (pendingInboundAt === null) pendingInboundAt = t
          } else if (
            m.direction === 'out' &&
            m.sender_type === 'recruiter' &&
            pendingInboundAt !== null
          ) {
            latencies.push(t - pendingInboundAt)
            pendingInboundAt = null
          }
        }
      }


      latencies.sort((a, b) => a - b)
      const pick = (p: number) => {
        if (!latencies.length) return null
        const idx = Math.min(latencies.length - 1, Math.floor(latencies.length * p))
        return latencies[idx]
      }

      return {
        awaitingHumanCount,
        oldestAwaitingMs,
        medianFirstResponseMs: pick(0.5),
        p95FirstResponseMs: pick(0.95),
        sampleSize: latencies.length,
        windowDays: WINDOW_DAYS,
      }
    },
  })
}
