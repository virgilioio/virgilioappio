import * as React from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  CircleSlash,
  ClipboardCheck,
  Clock,
  FileText,
  GitBranch,
  Link as LinkIcon,
  Loader,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  SoftArchive,
  SoftCaughtUp,
  SoftPaper,
  SoftPeople,
} from '@/components/ui/EmptyIllustrations'
import type { SelectionAction } from '@/components/shared/SelectionBar'
import type { PSColumn, PSEmptyConfig, PSRowAction } from './PipelineSectionTable'
import {
  PSAge,
  PSMatch,
  PSName,
  PSOwner,
  PSStatus,
  PSText,
  type PSStatusValue,
} from './psAtoms'

export type PSSection = 'application' | 'offers' | 'hired' | 'rejected'

/** One row, whatever the section — configs pick which fields they show. */
export interface PSRowData {
  id: string
  associationId?: string | null
  name: string
  role?: string | null
  company?: string | null
  favorite?: boolean
  score?: number | null
  /** Days waiting (application) or days since the offer went out (offers). */
  days?: number | null
  source?: string | null
  offerLabel?: string | null
  acceptedLabel?: string | null
  startDateLabel?: string | null
  reachedLabel?: string | null
  rejectedLabel?: string | null
  status?: PSStatusValue | null
  ownerName?: string | null
  ownerAvatar?: string | null
  raw?: any
}

export interface PSHandlers {
  onAdvance?: (row: PSRowData) => void
  onReject?: (row: PSRowData) => void
  onOpenRow?: (row: PSRowData) => void
  onMoveToJob?: (row: PSRowData) => void
  onBulkEmail?: () => void
  onBulkReject?: () => void
  onBulkMoveStage?: () => void
  onBulkMoveToJob?: () => void
  onBulkSendOffer?: () => void
  onBulkStartOnboarding?: () => void
  onBulkAssignReviewer?: () => void
  onBulkAddTag?: () => void
  onBulkExport?: () => void
  onBulkWithdrawOffer?: () => void
  onBulkTalentPool?: () => void
  onBulkAssignApprover?: () => void
  onBulkDelete?: () => void
  onStartReview?: () => void
  onSharePosting?: () => void
  onDraftOffer?: () => void
}

export interface PSSectionConfig {
  grid: string
  columns: PSColumn[]
  actions: PSRowAction[]
  bulk: { actions: SelectionAction[] }
  empty: PSEmptyConfig
  primary?: { label: string; icon: LucideIcon; onClick?: () => void }
}

// ── Status helpers (label + icon + colour + the reason line) ────────────────
export const PS_STATUS_ICONS = {
  sparkles: Sparkles,
  userCheck: UserCheck,
  clock: Clock,
  alert: AlertTriangle,
  shield: ShieldCheck,
  message: MessageSquare,
  loader: Loader,
  check: CheckCircle,
  slash: CircleSlash,
  userX: UserX,
} as const

const col = (
  key: string,
  label: string,
  render: (row: PSRowData) => React.ReactNode,
  align?: 'left' | 'right',
): PSColumn => ({ key, label, render, align })

const nameCol = col('candidate', 'Candidate', (r) => (
  <PSName name={r.name} role={r.role} company={r.company} favorite={r.favorite} />
))
const matchCol = col('match', 'Match', (r) => <PSMatch score={r.score} />, 'right')
const ownerCol = (label: string) =>
  col('owner', label, (r) => <PSOwner name={r.ownerName} avatarUrl={r.ownerAvatar} />)

/**
 * PS_SECTIONS — the four flat sections. Adding a fifth is a config entry here,
 * never a second table component.
 */
