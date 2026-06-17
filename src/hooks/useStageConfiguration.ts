import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import type { JobStage } from '@/hooks/useJobStages'

export type InterviewDurationMinutes = 15 | 30 | 45 | 60 | 90
export type InterviewFormat = 'video' | 'phone' | 'onsite'

export interface StageConfiguration {
  jhsId: string // job_hiring_stages.id
  stageId: string // job_stages.id
  customStageName: string | null
  stageName: string // Default name
  stageType: string
  stageDescription: string | null
  position: number
  // Additional settings
  interviewDurationMinutes: InterviewDurationMinutes | null
  interviewFormat: InterviewFormat | null
  slaEnabled: boolean
  slaDays: number | null
  stageInstructions: string | null
  updatedAt: string | null
}

export interface AdditionalSettingsPayload {
  interviewDurationMinutes: InterviewDurationMinutes | null
  interviewFormat: InterviewFormat | null
  slaEnabled: boolean
  slaDays: number | null
  stageInstructions: string | null
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
          interview_duration_minutes,
          interview_format,
          sla_enabled,
          sla_days,
          stage_instructions,
          updated_at,
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

      const row: any = data
      return {
        jhsId: row.id,
        stageId: row.job_stages.id,
        customStageName: row.custom_stage_name,
        stageName: row.job_stages.stage_name,
        stageType: row.job_stages.stage_type,
        stageDescription: row.job_stages.stage_description,
        position: row.position,
        interviewDurationMinutes: row.interview_duration_minutes ?? null,
        interviewFormat: row.interview_format ?? null,
        slaEnabled: !!row.sla_enabled,
        slaDays: row.sla_days ?? null,
        stageInstructions: row.stage_instructions ?? null,
        updatedAt: row.updated_at ?? null,
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
        .update({ custom_stage_name: customName?.trim() || null })
        .eq('id', jhsId)
      if (error) throw error
    },
    onSuccess: (_, { jhsId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-hiring-plan'] })
      queryClient.invalidateQueries({ queryKey: ['stage-config', jhsId] })
      queryClient.invalidateQueries({ queryKey: ['stage-interview-defaults', jhsId] })
      toast({ title: 'Stage Updated', description: 'Configuration saved successfully' })
    },
    onError: (error) => {
      console.error('Error updating stage configuration:', error)
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' })
    },
  })

  // Update additional settings (auto-saved, silent)
  const updateAdditionalSettings = useMutation({
    mutationFn: async ({ jhsId, payload }: { jhsId: string; payload: AdditionalSettingsPayload }) => {
      const { error } = await supabase
        .from('job_hiring_stages')
        .update({
          interview_duration_minutes: payload.interviewDurationMinutes,
          interview_format: payload.interviewFormat,
          sla_enabled: payload.slaEnabled,
          sla_days: payload.slaEnabled ? payload.slaDays : null,
          stage_instructions: payload.stageInstructions?.trim() || null,
        })
        .eq('id', jhsId)
      if (error) throw error
    },
    onSuccess: (_, { jhsId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-hiring-plan'] })
      queryClient.invalidateQueries({ queryKey: ['stage-config', jhsId] })
      queryClient.invalidateQueries({ queryKey: ['stage-interview-defaults', jhsId] })
      queryClient.invalidateQueries({ queryKey: ['stage-instructions', jhsId] })
      queryClient.invalidateQueries({ queryKey: ['stale-candidates'] })
    },
    onError: (error) => {
      console.error('Error saving additional settings:', error)
      toast({ title: 'Error', description: 'Failed to auto-save settings', variant: 'destructive' })
    },
  })

  return {
    isLoading,
    loadStageConfig,
    updateCustomStageName,
    updateAdditionalSettings,
  }
}
