import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cacheTiers } from '@/lib/cache/cacheTiers'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

export interface CandidateSource {
  id: string
  tenant_id: string | null
  name: string
  description: string | null
  is_active: boolean
  display_order: number
  source: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export function useCandidateSources(context: 'platform-defaults' | 'organization' = 'organization') {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['candidate-sources', context],
    queryFn: async () => {
      let query = supabase
        .from('candidate_sources')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (context === 'platform-defaults') {
        query = query.is('tenant_id', null)
      }

      const { data, error } = await query
      if (error) throw error
      return data as CandidateSource[]
    },
    enabled: !!user
  })

  const createSource = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      let tenantId: string | null = null

      if (context !== 'platform-defaults') {
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('tenant_id')
          .eq('user_id', user?.id)
          .eq('user_status', 'active')
          .maybeSingle()

        if (memberError) throw memberError
        if (!member?.tenant_id) throw new Error('No tenant found for user')
        tenantId = member.tenant_id
      }

      const { data, error } = await supabase
        .from('candidate_sources')
        .insert({
          name: input.name,
          description: input.description || null,
          tenant_id: tenantId,
          source: context === 'platform-defaults' ? 'platform' : 'tenant',
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-sources'] })
      toast.success('Candidate source created')
    },
    onError: (error) => {
      console.error('Failed to create candidate source:', error)
      toast.error('Failed to create candidate source')
    }
  })

  const updateSource = useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; display_order?: number }) => {
      const { id, ...updates } = input
      const { data, error } = await supabase
        .from('candidate_sources')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-sources'] })
      toast.success('Candidate source updated')
    },
    onError: (error) => {
      console.error('Failed to update candidate source:', error)
      toast.error('Failed to update candidate source')
    }
  })

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('candidate_sources')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-sources'] })
      toast.success('Candidate source deleted')
    },
    onError: (error) => {
      console.error('Failed to delete candidate source:', error)
      toast.error('Failed to delete candidate source')
    }
  })

  const platformSources = sources.filter(s => s.source === 'platform')
  const tenantSources = sources.filter(s => s.source === 'tenant')

  return {
    sources,
    platformSources,
    tenantSources,
    isLoading,
    createSource: createSource.mutateAsync,
    updateSource: updateSource.mutateAsync,
    deleteSource: deleteSource.mutateAsync,
    isCreating: createSource.isPending,
    isUpdating: updateSource.isPending,
    isDeleting: deleteSource.isPending
  }
}
