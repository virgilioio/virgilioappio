import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'

/**
 * Who a hire credits (Allan, 2026-10-23): one Sourcer and one Recruiter,
 * recorded on the filled opening by Mark hired. After the hire only admins
 * change it (`can_change_hire`): `change_hire_credit` or `unmark_hired`. The
 * database refuses any other write to a filled opening's hire columns, and
 * tells Gio Sales about every change.
 */

export interface HireCredit {
  openingId: string
  reqId: string
  jobId: string
  sourcerId: string | null
  recruiterId: string | null
}

export const hireCreditKey = (applicationId: string | null | undefined) => ['hire-credit', applicationId] as const

/** The filled opening this application holds, with the people it credits. */
export function useHireCredit(applicationId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: hireCreditKey(applicationId),
    enabled: !!applicationId && enabled,
    queryFn: async (): Promise<HireCredit | null> => {
      const { data, error } = await supabase
        .from('job_openings')
        .select('id, req_id, job_id, sourcer_user_id, recruiter_user_id')
        .eq('hired_association_id', applicationId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        openingId: data.id,
        reqId: data.req_id,
        jobId: data.job_id,
        sourcerId: data.sourcer_user_id,
        recruiterId: data.recruiter_user_id,
      }
    },
  })
}

/** Whether the signed-in person may change or undo a hire on this job (admins). */
export function useCanChangeHire(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['can-change-hire', jobId],
    enabled: !!jobId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_change_hire', { _job_id: jobId! })
      if (error) throw error
      return data === true
    },
  })
}

/** Display names for a few people (the credited Sourcer and Recruiter). */
export function usePeopleNames(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))].sort()
  return useQuery({
    queryKey: ['people-names', wanted.join(',')],
    enabled: wanted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', wanted)
      if (error) throw error
      const names = new Map<string, string>()
      for (const p of data ?? []) {
        names.set(p.user_id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || 'Someone')
      }
      return names
    },
  })
}

/** The database's own sentence when it explains a refusal, otherwise a plain one. */
export function hireChangeMessage(error: unknown, fallback: string) {
  const e = error as { code?: string; message?: string } | null
  if (e?.code === '42501') return 'Only an admin can change a hire.'
  const known = [
    'That person is not a Sourcer on this job.',
    'That person is not a Recruiter on this job.',
    'A hire credits one Sourcer and one Recruiter.',
  ]
  if (e?.message && (known.includes(e.message) || /isn't filled/.test(e.message))) return e.message
  return fallback
}

export function useChangeHireCredit(applicationId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { openingId: string; sourcerId: string; recruiterId: string }) => {
      const { error } = await supabase.rpc('change_hire_credit', {
        p_opening_id: v.openingId,
        p_sourcer_id: v.sourcerId,
        p_recruiter_id: v.recruiterId,
      })
      if (error) throw new Error(hireChangeMessage(error, "Couldn't change the credit. Try again."))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hireCreditKey(applicationId) })
      void qc.invalidateQueries({ queryKey: ['activity-feed'] })
    },
  })
}
