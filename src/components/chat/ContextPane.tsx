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
      const sb = supabase as any
      const { data: row, error: threadErr } = await sb
        .from('chat_threads')
        .select('candidate_id, job_id, association_id')
        .eq('id', threadId)
        .maybeSingle()

      if (!alive) return
      if (threadErr || !row) {
        if (threadErr) console.error('[ContextPane] thread fetch failed', threadErr)
        setData(null)
        setLoading(false)
        return
      }

      const [candidateRes, jobRes, assocRes] = await Promise.all([
        row.candidate_id
          ? sb
              .from('candidates')
              .select(
                'id, candidate_name, email, phone, role_current, company_current, location_city, location_country',
              )
              .eq('id', row.candidate_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        row.job_id
          ? sb
              .from('jobs')
              .select('id, title, employment_type, department')
              .eq('id', row.job_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        row.association_id
          ? sb
              .from('job_candidate_associations')
              .select('current_stage_id')
              .eq('id', row.association_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (!alive) return

      const candidate = candidateRes?.data ?? null
      const job = jobRes?.data ?? null
      const association = assocRes?.data ?? null

      let currentStageName: string | null = null
      if (association?.current_stage_id) {
        const { data: hs } = await sb
          .from('job_hiring_stages')
          .select('custom_stage_name, stage_id, job_stages:job_stages(stage_name)')
          .eq('id', association.current_stage_id)
          .maybeSingle()
        const js = Array.isArray(hs?.job_stages) ? hs?.job_stages[0] : hs?.job_stages
        currentStageName = hs?.custom_stage_name || js?.stage_name || null
      }

      if (!alive) return
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
      className="hidden lg:flex shrink-0 flex-col overflow-auto"
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
