import { useParams, useNavigate } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'
import { useCandidates } from '@/hooks/useCandidates'

export default function CandidateProfile() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const { candidates } = useCandidates(jobId || '')

  const idx = candidates.findIndex((c) => c.id === candidateId)
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < candidates.length - 1
  const total = candidates.length || null
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
            onNavigatePrev={() => hasPrev && go(candidates[idx - 1].id)}
            onNavigateNext={() => hasNext && go(candidates[idx + 1].id)}
            currentIndex={currentIndex}
            totalCount={total}
          />
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
