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
  const { user, userType, organizationId } = useAuth()
  
  const query = useQuery({
    queryKey: ['child-orgs-for-job-creation', organizationId, userType],
    queryFn: async () => {
      if (!user) return []
      
      // Platform admins see ALL client orgs
      if (userType === 'platform_admin') {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('org_kind', 'client')
          .eq('status', 'active')
          .order('name')
        
        if (error) throw error
        return data || []
      }
      
      // For workspace owners and recruiters: Get their parent org + all children
      if (!organizationId) return []
      
      // Get user's parent org details (including tenant_id)
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('organizations!inner(id, name, tenant_id)')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()
      
      if (memberError) throw memberError
      if (!memberData?.organizations) return []
      
      const parentOrg = memberData.organizations
      const tenantId = parentOrg.tenant_id
      
      // Get all orgs in the same tenant (parent + children)
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('org_kind', 'client')
        .eq('status', 'active')
        .order('name')
      
      if (orgsError) throw orgsError
      return orgs || []
    },
    enabled: !!user
  })
  
  return query
}
