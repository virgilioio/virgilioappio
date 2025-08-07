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
      const { data, error } = await supabase
        .from('job_stages')
        .insert({
          ...input,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error

      setStages(prev => [...prev, data])
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
      const { error } = await supabase
        .from('job_stages')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error

      setStages(prev => prev.filter(stage => stage.id !== id))
      toast({
        title: 'Success',
        description: 'Job stage deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting job stage:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete job stage',
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