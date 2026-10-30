import { useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'
import { supabase } from '@/lib/supabaseClient'
import {
  neighbours,
  pipelineSectionOf,
  readCandidateNavOrder,
  saveCandidateNavOrder,
  sectionOrder,
  type NavAssoc,
  type PipelineSection,
} from '@/lib/candidateNavOrder'

export default function CandidateProfile() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // The list this profile was opened from (or is being walked with ‹ ›), when it came from one.
  const navSection = (location.state as { navSection?: PipelineSection } | null)?.navSection ?? null

  // The job's stages and applications, to rebuild the candidate's own list when no list was saved.
  const { data: stages = [] } = useQuery({
    queryKey: ['job-hiring-stage-types', jobId],
    enabled: !!jobId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('id, position, stage:job_stages(stage_type)')
        .eq('job_id', jobId!)
      if (error) throw error
      type Row = { id: string; position: number | null; stage: { stage_type: string | null } | null }
      return ((data || []) as unknown as Row[]).map((r) => ({
        id: r.id,
        position: r.position ?? 0,
        type: r.stage?.stage_type ?? undefined,
      }))
    },
  })
  const { data: assocs = [] } = useQuery({
    queryKey: ['job-nav-associations', jobId],
    enabled: !!jobId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id, status, current_stage_id, created_at, ai_fit_score, rejected_at, updated_at')
        .eq('job_id', jobId!)
      if (error) throw error
      return (data || []) as NavAssoc[]
    },
  })

  // The saved list, read on each visit; nothing rewrites it while you walk, so a rejection
  // mid-browse doesn't move where Next lands.
  const saved = readCandidateNavOrder(jobId || '')

  const { orderedIds, section, fromSaved } = useMemo(() => {
    // Opened from a list (or walking it): that list, exactly as it was shown.
    if (saved && navSection && saved.section === navSection && candidateId && saved.order.includes(candidateId)) {
      return { orderedIds: saved.order, section: navSection, fromSaved: true }
    }
    // A link from the bell, Slack or anywhere else: the candidate's own list.
    const byId = new Map(stages.map((s) => [s.id, s]))
    const stageType = (jhsId: string) => byId.get(jhsId)?.type
    const mine = assocs.find((a) => a.candidate_id === candidateId)
    const own = mine ? pipelineSectionOf(mine, stageType) : null
    if (!own) return { orderedIds: candidateId ? [candidateId] : [], section: null, fromSaved: false }
    const ids = sectionOrder(assocs, own, stageType, (jhsId) => byId.get(jhsId)?.position ?? Number.MAX_SAFE_INTEGER)
    return { orderedIds: ids, section: own, fromSaved: false }
  }, [saved, navSection, candidateId, stages, assocs])

  const { index, prev, next } = neighbours(orderedIds, candidateId)

  // ‹ › carry the list along, so the next profile walks the same one. A list rebuilt for a
  // link is saved on the first step, so it stays put from then on too.
  const go = (id: string) => {
    if (!section) return navigate(`/jobs/${jobId}/candidates/${id}`)
    if (!fromSaved && jobId) saveCandidateNavOrder(jobId, section, orderedIds)
    navigate(`/jobs/${jobId}/candidates/${id}`, { state: { navSection: section } })
  }

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
            hasPrev={!!prev}
            hasNext={!!next}
            onNavigatePrev={() => prev && go(prev)}
            onNavigateNext={() => next && go(next)}
            currentIndex={index >= 0 ? index + 1 : null}
            totalCount={orderedIds.length || null}
          />
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
