import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Skeleton } from '@/components/ui/skeleton'
import { ContextSnapshot, type ContextSnapshotData } from '@/components/chat/ContextSnapshot'
import { ContextStepper } from '@/components/chat/ContextStepper'
import { ContextQuickActions } from '@/components/chat/ContextQuickActions'

interface ContextPaneProps {
  threadId?: string
}

interface ThreadContext {
  snapshot: ContextSnapshotData
  currentStageId: string | null
  currentStageName: string | null
}

function useThreadContext(threadId: string | undefined) {
  const [data, setData] = useState<ThreadContext | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    if (!threadId) {
      setData(null)
      return
    }
    setLoading(true)

    ;(async () => {
      const { data: row } = await (supabase as any)
        .from('chat_threads')
        .select(
          `
          candidate_id, job_id, association_id,
          candidate:candidates(id, candidate_name, email, phone, role_current, company_current, location_city, location_country),
          job:jobs(id, title, employment_type, department),
          association:job_candidate_associations(
            current_stage_id,
            job_hiring_stages!job_candidate_associations_current_stage_id_fkey(
              custom_stage_name,
              job_stages!job_hiring_stages_stage_id_fkey(stage_name)
            )
          )
          `,
        )
        .eq('id', threadId)
        .maybeSingle()

      if (!alive) return
      if (!row) {
        setData(null)
        setLoading(false)
        return
      }
      const candidate = Array.isArray(row.candidate) ? row.candidate[0] : row.candidate
      const job = Array.isArray(row.job) ? row.job[0] : row.job
      const association = Array.isArray(row.association) ? row.association[0] : row.association
      const hs = association?.job_hiring_stages
      const currentStageName = hs?.custom_stage_name || hs?.job_stages?.stage_name || null

      setData({
        snapshot: {
          candidateId: candidate?.id ?? row.candidate_id,
          candidateName: candidate?.candidate_name ?? null,
          email: candidate?.email ?? null,
          phone: candidate?.phone ?? null,
          roleCurrent: candidate?.role_current ?? null,
          companyCurrent: candidate?.company_current ?? null,
          locationCity: candidate?.location_city ?? null,
          locationCountry: candidate?.location_country ?? null,
          jobId: job?.id ?? row.job_id,
          jobTitle: job?.title ?? null,
          jobDepartment: job?.department ?? null,
          jobEmploymentType: job?.employment_type ?? null,
        },
        currentStageId: association?.current_stage_id ?? null,
        currentStageName,
      })
      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [threadId])

  return { data, loading }
}

/**
 * ContextPane — right rail. 304px, warm canvas background, three stacked
 * blocks (Snapshot · Pipeline card · Quick actions).
 */
export function ContextPane({ threadId }: ContextPaneProps) {
  const { data, loading } = useThreadContext(threadId)

  return (
    <aside
      className="hidden xl:flex shrink-0 flex-col overflow-auto"
      style={{
        width: 304,
        borderLeft: '1px solid #E7E8EE',
        background: '#F6F5F1',
        padding: 18,
        gap: 14,
      }}
      aria-label="Candidate context"
    >
      {(!threadId || (loading && !data)) && (
        <div className="flex flex-col items-center" style={{ gap: 10, paddingTop: 4 }}>
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {threadId && data && (
        <>
          <ContextSnapshot data={data.snapshot} />
          <ContextStepper
            jobId={data.snapshot.jobId}
            currentStageId={data.currentStageId}
            currentStageName={data.currentStageName}
            jobTitle={data.snapshot.jobTitle}
            jobDepartment={data.snapshot.jobDepartment}
            jobEmploymentType={data.snapshot.jobEmploymentType}
          />
          <ContextQuickActions
            jobId={data.snapshot.jobId}
            candidateId={data.snapshot.candidateId}
          />
        </>
      )}
    </aside>
  )
}
