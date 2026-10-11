import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setProjectCandidateStatus } from '@/lib/projectCandidateState'

interface ArchiveParams {
  apolloId: string
  projectId: string
}

export function useArchiveSavedCandidate() {
  const queryClient = useQueryClient()

  const archiveMutation = useMutation({
    mutationFn: async ({ apolloId, projectId }: ArchiveParams) => {
      await setProjectCandidateStatus(projectId, apolloId, 'archived')
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
      await setProjectCandidateStatus(projectId, apolloId, 'active')
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
