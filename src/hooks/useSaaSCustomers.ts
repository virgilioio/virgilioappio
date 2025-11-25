import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface SaaSCustomer {
  id: string
  name: string
  plan_type: string | null
  status: string
  renewal_date: string | null
  billing_id: string | null
  owner_id: string | null
  organization_type: string
  tenant_type: string
  signup_source: string
  created_at: string
  updated_at: string
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
  last_active_at: string | null
  churn_risk: 'healthy' | 'at-risk' | 'churn-risk' | 'inactive'
}

export function useSaaSCustomers() {
  return useQuery({
    queryKey: ['saas-customers'],
    queryFn: async (): Promise<SaaSCustomer[]> => {
      // Fetch SaaS tenants from the new tenants table
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          subscription_plan,
          status,
          subscription_renewal_date,
          billing_email,
          owner_id,
          tenant_type,
          signup_source,
          created_at,
          updated_at
        `)
        .eq('tenant_type', 'saas')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching SaaS tenants:', error)
        throw error
      }

      // Get tenant subscriptions for billing status
      const tenantIds = (tenants || []).map(t => t.id)
      const { data: subscriptions } = await supabase
        .from('tenant_subscriptions')
        .select('tenant_id, billing_status, subscription_tier')
        .in('tenant_id', tenantIds)
      
      const subscriptionMap = new Map(
        (subscriptions || []).map(sub => [sub.tenant_id, sub])
      )

      // Get usage data for each tenant (using tenant_id)
      const customersWithUsage = await Promise.all(
        (tenants || []).map(async (tenant) => {
          try {
            // Get all jobs for this tenant (regardless of department/organization)
            const { data: allJobs } = await supabase
              .from('jobs')
              .select('id')
              .eq('tenant_id', tenant.id)
            
            const jobIds = allJobs?.map(j => j.id) || []

            // Get aggregated usage metrics in parallel
            const [
              { count: jobsCount },
              recentAssociationsQuery,
              { count: membersCount },
              lastActivity
            ] = await Promise.all([
              // Jobs created in last 30 days for this tenant
              supabase
                .from('jobs')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
              
              // Candidates added via associations in last 30 days for this tenant
              jobIds.length > 0
                ? supabase
                    .from('job_candidate_associations')
                    .select('candidate_id')
                    .in('job_id', jobIds)
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                : Promise.resolve({ data: [] }),
              
              // Active members count for this tenant
              supabase
                .from('members')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('user_status', 'active'),
              
              // Last activity timestamp for this tenant (real user activity)
              supabase
                .from('activities')
                .select('created_at')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            ])
            
            // Count distinct candidate_ids to avoid duplicates
            const candidatesCount = new Set(
              (recentAssociationsQuery.data || []).map((a: any) => a.candidate_id)
            ).size

            const subscription = subscriptionMap.get(tenant.id)
            const lastActiveAt = lastActivity?.data?.created_at || null

            // Calculate churn risk based on activity
            const daysSinceActive = lastActiveAt 
              ? (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
              : 999

            let churnRisk: 'healthy' | 'at-risk' | 'churn-risk' | 'inactive'
            if (daysSinceActive > 30) {
              churnRisk = 'inactive'
            } else if (daysSinceActive > 14 || (jobsCount === 0 && candidatesCount === 0)) {
              churnRisk = 'churn-risk'
            } else if ((jobsCount || 0) < 2 || candidatesCount < 5) {
              churnRisk = 'at-risk'
            } else {
              churnRisk = 'healthy'
            }

            return {
              id: tenant.id,
              name: tenant.name,
              plan_type: subscription?.subscription_tier || tenant.subscription_plan,
              status: subscription?.billing_status || tenant.status,
              renewal_date: tenant.subscription_renewal_date,
              billing_id: tenant.billing_email,
              owner_id: tenant.owner_id,
              organization_type: 'client', // For backwards compatibility
              tenant_type: tenant.tenant_type,
              signup_source: tenant.signup_source || 'unknown',
              created_at: tenant.created_at,
              updated_at: tenant.updated_at,
              jobs_created_30d: jobsCount || 0,
              candidates_added_30d: candidatesCount,
              members_active_count: membersCount || 0,
              last_active_at: lastActiveAt,
              churn_risk: churnRisk
            } as SaaSCustomer
          } catch (error) {
            console.error('Error fetching usage data for tenant:', tenant.id, error)
            const subscription = subscriptionMap.get(tenant.id)
            return {
              id: tenant.id,
              name: tenant.name,
              plan_type: subscription?.subscription_tier || tenant.subscription_plan,
              status: subscription?.billing_status || tenant.status,
              renewal_date: tenant.subscription_renewal_date,
              billing_id: tenant.billing_email,
              owner_id: tenant.owner_id,
              organization_type: 'client',
              tenant_type: tenant.tenant_type,
              signup_source: tenant.signup_source || 'unknown',
              created_at: tenant.created_at,
              updated_at: tenant.updated_at,
              jobs_created_30d: 0,
              candidates_added_30d: 0,
              members_active_count: 0,
              last_active_at: null,
              churn_risk: 'inactive' as const
            } as SaaSCustomer
          }
        })
      )

      return customersWithUsage
    },
  })
}