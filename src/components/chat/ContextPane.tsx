import { useEffect, useState } from 'react'
import { User2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { EmptyState } from '@/components/ui/empty-state'
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

    supabase
      .from('chat_threads')
      .select(
        `
        candidate_id,
        job_id,
        association_id,
        candidate:candidates(id, candidate_name, email, phone, role_current, company_current, location_city, location_country),
        job:jobs(id, title),
        association:job_candidate_associations(current_stage_id)
        `,
      )
      .eq('id', threadId)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!alive) return
        if (!row) {
          setData(null)
          setLoading(false)
          return
        }
        const candidate = Array.isArray((row as any).candidate)
          ? (row as any).candidate[0]
          : (row as any).candidate
        const job = Array.isArray((row as any).job) ? (row as any).job[0] : (row as any).job
        const association = Array.isArray((row as any).association)
          ? (row as any).association[0]
          : (row as any).association

        setData({
          snapshot: {
            candidateId: candidate?.id ?? (row as any).candidate_id,
            candidateName: candidate?.candidate_name ?? null,
            email: candidate?.email ?? null,
            phone: candidate?.phone ?? null,
            roleCurrent: candidate?.role_current ?? null,
            companyCurrent: candidate?.company_current ?? null,
            locationCity: candidate?.location_city ?? null,
            locationCountry: candidate?.location_country ?? null,
            jobId: job?.id ?? (row as any).job_id,
            jobTitle: job?.title ?? null,
          },
          currentStageId: association?.current_stage_id ?? null,
        })
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [threadId])

  return { data, loading }
}

/**
 * ContextPane — Snapshot · Pipeline stepper · Quick actions (Step 1.8).
 */
export function ContextPane({ threadId }: ContextPaneProps) {
  const { data, loading } = useThreadContext(threadId)

  return (
    <aside
      className="hidden xl:flex w-[304px] shrink-0 flex-col border-l border-virgilio-border bg-surface-primary"
      aria-label="Candidate context"
    >
      <header className="flex items-center h-14 px-4 border-b border-virgilio-border">
        <h3 className="font-poppins font-semibold text-[13px] tracking-[-0.02em] text-virgilio-text">
          Context<span className="text-[#d7c5fb]">.</span>
        </h3>
      </header>

      <div className="flex-1 overflow-auto">
        {!threadId && (
          <div className="p-4">
            <EmptyState
              variant="inline"
              size="sm"
              mascot={false}
              icon={User2}
              title="No candidate selected"
              description="Snapshot and pipeline appear once a thread is open."
            />
          </div>
        )}

        {threadId && loading && !data && (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        )}

        {threadId && data && (
          <div className="divide-y divide-virgilio-border">
            <ContextSnapshot data={data.snapshot} />
            <ContextStepper
              jobId={data.snapshot.jobId}
              currentStageId={data.currentStageId}
            />
            <ContextQuickActions
              jobId={data.snapshot.jobId}
              candidateId={data.snapshot.candidateId}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
