import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Deal {
  id: string
  tenant_id: string
  organization_id: string | null
  title: string
  amount: number | null
  currency: string
  owner_id: string | null
  stage_id: string | null
  position: number
  expected_close_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined / derived
  organization_name?: string | null
  owner_name?: string | null
  owner_email?: string | null
  owner_avatar_url?: string | null
}

export interface DealInput {
  title: string
  organization_id?: string | null
  amount?: number | null
  currency?: string
  owner_id?: string | null
  stage_id?: string | null
  expected_close_date?: string | null
  notes?: string | null
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

async function enrichDeals(rows: any[]): Promise<Deal[]> {
  if (!rows.length) return []
  const orgIds = Array.from(new Set(rows.map((r) => r.organization_id).filter(Boolean)))
  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)))

  const [orgsRes, membersRes] = await Promise.all([
    orgIds.length
      ? supabase.from('organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [], error: null } as any),
    ownerIds.length
      ? supabase
          .from('members')
          .select('user_id, user_first_name, user_last_name, user_email, user_avatar_url')
          .in('user_id', ownerIds)
      : Promise.resolve({ data: [], error: null } as any),
  ])

  const orgMap = new Map<string, string>((orgsRes.data ?? []).map((o: any) => [o.id, o.name]))
  const memberMap = new Map<string, any>((membersRes.data ?? []).map((m: any) => [m.user_id, m]))

  return rows.map((r) => {
    const m = r.owner_id ? memberMap.get(r.owner_id) : null
    return {
      ...r,
      organization_name: r.organization_id ? orgMap.get(r.organization_id) ?? null : null,
      owner_name: m ? `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim() || m.user_email : null,
      owner_email: m?.user_email ?? null,
      owner_avatar_url: m?.user_avatar_url ?? null,
    } as Deal
  })
}

export function useDeals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['deals', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Deal[]> => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return enrichDeals(data ?? [])
    },
  })
}

export function useDeal(id: string | null | undefined) {
  return useQuery({
    queryKey: ['deal', id],
    enabled: !!id,
    queryFn: async (): Promise<Deal | null> => {
      if (!id) return null
      const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) return null
      const enriched = await enrichDeals([data])
      return enriched[0] ?? null
    },
  })
}

export function useDealMutations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const createDeal = useMutation({
    mutationFn: async (input: DealInput) => {
      if (!user?.id) throw new Error('Not authenticated')
      const tenant_id = await getTenantId(user.id)
      if (!tenant_id) throw new Error('No workspace')

      // Resolve initial stage if not provided: first open stage
      let stage_id = input.stage_id ?? null
      if (!stage_id) {
        const { data: st } = await supabase
          .from('deal_stages')
          .select('id')
          .eq('tenant_id', tenant_id)
          .order('position', { ascending: true })
          .limit(1)
        stage_id = st?.[0]?.id ?? null
      }

      // Position = count in target stage
      let position = 0
      if (stage_id) {
        const { count } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('stage_id', stage_id)
        position = count ?? 0
      }

      const { data, error } = await supabase
        .from('deals')
        .insert({
          tenant_id,
          title: input.title,
          organization_id: input.organization_id ?? null,
          amount: input.amount ?? null,
          currency: input.currency ?? 'USD',
          owner_id: input.owner_id ?? user.id,
          stage_id,
          position,
          expected_close_date: input.expected_close_date ?? null,
          notes: input.notes ?? null,
          created_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast({ title: 'Deal created' })
    },
    onError: (e: any) => toast({ title: 'Could not create deal', description: e.message, variant: 'destructive' }),
  })

  const updateDeal = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<DealInput>) => {
      const { data, error } = await supabase.from('deals').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['deal', vars.id] })
    },
    onError: (e: any) => toast({ title: 'Could not update deal', description: e.message, variant: 'destructive' }),
  })

  const moveDeal = useMutation({
    mutationFn: async ({ id, stage_id }: { id: string; stage_id: string }) => {
      // Append to bottom of new stage
      const { count } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('stage_id', stage_id)
      const { error } = await supabase
        .from('deals')
        .update({ stage_id, position: count ?? 0 })
        .eq('id', id)
      if (error) throw error
    },
    // Optimistic update for snappy kanban feel
    onMutate: async ({ id, stage_id }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] })
      const previous = queryClient.getQueryData<Deal[]>(['deals', user?.id])
      if (previous) {
        queryClient.setQueryData<Deal[]>(
          ['deals', user?.id],
          previous.map((d) => (d.id === id ? { ...d, stage_id } : d))
        )
      }
      return { previous }
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['deals', user?.id], ctx.previous)
      toast({ title: 'Could not move deal', description: e.message, variant: 'destructive' })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast({ title: 'Deal deleted' })
    },
    onError: (e: any) => toast({ title: 'Could not delete deal', description: e.message, variant: 'destructive' }),
  })

  return { createDeal, updateDeal, moveDeal, deleteDeal }
}
