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
      
      // Get the user's root organization (where they're a member)
      const { data: rootOrg, error: rootError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single()
      
      if (rootError) throw rootError
      if (!rootOrg) return []
      
      // Get all child organizations (job folders)
      const { data: children, error: childrenError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('parent_organization_id', organizationId)
        .eq('status', 'active')
        .order('name')
      
      if (childrenError) throw childrenError
      
      // Return root org + all children
      return [rootOrg, ...(children || [])]
    },
    enabled: !!user && !!organizationId
  })
  
  return query
}
