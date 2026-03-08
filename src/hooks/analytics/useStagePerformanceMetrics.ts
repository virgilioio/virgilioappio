import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface StageTimeData {
  stageName: string
  avgDays: number
  candidateCount: number
}

export interface StuckCandidate {
  associationId: string
  candidateId: string
  candidateName: string
  jobTitle: string
  jobId: string
  stageName: string
  daysInStage: number
}

export interface StagePerformanceData {
  avgTimePerStage: StageTimeData[]
  stuckCandidates: StuckCandidate[]
  stageEntryVolume: { stageName: string; count: number }[]
  isLoading: boolean
  error: Error | null
}

const STUCK_THRESHOLD_DAYS = 14

export function useStagePerformanceMetrics(
  finalJobIds: string[],
  dateRange: DateRange,
  enabled: boolean
): StagePerformanceData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-stage-performance', finalJobIds.join(','), dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (finalJobIds.length === 0) return { avgTimePerStage: [], stuckCandidates: [], stageEntryVolume: [] }

      // Get associations for these jobs
      const { data: associations, error: aErr } = await supabase
        .from('job_candidate_associations')
        .select('id, status, entered_stage_at, current_stage_id, candidate_id, job_id')
        .in('job_id', finalJobIds)
      if (aErr) throw aErr

      const assocIds = (associations || []).map(a => a.id)
      if (assocIds.length === 0) return { avgTimePerStage: [], stuckCandidates: [], stageEntryVolume: [] }

      // Get stage history
      const { data: history, error: hErr } = await supabase
        .from('job_candidate_stage_history')
        .select('id, association_id, from_stage_id, to_stage_id, moved_at')
        .in('association_id', assocIds)
        .order('moved_at', { ascending: true })
      if (hErr) throw hErr

      // Get hiring stages for these jobs
      const { data: jhStages, error: sErr } = await supabase
        .from('job_hiring_stages')
        .select('id, job_id, position, custom_stage_name, job_stages!inner(stage_name)')
        .in('job_id', finalJobIds)
        .order('position', { ascending: true })
      if (sErr) throw sErr

      // Build stage ID → name map
      const stageIdToInfo: Record<string, { name: string; position: number }> = {}
      ;(jhStages || []).forEach(s => {
        const si = s as any
        const name = si.custom_stage_name || si.job_stages?.stage_name || 'Unknown'
        stageIdToInfo[s.id] = { name, position: s.position }
      })

      // === Avg Time per Stage ===
      const historyByAssoc: Record<string, typeof history> = {}
      ;(history || []).forEach(h => {
        if (!historyByAssoc[h.association_id]) historyByAssoc[h.association_id] = []
        historyByAssoc[h.association_id]!.push(h)
      })

      const timePerStage: Record<string, number[]> = {}
      Object.values(historyByAssoc).forEach(hist => {
        const sorted = [...(hist || [])].sort((a, b) => new Date(a.moved_at).getTime() - new Date(b.moved_at).getTime())
        for (let i = 0; i < sorted.length; i++) {
          const cur = sorted[i]
          if (!cur.to_stage_id || !stageIdToInfo[cur.to_stage_id]) continue
          const stageName = stageIdToInfo[cur.to_stage_id].name
          const enteredAt = new Date(cur.moved_at)
          const nextMove = sorted[i + 1]
          if (nextMove) {
            const daysIn = (new Date(nextMove.moved_at).getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)
            if (!timePerStage[stageName]) timePerStage[stageName] = []
            timePerStage[stageName].push(daysIn)
          }
        }
      })

      const avgTimePerStage: StageTimeData[] = Object.entries(timePerStage)
        .map(([stageName, times]) => ({
          stageName,
          avgDays: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10,
          candidateCount: times.length,
        }))
        .filter(s => s.avgDays > 0)
        .sort((a, b) => {
          const aPos = Object.values(stageIdToInfo).find(s => s.name === a.stageName)?.position ?? 999
          const bPos = Object.values(stageIdToInfo).find(s => s.name === b.stageName)?.position ?? 999
          return aPos - bPos
        })

      // === Stuck Candidates ===
      const now = new Date()
      const stuckThreshold = now.getTime() - STUCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
      const stuckAssociations = (associations || []).filter(a => {
        if (a.status !== 'active') return false
        if (!a.entered_stage_at) return false
        return new Date(a.entered_stage_at).getTime() < stuckThreshold
      })

      let stuckCandidates: StuckCandidate[] = []
      if (stuckAssociations.length > 0) {
        const candidateIds = [...new Set(stuckAssociations.map(a => a.candidate_id))]
        const jobIdsForStuck = [...new Set(stuckAssociations.map(a => a.job_id))]

        const [candidatesRes, jobsRes] = await Promise.all([
          supabase.from('candidates').select('id, candidate_name').in('id', candidateIds),
          supabase.from('jobs').select('id, title').in('id', jobIdsForStuck),
        ])

        const candMap = new Map((candidatesRes.data || []).map(c => [c.id, c.candidate_name]))
        const jobMap = new Map((jobsRes.data || []).map(j => [j.id, j.title]))

        stuckCandidates = stuckAssociations.map(a => {
          const daysIn = Math.round((now.getTime() - new Date(a.entered_stage_at!).getTime()) / (1000 * 60 * 60 * 24))
          const stageName = a.current_stage_id && stageIdToInfo[a.current_stage_id]
            ? stageIdToInfo[a.current_stage_id].name
            : 'Unknown'
          return {
            associationId: a.id,
            candidateId: a.candidate_id,
            candidateName: candMap.get(a.candidate_id) || 'Unknown',
            jobTitle: jobMap.get(a.job_id) || 'Unknown',
            jobId: a.job_id,
            stageName,
            daysInStage: daysIn,
          }
        }).sort((a, b) => b.daysInStage - a.daysInStage)
        .slice(0, 20) // Top 20
      }

      // === Stage Entry Volume (in date range) ===
      const startISO = dateRange.startDate.toISOString()
      const endISO = dateRange.endDate.toISOString()
      const entriesInRange = (history || []).filter(h => {
        if (!h.to_stage_id) return false
        const movedAt = h.moved_at
        return movedAt >= startISO && movedAt <= endISO
      })
      const entryCountMap: Record<string, number> = {}
      entriesInRange.forEach(h => {
        const name = stageIdToInfo[h.to_stage_id!]?.name || 'Unknown'
        entryCountMap[name] = (entryCountMap[name] || 0) + 1
      })
      const stageEntryVolume = Object.entries(entryCountMap)
        .map(([stageName, count]) => ({ stageName, count }))
        .sort((a, b) => b.count - a.count)

      return { avgTimePerStage, stuckCandidates, stageEntryVolume }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  return {
    avgTimePerStage: data?.avgTimePerStage ?? [],
    stuckCandidates: data?.stuckCandidates ?? [],
    stageEntryVolume: data?.stageEntryVolume ?? [],
    isLoading,
    error: error as Error | null,
  }
}
