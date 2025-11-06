import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import type { Job } from '@/hooks/useJobs'
import { getOrganizationTree } from '@/lib/organizationHelpers'

export interface JobOption {
  id: string
  title: string
  organization_name: string
  organization_id: string
  display_label: string // "[Job Title] – [Organization]"
}

export function useJobsForCandidateAssignment() {
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, userType, organizationId, memberRole } = useAuth()

  const fetchJobs = useCallback(async () => {
    if (!user) {
      setJobs([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('jobs')
        .select(`
          id,
          title,
          organization_id,
          organizations!inner(name)
        `)
        .eq('status', 'open') // Only show open jobs

      // Apply permission-based filtering
      if (userType === 'platform_admin') {
        // Platform admins see all jobs (no additional filter)
      } else if (userType === 'workspace_owner') {
        // Workspace owners see jobs across their entire org hierarchy
        // (tenant org + all child workspaces)
        const { data: memberOrgs } = await supabase
          .from('members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('user_status', 'active')

        if (memberOrgs && memberOrgs.length > 0) {
          // Get full org tree for each membership
          // This includes parent, children, and siblings
          const allOrgIds = new Set<string>()
          
          for (const member of memberOrgs) {
            const treeIds = await getOrganizationTree(member.organization_id)
            treeIds.forEach(id => allOrgIds.add(id))
          }
          
          if (allOrgIds.size > 0) {
            query = query.in('organization_id', Array.from(allOrgIds))
          } else {
            setJobs([])
            return
          }
        } else {
          setJobs([])
          return
        }
      } else if (memberRole === 'admin') {
        // Org admins see all jobs in their organization
        if (organizationId) {
          query = query.eq('organization_id', organizationId)
        } else {
          setJobs([])
          return
        }
      } else if (memberRole === 'recruiter') {
        // Recruiters see jobs in their org hierarchy (parent + children) OR jobs they're assigned to
        // RLS policies handle the hierarchy access, no filtering needed here
        // This allows recruiters to assign candidates to ANY job in their org tree
      } else {
        // Other roles - no jobs
        setJobs([])
        return
      }

      const { data, error: fetchError } = await query.order('title')

      if (fetchError) throw fetchError

      const jobOptions: JobOption[] = (data || []).map(job => ({
        id: job.id,
        title: job.title,
        organization_name: job.organizations.name,
        organization_id: job.organization_id,
        display_label: `${job.title} – ${job.organizations.name}`
      }))

      setJobs(jobOptions)
    } catch (err) {
      console.error('Error fetching jobs for candidate assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
      setJobs([])
    } finally {
      setIsLoading(false)
    }
  }, [user, userType, organizationId, memberRole])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    isLoading,
    error,
    refetch: fetchJobs
  }
}