export function getSectionConfig(section: PSSection, h: PSHandlers): PSSectionConfig {
  const email: SelectionAction = {
    id: 'email',
    label: 'Email',
    icon: Mail,
    slot: 'secondary',
    onClick: h.onBulkEmail,
  }

  if (section === 'application') {
    return {
      grid: '28px minmax(0,1.9fr) 92px 116px minmax(0,1.15fr) minmax(0,1.25fr) 132px 64px',
      primary: { label: 'Start review', icon: ClipboardCheck, onClick: h.onStartReview },
      columns: [
        nameCol,
        matchCol,
        col('waiting', 'Waiting', (r) => <PSAge days={r.days} qualifier=" in queue" />),
        col('source', 'Source', (r) => <PSText tone="muted">{r.source}</PSText>),
        col('screening', 'Screening', (r) => <PSStatus value={r.status} />),
        ownerCol('Reviewer'),
      ],
      actions: [
        {
          id: 'advance',
          label: 'Advance to screening',
          icon: ArrowRight,
          kind: 'outlined',
          onClick: h.onAdvance,
        },
        { id: 'reject', label: 'Reject', icon: X, kind: 'danger', onClick: h.onReject },
      ],
      bulk: {
        actions: [
          {
            id: 'move-screening',
            label: 'Move to Screening',
            icon: ArrowRight,
            slot: 'primary',
            onClick: h.onBulkMoveStage,
          },
          email,
          { id: 'assign-reviewer', label: 'Assign reviewer', slot: 'overflow', onClick: h.onBulkAssignReviewer },
          { id: 'add-tag', label: 'Add tag', slot: 'overflow', onClick: h.onBulkAddTag },
          { id: 'reject', label: 'Reject', slot: 'overflow', destructive: true, onClick: h.onBulkReject },
        ],
      },
      empty: {
        illustration: <SoftPeople />,
        title: 'No applications waiting',
        body:
          "New applications land here the moment they arrive. Gio auto-screens each one against this job's must-haves before you see it.",
        action: { label: 'Share the posting', icon: <LinkIcon size={16} />, onClick: h.onSharePosting },
      },
    }
  }

  if (section === 'offers') {
    return {
      grid: '28px minmax(0,1.9fr) 92px minmax(0,1.05fr) 116px minmax(0,1.3fr) 132px 64px',
      columns: [
        nameCol,
        matchCol,
        col('offer', 'Offer', (r) => <PSText strong>{r.offerLabel}</PSText>),
        col('sent', 'Sent', (r) => <PSAge days={r.days} qualifier=" ago" />),
        col('status', 'Status', (r) => <PSStatus value={r.status} />),
        ownerCol('Owner'),
      ],
      actions: [
        { id: 'open', label: 'Open offer', icon: ArrowUpRight, kind: 'outlined', onClick: h.onOpenRow },
        {
          id: 'more',
          label: 'More',
          kind: 'bare',
          items: [
            { id: 'email', label: 'Email candidate', onClick: h.onOpenRow },
            { id: 'reject', label: 'Reject', destructive: true, onClick: h.onReject },
          ],
        },
      ],
      bulk: {
        actions: [
          { id: 'send-offer', label: 'Send offer', icon: FileText, slot: 'primary', onClick: h.onBulkSendOffer },
          email,
          { id: 'assign-approver', label: 'Assign approver', slot: 'overflow', onClick: h.onBulkAssignApprover },
          {
            id: 'withdraw',
            label: 'Withdraw offer',
            slot: 'overflow',
            destructive: true,
            onClick: h.onBulkWithdrawOffer,
          },
        ],
      },
      empty: {
        illustration: <SoftPaper />,
        title: 'No offers out',
        body:
          'Draft an offer from a candidate in final review and it appears here — with its approval chain and response deadline.',
        action: { label: 'Draft an offer', icon: <FileText size={16} />, onClick: h.onDraftOffer },
      },
    }
  }

  if (section === 'hired') {
    return {
      grid: '28px minmax(0,1.9fr) 92px 116px 116px minmax(0,1.3fr) 132px 64px',
      columns: [
        nameCol,
        matchCol,
        col('accepted', 'Accepted', (r) => <PSText tone="muted">{r.acceptedLabel}</PSText>),
        col('start', 'Start date', (r) => <PSText strong>{r.startDateLabel}</PSText>),
        col('onboarding', 'Onboarding', (r) => <PSStatus value={r.status} />),
        ownerCol('Owner'),
      ],
      actions: [
        {
          id: 'open',
          label: 'Open onboarding',
          icon: ArrowUpRight,
          kind: 'outlined',
          onClick: h.onOpenRow,
        },
        {
          id: 'more',
          label: 'More',
          kind: 'bare',
          items: [{ id: 'open', label: 'Open profile', onClick: h.onOpenRow }],
        },
      ],
      bulk: {
        actions: [
          {
            id: 'start-onboarding',
            label: 'Start onboarding',
            icon: UserCheck,
            slot: 'primary',
            onClick: h.onBulkStartOnboarding,
          },
          email,
          { id: 'add-tag', label: 'Add tag', slot: 'overflow', onClick: h.onBulkAddTag },
          { id: 'export', label: 'Export', slot: 'overflow', onClick: h.onBulkExport },
        ],
      },
      empty: {
        illustration: <SoftCaughtUp />,
        title: 'Nobody hired yet',
        body: 'Accepted offers move here with their onboarding checklist attached.',
      },
    }
  }

  return {
    grid: '28px minmax(0,1.9fr) 92px minmax(0,1.05fr) 116px minmax(0,1.4fr) 132px 64px',
    columns: [
      nameCol,
      matchCol,
      col('reached', 'Reached', (r) => <PSText tone="muted">{r.reachedLabel}</PSText>),
      col('rejected', 'Rejected', (r) => <PSText tone="muted">{r.rejectedLabel}</PSText>),
      col('reason', 'Reason', (r) => <PSStatus value={r.status} />),
      ownerCol('Decided by'),
    ],
    actions: [
      {
        id: 'move-job',
        label: 'Move to another job',
        icon: GitBranch,
        kind: 'outlined',
        onClick: h.onMoveToJob,
      },
      {
        id: 'more',
        label: 'More',
        kind: 'bare',
        items: [{ id: 'open', label: 'Open profile', onClick: h.onOpenRow }],
      },
    ],
    bulk: {
      actions: [
        {
          id: 'move-job',
          label: 'Move to another job',
          icon: GitBranch,
          slot: 'primary',
          onClick: h.onBulkMoveToJob,
        },
        email,
        { id: 'talent-pool', label: 'Add to talent pool', slot: 'overflow', onClick: h.onBulkTalentPool },
        { id: 'export', label: 'Export', slot: 'overflow', onClick: h.onBulkExport },
        { id: 'delete', label: 'Delete', slot: 'overflow', destructive: true, onClick: h.onBulkDelete },
      ],
    },
    empty: {
      illustration: <SoftArchive />,
      title: 'Nobody rejected yet',
      body:
        'Rejected and withdrawn candidates stay here with the reason attached — so a future role can start from what you already learned.',
    },
  }
}
