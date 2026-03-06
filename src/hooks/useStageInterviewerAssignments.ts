import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export interface StageInterviewerAssignment {
  id: string
  job_hiring_stage_id: string
  member_id: string
  assignment_type: 'required' | 'optional' | 'backup'
  created_at: string
  updated_at: string
}

export function useStageInterviewerAssignments(jhsId?: string) {
  const queryClient = useQueryClient()
  
  // Load interviewers for this stage
  const { data: interviewers = [], isLoading } = useQuery({
    queryKey: ['stage-interviewers', jhsId],
    queryFn: async () => {
      if (!jhsId) return []
      
      const { data, error } = await supabase
        .from('stage_interviewer_assignments')
        .select('id, job_hiring_stage_id, member_id, assignment_type, created_at, updated_at')
        .eq('job_hiring_stage_id', jhsId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      
      return data as StageInterviewerAssignment[]
    },
    enabled: !!jhsId
  })
  
  // Add interviewer mutation (HYBRID: creates job assignment if needed)
  const addInterviewer = useMutation({
    mutationFn: async ({ 
      jhsId, 
      memberId, 
      assignmentType,
      jobId,
      organizationId,
      isAlreadyAssignedToJob
    }: {
      jhsId: string
      memberId: string
      assignmentType: 'required' | 'optional' | 'backup'
      jobId: string
      organizationId: string
      isAlreadyAssignedToJob: boolean
    }) => {
      // Get member's user_id for job assignment
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('user_id')
        .eq('id', memberId)
        .single()
      
      if (memberError || !member?.user_id) {
        throw new Error('Member not found or has no user account')
      }
      
      // 1. Create stage interviewer assignment
      const { error: stageError } = await supabase
        .from('stage_interviewer_assignments')
        .insert({
          job_hiring_stage_id: jhsId,
          member_id: memberId,
          assignment_type: assignmentType
        })
      
      if (stageError) throw stageError
      
      // 2. If not already assigned to job, create job assignment
      if (!isAlreadyAssignedToJob) {
        const { error: jobError } = await supabase
          .from('job_assignments')
          .insert({
            job_id: jobId,
            user_id: member.user_id,
            organization_id: organizationId
          })
        
        if (jobError) throw jobError
      }
      
      return { addedToJobTeam: !isAlreadyAssignedToJob }
    },
    onSuccess: (result, { jhsId, jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['stage-interviewers', jhsId] })
      queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] })
      
      // If a new job assignment was created, sync seats (may affect billing if role is recruiter)
      if (result.addedToJobTeam) {
        supabase.functions.invoke('update-seat-quantity').catch(() => {})
        queryClient.invalidateQueries({ queryKey: ['recruiter-user-ids'] })
        queryClient.invalidateQueries({ queryKey: ['billing-status'] })
      }
      
      const message = result.addedToJobTeam
        ? 'Interviewer assigned and added to job team'
        : 'Interviewer assigned to stage'
      
      toast({ 
        title: 'Success', 
        description: message
      })
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to assign interviewer',
        variant: 'destructive' 
      })
    }
  })
  
  // Remove interviewer mutation (does NOT remove from job assignments)
  const removeInterviewer = useMutation({
    mutationFn: async ({ assignmentId, jhsId }: { assignmentId: string; jhsId: string }) => {
      const { error } = await supabase
        .from('stage_interviewer_assignments')
        .delete()
        .eq('id', assignmentId)
      if (error) throw error
      return { jhsId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stage-interviewers', data.jhsId] })
      toast({ 
        title: 'Success', 
        description: 'Interviewer removed from stage' 
      })
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to remove interviewer',
        variant: 'destructive' 
      })
    }
  })
  
  // Update assignment type mutation
  const updateAssignmentType = useMutation({
    mutationFn: async ({ 
      assignmentId, 
      assignmentType,
      jhsId
    }: {
      assignmentId: string
      assignmentType: 'required' | 'optional' | 'backup'
      jhsId: string
    }) => {
      const { error } = await supabase
        .from('stage_interviewer_assignments')
        .update({ 
          assignment_type: assignmentType,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
      if (error) throw error
      return { jhsId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stage-interviewers', data.jhsId] })
      toast({ 
        title: 'Updated', 
        description: 'Assignment type updated' 
      })
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to update assignment type',
        variant: 'destructive' 
      })
    }
  })
  
  return {
    interviewers,
    isLoading,
    addInterviewer,
    removeInterviewer,
    updateAssignmentType
  }
}
