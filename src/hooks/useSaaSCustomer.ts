import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

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
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
  last_active_at: string | null
  owner_details?: {
    first_name: string | null
    last_name: string | null
    email: string | null
  }
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
    .select('id')
    .eq('tenant_id', tenant.id)
  
  const jobIds = tenantJobs?.map(j => j.id) || []

  // Get usage data
  const [
    { count: jobsCount },
    recentAssociationsQuery,
    { count: membersCount },
    lastActivityQuery
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    
    // Get recent candidate associations for this tenant's jobs
    jobIds.length > 0 
      ? supabase
          .from('job_candidate_associations')
          .select('candidate_id')
          .in('job_id', jobIds)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
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
      .maybeSingle()
  ])
  
  // Count distinct candidate_ids
  const candidatesCount = new Set(
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
    jobs_created_30d: jobsCount || 0,
    candidates_added_30d: candidatesCount || 0,
    members_active_count: membersCount || 0,
    last_active_at: lastActivityQuery.data?.created_at || null,
    owner_details: ownerDetails
  } as SaaSCustomerDetail
}
