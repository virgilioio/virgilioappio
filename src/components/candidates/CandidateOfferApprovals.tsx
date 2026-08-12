import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  Check,
  X,
  Send,
  Minus,
  Lock,
  Bell,
  Info,
  ListChecks,
  Settings2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { useOfferApprovalSummary } from '@/hooks/useOfferApprovalSummary'
import { usePermissions } from '@/hooks/usePermissions'
import { RunStepStatus } from '@/lib/offerApproval'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CandidateOfferApprovalsProps {
  candidateId: string
  jobId: string
  organizationId?: string | null
  candidateFirstName?: string
  jobTitle?: string
}

function initialsOf(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/)
  if (!parts[0]) return '?'
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

function StatusBadge({ status }: { status: RunStepStatus }) {
  const map: Record<RunStepStatus, { label: string; bg: string; color: string; dot: boolean }> = {
    approved: { label: 'Approved', bg: '#D1FAE5', color: '#0B6E4F', dot: true },
    awaiting: { label: 'Awaiting', bg: '#EDE4FF', color: '#5B2FD1', dot: true },
    queued: { label: 'Queued', bg: '#F1F0EC', color: '#5A6072', dot: false },
    skipped: { label: 'Skipped', bg: '#F1F0EC', color: '#8B8F9E', dot: false },
    declined: { label: 'Declined', bg: '#FEE2E2', color: '#B91C1C', dot: true },
  }
  const t = map[status]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-inter"
      style={{ fontSize: 11, backgroundColor: t.bg, color: t.color }}
    >
      {t.dot && (
        <span
          className={cn('inline-block rounded-full', status === 'awaiting' && 'animate-pulse')}
          style={{ width: 5, height: 5, backgroundColor: 'currentColor' }}
        />
      )}
      {t.label}
    </span>
  )
}

