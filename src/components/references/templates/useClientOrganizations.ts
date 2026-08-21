import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'

export interface ClientOrg {
  id: string
  name: string
}

/** Client organizations inside the current tenant — used for client-scoped templates. */
export function useClientOrganizations() {
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  const { data, isLoading } = useQuery({
    queryKey: ['reference-template-clients', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ClientOrg[]> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .order('name')
      if (error) throw error
      return (data || []) as ClientOrg[]
    },
  })

  return { clients: data ?? [], isLoading }
}
