import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export type StageType = 'application' | 'screening' | 'interview' | 'assessment' | 'reference_check' | 'offer' | 'onboarding' | 'custom'

export interface JobStage {
  id: string
  stage_name: string
  stage_type: StageType
  stage_description?: string
  is_default: boolean
  stage_priority?: number
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateJobStageInput {
  stage_name: string
  stage_type: StageType
  stage_description?: string
  is_default: boolean
  stage_priority?: number
}

export function useJobStages() {
  const [stages, setStages] = useState<JobStage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const fetchStages = async () => {
    try {
      const { data, error } = await supabase
        .from('job_stages')
        .select('*')
        .eq('is_active', true)
        .order('stage_priority', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setStages(data || [])
    } catch (error) {
      console.error('Error fetching job stages:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch job stages',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createStage = async (input: CreateJobStageInput) => {
    setIsCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Get user's organization for workspace owners
      const { data: memberData } = await supabase
        .from('members')
        .select('organization_id, user_type')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single()

      const { data, error } = await supabase
        .from('job_stages')
        .insert({
          ...input,
          organization_id: memberData?.user_type === 'workspace_owner' ? memberData.organization_id : null,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error

      // Refetch stages to maintain proper sorting
      await fetchStages()
      toast({
        title: 'Success',
        description: 'Job stage created successfully'
      })
      
      return data
    } catch (error) {
      console.error('Error creating job stage:', error)
      toast({
        title: 'Error',
        description: 'Failed to create job stage',
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsCreating(false)
    }
  }

  const updateStage = async (id: string, updates: Partial<CreateJobStageInput>) => {
    setIsUpdating(true)
    try {
      const { data, error } = await supabase
        .from('job_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setStages(prev => prev.map(stage => 
        stage.id === id ? { ...stage, ...data } : stage
      ))
      
      toast({
        title: 'Success',
        description: 'Job stage updated successfully'
      })
      
      return data
    } catch (error) {
      console.error('Error updating job stage:', error)
      toast({
        title: 'Error',
        description: 'Failed to update job stage',
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteStage = async (id: string) => {
    setIsDeleting(true)
    try {
      console.log('[useJobStages.deleteStage] soft deleting stage via RPC:', id)
      const { error } = await supabase.rpc('soft_delete_job_stage', { stage_id_param: id })
      if (error) throw error

      // Optimistically remove from local list
      setStages(prev => prev.filter(stage => stage.id !== id))

      toast({
        title: 'Stage deleted',
        description: 'Candidates were reassigned to the previous stage or moved to Application Review.'
      })
    } catch (error: any) {
      console.error('Error deleting job stage via RPC:', error)
      const message = error?.message || 'Failed to delete job stage'
      toast({
        title: 'Error',
        description: message.includes('Only platform administrators')
          ? 'Only platform administrators can delete job stages.'
          : message,
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    fetchStages()
  }, [])

  return {
    stages,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    createStage,
    updateStage,
    deleteStage,
    refetch: fetchStages
  }
}