function Rail({ status, index }: { status: RunStepStatus; index: number }) {
  const base = 'flex items-center justify-center rounded-full font-poppins font-semibold'
  const size = { width: 22, height: 22, fontSize: 10.5 }
  if (status === 'approved')
    return (
      <div className={base} style={{ ...size, backgroundColor: '#D1FAE5', color: '#0B6E4F' }}>
        <Check className="h-3 w-3" />
      </div>
    )
  if (status === 'declined')
    return (
      <div className={base} style={{ ...size, backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
        <X className="h-3 w-3" />
      </div>
    )
  if (status === 'skipped')
    return (
      <div
        className={base}
        style={{ ...size, backgroundColor: '#FAFAF7', border: '1px dashed #DBD9D1', color: '#B5B9C4' }}
      >
        <Minus className="h-3 w-3" />
      </div>
    )
  if (status === 'awaiting')
    return (
      <div
        className={base}
        style={{
          ...size,
          backgroundColor: '#6F3FF5',
          color: '#fffcf9',
          boxShadow: '0 0 0 3px rgba(111,63,245,0.14)',
        }}
      >
        {index}
      </div>
    )
  return (
    <div className={base} style={{ ...size, backgroundColor: '#F1F0EC', color: '#8B8F9E' }}>
      {index}
    </div>
  )
}

function CardShell({
  title,
  subtitle,
  action,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-[12px] border border-[#E7E8EE] overflow-hidden" style={{ padding: 0 }}>
      <div style={{ padding: '8px 20px 4px' }}>
        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="min-w-0">
            <h3
              className="font-poppins font-semibold text-[14px] text-[#0d0d09]"
              style={{ letterSpacing: '-0.02em' }}
            >
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 font-inter text-[11.5px] text-[#8B8F9E]">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
      {footer}
    </div>
  )
}

export function CandidateOfferApprovals({
  candidateId,
  jobId,
  candidateFirstName,
  jobTitle,
}: CandidateOfferApprovalsProps) {
  const navigate = useNavigate()
  const permissions = usePermissions()
  const isAdmin = permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin

  const {
    isLoading,
    offerLetter,
    chainConfigured,
    configuredSteps,
    mode,
    approvalRequest,
    runSteps,
    approved,
    total,
    skippedCount,
    awaitingStep,
  } = useOfferApprovalSummary(candidateId, jobId)

  const { isCurrentUserActiveApprover, activeStep, approveStep, declineStep, isApproving, isDeclining } =
    useOfferApprovalRequest(offerLetter?.id, jobId)

  const [declineNotes, setDeclineNotes] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)

  const jobLabel = jobTitle || 'this job'
  const firstName = candidateFirstName || 'the candidate'

  const goToSetup = () => {
    navigate(`/jobs/${jobId}`)
    setTimeout(() => window.dispatchEvent(new CustomEvent('job-detail:nav', { detail: 'job-setup' })), 60)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-[12px] border border-[#E7E8EE] p-5">
        <p className="text-center font-inter text-[12.5px] text-[#8B8F9E]">Loading approval status…</p>
      </div>
    )
  }

  /* ---------- Canonical empty state: no chain ---------- */
  if (!chainConfigured) {
    return (
      <CardShell
        title="Offer approvals"
        subtitle={`No approval chain configured for ${jobLabel}`}
        action={
          <span
            className="rounded-full px-2 py-0.5 font-inter"
            style={{ fontSize: 11, backgroundColor: '#F1F0EC', color: '#5A6072' }}
          >
            Not required
          </span>
        }
      >
        <div className="flex flex-col items-center text-center" style={{ padding: '30px 24px 26px' }}>
          <div
            className="flex items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F0EC' }}
          >
            <ListChecks size={20} strokeWidth={1.75} style={{ color: '#8B8F9E' }} />
          </div>
          <p
            className="mt-3 font-poppins font-semibold text-[15px] text-[#0d0d09]"
            style={{ letterSpacing: '-0.02em' }}
          >
            This job doesn't need offer approvals
          </p>
          <p
            className="mt-1.5 font-inter text-[12.5px] text-[#5A6072]"
            style={{ lineHeight: 1.6, maxWidth: 380 }}
          >
            Offers for {jobLabel} go straight to the candidate, and you can mark {firstName} hired as soon
            as they accept.
          </p>
          {isAdmin && (
            <div className="mt-4">
              <Button variant="secondary" size="md" icon={Settings2} onClick={goToSetup}>
                Set up an approval chain
              </Button>
            </div>
          )}
          <div className="mt-5 w-full pt-3 border-t" style={{ borderColor: '#F1F0EC' }}>
            <p className="font-inter text-[11px] text-[#B5B9C4]">
              Chains are configured per job in Job setup → Offer approval.
            </p>
          </div>
        </div>
      </CardShell>
    )
  }

  /* ---------- Chain exists but the run hasn't started ---------- */
  const displaySteps =
    runSteps && runSteps.length > 0
      ? runSteps.map((s, i) => ({
          key: s.id,
          index: i + 1,
          runStatus: s.runStatus,
          name: s.approver_name,
          title: s.approver_role_label || null,
          decidedAt: s.decided_at,
          notes: s.notes,
          skipReason: s.skip_reason,
          stepId: s.id,
        }))
      : [...configuredSteps]
          .sort((a, b) => a.step_order - b.step_order)
          .map((s, i) => ({
            key: s.id,
            index: i + 1,
            runStatus: 'queued' as RunStepStatus,
            name: s.approver_name,
            title: s.approver_role || null,
            decidedAt: null as string | null,
            notes: null as string | null,
            skipReason: null as string | null,
            stepId: null as string | null,
          }))

  const runComplete = !!runSteps && total > 0 && approved === total
  const sentAt = (offerLetter as any)?.sent_at || null

  const handleApprove = async () => {
    if (!activeStep) return
    await approveStep(activeStep.id)
  }
  const handleDecline = async () => {
    if (!activeStep) return
    await declineStep(activeStep.id, declineNotes.trim() || undefined)
    setShowDeclineForm(false)
    setDeclineNotes('')
  }

  const metaFor = (s: (typeof displaySteps)[number], prevName?: string | null) => {
    if (s.runStatus === 'approved' || s.runStatus === 'declined') {
      const when = s.decidedAt ? format(new Date(s.decidedAt), "MMM d · h:mm a") : null
      return [when, s.notes ? `“${s.notes}”` : null].filter(Boolean).join(' · ')
    }
    if (s.runStatus === 'awaiting') {
      const when = approvalRequest?.created_at
        ? `Requested ${format(new Date(approvalRequest.created_at), "MMM d · h:mm a")}`
        : 'Requested'
      return when
    }
    if (s.runStatus === 'skipped') return s.skipReason || ''
    return prevName ? `Asked once ${prevName} approves` : 'Asked when the chain reaches this step'
  }

  return (
    <CardShell
      title="Offer approvals"
      subtitle={`Chain defined in ${jobLabel} → Job setup · ${mode === 'parallel' ? 'all at once' : 'runs in order'}`}
      action={
        <>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-inter"
            style={{
              fontSize: 11,
              backgroundColor: runComplete ? '#D1FAE5' : '#EDE4FF',
              color: runComplete ? '#0B6E4F' : '#5B2FD1',
            }}
          >
            <span
              className={cn('inline-block rounded-full', !runComplete && 'animate-pulse')}
              style={{ width: 5, height: 5, backgroundColor: 'currentColor' }}
            />
            {approved} of {total} approved
          </span>
          {isAdmin && (
            <Button variant="ghost" size="xs" icon={ExternalLink} onClick={goToSetup}>
              Edit chain
            </Button>
          )}
        </>
      }
      footer={
        skippedCount > 0 ? (
          <div
            className="flex items-start gap-2 border-t"
            style={{
              borderColor: '#F1F0EC',
              backgroundColor: '#FAFAF7',
              padding: '10px 20px',
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
          >
            <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" style={{ color: '#8B8F9E' }} />
            <p className="font-inter text-[11.5px] text-[#5A6072]">
              {skippedCount} approver{skippedCount === 1 ? '' : 's'} in the job's chain{' '}
              {skippedCount === 1 ? 'was' : 'were'} skipped — their condition didn't apply to this offer.
            </p>
          </div>
        ) : null
      }
    >
      <div className="pb-3">
        {displaySteps.map((s, i) => {
          const prev = displaySteps[i - 1]
          const dim = s.runStatus === 'queued' || s.runStatus === 'skipped'
          const isMine = !!s.stepId && s.stepId === activeStep?.id && isCurrentUserActiveApprover
          return (
            <div key={s.key} className="grid" style={{ gridTemplateColumns: '22px 1fr' }}>
              <div className="flex flex-col items-center">
                <Rail status={s.runStatus} index={s.index} />
                <div className="flex-1 w-[1.5px]" style={{ backgroundColor: '#EDECE6' }} />
              </div>

              <div className="pb-3 pl-3" style={{ opacity: dim ? 0.62 : 1 }}>
                <div
                  className={cn('flex items-center gap-3')}
                  style={
                    s.runStatus === 'awaiting'
                      ? {
                          backgroundColor: '#FAF8FF',
                          border: '1px solid #EDE4FF',
                          borderRadius: 10,
                          padding: '11px 12px',
                        }
                      : undefined
                  }
                >
                  <Avatar className="h-[30px] w-[30px] shrink-0">
                    <AvatarFallback className="font-inter text-[11px]">{initialsOf(s.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-inter text-[12.5px] font-medium text-[#0d0d09] truncate">
                      {s.name}
                      {s.title && <span className="font-normal text-[#8B8F9E]"> · {s.title}</span>}
                    </p>
                    <p className="font-inter text-[11px] text-[#8B8F9E] truncate">
                      {metaFor(s, prev?.name)}
                    </p>
                  </div>
                  {s.runStatus === 'awaiting' && !isMine && (
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={Bell}
                      onClick={() => toast.success(`Reminder sent to ${s.name}`)}
                    >
                      Remind
                    </Button>
                  )}
                  <StatusBadge status={s.runStatus} />
                </div>

                {isMine && (
                  <div className="mt-3">
                    {!showDeclineForm ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Check}
                          onClick={handleApprove}
                          disabled={isApproving || isDeclining}
                          loading={isApproving}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={X}
                          onClick={() => setShowDeclineForm(true)}
                          disabled={isApproving || isDeclining}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Please provide a reason for declining…"
                          value={declineNotes}
                          onChange={(e) => setDeclineNotes(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="dangerSolid"
                            icon={isDeclining ? Loader2 : X}
                            onClick={handleDecline}
                            disabled={isDeclining}
                            loading={isDeclining}
                          >
                            Confirm decline
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowDeclineForm(false)
                              setDeclineNotes('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Terminal row */}
        <div className="grid" style={{ gridTemplateColumns: '22px 1fr' }}>
          <div className="flex justify-center">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 22,
                height: 22,
                backgroundColor: runComplete ? '#0d0d09' : '#F1F0EC',
              }}
            >
              {runComplete ? (
                <Send className="h-3 w-3" style={{ color: '#fffcf9' }} />
              ) : (
                <Lock className="h-3 w-3" style={{ color: '#B5B9C4' }} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 pl-3">
            <div className="min-w-0 flex-1">
              {runComplete ? (
                <>
                  <p className="font-inter text-[12.5px] font-medium text-[#0d0d09]">
                    Offer sent to {firstName}
                  </p>
                  <p className="font-inter text-[11px] text-[#8B8F9E]">
                    {sentAt ? `${format(new Date(sentAt), "MMM d · h:mm a")} · via email` : 'via email'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-inter text-[12.5px] font-medium text-[#8B8F9E]">
                    Offer stays in Draft until the chain clears
                  </p>
                  <p className="font-inter text-[11px] text-[#B5B9C4]">
                    {awaitingStep ? `Waiting on ${awaitingStep.approver_name}` : 'Waiting on the approval chain'}
                  </p>
                </>
              )}
            </div>
            {runComplete ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-inter"
                style={{ fontSize: 11, backgroundColor: '#EDE4FF', color: '#5B2FD1' }}
              >
                <span
                  className="inline-block animate-pulse rounded-full"
                  style={{ width: 5, height: 5, backgroundColor: 'currentColor' }}
                />
                Awaiting response
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 font-inter"
                style={{ fontSize: 11, backgroundColor: '#F1F0EC', color: '#5A6072' }}
              >
                Locked
              </span>
            )}
          </div>
        </div>
      </div>
    </CardShell>
  )
}
