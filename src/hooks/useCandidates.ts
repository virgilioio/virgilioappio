
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from './useUserProfile'
import { useActivityLogger } from './useActivityLogger'
import type { Database } from '@/integrations/supabase/types'

type JobCandidate = Database['public']['Tables']['job_candidates']['Row']
type JobCandidateInsert = Database['public']['Tables']['job_candidates']['Insert']
type JobCandidateUpdate = Database['public']['Tables']['job_candidates']['Update']

export function useCandidates(jobId?: string) {
  return useQuery({
    queryKey: ['candidates', jobId],
    queryFn: async () => {
      console.log('Fetching candidates for job:', jobId)
      
      let query = supabase
        .from('job_candidates')
        .select('*')
        .order('created_at', { ascending: false })

      if (jobId) {
        query = query.eq('job_id', jobId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching candidates:', error)
        throw error
      }

      console.log('Fetched candidates:', data)
      return data as JobCandidate[]
    },
    enabled: !!jobId,
  })
}

export function useCreateCandidate() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { logCandidateAdded } = useActivityLogger()

  return useMutation({
    mutationFn: async (candidateData: JobCandidateInsert & { job_title?: string }) => {
      console.log('Creating candidate:', candidateData)
      
      const { job_title, ...insertData } = candidateData
      
      const { data, error } = await supabase
        .from('job_candidates')
        .insert({
          ...insertData,
          added_by: profile?.user_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating candidate:', error)
        throw error
      }

      console.log('Created candidate:', data)
      
      // Log activity
      logCandidateAdded(
        data.candidate_name, 
        job_title || 'Unknown Job', 
        data.id
      )
      
      return data as JobCandidate
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates', data.job_id] })
      toast({
        title: 'Success',
        description: 'Candidate added successfully',
      })
    },
    onError: (error) => {
      console.error('Error creating candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to add candidate',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...candidateData }: JobCandidateUpdate & { id: string }) => {
      console.log('Updating candidate:', id, candidateData)
      
      const { data, error } = await supabase
        .from('job_candidates')
        .update(candidateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating candidate:', error)
        throw error
      }

      console.log('Updated candidate:', data)
      return data as JobCandidate
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates', data.job_id] })
      toast({
        title: 'Success',
        description: 'Candidate updated successfully',
      })
    },
    onError: (error) => {
      console.error('Error updating candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to update candidate',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ candidateId, jobId }: { candidateId: string; jobId: string }) => {
      console.log('Deleting candidate:', candidateId)
      
      const { error } = await supabase
        .from('job_candidates')
        .delete()
        .eq('id', candidateId)

      if (error) {
        console.error('Error deleting candidate:', error)
        throw error
      }

      console.log('Deleted candidate:', candidateId)
      return { candidateId, jobId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates', data.jobId] })
      toast({
        title: 'Success',
        description: 'Candidate removed successfully',
      })
    },
    onError: (error) => {
      console.error('Error deleting candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove candidate',
        variant: 'destructive',
      })
    },
  })
}
