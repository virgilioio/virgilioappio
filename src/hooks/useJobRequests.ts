
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface JobRequest {
  id: string
  title: string
  description?: string
  department?: string
  level: 'L1' | 'L2' | 'L3'
  location?: string
  salary_min?: number
  salary_max?: number
  currency?: string
  notes?: string
  submitted_by: string
  organization_id: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  job_id?: string
  created_at: string
  updated_at: string
}

// Level mapping from job request to job table
const LEVEL_MAPPING = {
  'L1': 'L1 - Specialists',
  'L2': 'L2 - Managers',
  'L3': 'L3 - Directors / VPs / Executive Search'
} as const

export function useJobRequests() {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getMyRequests = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching my job requests for user:', user.id)
      const { data, error: fetchError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('organization_id', user.user_metadata?.organization_id || '')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching my job requests:', fetchError)
        throw fetchError
      }

      console.log('Fetched my job requests:', data)
      setJobRequests((data || []) as JobRequest[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job requests'
      console.error('My job requests fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getAllRequests = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching all job requests for admin/CS user:', user.id)
      const { data, error: fetchError } = await supabase
        .from('job_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching all job requests:', fetchError)
        throw fetchError
      }

      console.log('Fetched all job requests:', data)
      setJobRequests((data || []) as JobRequest[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job requests'
      console.error('All job requests fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getJobRequests = async () => {
    if (!user) return

    // Check if user is admin/CS to decide which method to use
    const userType = user?.user_metadata?.user_type || 'guest'
    const memberRole = user?.user_metadata?.member_role || 'member'
    
    const isAdmin = userType === 'platform_admin' || memberRole === 'customer_success'
    
    if (isAdmin) {
      await getAllRequests()
    } else {
      await getMyRequests()
    }
  }

  const getJobRequest = async (id: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      return data as JobRequest
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job request'
      console.error('Job request fetch error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const createJobRequest = async (requestData: Omit<JobRequest, 'id' | 'submitted_by' | 'organization_id' | 'status' | 'approved_by' | 'created_at' | 'updated_at' | 'job_id'>) => {
    if (!user) throw new Error('User not authenticated')

    try {
      const { data, error: insertError } = await supabase
        .from('job_requests')
        .insert({
          ...requestData,
          submitted_by: user.id,
          organization_id: user.user_metadata?.organization_id || '',
        })
        .select()
        .single()

      if (insertError) throw insertError

      toast({
        title: 'Success',
        description: 'Job request created successfully',
      })

      await getJobRequests() // Refresh the list
      return data as JobRequest
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create job request'
      console.error('Job request creation error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const updateJobRequest = async (id: string, updates: Partial<JobRequest>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('job_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      toast({
        title: 'Success',
        description: 'Job request updated successfully',
      })

      await getJobRequests() // Refresh the list
      return data as JobRequest
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update job request'
      console.error('Job request update error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const approveJobRequest = async (id: string) => {
    if (!user) throw new Error('User not authenticated')

    try {
      // First get the job request details
      const jobRequest = await getJobRequest(id)
      
      // Check if already approved (duplicate prevention)
      if (jobRequest.status === 'approved' || jobRequest.job_id) {
        throw new Error('Job request has already been approved')
      }

      // Create a new job from the approved request
      const { data: newJob, error: jobInsertError } = await supabase
        .from('jobs')
        .insert({
          title: jobRequest.title,
          description: jobRequest.description,
          department: jobRequest.department,
          level: LEVEL_MAPPING[jobRequest.level],
          location: jobRequest.location,
          salary_min: jobRequest.salary_min,
          salary_max: jobRequest.salary_max,
          currency: jobRequest.currency,
          organization_id: jobRequest.organization_id,
          created_by: user.id,
          status: 'draft'
        })
        .select()
        .single()

      if (jobInsertError) throw jobInsertError

      // Update the job request status and link to the created job
      await updateJobRequest(id, {
        status: 'approved',
        approved_by: user.id,
        job_id: newJob.id
      })

      toast({
        title: 'Success',
        description: 'Job request approved and job created successfully',
      })

      await getJobRequests() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve job request'
      console.error('Job request approval error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const deleteJobRequest = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('job_requests')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      toast({
        title: 'Success',
        description: 'Job request deleted successfully',
      })

      await getJobRequests() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete job request'
      console.error('Job request deletion error:', err)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    }
  }

  const refreshJobRequests = () => {
    getJobRequests()
  }

  useEffect(() => {
    if (user) {
      getJobRequests()
    }
  }, [user])

  return {
    jobRequests,
    isLoading,
    error,
    getJobRequests,
    getMyRequests,
    getAllRequests,
    getJobRequest,
    createJobRequest,
    updateJobRequest,
    approveJobRequest,
    deleteJobRequest,
    refreshJobRequests
  }
}
