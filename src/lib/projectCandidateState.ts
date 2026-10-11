import { supabase } from '@/lib/supabaseClient'

export type ProjectCandidateStatus = 'active' | 'shortlisted' | 'not_a_fit' | 'archived'

/**
 * Sets what a sourcing project did with a person (Find Phase 0, 2026-10-11).
 * The state lives in sourcing_project_candidates, apart from the search
 * cache, so a refresh never loses it. The workspace comes from the project
 * (database trigger); collecting is recorded by the server, not here.
 */
export async function setProjectCandidateStatus(projectId: string, apolloId: string, status: ProjectCandidateStatus) {
  const { data: row, error: readError } = await supabase
    .from('sourcing_project_candidates')
    .select('id')
    .eq('sourcing_project_id', projectId)
    .eq('apollo_id', apolloId)
    .maybeSingle()
  if (readError) throw readError

  if (row) {
    const { error } = await supabase
      .from('sourcing_project_candidates')
      .update({ status })
      .eq('id', row.id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('sourcing_project_candidates')
    // tenant_id is replaced by the project's workspace in the database.
    .insert({ sourcing_project_id: projectId, apollo_id: apolloId, status, tenant_id: '00000000-0000-0000-0000-000000000000' })
  if (error) throw error
}
