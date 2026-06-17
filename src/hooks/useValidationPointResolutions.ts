import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export type ValidationPointStatus = 'validated' | 'flagged' | 'added' | 'dismissed'

export interface ValidationPointResolution {
  id: string
  association_id: string
  point_index: number
  point_question: string
  status: ValidationPointStatus
  resolved_by: string
  resolved_at: string
  resolved_in_stage: string
  notes: string | null
  scorecard_id: string | null
  resolver_name?: string
}

function toMap(input: unknown): Map<number, ValidationPointResolution> {
  if (input instanceof Map) return input as Map<number, ValidationPointResolution>
  const map = new Map<number, ValidationPointResolution>()
  if (Array.isArray(input)) {
    for (const r of input as ValidationPointResolution[]) map.set(r.point_index, r)
  }
  return map
}

export function useValidationPointResolutions(associationId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const queryKey = ['validation-point-resolutions', associationId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Map<number, ValidationPointResolution>> => {
      if (!associationId) return new Map()

      const { data: resolutions, error } = await supabase
        .from('validation_point_resolutions')
        .select('*')
        .eq('association_id', associationId)

      if (error) throw error

      const resolverIds = [...new Set((resolutions || []).map(r => r.resolved_by))]
      let resolverNames: Record<string, string> = {}

      if (resolverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', resolverIds)

        if (profiles) {
          profiles.forEach(p => {
            resolverNames[p.user_id] =
              [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
          })
        }
      }

      const map = new Map<number, ValidationPointResolution>()
      for (const r of resolutions || []) {
        map.set(r.point_index, {
          ...(r as any),
          status: (r as any).status as ValidationPointStatus,
          resolver_name: resolverNames[(r as any).resolved_by] || 'Unknown',
        })
      }
      return map
    },
    enabled: !!associationId,
  })

  const writeResolution = async (
    pointIndex: number,
    pointQuestion: string,
    status: ValidationPointStatus,
    stageName: string,
    extra?: { notes?: string; scorecardId?: string }
  ) => {
    if (!associationId || !user?.id) return
    const { error } = await supabase
      .from('validation_point_resolutions')
      .upsert(
        {
          association_id: associationId,
          point_index: pointIndex,
          point_question: pointQuestion,
          status,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolved_in_stage: stageName,
          notes: extra?.notes ?? null,
          scorecard_id: extra?.scorecardId ?? null,
        },
        { onConflict: 'association_id,point_index' }
      )
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey })
  }

  // Legacy API (kept for the standalone Insights tab)
  const resolvePoint = async (
    pointIndex: number,
    pointQuestion: string,
    status: 'validated' | 'flagged',
    stageName: string,
    notes?: string,
    scorecardId?: string
  ) => writeResolution(pointIndex, pointQuestion, status, stageName, { notes, scorecardId })

  // New API for the Gio suggestion inbox
  const addPoint = (i: number, q: string, stage: string, scorecardId?: string) =>
    writeResolution(i, q, 'added', stage, { scorecardId })
  const dismissPoint = (i: number, q: string, stage: string, scorecardId?: string) =>
    writeResolution(i, q, 'dismissed', stage, { scorecardId })

  const clearResolution = async (pointIndex: number) => {
    if (!associationId) return
    const { error } = await supabase
      .from('validation_point_resolutions')
      .delete()
      .eq('association_id', associationId)
      .eq('point_index', pointIndex)
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey })
  }

  return {
    resolutions: toMap(data),
    isLoading,
    resolvePoint,
    addPoint,
    dismissPoint,
    clearResolution,
  }
}
