
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export function useOrganization() {
  const { organizationId } = useAuth()

  const { data: organization, isLoading, error } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => {
      if (!organizationId) return null
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!organizationId,
  })

  return {
    organization,
    isLoading,
    error,
  }
}
