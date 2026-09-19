/**
 * The client's side of a shared dossier, read back into the recruiter's profile view.
 *
 * Five states, derived from the share row and the one decision it may carry. We
 * never know which person at the client answered — only the address the link went
 * to — so every string this powers is written to that limit.
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

export type ClientVerdictState = 'none' | 'sent' | 'viewed' | 'requested' | 'declined'

export interface ClientVerdict {
  state: ClientVerdictState
  shareId: string | null
  sentTo: string | null
  sentBy: string | null
  viewCount: number
  lastViewedAt: string | null
  answeredAt: string | null
  reasons: string[]
  note: string | null
  /** Set once a recruiter (or the pipeline) has acted on the verdict. */
  resolvedAt: string | null
}

const EMPTY: ClientVerdict = {
  state: 'none',
  shareId: null,
  sentTo: null,
  sentBy: null,
  viewCount: 0,
  lastViewedAt: null,
  answeredAt: null,
  reasons: [],
  note: null,
  resolvedAt: null,
}

export function useClientVerdict(associationId: string | null | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['client-verdict', associationId],
    enabled: Boolean(associationId),
    queryFn: async (): Promise<ClientVerdict> => {
      if (!associationId) return EMPTY

      const [{ data: share }, { data: assoc }] = await Promise.all([
        supabase
          .from('dossier_shares')
          .select('id, sent_to, view_count, last_viewed_at, created_by')
          .eq('association_id', associationId)
          .maybeSingle(),
        supabase
          .from('job_candidate_associations')
          .select('client_verdict_resolved_at')
          .eq('id', associationId)
          .maybeSingle(),
      ])

      const resolvedAt = (assoc as { client_verdict_resolved_at?: string | null } | null)?.client_verdict_resolved_at ?? null
      if (!share) return { ...EMPTY, resolvedAt }

      const { data: feedback } = await supabase
        .from('dossier_feedback')
        .select('decision, reasons, note, created_at')
        .eq('share_id', share.id)
        .maybeSingle()

      let sentBy: string | null = null
      if (share.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', share.created_by)
          .maybeSingle()
        const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
        sentBy = name || null
      }

      const state: ClientVerdictState = feedback
        ? (feedback.decision === 'interview_requested' ? 'requested' : 'declined')
        : (share.view_count ?? 0) > 0
          ? 'viewed'
          : 'sent'

      return {
        state,
        shareId: share.id,
        sentTo: share.sent_to ?? null,
        sentBy,
        viewCount: share.view_count ?? 0,
        lastViewedAt: share.last_viewed_at ?? null,
        answeredAt: feedback?.created_at ?? null,
        reasons: (feedback?.reasons as string[] | null) ?? [],
        note: feedback?.note ?? null,
        resolvedAt,
      }
    },
    staleTime: 60_000,
  })

  /** Retire the call to action. Deliberately one-way: there is no un-resolve. */
  const resolve = useCallback(async () => {
    if (!associationId) return
    const { data: session } = await supabase.auth.getUser()
    await supabase.rpc('resolve_client_verdict', {
      _association_id: associationId,
      _by: session?.user?.id ?? null,
    })
    await queryClient.invalidateQueries({ queryKey: ['client-verdict', associationId] })
  }, [associationId, queryClient])

  return {
    verdict: query.data ?? EMPTY,
    isLoading: query.isLoading,
    resolve,
  }
}
