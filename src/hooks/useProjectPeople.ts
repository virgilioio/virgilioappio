import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import {
  setProjectPersonStatus,
  type PersonSnapshot,
  type ProjectCandidateStatus,
  type ProjectPersonKey,
} from '@/lib/projectCandidateState'

/**
 * What a sourcing project decided about people (Find Phase 2, 2026-10-12):
 * the shortlist, "not a fit", archive and pool rows, with the AI fit the
 * server stores for shortlisted people. Rows live in
 * sourcing_project_candidates, so they survive every search refresh and are
 * shared with everyone who can open the project.
 */

export interface ProjectPerson {
  id: string
  apollo_id: string | null
  candidate_id: string | null
  status: ProjectCandidateStatus
  snapshot: PersonSnapshot
  collected_at: string | null
  added_by_pool: boolean
  status_changed_at: string | null
  status_changed_by: string | null
  changed_by_name: string | null
  ai_fit_score: number | null
  ai_fit_summary: string | null
  ai_fit_strengths: string[]
  ai_fit_gaps: string[]
  ai_fit_at: string | null
  /** Our own record, when they're in Gio. */
  person: {
    name: string | null
    title: string | null
    company: string | null
    location: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
  } | null
}

export const projectPeopleKey = (projectId: string | null | undefined) => ['project-people', projectId] as const

