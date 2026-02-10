import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface ValidationPointResolution {
  id: string
  association_id: string
  point_index: number
  point_question: string
  status: 'validated' | 'flagged'
  resolved_by: string
  resolved_at: string
  resolved_in_stage: string
  notes: string | null
  scorecard_id: string | null
  resolver_name?: string
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

      // Fetch resolver names
      const resolverIds = [...new Set((resolutions || []).map(r => r.resolved_by))]
      let resolverNames: Record<string, string> = {}

      if (resolverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', resolverIds)

        if (profiles) {
          profiles.forEach(p => {
            resolverNames[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
          })
        }
      }

      const map = new Map<number, ValidationPointResolution>()
      for (const r of resolutions || []) {
        map.set(r.point_index, {
          ...r,
          status: r.status as 'validated' | 'flagged',
          resolver_name: resolverNames[r.resolved_by] || 'Unknown',
        })
      }
      return map
    },
    enabled: !!associationId,
  })

  const resolvePoint = async (
    pointIndex: number,
    pointQuestion: string,
    status: 'validated' | 'flagged',
    stageName: string,
    notes?: string,
    scorecardId?: string
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
          notes: notes || null,
          scorecard_id: scorecardId || null,
        },
        { onConflict: 'association_id,point_index' }
      )

    if (error) throw error
    await queryClient.invalidateQueries({ queryKey })
  }

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
    resolutions: data ?? new Map<number, ValidationPointResolution>(),
    isLoading,
    resolvePoint,
    clearResolution,
  }
}
