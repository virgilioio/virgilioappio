import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'

import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'

import { AddToPipelineGroup } from '@/components/candidates/suggested/AddToPipelineGroup'
import { SuggestedProfileView, type SuggestedProfileTab } from '@/components/candidates/suggested/SuggestedProfileView'
import { useJobSuggestedCandidates } from '@/hooks/useJobSuggestedCandidates'
import { suggestedReasons, suggestedScore, suggestedCandidateId } from '@/components/jobs/suggested/suggestedFilters'
import { dismissSuggestions, restoreSuggestions } from '@/components/jobs/suggested/suggestedDismissed'
import { toast } from '@/hooks/use-toast'
import { undoToast } from '@/lib/undoToast'

const ordinal = (n: number) => {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/**
 * The profile of somebody Gio matched against this job who has not applied.
 * The page itself is `SuggestedProfileView`, shared with Find; this route adds
 * the job's suggestion list (score, reasons, order) and its decision.
 */
function SuggestedCandidateProfileInner() {
  const queryClient = useQueryClient()
  const { jobId = '', candidateId = '' } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: SuggestedProfileTab = searchParams.get('tab') === 'resume' ? 'resume' : 'fit'
  const setTab = (tab: SuggestedProfileTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  // The same query the view runs, read here for the job's skills.
  const { data: job } = useQuery({
    queryKey: ['suggested-profile-job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, description, skills, skill_priorities, must_have_skills, location, department, status, organization:organizations(name)')
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any
    },
  })

  // The suggestion list gives the match score, the reasons and the list order.
  const { candidates: suggestions } = useJobSuggestedCandidates({
    jobId,
    jobSkills: job?.skills || null,
    limit: 50,
  })
  const ordered = useMemo(
    () => suggestions.slice().sort((a, b) => (suggestedScore(b) ?? 0) - (suggestedScore(a) ?? 0)),
    [suggestions],
  )
  const index = ordered.findIndex((c) => suggestedCandidateId(c) === candidateId)
  const suggestion = index >= 0 ? ordered[index] : null
  const matchScore = suggestion ? suggestedScore(suggestion) : null
  const reasons = useMemo(
    () => (suggestion ? suggestedReasons(suggestion, job?.skills || null) : []),
    [suggestion, job],
  )

  const goBack = () => navigate(`/jobs/${jobId}?tab=pipeline&section=suggested`)
  const goToSuggestion = (offset: number) => {
    const next = ordered[index + offset]
    const id = next ? suggestedCandidateId(next) : null
    if (id) navigate(`/jobs/${jobId}/suggested/${id}?tab=${activeTab}`)
  }

  // C27 (Block B §16, Undo; mirrors J27): Not a fit is saved for the whole team
  // and offers Undo, which makes the candidate suggestible for this job again.
  const name = (suggestion as { candidate_name?: string } | null)?.candidate_name || 'Candidate'
  const handleDismiss = async () => {
    const job = jobId
    const cand = candidateId
    try {
      await dismissSuggestions(job, [cand], queryClient)
    } catch {
      toast({ title: `Couldn\u2019t dismiss ${name}. Nothing changed; try again.`, variant: 'destructive' })
      return
    }
    undoToast(`${name} dismissed`, async () => {
      try {
        await restoreSuggestions(job, [cand], queryClient)
      } catch {
        toast({ title: `Couldn\u2019t bring back ${name}. Try again.`, variant: 'destructive' })
      }
    }, 'They won\u2019t be suggested for this job again, for anyone on the team.')
    goBack()
  }

  return (
    <SuggestedProfileView
      candidateId={candidateId}
      jobId={jobId}
      activeTab={activeTab}
      onTabChange={setTab}
      match={{
        score: matchScore,
        reasons,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rationale: (suggestion as any)?.ai_fit_rationale || null,
      }}
      identityBadges={({ addedStage }) => (
        <>
          <Badge tone="lilac" size="sm" icon={Sparkles}>Suggested by Gio</Badge>
          {addedStage ? (
            <Badge tone="green" size="sm" dot>{addedStage}</Badge>
          ) : index >= 0 ? (
            <Badge tone="neutral" size="sm">Ranks {ordinal(index + 1)} of {ordered.length}</Badge>
          ) : null}
        </>
      )}
      backLabel="Back to suggestions"
      breadcrumbLast="Suggested"
      hasPrev={index > 0}
      hasNext={index >= 0 && index < ordered.length - 1}
      onNavigatePrev={() => goToSuggestion(-1)}
      onNavigateNext={() => goToSuggestion(1)}
      prevLabel="Previous suggestion"
      nextLabel="Next suggestion"
      onClose={goBack}
      onDismiss={handleDismiss}
      renderDecision={(size, state) => (
        <AddToPipelineGroup
          jobId={jobId}
          candidateId={candidateId}
          addedStage={state.addedStage}
          size={size}
          previouslyRejected={state.wasRejectedHere}
          onAdded={(stage) => state.setAddedStage(stage)}
          onUndo={() => { state.setAddedStage(null); state.refetchAssociation() }}
          onDismiss={handleDismiss}
          onOpenInPipeline={() => navigate(`/jobs/${jobId}/candidates/${candidateId}`)}
          onAddToOtherJob={state.openTransfer}
        />
      )}
    />
  )
}

export default function SuggestedCandidateProfile() {
  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <JobAssignmentGuard>
          <SuggestedCandidateProfileInner />
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
