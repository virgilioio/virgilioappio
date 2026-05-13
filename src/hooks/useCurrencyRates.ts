import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { cacheTiers } from '@/lib/cache/cacheTiers'
import { useBaseCurrency } from '@/hooks/useBaseCurrency'
import { useAuth } from '@/contexts/AuthContext'

export interface CurrencyRate {
  id: string
  base_currency: string
  quote_currency: string
  rate: number
  rate_date: string
  source: 'auto' | 'manual'
  created_at: string
}

export interface CurrencyOverride {
  id: string
  base_currency: string
  quote_currency: string
  rate: number
  effective_from: string
  effective_to: string | null
  note: string | null
  created_at: string
}

/**
 * Latest rate per quote currency for the workspace's base currency.
 * Picks the most recent (rate_date, created_at) row regardless of source —
 * because manual overrides write into currency_rate_overrides, not currency_rates.
 */
export function useCurrencyRates() {
  const { tenantId, baseCurrency } = useBaseCurrency()

  return useQuery<{ rates: CurrencyRate[]; lastRefreshed: string | null }>({
    queryKey: ['currency-rates', tenantId, baseCurrency],
    enabled: !!tenantId,
    staleTime: cacheTiers.reference.staleTime,
    gcTime: cacheTiers.reference.gcTime,
    queryFn: async () => {
      if (!tenantId) return { rates: [], lastRefreshed: null }
      const { data, error } = await supabase
        .from('currency_rates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('base_currency', baseCurrency)
        .order('rate_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error

      // Reduce: latest per quote
      const seen = new Set<string>()
      const latest: CurrencyRate[] = []
      ;(data ?? []).forEach((r: any) => {
        const key = String(r.quote_currency).toUpperCase()
        if (seen.has(key)) return
        seen.add(key)
        latest.push({ ...r, rate: Number(r.rate) } as CurrencyRate)
      })
      const lastRefreshed = (data ?? [])[0]?.created_at ?? null
      return { rates: latest, lastRefreshed }
    },
  })
}

/** Active manual overrides for the workspace base currency. */
export function useCurrencyOverrides() {
  const { tenantId, baseCurrency } = useBaseCurrency()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const query = useQuery<CurrencyOverride[]>({
    queryKey: ['currency-overrides', tenantId, baseCurrency],
    enabled: !!tenantId,
    staleTime: cacheTiers.reference.staleTime,
    gcTime: cacheTiers.reference.gcTime,
    queryFn: async () => {
      if (!tenantId) return []
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('currency_rate_overrides')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('base_currency', baseCurrency)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({ ...r, rate: Number(r.rate) })) as CurrencyOverride[]
    },
  })

  const upsert = useMutation({
    mutationFn: async (input: { quote_currency: string; rate: number; note?: string | null; effective_to?: string | null }) => {
      if (!tenantId) throw new Error('No workspace')
      const { error } = await supabase.from('currency_rate_overrides').insert({
        tenant_id: tenantId,
        base_currency: baseCurrency,
        quote_currency: input.quote_currency.toUpperCase(),
        rate: input.rate,
        note: input.note ?? null,
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: input.effective_to ?? null,
        created_by: user?.id ?? null,
      })
      if (error) throw error
      await supabase.rpc('recompute_open_deals_base', { p_tenant_id: tenantId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-overrides'] })
      queryClient.invalidateQueries({ queryKey: ['currency-rates'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast({ title: 'Manual rate saved' })
    },
    onError: (e: any) => toast({ title: 'Could not save rate', description: e.message, variant: 'destructive' }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('currency_rate_overrides').delete().eq('id', id)
      if (error) throw error
      if (tenantId) await supabase.rpc('recompute_open_deals_base', { p_tenant_id: tenantId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-overrides'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast({ title: 'Override removed' })
    },
    onError: (e: any) => toast({ title: 'Could not remove override', description: e.message, variant: 'destructive' }),
  })

  return { ...query, upsert, remove }
}

/** Trigger the daily refresh edge function on demand. */
export function useRefreshFxRates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('refresh-fx-rates', { body: {} })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-rates'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast({ title: 'Rates refreshed' })
    },
    onError: (e: any) => toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' }),
  })
}

/**
 * Convert an arbitrary amount/currency to the workspace base using the live
 * cached rate set. Used for live previews in forms (no DB round trip).
 */
export function useLiveConvertToBase(): (amount: number | null | undefined, currency: string | null | undefined) => number | null {
  const { baseCurrency } = useBaseCurrency()
  const { data } = useCurrencyRates()
  const overrides = useCurrencyOverrides()

  return (amount, currency) => {
    if (amount == null || isNaN(Number(amount)) || !currency) return null
    const ccy = String(currency).toUpperCase()
    if (ccy === baseCurrency.toUpperCase()) return Number(amount)
    const override = (overrides.data ?? []).find((o) => o.quote_currency.toUpperCase() === ccy)
    const rateRow = (data?.rates ?? []).find((r) => r.quote_currency.toUpperCase() === ccy)
    const rate = override?.rate ?? rateRow?.rate
    if (!rate) return null
    return Number(amount) / Number(rate)
  }
}