export function useProjectPeople(projectId: string | null | undefined) {
  return useQuery({
    queryKey: projectPeopleKey(projectId),
    enabled: !!projectId,
    staleTime: 15_000,
    queryFn: async (): Promise<ProjectPerson[]> => {
      const { data: rows, error } = await supabase
        .from('sourcing_project_candidates')
        .select('id, apollo_id, candidate_id, status, snapshot, collected_at, added_by_pool, status_changed_at, status_changed_by, ai_fit_score, ai_fit_summary, ai_fit_strengths, ai_fit_gaps, ai_fit_at')
        .eq('sourcing_project_id', projectId!)
        .in('status', ['shortlisted', 'not_a_fit', 'archived'])
        .order('status_changed_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      const list = rows ?? []

      const candIds = [...new Set(list.map((r) => r.candidate_id).filter((x): x is string => !!x))]
      const people = new Map<string, ProjectPerson['person']>()
      for (let i = 0; i < candIds.length; i += 200) {
        const { data } = await supabase
          .from('candidates')
          .select('id, candidate_name, role_current, current_job_title, company_current, location_city, location_state, location_country, email, phone, linkedin_url')
          .in('id', candIds.slice(i, i + 200))
        for (const c of data ?? []) {
          people.set(c.id, {
            name: c.candidate_name,
            title: c.role_current || c.current_job_title,
            company: c.company_current,
            location: [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ') || null,
            email: c.email,
            phone: c.phone,
            linkedin_url: c.linkedin_url,
          })
        }
      }

      // Rows shortlisted before snapshots existed: read the search cache.
      const bare = list.filter((r) => !r.candidate_id && r.apollo_id && Object.keys((r.snapshot as object) ?? {}).length === 0)
      const cache = new Map<string, PersonSnapshot>()
      if (bare.length > 0) {
        const { data } = await supabase
          .from('sourcing_preview_candidates')
          .select('apollo_id, full_name, current_title, headline, current_company')
          .eq('sourcing_project_id', projectId!)
          .in('apollo_id', bare.map((r) => r.apollo_id!))
        for (const p of data ?? []) {
          if (p.apollo_id) cache.set(p.apollo_id, { name: p.full_name, title: p.current_title || p.headline, company: p.current_company, headline: p.headline })
        }
      }

      const userIds = [...new Set(list.map((r) => r.status_changed_by).filter((x): x is string => !!x))]
      const names = new Map<string, string>()
      if (userIds.length > 0) {
        const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
        for (const p of data ?? []) {
          const n = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
          if (p.user_id && n) names.set(p.user_id, n)
        }
      }

      return list.map((r) => ({
        id: r.id,
        apollo_id: r.apollo_id,
        candidate_id: r.candidate_id,
        status: r.status as ProjectCandidateStatus,
        snapshot: { ...((r.apollo_id && cache.get(r.apollo_id)) || {}), ...((r.snapshot as PersonSnapshot) ?? {}) },
        collected_at: r.collected_at,
        added_by_pool: r.added_by_pool,
        status_changed_at: r.status_changed_at,
        status_changed_by: r.status_changed_by,
        changed_by_name: r.status_changed_by ? names.get(r.status_changed_by) ?? null : null,
        ai_fit_score: r.ai_fit_score,
        ai_fit_summary: r.ai_fit_summary,
        ai_fit_strengths: r.ai_fit_strengths ?? [],
        ai_fit_gaps: r.ai_fit_gaps ?? [],
        ai_fit_at: r.ai_fit_at,
        person: r.candidate_id ? people.get(r.candidate_id) ?? null : null,
      }))
    },
  })
}

/** Status of a Find row in this project, by Apollo id or candidate id. */
export function statusLookup(people: ProjectPerson[] | undefined) {
  const byApollo = new Map<string, ProjectCandidateStatus>()
  const byCandidate = new Map<string, ProjectCandidateStatus>()
  for (const p of people ?? []) {
    if (p.apollo_id) byApollo.set(p.apollo_id, p.status)
    if (p.candidate_id) byCandidate.set(p.candidate_id, p.status)
  }
  return (key: ProjectPersonKey): ProjectCandidateStatus | null =>
    (key.apolloId && byApollo.get(key.apolloId)) || (key.candidateId && byCandidate.get(key.candidateId)) || null
}

export interface PersonChange {
  key: ProjectPersonKey
  snapshot?: PersonSnapshot
  /** What it was before, for Undo. */
  previous: ProjectCandidateStatus | null
}

const LABEL: Record<ProjectCandidateStatus, (n: number) => string> = {
  shortlisted: (n) => (n === 1 ? 'Shortlisted' : `Shortlisted ${n} people`),
  not_a_fit: (n) => (n === 1 ? 'Marked not a fit' : `Marked ${n} people not a fit`),
  archived: (n) => (n === 1 ? 'Archived' : `Archived ${n} people`),
  active: (n) => (n === 1 ? 'Back in the results' : `${n} people back in the results`),
}

/**
 * Not a fit / restore, applied at once with Undo (§5). The shortlist and its
 * AI fit went with the Shortlist tab (2026-10-22); Gio Fit scores people once
 * they're added to a job.
 */
export function useProjectPeopleActions(projectId: string | null | undefined) {
  const queryClient = useQueryClient()

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: projectPeopleKey(projectId) })
    queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
  }, [queryClient, projectId])

  const apply = useCallback(async (changes: PersonChange[], status: ProjectCandidateStatus, opts: { undoable?: boolean } = {}) => {
    if (!projectId || changes.length === 0) return
    const key = projectPeopleKey(projectId)
    const before = queryClient.getQueryData<ProjectPerson[]>(key)
    // Optimistic: the row changes state now; the server catches up.
    queryClient.setQueryData<ProjectPerson[]>(key, (old) => {
      const list = [...(old ?? [])]
      for (const ch of changes) {
        const i = list.findIndex((p) =>
          (ch.key.apolloId && p.apollo_id === ch.key.apolloId) || (ch.key.candidateId && p.candidate_id === ch.key.candidateId))
        if (i >= 0) list[i] = { ...list[i], status, snapshot: ch.snapshot ?? list[i].snapshot }
        else list.unshift({
          id: `pending-${ch.key.apolloId ?? ch.key.candidateId}`,
          apollo_id: ch.key.apolloId ?? null,
          candidate_id: ch.key.candidateId ?? null,
          status,
          snapshot: ch.snapshot ?? {},
          collected_at: null,
          added_by_pool: false,
          status_changed_at: new Date().toISOString(),
          status_changed_by: null,
          changed_by_name: null,
          ai_fit_score: null, ai_fit_summary: null, ai_fit_strengths: [], ai_fit_gaps: [], ai_fit_at: null,
          person: null,
        })
      }
      return list.filter((p) => p.status !== 'active')
    })

    const failed: PersonChange[] = []
    await Promise.all(changes.map(async (ch) => {
      try { await setProjectPersonStatus(projectId, ch.key, status, ch.snapshot) }
      catch { failed.push(ch) }
    }))
    if (failed.length === changes.length) {
      queryClient.setQueryData(key, before)
      toast.error(changes.length === 1 ? "Couldn't save that" : "Couldn't save those changes", {
        description: 'Nothing changed. Try again in a moment.',
        action: { label: 'Retry', onClick: () => void apply(changes, status, opts) },
      })
      return
    }
    refresh()

    const done = changes.filter((c) => !failed.includes(c))
    toast(LABEL[status](done.length), {
      description: failed.length ? `${failed.length} couldn't be saved.` : undefined,
      action: opts.undoable === false ? undefined : {
        label: 'Undo',
        onClick: () => {
          // Each person goes back to what they were.
          const groups = new Map<ProjectCandidateStatus, PersonChange[]>()
          for (const c of done) {
            const prev = c.previous ?? 'active'
            groups.set(prev, [...(groups.get(prev) ?? []), c])
          }
          for (const [prev, list] of groups) void apply(list.map((c) => ({ ...c, previous: status })), prev, { undoable: false })
        },
      },
    })
  }, [projectId, queryClient, refresh])

  return {
    notAFit: (changes: PersonChange[]) => apply(changes, 'not_a_fit'),
    restore: (changes: PersonChange[]) => apply(changes, 'active'),
  }
}
