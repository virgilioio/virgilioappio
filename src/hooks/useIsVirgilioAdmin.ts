import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'

export function useIsVirgilioAdmin() {
  const { user, userType, organizationId } = useAuth()
  
  const { data: isVirgilioAdmin = false } = useQuery({
    queryKey: ['is-virgilio-admin', user?.id, organizationId],
    queryFn: async () => {
      if (!user || userType !== 'platform_admin' || !organizationId) {
        return false
      }

      // Check if the user's organization is Virgilio (platform SaaS organization)
      const { data: organization } = await supabase
        .from('organizations')
        .select('name, organization_type, tenant_type')
        .eq('id', organizationId)
        .single()

      if (!organization) return false

      // Check if this is the Virgilio platform organization
      return (
        organization.name === 'Virgilio' &&
        organization.organization_type === 'platform' &&
        organization.tenant_type === 'saas'
      )
    },
    enabled: !!user && userType === 'platform_admin' && !!organizationId,
  })

  return isVirgilioAdmin
}