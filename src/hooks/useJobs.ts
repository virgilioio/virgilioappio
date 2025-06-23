
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from './useUserProfile'
import { useActivityLogger } from './useActivityLogger'
import type { Database } from '@/integrations/supabase/types'

export type Job = Database['public']['Tables']['jobs']['Row']
export type JobInsert = Database['public']['Tables']['jobs']['Insert']
export type JobUpdate = Database['public']['Tables']['jobs']['Update']

export type CreateJobData = Omit<JobInsert, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'organization_id'>
export type UpdateJobData = Partial<JobUpdate>

export function useJobs() {
  const { profile } = useUserProfile()

  const query = useQuery({
    queryKey: ['jobs', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching jobs for organization:', profile?.organization_id)
      
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching jobs:', error)
        throw error
      }

      console.log('Fetched jobs:', data)
      return data as Job[]
    },
    enabled: !!profile?.organization_id,
  })

  return {
    jobs: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { logJobCreated } = useActivityLogger()

  return useMutation({
    mutationFn: async (jobData: CreateJobData) => {
      console.log('Creating job:', jobData)
      
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          ...jobData,
          created_by: profile?.user_id,
          organization_id: profile?.organization_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating job:', error)
        throw error
      }

      console.log('Created job:', data)
      
      // Log activity
      logJobCreated(data.title, data.id)
      
      return data as Job
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast({
        title: 'Success',
        description: 'Job created successfully',
      })
    },
    onError: (error) => {
      console.error('Error creating job:', error)
      toast({
        title: 'Error',
        description: 'Failed to create job',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { logJobUpdated } = useActivityLogger()

  return useMutation({
    mutationFn: async ({ id, ...jobData }: UpdateJobData & { id: string }) => {
      console.log('Updating job:', id, jobData)
      
      const { data, error } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating job:', error)
        throw error
      }

      console.log('Updated job:', data)
      
      // Log activity
      logJobUpdated(data.title, data.id)
      
      return data as Job
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast({
        title: 'Success',
        description: 'Job updated successfully',
      })
    },
    onError: (error) => {
      console.error('Error updating job:', error)
      toast({
        title: 'Error',
        description: 'Failed to update job',
        variant: 'destructive',
      })
    },
  })
}

export function useArchiveJob() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { logJobUpdated } = useActivityLogger()

  return useMutation({
    mutationFn: async (jobId: string) => {
      console.log('Archiving job:', jobId)
      
      const { data, error } = await supabase
        .from('jobs')
        .update({ status: 'archived' })
        .eq('id', jobId)
        .select()
        .single()

      if (error) {
        console.error('Error archiving job:', error)
        throw error
      }

      console.log('Archived job:', data)
      
      // Log activity
      logJobUpdated(data.title, data.id)
      
      return data as Job
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast({
        title: 'Success',
        description: 'Job archived successfully',
      })
    },
    onError: (error) => {
      console.error('Error archiving job:', error)
      toast({
        title: 'Error',
        description: 'Failed to archive job',
        variant: 'destructive',
      })
    },
  })
}

export function useGetJob() {
  const queryClient = useQueryClient()

  return async (jobId: string): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      throw error
    }

    return data as Job
  }
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (jobId: string) => {
      console.log('Deleting job:', jobId)
      
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)

      if (error) {
        console.error('Error deleting job:', error)
        throw error
      }

      console.log('Deleted job:', jobId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast({
        title: 'Success',
        description: 'Job deleted successfully',
      })
    },
    onError: (error) => {
      console.error('Error deleting job:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete job',
        variant: 'destructive',
      })
    },
  })
}
