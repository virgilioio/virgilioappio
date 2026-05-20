import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export type NotificationCategory =
  | 'mention'
  | 'application_batch'
  | 'scorecard_submitted'
  | 'interview_event'
  | 'offer_event'
  | 'posting_status'
  | 'daily_digest'

export interface NotificationRow {
  id: string
  tenant_id: string | null
  user_id: string
  category: NotificationCategory
  actor_user_id: string | null
  actor_name: string | null
  actor_avatar_url: string | null
  title: string
  subtitle: string | null
  preview: string | null
  entity_kind: string | null
  entity_id: string | null
  job_id: string | null
  candidate_id: string | null
  action_url: string | null
  metadata: Record<string, any>
  read_at: string | null
  created_at: string
}

export function useNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data || []) as NotificationRow[]
    },
  })

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications', user?.id] })
      const prev = qc.getQueryData<NotificationRow[]>(['notifications', user?.id])
      qc.setQueryData<NotificationRow[]>(['notifications', user?.id], (old) =>
        old?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) || []
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', user?.id], ctx.prev)
    },
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications', user?.id] })
      const prev = qc.getQueryData<NotificationRow[]>(['notifications', user?.id])
      const now = new Date().toISOString()
      qc.setQueryData<NotificationRow[]>(['notifications', user?.id], (old) =>
        old?.map((n) => (n.read_at ? n : { ...n, read_at: now })) || []
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', user?.id], ctx.prev)
    },
  })

  return { ...query, markAsRead, markAllAsRead }
}
