import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useJobs } from '@/hooks/useJobs'
import { useScheduledBookings } from '@/hooks/useScheduledBookings'
import { usePermissions } from '@/hooks/usePermissions'

export interface NeedsSchedulingItem {
  associationId: string
  candidateId: string
  candidateName: string
  candidateEmail: string
  candidatePhone?: string | null
  jobId: string
  jobTitle: string
  organizationId: string
  jhsId: string
  stageName: string
  enteredAt: string
  panelNames: string[]
  waitDays: number
}

/**
 * Candidates currently in an `interview` stage that have no upcoming
 * scheduled booking for that stage. Sorted longest-waiting first.
 */
export function useNeedsSchedulingQueue() {
  const { jobs, isLoading: jobsLoading } = useJobs()
  const permissions = usePermissions()
  const { bookings } = useScheduledBookings('upcoming', permissions) as any
  const jobIds = jobs?.map(j => j.id) ?? []

  return useQuery({
    queryKey: ['needs-scheduling-queue', jobIds, (bookings ?? []).map((b: any) => b.id)],
    enabled: !jobsLoading && jobIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<NeedsSchedulingItem[]> => {
      const chunkSize = 200
      const hiringStages: { id: string; job_id: string; stage_name: string }[] = []
      for (let i = 0; i < jobIds.length; i += chunkSize) {
        const chunk = jobIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('job_hiring_stages')
          .select('id, job_id, job_stages!job_hiring_stages_stage_id_fkey(stage_type, stage_name)')
          .in('job_id', chunk)
        if (error) continue
        const filtered = (data ?? []).filter(
          (r: any) => r.job_stages?.stage_type === 'interview',
        )
        hiringStages.push(
          ...filtered.map((r: any) => ({
            id: r.id,
            job_id: r.job_id,
            stage_name: r.job_stages?.stage_name ?? 'Interview',
          })),
        )
      }
      if (hiringStages.length === 0) return []

      const stageIds = hiringStages.map(s => s.id)
      const stageMeta = new Map(hiringStages.map(s => [s.id, s]))
      const jobMap = new Map(jobs?.map(j => [j.id, j]) ?? [])

      // Stage IDs already covered by an upcoming booking
      const bookedStageIds = new Set(
        (bookings ?? [])
          .map((b: any) => b.job_hiring_stage_id)
          .filter(Boolean),
      )

      const items: NeedsSchedulingItem[] = []
      for (let i = 0; i < stageIds.length; i += chunkSize) {
        const chunk = stageIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('job_candidate_associations')
          .select(`
            id,
            candidate_id,
            current_stage_id,
            entered_stage_at,
            created_at,
            candidates!inner(id, candidate_name, email, phone)
          `)
          .in('current_stage_id', chunk)
          .eq('status', 'active')
        if (error || !data) continue
        for (const row of data as any[]) {
          const meta = stageMeta.get(row.current_stage_id)
          if (!meta) continue
          // Skip if candidate already has a booking on this stage
          const candidateHasBooking = (bookings ?? []).some(
            (b: any) =>
              b.candidate_id === row.candidate_id &&
              b.job_hiring_stage_id === row.current_stage_id,
          )
          if (candidateHasBooking) continue

          const job = jobMap.get(meta.job_id)
          const enteredAt = row.entered_stage_at ?? row.created_at
          const waitDays = Math.max(
            0,
            Math.floor((Date.now() - new Date(enteredAt).getTime()) / 86400000),
          )
          items.push({
            associationId: row.id,
            candidateId: row.candidate_id,
            candidateName: row.candidates?.candidate_name ?? 'Unknown',
            candidateEmail: row.candidates?.email ?? '',
            candidatePhone: row.candidates?.phone ?? null,
            jobId: meta.job_id,
            jobTitle: job?.title ?? 'Unknown Job',
            organizationId: (job as any)?.organization_id ?? '',
            jhsId: row.current_stage_id,
            stageName: meta.stage_name,
            enteredAt,
            panelNames: [],
            waitDays,
          })
        }
      }
      // longest-waiting first
      return items.sort((a, b) => b.waitDays - a.waitDays)
    },
  })
}
