import { useMemo } from 'react'
import { ArrowUpRight, Clock, Info, Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftPaper } from '@/components/ui/EmptyIllustrations'
import { usePermissions } from '@/hooks/usePermissions'
import { ReferencesShell, ReferencesNoAccess } from '@/components/references/ReferencesShell'
import { ProvenanceLine } from '@/components/references/ProvenanceLine'
import { RefGlyph } from '@/components/references/RefGlyph'
import { RefStatus } from '@/components/references/RefStatus'
import { useTenantReferenceRequests } from '@/hooks/useReferenceList'

/** A check older than three months is no longer "current" evidence. */
function ageChip(iso: string) {
  const months = Math.floor((Date.now() - Date.parse(iso)) / (30 * 86_400_000))
  if (months < 3) {
    return (
      <Badge tone="green" size="xs" icon={Clock}>
        Current
      </Badge>
    )
  }
  return (
    <Badge tone="neutral" size="xs">
      {months < 12 ? `${months} months old` : `${Math.floor(months / 12)} yr old`}
    </Badge>
  )
}

/** /candidates/:candidateId/references — Flow E.4. Outside any job. */
export default function CandidateReferences() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const { canViewReferences } = usePermissions()
  const { requests } = useTenantReferenceRequests()

  const checks = useMemo(
    () => requests.filter((r) => r.candidateId === candidateId),
    [requests, candidateId],
  )

  if (!canViewReferences) return <ReferencesNoAccess />

  const candidateName = checks[0]?.candidateName ?? 'Candidate'

  return (
    <ReferencesShell>
      <PageHeader
        title="References"
        kicker
        breadcrumb={[
          { label: 'Candidates', to: '/candidates' },
          { label: candidateName, to: `/candidates/${candidateId}` },
          'References',
        ]}
        meta={
          <>
            <span>
              {checks.length} check{checks.length === 1 ? '' : 's'} collected
            </span>
            <span>Follows the candidate across every job</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => navigate(`/candidates/${candidateId}`)}
          >
            Request references
          </Button>
        }
      />

      {checks.length === 0 ? (
        <EmptyState
          illustration={<SoftPaper />}
          title="No reference checks yet"
          body="Reference checks belong to the candidate and follow them across every job."
        />
      ) : (
        <>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {checks.map((check, i) => (
              <div
                key={check.id}
                className="flex items-start"
                style={{
                  gap: 12,
                  background: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  border: `1px solid ${i === 0 ? '#D7C5FB' : '#E7E8EE'}`,
                  boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 32, height: 32, borderRadius: 9, background: '#0d0d09' }}
                >
                  <RefGlyph size={18} color="#fffcf9" accent="#D7C5FB" />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center" style={{ gap: 9, flexWrap: 'wrap' }}>
                    <RefStatus state={check.state} flagged={check.flagged} size="sm" />
                    <span
                      className="font-inter tabular-nums"
                      style={{ fontSize: 11.5, color: '#5A6072' }}
                    >
                      {check.counts}
                    </span>
                    {ageChip(check.created_at)}
                  </div>
                  <ProvenanceLine
                    job={check.jobTitle}
                    client={check.clientName}
                    stage={check.stage}
                    recruiter={check.recruiterName}
                    collectedAt={check.created_at}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowUpRight}
                  onClick={() => navigate(`/references/requests/${check.id}`)}
                >
                  Open
                </Button>
              </div>
            ))}
          </div>

          <div
            className="flex"
            style={{
              gap: 9,
              marginTop: 14,
              padding: '12px 14px',
              background: '#fff',
              border: '1px solid #E7E8EE',
              borderRadius: 10,
            }}
          >
            <Info size={14} color="#8B8F9E" style={{ flexShrink: 0, marginTop: 1 }} />
            <p
              className="font-inter"
              style={{ fontSize: 11.5, color: '#5A6072', lineHeight: 1.55 }}
            >
              A reference check belongs to the candidate, not the job. Every check shows the job and
              client it was collected for, so you can judge whether it's still current and relevant
              before reusing it.
            </p>
          </div>
        </>
      )}
    </ReferencesShell>
  )
}
