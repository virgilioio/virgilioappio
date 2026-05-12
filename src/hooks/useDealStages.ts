import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export type DealStageType = 'open' | 'won' | 'lost'

export interface DealStage {
  id: string
  tenant_id: string
  name: string
  position: number
  color: string | null
  stage_type: DealStageType
  created_at: string
  updated_at: string
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

export function useDealStages() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['deal-stages', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<DealStage[]> => {
      // Ensure defaults exist (idempotent)
      await supabase.rpc('ensure_default_deal_stages')
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .order('position', { ascending: true })
      if (error) throw error
      return (data as DealStage[]) ?? []
    },
  })

  const createStage = useMutation({
    mutationFn: async (input: { name: string; stage_type?: DealStageType; color?: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated')
      const tenant_id = await getTenantId(user.id)
      if (!tenant_id) throw new Error('No workspace')
      const stages = query.data ?? []
      const position = stages.length ? Math.max(...stages.map((s) => s.position)) + 1 : 0
      const { data, error } = await supabase
        .from('deal_stages')
        .insert({
          tenant_id,
          name: input.name,
          stage_type: input.stage_type ?? 'open',
          color: input.color ?? null,
          position,
        })
        .select()
        .single()
      if (error) throw error
      return data as DealStage
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] })
      toast({ title: 'Stage created' })
    },
    onError: (e: any) => toast({ title: 'Could not create stage', description: e.message, variant: 'destructive' }),
  })

  const updateStage = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; stage_type?: DealStageType; color?: string | null; position?: number }) => {
      const { data, error } = await supabase.from('deal_stages').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as DealStage
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-stages'] }),
    onError: (e: any) => toast({ title: 'Could not update stage', description: e.message, variant: 'destructive' }),
  })

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deal_stages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      toast({ title: 'Stage deleted' })
    },
    onError: (e: any) => toast({ title: 'Could not delete stage', description: e.message, variant: 'destructive' }),
  })

  const reorderStages = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update positions sequentially; small N
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from('deal_stages').update({ position: idx }).eq('id', id)
        )
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-stages'] }),
  })

  return { ...query, createStage, updateStage, deleteStage, reorderStages }
}
