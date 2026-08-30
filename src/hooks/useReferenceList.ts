/**
 * Reference checks — recruiter-side reads for Flow E (module list, request
 * detail, activity timeline).
 *
 * State and counts are always DERIVED with the helpers in
 * `src/lib/references/status.ts` — never re-implemented here, never read off the
 * stored `state` column for display.
 */
import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'
import {
  countReferees,
  deriveState,
  formatCounts,
  type RefRequestState,
} from '@/lib/references/status'
import type { RefereeRowData } from '@/components/references/RefereeRow'

export interface ReferenceListRow {
  id: string
  created_at: string
  flagged: boolean
  storedState: RefRequestState
  /** Derived from the referees — the display state. */
  state: RefRequestState
  counts: string
  submitted: number
  required: number
  referees: RefereeRowData[]
  candidateId: string
  candidateName: string
  candidateRole: string | null
  jobId: string | null
  jobTitle: string | null
  clientId: string | null
  clientName: string | null
  stage: string | null
  templateName: string | null
  requestedBy: string | null
  recruiterName: string | null
  lastActivity: { label: string; at: string } | null
  templateSnapshot: Record<string, any> | null
  selfAssessment: Record<string, unknown> | null
  flags: any
  consentRecordedAt: string | null
  candidateLinkExpiresAt: string | null
  retentionExpiresAt: string | null
  minRefereesOverride: number | null
}

function requiredFor(request: any): number {
  const snapshotMin = Number(request?.template_snapshot?.min_referees)
  const override = Number(request?.min_referees_override)
  if (Number.isFinite(override) && override > 0) return override
  if (Number.isFinite(snapshotMin) && snapshotMin > 0) return snapshotMin
  return 2
}

function personName(p: any): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || (p?.email ?? '')
}

async function chunkedIn<T>(
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return []
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from(table as any)
      .select(columns)
      .in(column, ids.slice(i, i + 200))
    if (error) throw error
    out.push(...((data as any[]) ?? []) as T[])
  }
  return out
}

/**
 * Every reference request in the tenant, with its referees and the names it is
 * displayed with. Child tables have no tenant_id, so they are fetched in a
 * second chunked pass keyed on the request ids.
 */
