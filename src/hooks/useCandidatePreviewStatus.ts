/**
 * Hook for managing candidate preview status (shortlist / not a fit) in sourcing projects
 * Stored in sourcing_project_candidates, so it survives search refreshes (2026-10-11)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { setProjectCandidateStatus } from '@/lib/projectCandidateState'

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
      await setProjectCandidateStatus(projectId, apolloId, newStatus)
      return { newStatus }
    },
    onSuccess: ({ newStatus }, { projectId }) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['sourcing-preview-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['archived-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-people', projectId] })
      
      const messages: Record<PreviewStatus, string> = {
        active: 'Candidate restored',
        shortlisted: 'Candidate shortlisted',
        not_a_fit: 'Marked as not a fit',
        archived: 'Candidate archived'
      }
      toast.success(messages[newStatus])
    },
    onError: (error: any) => {
      toast.error("Couldn't update the candidate", { description: 'Try again in a moment.' })
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
