import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Tenant-wide aggregation of deal_payments.
 * Returns the total collected amount per deal id.
 */
export function useDealPaymentsTotals() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setTenantId(null)
      return
    }
    ;(async () => {
      const { data } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .maybeSingle()
      if (!cancelled) setTenantId(data?.tenant_id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return useQuery({
    queryKey: ['deal-payments-totals', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<{ collectedByDeal: Map<string, number> }> => {
      const { data, error } = await supabase
        .from('deal_payments')
        .select('deal_id, amount')
        .eq('tenant_id', tenantId!)
      if (error) throw error
      const map = new Map<string, number>()
      ;(data ?? []).forEach((r: any) => {
        map.set(r.deal_id, (map.get(r.deal_id) ?? 0) + Number(r.amount))
      })
      return { collectedByDeal: map }
    },
  })
}
