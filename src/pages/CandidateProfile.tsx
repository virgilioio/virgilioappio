import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'
import { useCandidates } from '@/hooks/useCandidates'
import { supabase } from '@/lib/supabaseClient'
import { readCandidateNavOrder, buildStageOrderedIds } from '@/lib/candidateNavOrder'

export default function CandidateProfile() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const { candidates } = useCandidates(jobId || '')

  // Stage order for the fallback ordering (no board snapshot available)
  const { data: stageOrder = [] } = useQuery({
    queryKey: ['job-hiring-stage-order', jobId],
    enabled: !!jobId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('id, position')
        .eq('job_id', jobId!)
        .order('position', { ascending: true })
      if (error) throw error
      return (data || []).map((r: any) => r.id as string)
    },
  })

  // Frozen board order, read once per mount so a rejection mid-browse does not
  // reshuffle where "Next" lands.
  const snapshot = useMemo(() => readCandidateNavOrder(jobId || ''), [jobId])

  const orderedIds = useMemo(() => {
    const knownIds = new Set(candidates.map((c) => c.id))
    if (snapshot && snapshot.length > 0) {
      const fromSnapshot = snapshot.filter((id) => knownIds.has(id))
      // Safety: if the snapshot barely matches the loaded candidates, ignore it
      if (fromSnapshot.length >= Math.max(1, Math.floor(snapshot.length * 0.5))) {
        // Keep the current candidate reachable even if it wasn't in the snapshot
        if (candidateId && knownIds.has(candidateId) && !fromSnapshot.includes(candidateId)) {
          return [...fromSnapshot, candidateId]
        }
        return fromSnapshot
      }
    }
    return buildStageOrderedIds(candidates, stageOrder)
  }, [snapshot, candidates, stageOrder, candidateId])

  const idx = orderedIds.findIndex((id) => id === candidateId)
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < orderedIds.length - 1
  const total = orderedIds.length || null
  const currentIndex = idx >= 0 ? idx + 1 : null

  const go = (id: string) => navigate(`/jobs/${jobId}/candidates/${id}`)

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <JobAssignmentGuard>
          <CandidateProfileSheet
            asPage
            open
            onOpenChange={(o) => { if (!o) navigate(`/jobs/${jobId}`) }}
            jobId={jobId || ''}
            candidateId={candidateId || null}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onNavigatePrev={() => hasPrev && go(orderedIds[idx - 1])}
            onNavigateNext={() => hasNext && go(orderedIds[idx + 1])}
            currentIndex={currentIndex}
            totalCount={total}
          />
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
