import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { toast } from '@/hooks/use-toast'

export type PageContext = 'pipeline' | 'candidates' | 'analytics' | 'talent-intelligence'
export type ViewVisibility = 'private' | 'shared'

export interface SavedView {
  id: string
  user_id: string
  tenant_id: string
  page_context: PageContext
  name: string
  filters: Record<string, unknown>
  sort_state: Record<string, unknown> | null
  extra_state: Record<string, unknown> | null
  is_default: boolean
  visibility: ViewVisibility
  created_at: string
  updated_at: string
}

// visibility column is in the generated types now (migration applied)

export function useSavedViews(pageContext: PageContext) {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const queryKey = ['saved-views', pageContext, user?.id, tenant?.id]

  const { data: views = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return []
      // Fetch own views + shared views in the same tenant (RLS enforces this too)
      const ownPromise = db
        .from('saved_views')
        .select('*')
        .eq('user_id', user.id)
        .eq('page_context', pageContext)
      const sharedPromise = tenant
        ? db
            .from('saved_views')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('page_context', pageContext)
            .eq('visibility', 'shared')
            .neq('user_id', user.id)
        : Promise.resolve({ data: [], error: null })

      const [own, shared] = await Promise.all([ownPromise, sharedPromise])
      if (own.error) throw own.error
      if (shared.error) throw shared.error
      const map = new Map<string, SavedView>()
      ;[...(own.data ?? []), ...(shared.data ?? [])].forEach((v: SavedView) => map.set(v.id, v))
      return Array.from(map.values()).sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
    },
    enabled: !!user,
  })

  const defaultView = views.find(v => v.is_default && v.user_id === user?.id) ?? views.find(v => v.is_default) ?? null

  const createView = useMutation({
    mutationFn: async (input: {
      name: string
      filters: Record<string, unknown>
      sort_state?: Record<string, unknown>
      extra_state?: Record<string, unknown>
      is_default?: boolean
      visibility?: ViewVisibility
    }) => {
      if (!user || !tenant) throw new Error('Not authenticated')
      if (input.is_default) {
        await db
          .from('saved_views')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('page_context', pageContext)
          .eq('is_default', true)
      }
      const { data, error } = await db
        .from('saved_views')
        .insert({
          user_id: user.id,
          tenant_id: tenant.id,
          page_context: pageContext,
          name: input.name,
          filters: input.filters,
          sort_state: input.sort_state ?? null,
          extra_state: input.extra_state ?? null,
          is_default: input.is_default ?? false,
          visibility: input.visibility ?? 'private',
        })
        .select()
        .single()
      if (error) throw error
      return data as SavedView
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({ title: 'View saved' })
    },
    onError: () => toast({ title: 'Failed to save view', variant: 'destructive' }),
  })

  const updateView = useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      filters?: Record<string, unknown>
      sort_state?: Record<string, unknown>
      extra_state?: Record<string, unknown>
      is_default?: boolean
      visibility?: ViewVisibility
    }) => {
      if (!user) throw new Error('Not authenticated')
      const updates: Record<string, unknown> = {}
      if (input.name !== undefined) updates.name = input.name
      if (input.filters !== undefined) updates.filters = input.filters
      if (input.sort_state !== undefined) updates.sort_state = input.sort_state
      if (input.extra_state !== undefined) updates.extra_state = input.extra_state
      if (input.visibility !== undefined) updates.visibility = input.visibility
      if (input.is_default !== undefined) {
        if (input.is_default) {
          await db
            .from('saved_views')
            .update({ is_default: false })
            .eq('user_id', user.id)
            .eq('page_context', pageContext)
            .eq('is_default', true)
        }
        updates.is_default = input.is_default
      }
      const { data, error } = await db
        .from('saved_views')
        .update(updates)
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return data as SavedView
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey })
      if (vars.name !== undefined) toast({ title: 'View renamed' })
      else if (vars.visibility !== undefined) toast({ title: vars.visibility === 'shared' ? 'View shared' : 'View made private' })
    },
    onError: () => toast({ title: 'Failed to update view', variant: 'destructive' }),
  })

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('saved_views').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({ title: 'View deleted' })
    },
    onError: () => toast({ title: 'Failed to delete view', variant: 'destructive' }),
  })

  return { views, defaultView, isLoading, createView, updateView, deleteView }
}
