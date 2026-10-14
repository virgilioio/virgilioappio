import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'

/**
 * Whether the signed-in person may use the talent pool (job-based access,
 * 2026-10-14). The database decides (has_workspace_wide_access): always yes
 * while the workspace's switch is off; with it on, admins and people with a
 * TA or Sourcer seat on a draft or open job. `undefined` while loading.
 */
export function useTalentPoolAccess(): boolean | undefined {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const { data } = useQuery({
    queryKey: ['talent-pool-access', tenant?.id, user?.id],
    enabled: !!tenant?.id && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_workspace_wide_access', { _tenant_id: tenant!.id })
      if (error) throw error
      return data === true
    },
  })
  return data
}
