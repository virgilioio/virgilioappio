import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface JobSourcingProject {
  id: string
  job_id: string | null
  name: string
  status: string
  organization_id: string
}

export function useJobSourcingProject(jobId?: string | null) {
  const { user, organizationId } = useAuth()
  const [project, setProject] = useState<JobSourcingProject | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchProject = useCallback(async () => {
    if (!jobId) {
      setProject(null)
      return null
    }
    setIsLoading(true)
    const { data, error } = await supabase
      .from('sourcing_projects')
      .select('id, job_id, name, status, organization_id')
      .eq('job_id', jobId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setIsLoading(false)
    if (error) {
      console.error('useJobSourcingProject fetch error', error)
      setProject(null)
      return null
    }
    setProject((data as JobSourcingProject) ?? null)
    return (data as JobSourcingProject) ?? null
  }, [jobId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const ensureProject = useCallback(
    async (opts?: { name?: string; seed?: Record<string, any> }) => {
      if (!jobId || !user || !organizationId) return null
      const existing = await fetchProject()
      if (existing) return existing
      const { data, error } = await supabase
        .from('sourcing_projects')
        .insert({
          organization_id: organizationId,
          created_by: user.id,
          job_id: jobId,
          name: opts?.name ?? 'Sourcing project',
          search_criteria: opts?.seed ?? {},
        })
        .select('id, job_id, name, status, organization_id')
        .single()
      if (error) {
        console.error('ensureProject error', error)
        return null
      }
      setProject(data as JobSourcingProject)
      return data as JobSourcingProject
    },
    [jobId, user, organizationId, fetchProject],
  )

  return { project, isLoading, ensureProject, refetch: fetchProject }
}
