import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface ChildOrgOption {
  id: string
  name: string
}

/**
 * Hook to fetch child organizations where current user can create jobs.
 * 
 * Business Rules:
 * - Platform admins: See all client organizations
 * - Workspace owners: See their parent org + all child orgs
 * - Recruiters: See their parent org + all child orgs
 * - Other roles: No org selection (will use their default org)
 */
export function useChildOrganizationsForJobCreation() {
  const { user, organizationId } = useAuth()
  
  const query = useQuery({
    queryKey: ['child-orgs-for-job-creation', organizationId],
    queryFn: async () => {
      if (!user || !organizationId) return []

      // Jobs only live under client orgs (the workspace's hiring containers).
      // The root saas/tenant org is NOT a valid job owner — excluding it
      // prevents the confusing duplicate (e.g. two "Virgilio" entries) in
      // pickers.
      const { data: children, error: childrenError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('parent_organization_id', organizationId)
        .eq('org_kind', 'client')
        .eq('status', 'active')
        .order('name')

      if (childrenError) throw childrenError

      return children || []
    },
    enabled: !!user && !!organizationId
  })

  
  return query
}
