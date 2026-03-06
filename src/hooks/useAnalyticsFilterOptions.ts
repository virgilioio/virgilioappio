import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface FilterOption {
  value: string
  label: string
}

export interface AnalyticsFilterOptions {
  recruiters: FilterOption[]
  jobs: FilterOption[]
  organizations: FilterOption[]
  isLoading: boolean
  error: Error | null
}

export function useAnalyticsFilterOptions(): AnalyticsFilterOptions {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-filter-options', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('No user')

      // Get tenant_id from members table
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

      // Fetch all options in parallel
      const [recruitersResult, jobsResult, organizationsResult] = await Promise.all([
        // Recruiters: active members who can add candidates (admin, recruiter roles)
        supabase
          .from('members')
          .select(`
            user_id,
            profiles!inner(
              first_name,
              last_name,
              email
            )
          `)
          .eq('tenant_id', tenantId)
          .eq('user_status', 'active'),

        // Jobs: non-archived jobs
        supabase
          .from('jobs')
          .select('id, title')
          .eq('tenant_id', tenantId)
          .neq('status', 'archived')
          .order('title'),

        // Organizations/Departments
        supabase
          .from('organizations')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('name')
      ])

      if (recruitersResult.error) throw recruitersResult.error
      if (jobsResult.error) throw jobsResult.error
      if (organizationsResult.error) throw organizationsResult.error

      // Map to FilterOption format
      const recruiters: FilterOption[] = (recruitersResult.data || []).map((m: any) => {
        const profile = m.profiles
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        return {
          value: m.user_id,
          label: name || profile?.email || 'Unknown'
        }
      })

      const jobs: FilterOption[] = (jobsResult.data || []).map(j => ({
        value: j.id,
        label: j.title || 'Untitled Job'
      }))

      const organizations: FilterOption[] = (organizationsResult.data || []).map(o => ({
        value: o.id,
        label: o.name || 'Unnamed Department'
      }))

      return { recruiters, jobs, organizations }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10 // 10 minutes - options don't change often
  })

  return {
    recruiters: data?.recruiters ?? [],
    jobs: data?.jobs ?? [],
    organizations: data?.organizations ?? [],
    isLoading,
    error: error as Error | null
  }
}
