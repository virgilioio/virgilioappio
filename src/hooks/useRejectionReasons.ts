import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

export type RejectionCategory = 'recruiter_rejected' | 'candidate_declined'

export interface RejectionReason {
  id: string
  tenant_id: string | null
  name: string
  category: RejectionCategory
  description: string | null
  is_active: boolean
  display_order: number
  source: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export function useRejectionReasons(context: 'platform-defaults' | 'organization' = 'organization') {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: reasons = [], isLoading } = useQuery({
    queryKey: ['rejection-reasons', context],
    queryFn: async () => {
      let query = supabase
        .from('rejection_reasons')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (context === 'platform-defaults') {
        // Only show platform defaults
        query = query.is('tenant_id', null)
      }
      // For organization context, RLS handles filtering to tenant + platform defaults

      const { data, error } = await query

      if (error) throw error
      return data as RejectionReason[]
    },
    enabled: !!user
  })

  const createReason = useMutation({
    mutationFn: async (input: { 
      name: string
      category: RejectionCategory
      description?: string 
    }) => {
      const { data, error } = await supabase
        .from('rejection_reasons')
        .insert({
          name: input.name,
          category: input.category,
          description: input.description || null,
          tenant_id: context === 'platform-defaults' ? null : undefined, // RLS will set tenant_id for org context
          source: context === 'platform-defaults' ? 'platform' : 'tenant',
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-reasons'] })
      toast.success('Rejection reason created')
    },
    onError: (error) => {
      console.error('Failed to create rejection reason:', error)
      toast.error('Failed to create rejection reason')
    }
  })

  const updateReason = useMutation({
    mutationFn: async (input: { 
      id: string
      name?: string
      description?: string
      display_order?: number
    }) => {
      const { id, ...updates } = input
      const { data, error } = await supabase
        .from('rejection_reasons')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-reasons'] })
      toast.success('Rejection reason updated')
    },
    onError: (error) => {
      console.error('Failed to update rejection reason:', error)
      toast.error('Failed to update rejection reason')
    }
  })

  const deleteReason = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active = false
      const { error } = await supabase
        .from('rejection_reasons')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-reasons'] })
      toast.success('Rejection reason deleted')
    },
    onError: (error) => {
      console.error('Failed to delete rejection reason:', error)
      toast.error('Failed to delete rejection reason')
    }
  })

  // Separate platform and tenant reasons
  const platformReasons = reasons.filter(r => r.source === 'platform')
  const tenantReasons = reasons.filter(r => r.source === 'tenant')

  return {
    reasons,
    platformReasons,
    tenantReasons,
    isLoading,
    createReason: createReason.mutateAsync,
    updateReason: updateReason.mutateAsync,
    deleteReason: deleteReason.mutateAsync,
    isCreating: createReason.isPending,
    isUpdating: updateReason.isPending,
    isDeleting: deleteReason.isPending
  }
}
