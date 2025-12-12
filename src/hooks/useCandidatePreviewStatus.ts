/**
 * Hook for managing candidate preview status (shortlist / not a fit) in sourcing projects
 * Uses the existing status column on sourcing_preview_candidates table
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

type PreviewStatus = 'active' | 'shortlisted' | 'not_a_fit' | 'archived'

interface UpdateStatusParams {
  apolloId: string
  projectId: string
  newStatus: PreviewStatus
}

export function useCandidatePreviewStatus() {
  const queryClient = useQueryClient()

  const updateStatusMutation = useMutation({
    mutationFn: async ({ apolloId, projectId, newStatus }: UpdateStatusParams) => {
      const { error } = await supabase
        .from('sourcing_preview_candidates')
        .update({ 
          status: newStatus,
          archived_at: newStatus === 'archived' ? new Date().toISOString() : null
        })
        .eq('apollo_id', apolloId)
        .eq('sourcing_project_id', projectId)

      if (error) throw error
      return { newStatus }
    },
    onSuccess: ({ newStatus }, { projectId }) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['sourcing-preview-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['archived-candidates', projectId] })
      
      const messages: Record<PreviewStatus, string> = {
        active: 'Candidate restored',
        shortlisted: 'Candidate shortlisted',
        not_a_fit: 'Marked as not a fit',
        archived: 'Candidate archived'
      }
      toast.success(messages[newStatus])
    },
    onError: (error: any) => {
      toast.error('Failed to update status', { description: error.message })
    }
  })

  return {
    shortlistCandidate: (apolloId: string, projectId: string) => 
      updateStatusMutation.mutate({ apolloId, projectId, newStatus: 'shortlisted' }),
    markNotAFit: (apolloId: string, projectId: string) => 
      updateStatusMutation.mutate({ apolloId, projectId, newStatus: 'not_a_fit' }),
    restoreCandidate: (apolloId: string, projectId: string) => 
      updateStatusMutation.mutate({ apolloId, projectId, newStatus: 'active' }),
    archiveCandidate: (apolloId: string, projectId: string) => 
      updateStatusMutation.mutate({ apolloId, projectId, newStatus: 'archived' }),
    isUpdating: updateStatusMutation.isPending,
    currentApolloId: updateStatusMutation.variables?.apolloId
  }
}
