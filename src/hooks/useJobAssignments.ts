
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

/** Asks the database whether this person may change a seat with this role on this job. */
async function assertCanManage(jobId: string, role: JobAssignmentRole) {
  const { data, error } = await supabase.rpc('can_manage_job_team', { _job_id: jobId, _role: role })
  if (!error && data === false) throw { code: '42501' }
}

/**
 * Job-team writes refused by the database get a message that says why: 42501
 * (not allowed), GJT01 (one seat per person: "Maya Okafor is already on this
 * job as Hiring manager.") and 23505 (the same, lost to a race).
 */
export function jobTeamError(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '42501') {
    return 'Only admins can add, change or remove a job\'s TA and Sourcers. A TA on the job can add its hiring managers and interviewers.'
  }
  if (e?.code === 'GJT01' && e.message) return e.message
  if (e?.code === '23505') return 'That person is already on this job. Change their role instead.'
  return err instanceof Error ? err.message : fallback
}


export type JobAssignmentRole = 'sourcer' | 'recruiter' | 'hiring_manager' | 'interviewer'

export interface JobAssignment {
  id: string
  job_id: string
  user_id: string
  assigned_by: string | null
  organization_id: string
  role: JobAssignmentRole
  created_at: string
  updated_at: string
}

export interface CreateJobAssignmentData {
  job_id: string
  user_id: string
  organization_id: string
  role: JobAssignmentRole
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

  /**
   * One person holds one seat on a job (Allan, 2026-10-22): someone already on
   * this job keeps their seat and takes the new role, they're never added twice.
   */
  const assignUserToJob = async (data: CreateJobAssignmentData) => {
    if (!user) throw new Error('User not authenticated')

    const seat = data.job_id === jobId ? assignments.find((a) => a.user_id === data.user_id) : undefined
    if (seat) {
      if (seat.role !== data.role) await updateAssignmentRole(seat.id, data.role)
      return { ...seat, role: data.role }
    }

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
      const errorMessage = jobTeamError(err, 'Failed to assign user to job')
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

  /** `quiet`: the caller shows success and errors itself (the remove dialogs do). */
  const removeUserFromJob = async (assignmentId: string, opts: { quiet?: boolean } = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Removing job assignment:', assignmentId)
      // The database silently removes nothing it doesn't allow, so ask first.
      const target = assignments.find((a) => a.id === assignmentId)
      if (target) await assertCanManage(target.job_id, target.role)

      const { error: deleteError } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', assignmentId)

      if (deleteError) {
        console.error('Error removing job assignment:', deleteError)
        throw deleteError
      }

      console.log('Removed job assignment:', assignmentId)
      if (!opts.quiet) toast({
        title: 'Success',
        description: 'User removed from job successfully'
      })

      await getAssignments()
    } catch (err) {
      const errorMessage = jobTeamError(err, 'Failed to remove user from job')
      console.error('Job assignment deletion error:', err)
      setError(errorMessage)
      if (!opts.quiet) toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateAssignmentRole = async (assignmentId: string, role: JobAssignmentRole) => {
    setIsLoading(true)
    setError(null)

    try {
      const current = assignments.find((a) => a.id === assignmentId)
      if (current) {
        await assertCanManage(current.job_id, current.role)
        await assertCanManage(current.job_id, role)
      }

      const { error: updateError } = await supabase
        .from('job_assignments')
        .update({ role } as any)
        .eq('id', assignmentId)

      if (updateError) throw updateError

      toast({
        title: 'Success',
        description: 'Assignment role updated successfully'
      })

      await getAssignments()
    } catch (err) {
      const errorMessage = jobTeamError(err, 'Failed to update assignment role')
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
    updateAssignmentRole,
    checkUserAssignment
  }
}