export function useTenantReferenceRequests() {
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  const query = useQuery({
    queryKey: ['reference-requests', 'tenant', tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async (): Promise<ReferenceListRow[]> => {
      const { data: requests, error } = await supabase
        .from('reference_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
      if (error) throw error

      const rows = (requests ?? []) as any[]
      if (rows.length === 0) return []

      const requestIds = rows.map((r) => r.id)
      const candidateIds = Array.from(new Set(rows.map((r) => r.candidate_id).filter(Boolean)))
      const jobIds = Array.from(new Set(rows.map((r) => r.job_id).filter(Boolean)))
      const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean)))
      const templateIds = Array.from(new Set(rows.map((r) => r.template_id).filter(Boolean)))
      const userIds = Array.from(new Set(rows.map((r) => r.requested_by).filter(Boolean)))

      const [referees, activity, candidates, jobs, clients, templates, people] = await Promise.all([
        chunkedIn<any>('reference_referees', '*', 'request_id', requestIds),
        chunkedIn<any>(
          'reference_activity',
          'request_id, type, label, created_at',
          'request_id',
          requestIds,
        ),
        chunkedIn<any>('candidates', 'id, candidate_name, current_job_title', 'id', candidateIds),
        chunkedIn<any>('jobs', 'id, title', 'id', jobIds),
        chunkedIn<any>('organizations', 'id, name', 'id', clientIds),
        chunkedIn<any>('reference_templates', 'id, name', 'id', templateIds),
        chunkedIn<any>('profiles', 'user_id, first_name, last_name, email', 'user_id', userIds),
      ])

      const byRequest = new Map<string, any[]>()
      for (const r of referees) {
        const list = byRequest.get(r.request_id) ?? []
        list.push(r)
        byRequest.set(r.request_id, list)
      }

      const latestActivity = new Map<string, { label: string; at: string }>()
      for (const a of activity) {
        const current = latestActivity.get(a.request_id)
        if (!current || Date.parse(a.created_at) > Date.parse(current.at)) {
          latestActivity.set(a.request_id, { label: a.label || a.type, at: a.created_at })
        }
      }

      const candidateMap = new Map(candidates.map((c) => [c.id, c]))
      const jobMap = new Map(jobs.map((j) => [j.id, j]))
      const clientMap = new Map(clients.map((c) => [c.id, c]))
      const templateMap = new Map(templates.map((t) => [t.id, t]))
      const peopleMap = new Map(people.map((p) => [p.user_id, personName(p)]))

      return rows.map((r) => {
        const list = (byRequest.get(r.id) ?? []).sort(
          (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
        ) as RefereeRowData[]
        const required = requiredFor(r)
        const counts = countReferees(list, required)
        const candidate = candidateMap.get(r.candidate_id)

        return {
          id: r.id,
          created_at: r.created_at,
          flagged: r.flagged === true,
          storedState: r.state as RefRequestState,
          state:
            r.state === 'expired' || r.state === 'draft' || r.state === 'cancelled'
              ? (r.state as RefRequestState)
              : deriveState(list, required),
          counts: formatCounts(list, required),
          submitted: counts.submitted,
          required,
          referees: list,
          candidateId: r.candidate_id,
          candidateName: candidate?.candidate_name ?? 'Candidate',
          candidateRole: candidate?.current_job_title ?? null,
          jobId: r.job_id ?? null,
          jobTitle: jobMap.get(r.job_id)?.title ?? null,
          clientId: r.client_id ?? null,
          clientName: clientMap.get(r.client_id)?.name ?? null,
          stage: r.stage ?? null,
          templateName:
            templateMap.get(r.template_id)?.name ?? r.template_snapshot?.name ?? null,
          requestedBy: r.requested_by ?? null,
          recruiterName: peopleMap.get(r.requested_by) ?? null,
          lastActivity: latestActivity.get(r.id) ?? null,
          templateSnapshot: r.template_snapshot ?? null,
          selfAssessment: r.self_assessment ?? null,
          flags: r.flags ?? null,
          consentRecordedAt: r.consent_recorded_at ?? null,
          candidateLinkExpiresAt: r.candidate_link_expires_at ?? null,
          retentionExpiresAt: r.retention_expires_at ?? null,
          minRefereesOverride: r.min_referees_override ?? null,
        }
      })
    },
  })

  return { requests: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch }
}

/** One request, resolved exactly like a list row (so both screens agree). */
export function useReferenceRequestDetail(requestId?: string | null) {
  const { requests, isLoading } = useTenantReferenceRequests()
  const request = useMemo(
    () => requests.find((r) => r.id === requestId) ?? null,
    [requests, requestId],
  )
  return { request, isLoading }
}

export interface ReferenceActivityRow {
  id: string
  type: string
  label: string | null
  actor: string | null
  actorName: string | null
  created_at: string
}

/** Append-only activity for one request, oldest first. Never truncated. */
export function useReferenceActivity(requestId?: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['reference-activity', requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<ReferenceActivityRow[]> => {
      const { data, error } = await supabase
        .from('reference_activity')
        .select('*')
        .eq('request_id', requestId!)
        .order('created_at', { ascending: true })
      if (error) throw error

      const rows = (data ?? []) as any[]
      const actorIds = Array.from(new Set(rows.map((r) => r.actor).filter(Boolean)))
      const people = await chunkedIn<any>(
        'profiles',
        'user_id, first_name, last_name, email',
        'user_id',
        actorIds,
      )
      const map = new Map(people.map((p) => [p.user_id, personName(p)]))

      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        label: r.label ?? null,
        actor: r.actor ?? null,
        actorName: r.actor ? (map.get(r.actor) ?? null) : null,
        created_at: r.created_at,
      }))
    },
  })

  useEffect(() => {
    if (!requestId) return
    const channel = supabase
      .channel(`reference-activity-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reference_activity',
          filter: `request_id=eq.${requestId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ['reference-activity', requestId] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId, queryClient])

  return { activity: query.data ?? [], isLoading: query.isLoading }
}
