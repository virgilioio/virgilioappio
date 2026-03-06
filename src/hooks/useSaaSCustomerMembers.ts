import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface SaaSMember {
  id: string
  user_id: string | null
  system_role: string
  member_role: string
  user_status: string
  user_type: string | null
  invited_email: string | null
  created_at: string
  updated_at: string
  profile: {
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

export function useSaaSCustomerMembers(tenantId: string) {
  return useQuery({
    queryKey: ['saas-customer-members', tenantId],
    queryFn: async (): Promise<SaaSMember[]> => {
      if (!tenantId) return []

      const { data, error } = await supabase.functions.invoke('saas-customer-members', {
        body: { tenantId }
      })

      if (error) {
        console.error('Error fetching SaaS customer members:', error)
        throw error
      }

      return data?.members || []
    },
    enabled: !!tenantId,
  })
}
