import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useToast } from '@/hooks/use-toast'
import type { ReferenceTemplate } from '@/lib/references/templateModel'

/** Reference requests belong to the CANDIDATE — job/client/stage are provenance. */
export function useCandidateReferenceRequests(candidateId?: string | null) {
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  const query = useQuery({
    queryKey: ['reference-requests', 'candidate', candidateId, tenantId],
    enabled: !!candidateId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_requests')
        .select('*')
        .eq('candidate_id', candidateId!)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  return { requests: query.data ?? [], isLoading: query.isLoading }
}

export interface CreateReferenceRequestInput {
  candidateId: string
  template: ReferenceTemplate
  minRefereesOverride: number
  jobId?: string | null
  clientId?: string | null
  stage?: string | null
}

export function useCreateReferenceRequest() {
  const { tenant } = useTenant()
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateReferenceRequestInput) => {
      if (!tenant?.id) throw new Error('No tenant')

      const expires = new Date(
        Date.now() + (input.template.candidate_link_days || 7) * 86_400_000,
      ).toISOString()

      const { data, error } = await supabase
        .from('reference_requests')
        .insert({
          tenant_id: tenant.id,
          candidate_id: input.candidateId,
          template_id: input.template.id,
          // Frozen at request time — later template edits must never change it.
          template_snapshot: input.template as any,
          min_referees_override: input.minRefereesOverride,
          state: 'candidate',
          requested_by: user?.id ?? null,
          job_id: input.jobId ?? null,
          client_id: input.clientId ?? null,
          stage: input.stage ?? null,
          candidate_link_expires_at: expires,
        })
        .select('*')
        .single()
      if (error) throw error

      // Email 1 — the candidate's "add your references" link. The edge function
      // mints the token, resolves copy from the frozen snapshot and logs the
      // activity row (so we no longer log a send that never happened).
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        'send-reference-request',
        { body: { request_id: data.id } },
      )
      if (sendError || (sendResult as { error?: string })?.error) {
        let message = (sendResult as { error?: string })?.error ?? 'Could not send the email'
        const ctx = (sendError as { context?: Response } | null)?.context
        if (ctx && typeof ctx.json === 'function') {
          try {
            const payload = await ctx.json()
            if (payload?.error) message = payload.error
          } catch {
            /* keep the generic message */
          }
        }
        throw new Error(message)
      }

      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reference-requests', 'candidate', vars.candidateId],
      })
      toast({ title: 'Reference check requested', description: 'The candidate has been emailed their secure link.' })
    },
    onError: (e: any) =>
      toast({
        title: 'Could not request references',
        description: e.message,
        variant: 'destructive',
      }),
  })
}
