import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useToast } from '@/hooks/use-toast'
import { rememberReferenceLink } from '@/lib/references/sessionLinks'
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

      rememberReferenceLink(data.id, (sendResult as { link?: string } | null)?.link)

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

/* ------------------------------------------------------------------ */
/* Card data — the request for THIS job, its referees, and the actions */
/* the profile card fires. One derivation, one query key per request.  */
/* ------------------------------------------------------------------ */

/** Newest non-superseded request for this candidate on this job (or null). */
export function useJobReferenceRequest(candidateId?: string | null, jobId?: string | null) {
  const { requests, isLoading } = useCandidateReferenceRequests(candidateId)
  const request = jobId
    ? (requests.find((r: any) => r.job_id === jobId) ?? null)
    : (requests[0] ?? null)
  return { request, isLoading }
}

/** Referees for one request, kept live so transitions need no page refresh. */
export function useReferenceRequestReferees(requestId?: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['reference-referees', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_referees')
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  useEffect(() => {
    if (!requestId) return
    const channel = supabase
      .channel(`reference-request-${requestId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reference_referees', filter: `request_id=eq.${requestId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['reference-referees', requestId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reference_requests', filter: `id=eq.${requestId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['reference-requests'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId, queryClient])

  return { referees: query.data ?? [], isLoading: query.isLoading }
}

/** Who requested it — for "Sent … by {name}" and the cancelled note. */
export function useReferenceRequestPeople(userIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]))
  const query = useQuery({
    queryKey: ['reference-request-people', ids.slice().sort().join(',')],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', ids)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const p of data || []) {
        map[p.id] =
          [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || (p.email ?? '')
      }
      return map
    },
  })
  return query.data ?? {}
}

function invalidateRequest(queryClient: ReturnType<typeof useQueryClient>, requestId: string) {
  queryClient.invalidateQueries({ queryKey: ['reference-requests'] })
  queryClient.invalidateQueries({ queryKey: ['reference-referees', requestId] })
}

/**
 * Re-sends the candidate link. Returns the freshly minted URL so the card can
 * offer "Copy link" for the link the recruiter just sent — we only ever store
 * the hash, so there is nothing to read back later.
 */
export function useResendCandidateLink() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('send-reference-request', {
        body: { request_id: requestId },
      })
      const failure = (data as { error?: string } | null)?.error
      if (error || failure) throw new Error(failure ?? error?.message ?? 'Could not send the email')
      return (data as { link?: string; expires_at?: string }) ?? {}
    },
    onSuccess: (_d, requestId) => {
      invalidateRequest(queryClient, requestId)
      toast({ title: 'Link sent', description: 'The candidate has a fresh secure link.' })
    },
    onError: (e: any) =>
      toast({ title: 'Could not send the link', description: e.message, variant: 'destructive' }),
  })
}

export function useCancelReferenceRequest() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('reference_requests')
        .update({ state: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', requestId)
      if (error) throw error
    },
    onSuccess: (_d, requestId) => {
      invalidateRequest(queryClient, requestId)
      toast({ title: 'Request cancelled', description: 'Nobody will be contacted again.' })
    },
    onError: (e: any) =>
      toast({ title: 'Could not cancel', description: e.message, variant: 'destructive' }),
  })
}

export type ReferenceRefereeAction = 'remind_referees' | 'resend_referee' | 'release_referee'

/** Referee-side sends. On-hold referees are only ever emailed via 'release_referee'. */
export function useReferenceRefereeAction() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      requestId: string
      action: ReferenceRefereeAction
      refereeId?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('reference-request-actions', {
        body: {
          request_id: input.requestId,
          action: input.action,
          referee_id: input.refereeId ?? null,
        },
      })
      const failure = (data as { error?: string } | null)?.error
      if (error || failure) throw new Error(failure ?? error?.message ?? 'Could not send')
      return data as { sent: number }
    },
    onSuccess: (data, vars) => {
      invalidateRequest(queryClient, vars.requestId)
      toast({
        title: vars.action === 'remind_referees' ? 'Reminders sent' : 'Email sent',
        description:
          data?.sent === 0
            ? 'Nobody needed an email right now.'
            : `${data?.sent ?? 1} referee${(data?.sent ?? 1) === 1 ? '' : 's'} contacted.`,
      })
    },
    onError: (e: any) =>
      toast({ title: 'Could not send', description: e.message, variant: 'destructive' }),
  })
}

export interface LogPhoneReferenceInput {
  requestId: string
  name: string
  relationship?: string | null
  title?: string | null
  company?: string | null
  period?: string | null
  answers: Record<string, unknown>
}

/** A reference the recruiter already has in hand — no email, no token. */
export function useLogPhoneReference() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: LogPhoneReferenceInput) => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('reference_referees')
        .insert({
          request_id: input.requestId,
          name: input.name,
          relationship: input.relationship ?? null,
          title: input.title ?? null,
          company: input.company ?? null,
          period: input.period ?? null,
          source: 'recruiter_logged',
          status: 'logged',
          answers: input.answers as any,
          submitted_at: now,
        })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      invalidateRequest(queryClient, vars.requestId)
      toast({ title: 'Reference logged', description: 'It now appears with the others.' })
    },
    onError: (e: any) =>
      toast({ title: 'Could not log the reference', description: e.message, variant: 'destructive' }),
  })
}
