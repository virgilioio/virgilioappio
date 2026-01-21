import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

interface ActivityLog {
  id: string
  activity_type: string
  title: string
  description: string | null
  created_at: string
  user_id: string
  entity_type: string | null
  entity_id: string | null
}

export interface SaaSCustomerDetail {
  id: string
  name: string
  tenant_id: string
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
  trial_end_date: string | null
  suspended_at: string | null
  suspended_reason: string | null
  // Total counts
  jobs_total: number
  candidates_total: number
  // 30-day trends
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
  last_active_at: string | null
  owner_details?: {
    first_name: string | null
    last_name: string | null
    email: string | null
  }
  // Real activity logs
  recent_activities: ActivityLog[]
  // Extended tenant fields
  subscription_plan?: string | null
  subscription_renewal_date?: string | null
  billing_email?: string | null
  billing_contact_name?: string | null
  billing_phone?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_postal_code?: string | null
  billing_country?: string | null
  trial_starts_at?: string | null
  trial_ends_at?: string | null
  [key: string]: any // Allow other tenant fields
}

export function useSaaSCustomer(customerId: string) {
  return useQuery({
    queryKey: ['saas-customer', customerId],
    queryFn: async (): Promise<SaaSCustomerDetail | null> => {
      if (!customerId) return null

      // Use edge function to fetch cross-tenant metrics
      const { data, error } = await supabase.functions.invoke('saas-customer-metrics', {
        body: { customerId }
      })

      if (error) {
        console.error('Error fetching SaaS customer from edge function:', error)
        // Fallback to direct query if edge function fails
        return fallbackFetch(customerId)
      }

      if (!data?.customers?.length) {
        console.warn('No customer found in edge function response')
        return fallbackFetch(customerId)
      }

      const customer = data.customers[0]
      return {
        ...customer,
        tenant_id: customer.id,
      } as SaaSCustomerDetail
    },
    enabled: !!customerId,
  })
}

// Fallback direct query if edge function fails
async function fallbackFetch(customerId: string): Promise<SaaSCustomerDetail | null> {
  // Get the SaaS tenant
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_type', 'saas')
    .single()

  if (error || !tenant) {
    console.error('Error fetching SaaS customer:', error)
    return null
  }

  // Get job IDs for this tenant first
  const { data: tenantJobs } = await supabase
    .from('jobs')
    .select('id, created_at')
    .eq('tenant_id', tenant.id)
    .is('deleted_at', null)
  
  const jobIds = tenantJobs?.map(j => j.id) || []
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Calculate totals
  const totalJobs = tenantJobs?.length || 0
  const jobsIn30Days = tenantJobs?.filter(j => j.created_at >= thirtyDaysAgo).length || 0

  // Get usage data
  const [
    allAssociationsQuery,
    recentAssociationsQuery,
    { count: membersCount },
    lastActivityQuery,
    recentActivitiesQuery
  ] = await Promise.all([
    // All candidate associations
    jobIds.length > 0 
      ? supabase
          .from('job_candidate_associations')
          .select('candidate_id')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] }),
    
    // Recent candidate associations
    jobIds.length > 0 
      ? supabase
          .from('job_candidate_associations')
          .select('candidate_id')
          .in('job_id', jobIds)
          .gte('created_at', thirtyDaysAgo)
      : Promise.resolve({ data: [] }),
    
    supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('user_status', 'active'),
    
    supabase
      .from('activities')
      .select('created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('activities')
      .select('id, activity_type, title, description, created_at, user_id, entity_type, entity_id')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(50)
  ])
  
  // Count distinct candidate_ids
  const totalCandidates = new Set(
    (allAssociationsQuery.data || []).map((a: any) => a.candidate_id)
  ).size
  const candidatesIn30Days = new Set(
    (recentAssociationsQuery.data || []).map((a: any) => a.candidate_id)
  ).size

  // Get owner details if owner_id exists
  let ownerDetails = null
  if (tenant.owner_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', tenant.owner_id)
      .maybeSingle()
    
    ownerDetails = profile
  }

  return {
    ...tenant,
    tenant_id: tenant.id,
    plan_type: tenant.subscription_plan,
    renewal_date: tenant.subscription_renewal_date,
    billing_id: tenant.billing_email,
    organization_type: 'client',
    jobs_total: totalJobs,
    candidates_total: totalCandidates,
    jobs_created_30d: jobsIn30Days,
    candidates_added_30d: candidatesIn30Days,
    members_active_count: membersCount || 0,
    last_active_at: lastActivityQuery.data?.created_at || null,
    owner_details: ownerDetails,
    recent_activities: recentActivitiesQuery.data || []
  } as SaaSCustomerDetail
}
