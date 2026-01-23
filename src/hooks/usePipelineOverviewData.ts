import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { usePipelineJobMetrics, PipelineJobMetric } from './usePipelineJobMetrics'

export interface StageColumn {
  stageName: string
  averagePosition: number
}

export interface PipelineOverviewRow {
  jobId: string
  jobTitle: string
  jobStatus: string
  applicationReview: number
  stageCounts: Record<string, number>
  offer: number
  hired: number
}

export interface PipelineOverviewData {
  stageColumns: StageColumn[]
  rows: PipelineOverviewRow[]
  totals: {
    applicationReview: number
    stageCounts: Record<string, number>
    offer: number
    hired: number
  }
  isLoading: boolean
  error: Error | null
}

export function usePipelineOverviewData(jobIds: string[]): PipelineOverviewData {
  // Fetch pipeline metrics using existing hook
  const { data: pipelineMetrics, isLoading: metricsLoading, error: metricsError } = usePipelineJobMetrics(jobIds)

  // Fetch job titles and additional counts
  const { data: jobData, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['pipeline-overview-jobs', jobIds],
    queryFn: async () => {
      if (!jobIds || jobIds.length === 0) return { jobs: [], reviewCounts: {}, offerCounts: {}, hiredCounts: {} }

      // Fetch job titles
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, status')
        .in('id', jobIds)

      if (jobsError) throw jobsError

      // Fetch Application Review counts (candidates with no stage assigned but status = 'active')
      const { data: reviewData, error: reviewError } = await supabase
        .from('job_candidate_associations')
        .select('job_id')
        .in('job_id', jobIds)
        .eq('status', 'active')
        .is('current_stage_id', null)

      if (reviewError) throw reviewError

      // Count per job
      const reviewCounts: Record<string, number> = {}
      reviewData?.forEach(r => {
        reviewCounts[r.job_id] = (reviewCounts[r.job_id] || 0) + 1
      })

      // Fetch Offer counts
      const { data: offerData, error: offerError } = await supabase
        .from('job_candidate_associations')
        .select('job_id')
        .in('job_id', jobIds)
        .eq('status', 'offer')

      if (offerError) throw offerError

      const offerCounts: Record<string, number> = {}
      offerData?.forEach(o => {
        offerCounts[o.job_id] = (offerCounts[o.job_id] || 0) + 1
      })

      // Fetch Hired counts
      const { data: hiredData, error: hiredError } = await supabase
        .from('job_candidate_associations')
        .select('job_id')
        .in('job_id', jobIds)
        .eq('status', 'hired')

      if (hiredError) throw hiredError

      const hiredCounts: Record<string, number> = {}
      hiredData?.forEach(h => {
        hiredCounts[h.job_id] = (hiredCounts[h.job_id] || 0) + 1
      })

      return { jobs, reviewCounts, offerCounts, hiredCounts }
    },
    enabled: jobIds && jobIds.length > 0,
    staleTime: 30000
  })

  // Process data when both queries complete
  const isLoading = metricsLoading || jobsLoading
  const error = metricsError || jobsError

  if (isLoading || error || !pipelineMetrics || !jobData) {
    return {
      stageColumns: [],
      rows: [],
      totals: { applicationReview: 0, stageCounts: {}, offer: 0, hired: 0 },
      isLoading,
      error: error as Error | null
    }
  }

  const { jobs, reviewCounts, offerCounts, hiredCounts } = jobData

  // Build unique stage columns from all jobs, ordered by average position
  const stagePositions: Record<string, { totalPosition: number; count: number }> = {}
  
  pipelineMetrics.forEach((metric: PipelineJobMetric) => {
    metric.stages?.forEach(stage => {
      if (!stagePositions[stage.stage_name]) {
        stagePositions[stage.stage_name] = { totalPosition: 0, count: 0 }
      }
      stagePositions[stage.stage_name].totalPosition += stage.position
      stagePositions[stage.stage_name].count += 1
    })
  })

  const stageColumns: StageColumn[] = Object.entries(stagePositions)
    .map(([stageName, { totalPosition, count }]) => ({
      stageName,
      averagePosition: totalPosition / count
    }))
    .sort((a, b) => a.averagePosition - b.averagePosition)

  // Build rows
  const metricsMap = new Map(pipelineMetrics.map((m: PipelineJobMetric) => [m.job_id, m]))
  
  const rows: PipelineOverviewRow[] = jobs?.map(job => {
    const metric = metricsMap.get(job.id)
    const stageCounts: Record<string, number> = {}
    
    metric?.stages?.forEach(stage => {
      stageCounts[stage.stage_name] = stage.count_in_stage
    })

    return {
      jobId: job.id,
      jobTitle: job.title,
      jobStatus: job.status,
      applicationReview: reviewCounts[job.id] || 0,
      stageCounts,
      offer: offerCounts[job.id] || 0,
      hired: hiredCounts[job.id] || 0
    }
  }) || []

  // Sort rows by job title
  rows.sort((a, b) => a.jobTitle.localeCompare(b.jobTitle))

  // Calculate totals
  const totals = {
    applicationReview: rows.reduce((sum, r) => sum + r.applicationReview, 0),
    stageCounts: {} as Record<string, number>,
    offer: rows.reduce((sum, r) => sum + r.offer, 0),
    hired: rows.reduce((sum, r) => sum + r.hired, 0)
  }

  stageColumns.forEach(col => {
    totals.stageCounts[col.stageName] = rows.reduce((sum, r) => sum + (r.stageCounts[col.stageName] || 0), 0)
  })

  return {
    stageColumns,
    rows,
    totals,
    isLoading,
    error: error as Error | null
  }
}
