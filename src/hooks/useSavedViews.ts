import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { toast } from '@/hooks/use-toast'

export type PageContext = 'pipeline' | 'candidates' | 'analytics' | 'talent-intelligence'

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
  created_at: string
  updated_at: string
}

export function useSavedViews(pageContext: PageContext) {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const queryKey = ['saved-views', pageContext, user?.id]

  const { data: views = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('user_id', user.id)
        .eq('page_context', pageContext)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SavedView[]
    },
    enabled: !!user,
  })

  const defaultView = views.find(v => v.is_default) ?? null

  const createView = useMutation({
    mutationFn: async (input: { name: string; filters: Record<string, unknown>; sort_state?: Record<string, unknown>; extra_state?: Record<string, unknown>; is_default?: boolean }) => {
      if (!user || !tenant) throw new Error('Not authenticated')
      
      // If setting as default, unset any existing default first
      if (input.is_default) {
        await supabase
          .from('saved_views')
          .update({ is_default: false } as any)
          .eq('user_id', user.id)
          .eq('page_context', pageContext)
          .eq('is_default', true)
      }
      
      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          user_id: user.id,
          tenant_id: tenant.id,
          page_context: pageContext,
          name: input.name,
          filters: input.filters as any,
          sort_state: (input.sort_state ?? null) as any,
          extra_state: (input.extra_state ?? null) as any,
          is_default: input.is_default ?? false,
        } as any)
        .select()
        .single()
      if (error) throw error
      return data as SavedView
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({ title: 'View saved' })
    },
    onError: () => {
      toast({ title: 'Failed to save view', variant: 'destructive' })
    },
  })

  const updateView = useMutation({
    mutationFn: async (input: { id: string; name?: string; filters?: Record<string, unknown>; sort_state?: Record<string, unknown>; extra_state?: Record<string, unknown>; is_default?: boolean }) => {
      if (!user) throw new Error('Not authenticated')
      
      const updates: Record<string, unknown> = {}
      if (input.name !== undefined) updates.name = input.name
      if (input.filters !== undefined) updates.filters = input.filters
      if (input.sort_state !== undefined) updates.sort_state = input.sort_state
      if (input.extra_state !== undefined) updates.extra_state = input.extra_state
      if (input.is_default !== undefined) {
        if (input.is_default) {
          // Unset existing default
          await supabase
            .from('saved_views')
            .update({ is_default: false } as any)
            .eq('user_id', user.id)
            .eq('page_context', pageContext)
            .eq('is_default', true)
        }
        updates.is_default = input.is_default
      }
      
      const { data, error } = await supabase
        .from('saved_views')
        .update(updates as any)
        .eq('id', input.id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return data as SavedView
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey })
      if (vars.filters) toast({ title: 'View updated' })
      else if (vars.name) toast({ title: 'View renamed' })
      else if (vars.is_default !== undefined) toast({ title: vars.is_default ? 'Default view set' : 'Default view cleared' })
    },
    onError: () => {
      toast({ title: 'Failed to update view', variant: 'destructive' })
    },
  })

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('saved_views')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({ title: 'View deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete view', variant: 'destructive' })
    },
  })

  return {
    views,
    defaultView,
    isLoading,
    createView,
    updateView,
    deleteView,
  }
}
