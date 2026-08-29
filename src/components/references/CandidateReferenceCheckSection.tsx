import { useMemo } from 'react'
import { ReferenceCheckCard } from '@/components/references/ReferenceCheckCard'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useJobClient } from '@/hooks/useJobClient'
import { refereeRulesLine, stageSuggestsReferences } from '@/lib/references/requestCopy'
import type { ReferenceTemplate } from '@/lib/references/templateModel'

/**
 * Composes the requirement copy from the live templates + job client, then
 * renders the presentational card. No client name or requirement is hardcoded.
 */
export function CandidateReferenceCheckSection({
  jobId,
  stageName,
  onRequest,
}: {
  jobId?: string | null
  stageName?: string | null
  onRequest: () => void
}) {
  const { templates } = useReferenceTemplates()
  const { clientId, clientName } = useJobClient(jobId)

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

  return (
    <ReferenceCheckCard
      client={clientName}
      requirement={requirementPhrase}
      suggested={stageSuggestsReferences(stageName)}
      onRequest={onRequest}
    />
  )
}

export default CandidateReferenceCheckSection
