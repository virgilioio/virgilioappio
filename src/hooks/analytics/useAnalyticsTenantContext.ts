import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { extractHiringTeamUserIds } from '@/utils/jobInvolvement'

export interface AnalyticsFilterParams {
  recruiterIds?: string[]
  jobIds?: string[]
  organizationIds?: string[]
  jobStatus?: string
}

export interface TenantJobContext {
  tenantId: string
  finalJobIds: string[]
}

/**
 * Shared hook to resolve tenant context + filtered job IDs.
 * All analytics section hooks depend on this to avoid repeating tenant isolation logic.
 */
export function useAnalyticsTenantContext(filters: AnalyticsFilterParams) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [
      'analytics-tenant-context',
      user?.id,
      filters.recruiterIds?.join(',') || '',
      filters.jobIds?.join(',') || '',
      filters.organizationIds?.join(',') || '',
      filters.jobStatus || 'all',
    ],
    queryFn: async (): Promise<TenantJobContext> => {
      if (!user) throw new Error('No user')

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      if (memberError || !memberData?.tenant_id) {
        throw new Error('Unable to determine tenant context')
      }

      const tenantId = memberData.tenant_id

      let jobsQuery = supabase
        .from('jobs')
        .select('id, hiring_team')
        .eq('tenant_id', tenantId)

      if (filters.organizationIds && filters.organizationIds.length > 0) {
        jobsQuery = jobsQuery.in('organization_id', filters.organizationIds)
      }

      if (filters.jobStatus && filters.jobStatus !== 'all') {
        jobsQuery = jobsQuery.eq('status', filters.jobStatus as any)
      }

      const { data: tenantJobs, error: jobsError } = await jobsQuery
      if (jobsError) throw jobsError

      let finalJobIds = tenantJobs?.map(j => j.id) || []

      if (filters.jobIds && filters.jobIds.length > 0) {
        const tenantJobSet = new Set(finalJobIds)
        finalJobIds = filters.jobIds.filter(id => tenantJobSet.has(id))
      }

      if (filters.recruiterIds && filters.recruiterIds.length > 0) {
        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id')
          .in('user_id', filters.recruiterIds)
          .is('deleted_at', null)

        const assignedJobIds = new Set(assignments?.map(a => a.job_id) || [])
        const recruiterIdSet = new Set(filters.recruiterIds)

        finalJobIds = finalJobIds.filter(jobId => {
          if (assignedJobIds.has(jobId)) return true
          const job = tenantJobs?.find(j => j.id === jobId)
          if (job) {
            const htUserIds = extractHiringTeamUserIds(job.hiring_team)
            for (const uid of recruiterIdSet) {
              if (htUserIds.has(uid)) return true
            }
          }
          return false
        })
      }

      return { tenantId, finalJobIds }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}
