import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SaaSMetrics {
  totalCustomers: number
  activeTenants: number
  totalActiveUsers: number
  monthlyRevenue: number
}

export function useSaaSMetrics() {
  return useQuery({
    queryKey: ['saas-metrics'],
    queryFn: async (): Promise<SaaSMetrics> => {
      // Get total SaaS customers count
      const { count: totalCustomers } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .is('parent_organization_id', null)

      // Get active tenants count
      const { count: activeTenants } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .eq('status', 'active')
        .is('parent_organization_id', null)

      // Get total active users across all SaaS organizations
      const { data: saasOrgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .is('parent_organization_id', null)

      let totalActiveUsers = 0
      if (saasOrgs && saasOrgs.length > 0) {
        const orgIds = saasOrgs.map(org => org.id)
        const { count: userCount } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .in('organization_id', orgIds)
          .eq('user_status', 'active')
        
        totalActiveUsers = userCount || 0
      }

      // TODO: Calculate monthly revenue from subscription data
      // For now, placeholder calculation
      const monthlyRevenue = (activeTenants || 0) * 299 // Assuming $299/month average

      return {
        totalCustomers: totalCustomers || 0,
        activeTenants: activeTenants || 0,
        totalActiveUsers,
        monthlyRevenue
      }
    },
  })
}