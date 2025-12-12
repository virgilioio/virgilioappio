import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface ArchiveParams {
  apolloId: string
  projectId: string
}

export function useArchiveSavedCandidate() {
  const queryClient = useQueryClient()

  const archiveMutation = useMutation({
    mutationFn: async ({ apolloId, projectId }: ArchiveParams) => {
      const { error } = await supabase
        .from('sourcing_preview_candidates')
        .update({ 
          status: 'archived', 
          archived_at: new Date().toISOString() 
        })
        .eq('apollo_id', apolloId)
        .eq('sourcing_project_id', projectId)

      if (error) throw error
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['archived-candidates', projectId] })
      toast.success('Candidate archived')
    },
    onError: (error: any) => {
      toast.error('Failed to archive candidate', { description: error.message })
    }
  })

  const restoreMutation = useMutation({
    mutationFn: async ({ apolloId, projectId }: ArchiveParams) => {
      const { error } = await supabase
        .from('sourcing_preview_candidates')
        .update({ 
          status: 'active', 
          archived_at: null 
        })
        .eq('apollo_id', apolloId)
        .eq('sourcing_project_id', projectId)

      if (error) throw error
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['archived-candidates', projectId] })
      toast.success('Candidate restored')
    },
    onError: (error: any) => {
      toast.error('Failed to restore candidate', { description: error.message })
    }
  })

  return {
    archiveCandidate: archiveMutation.mutate,
    restoreCandidate: restoreMutation.mutate,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending
  }
}
