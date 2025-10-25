import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import type { JobStage } from '@/hooks/useJobStages'

export interface StageConfiguration {
  jhsId: string // job_hiring_stages.id
  stageId: string // job_stages.id
  customStageName: string | null
  stageName: string // Default name
  stageType: string
  stageDescription: string | null
  position: number
}

export function useStageConfiguration() {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  
  // Load config for specific stage instance
  const loadStageConfig = async (jhsId: string): Promise<StageConfiguration> => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select(`
          id,
          position,
          custom_stage_name,
          job_stages!inner(
            id,
            stage_name,
            stage_type,
            stage_description
          )
        `)
        .eq('id', jhsId)
        .single()
      
      if (error) throw error
      
      return {
        jhsId: data.id,
        stageId: (data.job_stages as any).id,
        customStageName: data.custom_stage_name,
        stageName: (data.job_stages as any).stage_name,
        stageType: (data.job_stages as any).stage_type,
        stageDescription: (data.job_stages as any).stage_description,
        position: data.position
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  // Update custom stage name
  const updateCustomStageName = useMutation({
    mutationFn: async ({ jhsId, customName }: { jhsId: string; customName: string | null }) => {
      const { error } = await supabase
        .from('job_hiring_stages')
        .update({ 
          custom_stage_name: customName?.trim() || null
        })
        .eq('id', jhsId)
      if (error) throw error
    },
    onSuccess: (_, { jhsId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-hiring-plan'] })
      queryClient.invalidateQueries({ queryKey: ['stage-config', jhsId] })
      toast({ title: 'Stage Updated', description: 'Configuration saved successfully' })
    },
    onError: (error) => {
      console.error('Error updating stage configuration:', error)
      toast({ 
        title: 'Error', 
        description: 'Failed to save configuration', 
        variant: 'destructive' 
      })
    }
  })
  
  return { 
    isLoading,
    loadStageConfig, 
    updateCustomStageName 
  }
}
