import { supabase } from '@/lib/supabaseClient'
import type { Json } from '@/integrations/supabase/types'

export type ProjectCandidateStatus = 'active' | 'shortlisted' | 'not_a_fit' | 'archived'

/** Who a project row is about: an Apollo person, one of our candidates, or both. */
export interface ProjectPersonKey {
  apolloId?: string | null
  candidateId?: string | null
}

/** The person as the search showed them, kept with the shortlist (Find Phase 2). */
export interface PersonSnapshot {
  name?: string | null
  title?: string | null
  company?: string | null
  headline?: string | null
  location?: string | null
  linkedin_url?: string | null
  fit_score?: number | null
  fit_reasons?: string[]
  in_gio?: boolean
}

/** Builds a snapshot from a Find result row (any lane). */
export function snapshotOf(c: Record<string, any>): PersonSnapshot {
  const location = c.location || [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ') || null
  return {
    name: c.full_name || c.candidate_name || null,
    title: c.current_role || c.current_title || c.headline || null,
    company: c.current_company || null,
    headline: c.headline || null,
    location,
    linkedin_url: c.linkedin_url || null,
    fit_score: typeof c.match_score === 'number' ? c.match_score : null,
    fit_reasons: Array.isArray(c.fit_reasons) ? c.fit_reasons.slice(0, 4) : [],
    in_gio: c.display_source === 'internal' || !!c.candidate_id,
  }
}

/**
 * Sets what a sourcing project did with a person (Find Phases 0 and 2).
 * The state lives in sourcing_project_candidates, apart from the search
 * cache, so a refresh never loses it. The workspace comes from the project
 * (database trigger); collecting is recorded by the server, not here.
 * A person is found by Apollo id first, then by candidate id.
 */
export async function setProjectPersonStatus(
  projectId: string,
  person: ProjectPersonKey,
  status: ProjectCandidateStatus,
  snapshot?: PersonSnapshot,
) {
  const apolloId = person.apolloId || null
  const candidateId = person.candidateId || null
  if (!apolloId && !candidateId) throw new Error('Nothing identifies this person')

  let rowId: string | null = null
  if (apolloId) {
    const { data, error } = await supabase
      .from('sourcing_project_candidates').select('id')
      .eq('sourcing_project_id', projectId).eq('apollo_id', apolloId).maybeSingle()
    if (error) throw error
    rowId = data?.id ?? null
  }
  if (!rowId && candidateId) {
    const { data, error } = await supabase
      .from('sourcing_project_candidates').select('id')
      .eq('sourcing_project_id', projectId).eq('candidate_id', candidateId).maybeSingle()
    if (error) throw error
    rowId = data?.id ?? null
  }

  if (rowId) {
    const patch: { status: ProjectCandidateStatus; snapshot?: Json } = { status }
    if (snapshot) patch.snapshot = snapshot as unknown as Json
    const { error } = await supabase.from('sourcing_project_candidates').update(patch).eq('id', rowId)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('sourcing_project_candidates').insert({
    sourcing_project_id: projectId,
    apollo_id: apolloId,
    candidate_id: candidateId,
    status,
    snapshot: (snapshot ?? {}) as unknown as Json,
    // tenant_id is replaced by the project's workspace in the database.
    tenant_id: '00000000-0000-0000-0000-000000000000',
  })
  if (error) throw error
}

/** Older call shape: an Apollo person by id. */
export async function setProjectCandidateStatus(projectId: string, apolloId: string, status: ProjectCandidateStatus) {
  return setProjectPersonStatus(projectId, { apolloId }, status)
}
