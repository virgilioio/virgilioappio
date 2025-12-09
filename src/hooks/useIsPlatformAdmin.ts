import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'

export function useIsPlatformAdmin() {
  const { user, userType, organizationId } = useAuth()
  
  const { data: isPlatformAdmin = false } = useQuery({
    queryKey: ['is-platform-admin', user?.id, organizationId],
    queryFn: async () => {
      if (!user || userType !== 'platform_admin' || !organizationId) {
        return false
      }

      // Check if the user's organization is GoGio (platform SaaS organization)
      const { data: organization } = await supabase
        .from('organizations')
        .select('name, organization_type, tenant_type')
        .eq('id', organizationId)
        .single()

      if (!organization) return false

      // Check if this is the GoGio platform organization
      return (
        organization.name === 'GoGio' &&
        organization.organization_type === 'platform' &&
        organization.tenant_type === 'saas'
      )
    },
    enabled: !!user && userType === 'platform_admin' && !!organizationId,
  })

  return isPlatformAdmin
}
