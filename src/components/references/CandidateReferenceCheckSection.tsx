import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ReferenceCheckCard } from '@/components/references/ReferenceCheckCard'
import { LogPhoneReferenceDialog } from '@/components/references/LogPhoneReferenceDialog'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useJobClient } from '@/hooks/useJobClient'
import {
  useCancelReferenceRequest,
  useJobReferenceRequest,
  useReferenceRefereeAction,
  useReferenceRequestPeople,
  useReferenceRequestReferees,
  useResendCandidateLink,
} from '@/hooks/useReferenceRequests'
import {
  rememberReferenceLink,
  useSessionRefereeLinks,
  useSessionReferenceLink,
} from '@/lib/references/sessionLinks'
import { refereeRulesLine, stageSuggestsReferences } from '@/lib/references/requestCopy'
import type { ReferenceTemplate } from '@/lib/references/templateModel'
import { copyToClipboard } from '@/utils/clipboard'

/**
 * Data + actions for the single reference-check card on the in-job candidate
 * profile. The card itself is presentational; every state comes from
 * resolveCardState() in src/lib/references/status.ts.
 */
export function CandidateReferenceCheckSection({
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  stageName,
  onRequest,
}: {
  candidateId?: string | null
  candidateName?: string | null
  candidateEmail?: string | null
  jobId?: string | null
  stageName?: string | null
  onRequest: () => void
}) {
  const navigate = useNavigate()
  const { templates } = useReferenceTemplates()
  const { clientId, clientName } = useJobClient(jobId)

  const { request } = useJobReferenceRequest(candidateId, jobId)
  const activeRequest = request?.state === 'cancelled' ? request : request
  const { referees } = useReferenceRequestReferees(
    activeRequest && activeRequest.state !== 'cancelled' ? activeRequest.id : null,
  )
  const people = useReferenceRequestPeople([activeRequest?.requested_by])
  const sessionLink = useSessionReferenceLink(activeRequest?.id)
  const sessionRefereeLinks = useSessionRefereeLinks()

  const resend = useResendCandidateLink()
  const cancel = useCancelReferenceRequest()
  const refereeAction = useReferenceRefereeAction()
  const [logOpen, setLogOpen] = useState(false)

  const template = useMemo<ReferenceTemplate | null>(() => {
    const live = templates.filter((t) => t.is_live)
    const match = live.find(
      (t) => t.scope === 'client' && !!clientId && t.client_id === clientId,
    )
    return match ?? live[0] ?? null
  }, [templates, clientId])

  const requirement = template
    ? refereeRulesLine(template.min_referees, template.relationship_rules)
    : 'references from previous managers'

  const requirementPhrase = clientName
    ? requirement
    : `This stage usually collects ${requirement}`

  /** Configuration, not a hardcoded stage name. */
  const suggested = stageSuggestsReferences(stageName, template?.collect_at_stages)

  const busy = resend.isPending || refereeAction.isPending || cancel.isPending

  const handleResend = async () => {
    if (!activeRequest) return
    const result = await resend.mutateAsync(activeRequest.id)
    rememberReferenceLink(activeRequest.id, result?.link)
  }

  return (
    <>
      <ReferenceCheckCard
        client={clientName}
        requirement={requirementPhrase}
        suggested={suggested}
        request={activeRequest as any}
        referees={referees as any}
        candidateName={candidateName}
        candidateEmail={candidateEmail}
        people={people}
        sessionLink={sessionLink}
        sessionRefereeLinks={sessionRefereeLinks}
        busy={busy}
        onRequest={onRequest}
        onOpenDetail={() => navigate('/references')}
        onResendCandidate={handleResend}
        onCopyLink={() => {
          if (sessionLink) copyToClipboard(sessionLink, 'Candidate link copied')
        }}
        onLogPhone={() => {
          if (activeRequest) setLogOpen(true)
        }}
        onCancel={() => activeRequest && cancel.mutate(activeRequest.id)}
        onRemindReferees={() =>
          activeRequest &&
          refereeAction.mutate({ requestId: activeRequest.id, action: 'remind_referees' })
        }
        onReleaseReferee={(refereeId) =>
          activeRequest &&
          refereeAction.mutate({
            requestId: activeRequest.id,
            action: 'release_referee',
            refereeId,
          })
        }
        onRequestReplacement={handleResend}
      />

      {activeRequest && (
        <LogPhoneReferenceDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          requestId={activeRequest.id}
          snapshot={(activeRequest as any).template_snapshot ?? null}
        />
      )}
    </>
  )
}

export default CandidateReferenceCheckSection
