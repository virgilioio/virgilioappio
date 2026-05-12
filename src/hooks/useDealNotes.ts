import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface DealNote {
  id: string
  deal_id: string
  tenant_id: string
  author_id: string | null
  body: string
  created_at: string
  updated_at: string
  author_name?: string | null
  author_avatar_url?: string | null
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

export function useDealNotes(dealId: string | null | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const list = useQuery({
    queryKey: ['deal-notes', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<DealNote[]> => {
      const { data, error } = await supabase
        .from('deal_notes')
        .select('*')
        .eq('deal_id', dealId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = data ?? []
      const ids = Array.from(new Set(rows.map((r: any) => r.author_id).filter(Boolean)))
      let memberMap = new Map<string, any>()
      if (ids.length) {
        const { data: m } = await supabase
          .from('members')
          .select('user_id, user_first_name, user_last_name, user_email, user_avatar_url')
          .in('user_id', ids)
        memberMap = new Map((m ?? []).map((x: any) => [x.user_id, x]))
      }
      return rows.map((r: any) => {
        const m = r.author_id ? memberMap.get(r.author_id) : null
        return {
          ...r,
          author_name: m ? `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim() || m.user_email : 'Unknown',
          author_avatar_url: m?.user_avatar_url ?? null,
        } as DealNote
      })
    },
  })

  const addNote = useMutation({
    mutationFn: async (body: string) => {
      if (!user?.id || !dealId) throw new Error('Missing context')
      const tenant_id = await getTenantId(user.id)
      if (!tenant_id) throw new Error('No workspace')
      const { error } = await supabase.from('deal_notes').insert({
        deal_id: dealId,
        tenant_id,
        author_id: user.id,
        body,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-notes', dealId] }),
    onError: (e: any) => toast({ title: 'Could not add note', description: e.message, variant: 'destructive' }),
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deal_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-notes', dealId] }),
  })

  return { ...list, addNote, deleteNote }
}
