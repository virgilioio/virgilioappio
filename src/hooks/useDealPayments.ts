import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface DealPayment {
  id: string
  deal_id: string
  tenant_id: string
  amount: number
  currency: string
  paid_at: string
  method: string | null
  note: string | null
  invoice_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DealPaymentInput {
  amount: number
  currency: string
  paid_at: string
  method?: string | null
  note?: string | null
  invoice_id?: string | null
}

async function getTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .maybeSingle()
  return data?.tenant_id ?? null
}

export function useDealPayments(dealId: string | null | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const list = useQuery({
    queryKey: ['deal-payments', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealPayment[]> => {
      const { data, error } = await supabase
        .from('deal_payments')
        .select('*')
        .eq('deal_id', dealId!)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as DealPayment[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: DealPaymentInput) => {
      if (!user?.id || !dealId) throw new Error('Missing context')
      const tenant_id = await getTenantId(user.id)
      if (!tenant_id) throw new Error('No workspace')
      const { error } = await supabase.from('deal_payments').insert({
        deal_id: dealId,
        tenant_id,
        created_by: user.id,
        ...input,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-payments', dealId] })
      toast({ title: 'Payment registered' })
    },
    onError: (e: any) => toast({ title: 'Could not register payment', description: e.message, variant: 'destructive' }),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<DealPaymentInput>) => {
      const { error } = await supabase.from('deal_payments').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-payments', dealId] }),
    onError: (e: any) => toast({ title: 'Could not update payment', description: e.message, variant: 'destructive' }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deal_payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-payments', dealId] }),
    onError: (e: any) => toast({ title: 'Could not delete payment', description: e.message, variant: 'destructive' }),
  })

  return { ...list, create, update, remove }
}
