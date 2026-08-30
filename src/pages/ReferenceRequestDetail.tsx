import { useState } from 'react'
import { EyeOff, Phone, Send, Share2, UserRoundPlus } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { ReferencesShell, ReferencesNoAccess } from '@/components/references/ReferencesShell'
import { GioSummaryBlock } from '@/components/references/GioSummaryBlock'
import { GioFlagCards } from '@/components/references/GioFlagCards'
import { ProvenanceLine } from '@/components/references/ProvenanceLine'
import { RefStatus } from '@/components/references/RefStatus'
import { RefereeRow } from '@/components/references/RefereeRow'
import { ScoredAnswersTable } from '@/components/references/ScoredAnswersTable'
import { ReferenceActivityTimeline } from '@/components/references/ReferenceActivityTimeline'
import { ShareReportDialog } from '@/components/references/ShareReportDialog'
import { LogPhoneReferenceDialog } from '@/components/references/LogPhoneReferenceDialog'
import {
  useReferenceActivity,
  useReferenceRequestDetail,
} from '@/hooks/useReferenceList'
import {
  useReferenceRefereeAction,
  useResendCandidateLink,
} from '@/hooks/useReferenceRequests'
import type { RefQuestion } from '@/lib/references/templateModel'

const DATE = { day: 'numeric', month: 'short', year: 'numeric' } as const

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, DATE)
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`
}

function Panel({
  title,
  children,
  pad = 14,
}: {
  title?: string
  children: React.ReactNode
  pad?: number
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        padding: pad,
      }}
    >
      {title && (
        <p
          className="font-poppins uppercase"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: '#1F2230',
            marginBottom: 10,
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12, padding: '7px 0' }}>
      <span className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
        {label}
      </span>
      <span
        className="font-inter truncate"
        style={{ fontSize: 12, fontWeight: 500, color: '#1F2230', textAlign: 'right' }}
      >
        {value}
      </span>
    </div>
  )
}

/** /references/requests/:requestId — Flow E.2. */
export default function ReferenceRequestDetail() {
  const { requestId } = useParams<{ requestId: string }>()
  const { canViewReferences } = usePermissions()

  const { request, isLoading } = useReferenceRequestDetail(requestId)
  const { activity } = useReferenceActivity(requestId)
  const resend = useResendCandidateLink()
  const refereeAction = useReferenceRefereeAction()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneReferee, setPhoneReferee] = useState<string | null>(null)

  if (!canViewReferences) return <ReferencesNoAccess />

  if (!request) {
    return (
      <ReferencesShell>
        <p className="font-inter" style={{ fontSize: 12, color: '#5A6072' }}>
          {isLoading ? 'Loading…' : 'This reference check is no longer available.'}
        </p>
      </ReferencesShell>
    )
  }

  const snapshot = request.templateSnapshot ?? null
  const questions: RefQuestion[] = Array.isArray(snapshot?.questions)
    ? (snapshot!.questions as RefQuestion[])
    : []
  const summary = (snapshot as any)?.gio_summary ?? null
  const retentionMonths = snapshot?.retention_months ?? snapshot?.retention?.months ?? null

  const openPhone = (refereeId: string | null) => {
    setPhoneReferee(refereeId)
    setPhoneOpen(true)
  }

  return (
    <ReferencesShell>
      <PageHeader
        title={request.candidateName}
        kicker
        breadcrumb={[{ label: 'Reference checks', to: '/references' }, request.candidateName]}
        meta={
          <>
            <RefStatus state={request.state} flagged={request.flagged} size="sm" />
            <span className="tabular-nums">{request.counts}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="md" icon={Phone} onClick={() => openPhone(null)}>
              Log by phone
            </Button>
            <Button variant="secondary" size="md" icon={Share2} onClick={() => setShareOpen(true)}>
              Share report
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Send}
              loading={resend.isPending}
              onClick={() => resend.mutate(request.id)}
            >
              Resend
            </Button>
          </>
        }
      >
        <ProvenanceLine
          job={request.jobTitle}
          client={request.clientName}
          stage={request.stage}
          recruiter={request.recruiterName}
          collectedAt={request.created_at}
          style={{ marginTop: 10 }}
        />
      </PageHeader>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'minmax(0,1fr) 320px',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* Left */}
        <div className="flex flex-col" style={{ gap: 14 }}>
          {/* Silent when there is no analysis — no placeholder, no skeleton. */}
          <GioSummaryBlock
            variant="detail"
            prose={summary?.prose}
            flagged={request.flagged}
            updatedAt={summary?.updated_at}
          >
            <GioFlagCards flags={request.flags} />
          </GioSummaryBlock>

          <div>
            <div
              className="flex items-center justify-between"
              style={{ gap: 12, marginBottom: 9 }}
            >
              <p
                className="font-poppins uppercase"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: '#1F2230',
                }}
              >
                Referees
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={UserRoundPlus}
                onClick={() => resend.mutate(request.id)}
              >
                Request a replacement
              </Button>
            </div>

            <div className="flex flex-col" style={{ gap: 8 }}>
              {request.referees.map((referee) => (
                <RefereeRow
                  key={referee.id}
                  referee={referee}
                  expandable
                  expanded={expanded === referee.id}
                  onToggle={() => setExpanded(expanded === referee.id ? null : referee.id)}
                  questions={questions}
                  candidateSelf={request.selfAssessment}
                  showActions
                  busy={refereeAction.isPending}
                  onRemind={() =>
                    refereeAction.mutate({
                      requestId: request.id,
                      action: 'resend_referee',
                      refereeId: referee.id,
                    })
                  }
                  onRelease={() =>
                    refereeAction.mutate({
                      requestId: request.id,
                      action: 'release_referee',
                      refereeId: referee.id,
                    })
                  }
                  onLogByPhone={() => openPhone(referee.id)}
                />
              ))}
            </div>
          </div>

          <ScoredAnswersTable
            questions={questions}
            referees={request.referees}
            candidateSelf={request.selfAssessment}
          />
        </div>

        {/* Right */}
        <div className="flex flex-col" style={{ gap: 14 }}>
          <Panel>
            <Row label="Template" value={request.templateName ?? '—'} />
            <Row label="Requested by" value={request.recruiterName ?? '—'} />
            <Row label="Sent" value={fmtDate(request.created_at)} />
            <Row
              label="Candidate link"
              value={
                request.candidateLinkExpiresAt
                  ? `Expires ${fmtDate(request.candidateLinkExpiresAt)}`
                  : '—'
              }
            />
            <Row
              label="Consent"
              value={
                request.consentRecordedAt
                  ? `Recorded ${fmtDateTime(request.consentRecordedAt)}`
                  : 'Not recorded'
              }
            />
            <Row
              label="Retention"
              value={
                retentionMonths
                  ? `${retentionMonths} months`
                  : request.retentionExpiresAt
                    ? `Until ${fmtDate(request.retentionExpiresAt)}`
                    : '—'
              }
            />
          </Panel>

          <div
            className="flex"
            style={{
              gap: 9,
              padding: '11px 13px',
              background: '#fff',
              border: '1px solid #E7E8EE',
              borderRadius: 10,
            }}
          >
            <EyeOff size={14} color="#8B8F9E" style={{ flexShrink: 0, marginTop: 1 }} />
            <p
              className="font-inter"
              style={{ fontSize: 11.5, color: '#5A6072', lineHeight: 1.55 }}
            >
              Referee answers are internal. The candidate never sees them anywhere in the product.
            </p>
          </div>

          {activity.length > 0 && (
            <Panel title="Activity">
              <ReferenceActivityTimeline activity={activity} />
            </Panel>
          )}
        </div>
      </div>

      <ShareReportDialog open={shareOpen} onOpenChange={setShareOpen} requestId={request.id} />
      <LogPhoneReferenceDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        requestId={request.id}
        snapshot={snapshot}
        candidateName={request.candidateName}
        referees={request.referees}
        preselectedRefereeId={phoneReferee}
      />

    </ReferencesShell>
  )
}
