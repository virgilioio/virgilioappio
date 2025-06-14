
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface JobAssignment {
  id: string
  job_id: string
  user_id: string
  assigned_by: string | null
  organization_id: string
  created_at: string
  updated_at: string
}

export interface CreateJobAssignmentData {
  job_id: string
  user_id: string
  organization_id: string
}

export function useJobAssignments(jobId?: string) {
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getAssignments = async (targetJobId?: string) => {
    const queryJobId = targetJobId || jobId
    if (!user || !queryJobId) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching job assignments for job:', queryJobId)
      const { data, error: fetchError } = await supabase
        .from('job_assignments')
        .select('*')
        .eq('job_id', queryJobId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching job assignments:', fetchError)
        throw fetchError
      }

      console.log('Fetched job assignments:', data)
      setAssignments(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job assignments'
      console.error('Job assignments fetch error:', err)
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

  const assignUserToJob = async (data: CreateJobAssignmentData) => {
    if (!user) throw new Error('User not authenticated')

    setIsLoading(true)
    setError(null)

    try {
      console.log('Assigning user to job:', data)
      const { data: newAssignment, error: createError } = await supabase
        .from('job_assignments')
        .insert([{
          ...data,
          assigned_by: user.id,
        }])
        .select()
        .single()

      if (createError) {
        console.error('Error assigning user to job:', createError)
        throw createError
      }

      console.log('Created job assignment:', newAssignment)
      toast({
        title: 'Success',
        description: 'User assigned to job successfully'
      })

      await getAssignments(data.job_id)
      return newAssignment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign user to job'
      console.error('Job assignment creation error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const removeUserFromJob = async (assignmentId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Removing job assignment:', assignmentId)
      const { error: deleteError } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', assignmentId)

      if (deleteError) {
        console.error('Error removing job assignment:', deleteError)
        throw deleteError
      }

      console.log('Removed job assignment:', assignmentId)
      toast({
        title: 'Success',
        description: 'User removed from job successfully'
      })

      await getAssignments()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove user from job'
      console.error('Job assignment deletion error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const checkUserAssignment = async (userId: string, targetJobId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.rpc('is_user_assigned_to_job', {
        job_id_param: targetJobId,
        user_id_param: userId
      })
      return data || false
    } catch (err) {
      console.error('Error checking user assignment:', err)
      return false
    }
  }

  useEffect(() => {
    if (user && jobId) {
      getAssignments()
    }
  }, [user, jobId])

  return {
    assignments,
    isLoading,
    error,
    getAssignments,
    assignUserToJob,
    removeUserFromJob,
    checkUserAssignment
  }
}
