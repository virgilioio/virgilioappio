import { useEffect, useMemo, useState } from 'react'
import { Info, Link2, Phone, Plus, Send, Share2, UserRoundPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { EmptyRefereeTrack } from '@/components/references/EmptyRefereeTrack'
import { RefGlyph } from '@/components/references/RefGlyph'
import { RefStatus } from '@/components/references/RefStatus'
import { RefereeTrack } from '@/components/references/RefereeTrack'
import { RefCardFooter, RefCardShell, RefDetailRow } from '@/components/references/RefCardShell'
import { RefereeRow, type RefereeRowData } from '@/components/references/RefereeRow'
import { GioSummaryBlock, type GioFlagCounts } from '@/components/references/GioSummaryBlock'
import { ShareReportDialog } from '@/components/references/ShareReportDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { composeRequirementLine } from '@/lib/references/requestCopy'
import {
  countReferees,
  deriveState,
  formatCounts,
  resolveCardState,
  type RefCardState,
  type RefRequestState,
} from '@/lib/references/status'

export interface ReferenceRequestRow {
  id: string
  state: RefRequestState
  flagged?: boolean | null
  cancelled_at?: string | null
  candidate_link_expires_at?: string | null
  min_referees_override?: number | null
  requested_by?: string | null
  created_at?: string
  updated_at?: string | null
  template_snapshot?: Record<string, any> | null
  self_assessment?: Record<string, unknown> | null
  flags?: Record<string, any> | null
  gio_summary?: { prose?: string | null; updated_at?: string | null } | null
}

interface ReferenceCheckCardProps {
  /** Client (organization) name for this job, when there is one. */
  client?: string | null
  /** e.g. "2 references, one from a direct manager" — always from data. */
  requirement: string
  /** e.g. "usually back in about 4 days" — optional. */
  turnaround?: string | null
  /** The stage normally collects references → lilac prompt instead of the quiet row. */
  suggested?: boolean

  /** The candidate's request for THIS job, or null. */
  request?: ReferenceRequestRow | null
  referees?: RefereeRowData[]
  candidateFirstName?: string | null
  candidateName?: string | null
  candidateEmail?: string | null
  /** user id → display name, for "by {name}". */
  people?: Record<string, string>
  /** The candidate link minted in this session, if any — enables Copy link. */
  sessionLink?: string | null
  /** referee id → link minted in this session, if any. */
  sessionRefereeLinks?: Record<string, string>

  onRequest: () => void
  onOpenDetail?: () => void
  onResendCandidate?: () => void
  onCopyLink?: () => void
  onLogPhone?: () => void
  onCancel?: () => void
  onRemindReferees?: () => void
  onReleaseReferee?: (refereeId: string) => void
  onRequestReplacement?: () => void
  busy?: boolean
}

const DATE = { day: 'numeric', month: 'short', year: 'numeric' } as const

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, DATE)
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, DATE)} · ${d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** Live, never stored: "in 14 days" recomputes on every render. */
function relativeDays(iso?: string | null): string | null {
  if (!iso) return null
  const ms = Date.parse(iso) - Date.now()
  const days = Math.round(ms / 86_400_000)
  if (days < 0) return null
  if (days === 0) return 'today'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

function addDays(iso: string | null | undefined, days: number): string | null {
  const base = iso ? Date.parse(iso) : Date.now()
  if (Number.isNaN(base)) return null
  return new Date(base + days * 86_400_000).toISOString()
}

function fmtShort(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * The ONE reference-check card on the in-job candidate profile — five
 * renderings, one slot, directly below Scorecards. The trigger and the result
 * live in the same place, so a recruiter never learns a second location for the
 * outcome.
 */
export function ReferenceCheckCard({
  client,
  requirement,
  turnaround,
  suggested = false,
  request = null,
  referees = [],
  candidateFirstName,
  candidateName,
  candidateEmail,
  people = {},
  sessionLink,
  sessionRefereeLinks = {},
  onRequest,
  onOpenDetail,
  onResendCandidate,
  onCopyLink,
  onLogPhone,
  onCancel,
  onRemindReferees,
  onReleaseReferee,
  onRequestReplacement,
  busy = false,
}: ReferenceCheckCardProps) {
  const [open, setOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [openRefereeId, setOpenRefereeId] = useState<string | null>(null)

  const cardState: RefCardState = resolveCardState(request, suggested, referees)
  const snapshot = request?.template_snapshot ?? null
  const required = request?.min_referees_override ?? snapshot?.min_referees ?? 2
  const firstName = candidateFirstName || candidateName?.split(' ')[0] || 'the candidate'

  const counts = useMemo(() => countReferees(referees, required), [referees, required])
  const reminders = snapshot?.reminders ?? null
  const remindersOn = reminders?.enabled !== false

  const heldReferees = referees.filter((r) => r.on_hold === true || r.status === 'on_hold')
  const failedReferees = referees.filter(
    (r) => r.status === 'bounced' || r.status === 'declined',
  )
  const invitedNames = referees
    .filter((r) => !(r.on_hold === true || r.status === 'on_hold'))
    .map((r) => r.name)

  const firstRefereeId = referees[0]?.id ?? null
  useEffect(() => {
    setOpenRefereeId((current) => current ?? firstRefereeId)
  }, [firstRefereeId])

  /** Questions from the FROZEN snapshot, in template order. */
  const snapshotQuestions = useMemo(
    () => ((snapshot?.questions ?? []) as any[]).filter((q) => q?.id),
    [snapshot],
  )

  /* ---------------- states 1 & 2 — the ProfileCard shell ---------------- */

  if (cardState === 'empty' || cardState === 'suggested') {
    const requirementLine =
      cardState === 'suggested' ? composeRequirementLine(requirement, client, turnaround) : null

    const cancelledNote =
      request?.state === 'cancelled' && request.cancelled_at
        ? `Last request cancelled ${fmtShort(request.cancelled_at)}${
            request.requested_by && people[request.requested_by]
              ? ` by ${people[request.requested_by]}`
              : ''
          }.`
        : null

    return (
      <ProfileCard
        title="Reference check"
        subtitle="Belongs to the candidate — reusable on any job they're put forward for"
        action={
          <Button variant="secondary" size="sm" icon={Plus} onClick={onRequest}>
            Request references
          </Button>
        }
      >
        {cardState === 'suggested' ? (
          <div
            className="flex items-center"
            style={{
              gap: 12,
              padding: '12px 14px',
              background: '#FAF8FF',
              border: '1px solid #EDE4FF',
              borderRadius: 10,
            }}
          >
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{ width: 32, height: 32, borderRadius: 8, background: '#EDE4FF' }}
            >
              <RefGlyph size={17} color="#6F3FF5" accent="#6F3FF5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center" style={{ gap: 7 }}>
                <span
                  className="font-poppins"
                  style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
                >
                  Usually collected at this stage
                </span>
                <Badge tone="lilac" size="xs">
                  Suggested
                </Badge>
              </div>
              <p className="font-inter" style={{ fontSize: 11, color: '#5A6072', marginTop: 2 }}>
                {requirementLine}
              </p>
            </div>
            <Button variant="purple" size="sm" icon={Send} onClick={onRequest}>
              Request
            </Button>
          </div>
        ) : (
          <div className="flex items-center" style={{ gap: 11, padding: '4px 0' }}>
            <RefStatus state="none" />
            <span className="font-inter" style={{ fontSize: 12, color: '#8B8F9E' }}>
              Nothing requested yet for this job.
              {cancelledNote ? ` ${cancelledNote}` : ''}
            </span>
          </div>
        )}
      </ProfileCard>
    )
  }

  /* ---------------- states 3, 4, 5 — one shared shell ---------------- */

  const expired = request?.state === 'expired'
  const derived: RefRequestState =
    cardState === 'awaiting_candidate'
      ? expired
        ? 'candidate'
        : 'candidate'
      : cardState === 'awaiting_referees'
        ? counts.bounced + counts.declined > 0 &&
          counts.total - counts.bounced - counts.declined < counts.required
          ? 'attention'
          : 'referees'
        : deriveState(referees, required)

  const summary =
    cardState === 'awaiting_candidate'
      ? `Waiting on ${firstName} to add their referees`
      : cardState === 'awaiting_referees' && counts.submitted === 0
        ? `0 of ${Math.max(counts.total, 0)} submitted${
            invitedNames.length > 0 ? ` · all invited` : ''
          }`
        : formatCounts(referees, required)

  const track =
    cardState === 'awaiting_candidate' ? (
      <EmptyRefereeTrack count={required} />
    ) : (
      <RefereeTrack referees={referees as any} requiredCount={required} width={72} />
    )

  const reminderValue = () => {
    if (!remindersOn) return 'Reminders off'
    const first = addDays(request?.created_at, reminders?.candidate_first_after_days ?? 3)
    const every = reminders?.candidate_every_days ?? 4
    return `${fmtShort(first)} · then every ${every} days`
  }

  const refereeReminderValue = () => {
    if (!remindersOn) return 'Reminders off'
    const first = addDays(request?.created_at, reminders?.referee_first_after_days ?? 3)
    return `${fmtShort(first)} · max ${reminders?.referee_max ?? 3} reminders`
  }

  const submittedAtLatest = referees
    .map((r: any) => r.submitted_at)
    .filter(Boolean)
    .sort()
    .pop()

  const refereeLinkExpiry = (referees as any[])
    .map((r) => r.link_expires_at)
    .filter(Boolean)
    .sort()
    .pop()

  const footer =
    cardState === 'answers' ? (
      <RefCardFooter>
        <Button variant="secondary" size="sm" icon={Send} loading={busy} onClick={onResendCandidate}>
          Resend to candidate
        </Button>
        <Button variant="ghost" size="sm" icon={Phone} onClick={onLogPhone}>
          Log a phone reference
        </Button>
        <Button variant="secondary" size="sm" icon={Share2} onClick={() => setShareOpen(true)}>
          Share report
        </Button>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
            Cancel request
          </Button>
        </div>
      </RefCardFooter>
    ) : (
      <RefCardFooter>
        {failedReferees.length > 0 && onRequestReplacement && (
          <Button variant="primary" size="sm" icon={UserRoundPlus} onClick={onRequestReplacement}>
            Request a replacement
          </Button>
        )}

        {cardState === 'awaiting_candidate' ? (
          expired ? (
            <Button variant="primary" size="sm" icon={Send} loading={busy} onClick={onResendCandidate}>
              Send a fresh link
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={Send} loading={busy} onClick={onResendCandidate}>
              Resend to candidate
            </Button>
          )
        ) : (
          <Button variant="secondary" size="sm" icon={Send} loading={busy} onClick={onRemindReferees}>
            Remind referees
          </Button>
        )}

        {sessionLink ? (
          <Button variant="secondary" size="sm" icon={Link2} onClick={onCopyLink}>
            Copy link
          </Button>
        ) : (
          cardState !== 'awaiting_candidate' && (
            <Button variant="secondary" size="sm" icon={Send} loading={busy} onClick={onResendCandidate}>
              Resend to candidate
            </Button>
          )
        )}

        <Button variant="ghost" size="sm" icon={Phone} onClick={onLogPhone}>
          Log a phone reference
        </Button>

        <div style={{ marginLeft: 'auto' }}>
          <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
            Cancel request
          </Button>
        </div>
      </RefCardFooter>
    )

  return (
    <RefCardShell
      status={<RefStatus state={derived} flagged={request?.flagged === true} size="xs" />}
      track={track}
      summary={summary}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onOpenDetail={onOpenDetail}
    >
      {cardState === 'awaiting_candidate' && (
        <>
          <div style={{ padding: '12px 0' }}>
            <RefDetailRow
              label="Sent to"
              value={[candidateName, candidateEmail].filter(Boolean).join(' · ') || '—'}
            />
            <RefDetailRow
              label="Sent"
              value={
                <>
                  {fmtDateTime(request?.created_at)}
                  {request?.requested_by && people[request.requested_by]
                    ? ` by ${people[request.requested_by]}`
                    : ''}
                </>
              }
            />
            {expired ? (
              <RefDetailRow
                label="Link expires"
                value={`Expired ${fmtDate(request?.candidate_link_expires_at)}`}
                valueColor="#B45309"
              />
            ) : (
              <RefDetailRow
                label="Link expires"
                value={
                  [
                    fmtDate(request?.candidate_link_expires_at),
                    relativeDays(request?.candidate_link_expires_at),
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
              />
            )}
            <RefDetailRow label="Next reminder" value={reminderValue()} last />
          </div>

          <div
            className="flex"
            style={{
              gap: 9,
              padding: '11px 13px',
              background: '#FAFAF7',
              border: '1px solid #E7E8EE',
              borderRadius: 10,
            }}
          >
            <Info size={14} color="#8B8F9E" style={{ flexShrink: 0, marginTop: 1 }} />
            <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', lineHeight: 1.55 }}>
              Nobody is contacted until {firstName} submits their referees and confirms they have
              their permission. You'll see each referee appear here as they are added.
            </p>
          </div>
        </>
      )}

      {cardState === 'awaiting_referees' && (
        <>
          <div style={{ padding: '12px 0' }}>
            <RefDetailRow
              label="Referees submitted"
              value={`${referees.length} of ${required}${
                submittedAtLatest ? ` · ${fmtDateTime(submittedAtLatest)}` : ''
              }`}
            />
            <RefDetailRow
              label="Invited"
              value={invitedNames.length > 0 ? invitedNames.join(' · ') : '—'}
            />
            <RefDetailRow
              label="Links expire"
              value={
                [fmtDate(refereeLinkExpiry), relativeDays(refereeLinkExpiry)]
                  .filter(Boolean)
                  .join(' · ') || '—'
              }
            />
            <RefDetailRow
              label="Next reminder"
              value={refereeReminderValue()}
              last={heldReferees.length === 0}
            />
            {heldReferees.length > 0 && (
              <RefDetailRow
                label="On hold"
                value={heldReferees.map((r) => r.name).join(' · ')}
                valueColor="#9A3412"
                last
              />
            )}
          </div>

          <div className="flex flex-col" style={{ gap: 7 }}>
            {referees.map((r) => (
              <RefereeRow key={r.id} referee={r} busy={busy} />
            ))}
          </div>
        </>
      )}

      {cardState === 'answers' && (
        <div className="flex flex-col" style={{ gap: 12, paddingTop: 12 }}>
          <GioSummaryBlock
            prose={request?.gio_summary?.prose ?? null}
            flagged={request?.flagged === true}
            flags={(request?.flags ?? null) as GioFlagCounts | null}
            updatedAt={request?.gio_summary?.updated_at ?? request?.updated_at ?? null}
            submitted={counts.submitted}
            required={required}
          />

          <div className="flex flex-col" style={{ gap: 7 }}>
            {referees.map((r) => (
              <RefereeRow
                key={r.id}
                referee={r}
                expandable
                expanded={openRefereeId === r.id}
                onToggle={() => setOpenRefereeId((cur) => (cur === r.id ? null : r.id))}
                questions={snapshotQuestions}
                candidateSelf={request?.self_assessment ?? null}
                showActions
                busy={busy}
                onRelease={onReleaseReferee ? () => onReleaseReferee(r.id) : undefined}
                onRemind={onRemindReferees}
                onReplace={onRequestReplacement}
                onLogByPhone={onLogPhone}
                onOpenLink={
                  sessionRefereeLinks[r.id]
                    ? () => window.open(sessionRefereeLinks[r.id], '_blank', 'noopener')
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {footer}

      <ShareReportDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        requestId={request?.id}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this reference request?</AlertDialogTitle>
            <AlertDialogDescription>
              The candidate and referee links stop working immediately. Anything already submitted
              stays on the candidate's record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the request</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancel(false)
                onCancel?.()
              }}
            >
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RefCardShell>
  )
}

export default ReferenceCheckCard
