
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from './useUserProfile'
import { useActivityLogger } from './useActivityLogger'
import type { Database } from '@/integrations/supabase/types'

export type JobRequest = Database['public']['Tables']['job_requests']['Row']
export type JobRequestInsert = Database['public']['Tables']['job_requests']['Insert']
export type JobRequestUpdate = Database['public']['Tables']['job_requests']['Update']

export function useJobRequests() {
  const { profile } = useUserProfile()

  const query = useQuery({
    queryKey: ['job_requests', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching job requests for organization:', profile?.organization_id)
      
      const { data, error } = await supabase
        .from('job_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching job requests:', error)
        throw error
      }

      console.log('Fetched job requests:', data)
      return data as JobRequest[]
    },
    enabled: !!profile?.organization_id,
  })

  return {
    jobRequests: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCreateJobRequest() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { logJobRequestCreated } = useActivityLogger()

  return useMutation({
    mutationFn: async (jobRequestData: JobRequestInsert) => {
      console.log('Creating job request:', jobRequestData)
      
      const { data, error } = await supabase
        .from('job_requests')
        .insert({
          ...jobRequestData,
          submitted_by: profile?.user_id,
          organization_id: profile?.organization_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating job request:', error)
        throw error
      }

      console.log('Created job request:', data)
      
      // Log activity
      logJobRequestCreated(data.title, data.id)
      
      return data as JobRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_requests'] })
      toast({
        title: 'Success',
        description: 'Job request submitted successfully',
      })
    },
    onError: (error) => {
      console.error('Error creating job request:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit job request',
        variant: 'destructive',
      })
    },
  })
}

export function useApproveJobRequest() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { logJobRequestApproved } = useActivityLogger()

  return useMutation({
    mutationFn: async (jobRequestId: string) => {
      console.log('Approving job request:', jobRequestId)
      
      const { data, error } = await supabase
        .from('job_requests')
        .update({
          status: 'approved',
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', jobRequestId)
        .select()
        .single()

      if (error) {
        console.error('Error approving job request:', error)
        throw error
      }

      console.log('Approved job request:', data)
      
      // Log activity
      logJobRequestApproved(data.title, data.id)
      
      return data as JobRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_requests'] })
      toast({
        title: 'Success',
        description: 'Job request approved successfully',
      })
    },
    onError: (error) => {
      console.error('Error approving job request:', error)
      toast({
        title: 'Error',
        description: 'Failed to approve job request',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateJobRequest() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...jobRequestData }: JobRequestUpdate & { id: string }) => {
      console.log('Updating job request:', id, jobRequestData)
      
      const { data, error } = await supabase
        .from('job_requests')
        .update(jobRequestData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating job request:', error)
        throw error
      }

      console.log('Updated job request:', data)
      return data as JobRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_requests'] })
      toast({
        title: 'Success',
        description: 'Job request updated successfully',
      })
    },
    onError: (error) => {
      console.error('Error updating job request:', error)
      toast({
        title: 'Error',
        description: 'Failed to update job request',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteJobRequest() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (jobRequestId: string) => {
      console.log('Deleting job request:', jobRequestId)
      
      const { error } = await supabase
        .from('job_requests')
        .delete()
        .eq('id', jobRequestId)

      if (error) {
        console.error('Error deleting job request:', error)
        throw error
      }

      console.log('Deleted job request:', jobRequestId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_requests'] })
      toast({
        title: 'Success',
        description: 'Job request deleted successfully',
      })
    },
    onError: (error) => {
      console.error('Error deleting job request:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete job request',
        variant: 'destructive',
      })
    },
  })
}
