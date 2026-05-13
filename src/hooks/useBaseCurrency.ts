import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { cacheTiers } from '@/lib/cache/cacheTiers'

async function getTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .maybeSingle()
  return data?.tenant_id ?? null
}

/**
 * Workspace base currency. Stored in tenants.settings.base_currency.
 * Defaults to USD.
 */
export function useBaseCurrency() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['base-currency', user?.id],
    enabled: !!user?.id,
    ...cacheTiers.reference,
    queryFn: async (): Promise<{ tenantId: string | null; baseCurrency: string }> => {
      if (!user?.id) return { tenantId: null, baseCurrency: 'USD' }
      const tenantId = await getTenantId(user.id)
      if (!tenantId) return { tenantId: null, baseCurrency: 'USD' }
      const { data } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
      const settings = (data?.settings ?? {}) as Record<string, any>
      return { tenantId, baseCurrency: (settings.base_currency as string) || 'USD' }
    },
  })

  const update = useMutation({
    mutationFn: async (newCurrency: string) => {
      const tenantId = query.data?.tenantId
      if (!tenantId) throw new Error('No workspace')
      const { data: existing } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
      const settings = { ...((existing?.settings as Record<string, any>) ?? {}), base_currency: newCurrency }
      const { error } = await supabase.from('tenants').update({ settings }).eq('id', tenantId)
      if (error) throw error
      // Recompute open-deal base amounts at the new base
      await supabase.rpc('recompute_open_deals_base', { p_tenant_id: tenantId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['base-currency'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['currency-rates'] })
      toast({ title: 'Base currency updated' })
    },
    onError: (e: any) =>
      toast({ title: 'Could not update base currency', description: e.message, variant: 'destructive' }),
  })

  return { ...query, update, baseCurrency: query.data?.baseCurrency ?? 'USD', tenantId: query.data?.tenantId ?? null }
}
