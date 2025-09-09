import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SaaSCustomer {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  organization_type: string
  tenant_type: string
  user_count: number
  billing_poc_email?: string
  sub_organizations: SubOrganization[]
}

export interface SubOrganization {
  id: string
  name: string
  status: string
  created_at: string
  user_count: number
}

export function useSaaSCustomer(customerId: string) {
  return useQuery({
    queryKey: ['saas-customer', customerId],
    queryFn: async (): Promise<SaaSCustomer | null> => {
      if (!customerId) return null

      // Get the main SaaS organization
      const { data: organization, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .single()

      if (error || !organization) {
        console.error('Error fetching SaaS customer:', error)
        return null
      }

      // Get user count for main organization
      const { count: userCount } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('user_status', 'active')

      // Get billing POC email
      let billingPocEmail = null
      if (organization.billing_poc_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', organization.billing_poc_user_id)
          .single()
        
        billingPocEmail = profile?.email
      }

      // Get sub-organizations (departments)
      const { data: subOrgs } = await supabase
        .from('organizations')
        .select('id, name, status, created_at')
        .eq('parent_organization_id', organization.id)
        .order('created_at', { ascending: false })

      // Get user counts for each sub-organization
      const subOrganizations = await Promise.all(
        (subOrgs || []).map(async (subOrg) => {
          const { count: subUserCount } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', subOrg.id)
            .eq('user_status', 'active')

          return {
            ...subOrg,
            user_count: subUserCount || 0
          }
        })
      )

      return {
        ...organization,
        user_count: userCount || 0,
        billing_poc_email: billingPocEmail,
        sub_organizations: subOrganizations
      }
    },
    enabled: !!customerId,
  })
}