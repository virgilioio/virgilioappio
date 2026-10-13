import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { undoToast } from '@/lib/undoToast'
import { setProjectCandidateStatus, type ProjectCandidateStatus } from '@/lib/projectCandidateState'

interface ArchiveParams {
  apolloId: string
  projectId: string
  /** For the toast: "Priya Raman archived". */
  name?: string | null
}

export function useArchiveSavedCandidate() {
  const queryClient = useQueryClient()

  const invalidate = (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
    queryClient.invalidateQueries({ queryKey: ['archived-candidates', projectId] })
  }

  // O13 (Block B §16): archiving is instant; Undo puts the person back with the
  // status they had (a shortlisted person comes back shortlisted).
  const archiveMutation = useMutation({
    mutationFn: async ({ apolloId, projectId }: ArchiveParams) => {
      const { data } = await supabase
        .from('sourcing_project_candidates')
        .select('status')
        .eq('sourcing_project_id', projectId)
        .eq('apollo_id', apolloId)
        .maybeSingle()
      const previous: ProjectCandidateStatus = data?.status === 'shortlisted' ? 'shortlisted' : 'active'
      await setProjectCandidateStatus(projectId, apolloId, 'archived')
      return previous
    },
    onSuccess: (previous, { apolloId, projectId, name }) => {
      invalidate(projectId)
      const who = name?.trim() || 'Candidate'
      undoToast(`${who} archived`, async () => {
        try {
          await setProjectCandidateStatus(projectId, apolloId, previous)
          invalidate(projectId)
        } catch {
          toast.error(`Couldn\u2019t restore ${who}. Try again.`)
        }
      })
    },
    onError: (_e, { name }) => {
      toast.error(`Couldn\u2019t archive ${name?.trim() || 'the candidate'}. Try again.`)
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
