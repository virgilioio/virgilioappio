import { ReactNode } from 'react'
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  Globe,
  FileText,
  Users,
  CheckCircle2,
  Activity,
  Clock,
  Sparkles,
  ArrowRightLeft,
  Plus,
  Upload,
  Send,
  Star,
  Inbox,
  XCircle,
} from 'lucide-react'
import { ProfileSidebar, SidebarBlock, MetaRow, LinkRow } from '../primitives/ProfileSidebar'
import { ProfileQuickActionsCard } from '../ProfileQuickActionsCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatSalaryExpectation } from '@/lib/candidateHelpers'

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

function LinksBlock({ urls }: { urls: { label: string; url: string }[] }) {
  if (!urls.length) {
    return (
      <SidebarBlock label="Links">
        <div className="font-inter text-[12px] text-[#8B8F9E]">—</div>
      </SidebarBlock>
    )
  }
  return (
    <SidebarBlock label="Links">
      <div>
        {urls.map((u) => (
          <LinkRow key={u.url} icon={Globe} label={u.label} url={u.url} />
        ))}
      </div>
    </SidebarBlock>
  )
}

function FilesBlock({
  count,
  onUpload,
  children,
}: {
  count: number
  onUpload?: () => void
  children?: ReactNode
}) {
  return (
    <SidebarBlock
      label={`Files (${count})`}
      action={
        onUpload && (
          <Button variant="ghost" size="xs" icon={Upload} onClick={onUpload}>
            Upload
          </Button>
        )
      }
    >
      <div className="space-y-2">
        {children || <div className="font-inter text-[12px] text-[#8B8F9E]">No files</div>}
      </div>
    </SidebarBlock>
  )
}

/* ------------------------------------------------------------------ */
/* Per-tab sidebars                                                    */
/* ------------------------------------------------------------------ */

export interface JobOverviewSidebarProps {
  candidate: any
  job: any
  appliedAt?: string | null
  source?: string | null
  urls: { label: string; url: string }[]
  filesCount: number
  fileSlots?: ReactNode
  onUploadFile?: () => void
  // QuickActions
  nextStageLabel: string | null
  onAdvance: () => void
  onSubmitScorecard: () => void
  onAddTransfer: () => void
  onCreateOffer: () => void
  onReject: () => void
  isOfferStatus: boolean
  isRejected: boolean
  isHired: boolean
}
export function JobOverviewSidebar(p: JobOverviewSidebarProps) {
  const comp = formatSalaryExpectation(p.candidate as any)
  return (
    <div className="space-y-4">
      <ProfileQuickActionsCard
        nextStageLabel={p.nextStageLabel}
        onAdvance={p.onAdvance}
        onSubmitScorecard={p.onSubmitScorecard}
        onAddTransfer={p.onAddTransfer}
        onCreateOffer={p.onCreateOffer}
        onReject={p.onReject}
        isOfferStatus={p.isOfferStatus}
        isRejected={p.isRejected}
        isHired={p.isHired}
      />
      <ProfileSidebar>
        <SidebarBlock label="Application">
          <MetaRow icon={Clock} label="Applied" value={fmtDate(p.appliedAt)} />
          <MetaRow icon={Inbox} label="Source" value={p.source ?? '—'} />
          <MetaRow icon={Briefcase} label="Comp ask" value={comp} />
          <MetaRow icon={MapPin} label="Open to" value={p.candidate?.location ?? null} />
          <MetaRow icon={CheckCircle2} label="Work auth" value={p.candidate?.work_authorization ?? null} />
        </SidebarBlock>
        <SidebarBlock label="Job information">
          <MetaRow icon={Briefcase} label="Position" value={p.job?.title ?? null} />
          <MetaRow icon={Building2} label="Department" value={p.job?.department ?? null} />
          <MetaRow icon={MapPin} label="Location" value={p.job?.location ?? null} />
          <MetaRow
            icon={Activity}
            label="Status"
            value={p.job?.status ? <Badge tone="purple" size="xs">{p.job.status}</Badge> : null}
          />
        </SidebarBlock>
        <LinksBlock urls={p.urls} />
        <FilesBlock count={p.filesCount} onUpload={p.onUploadFile}>{p.fileSlots}</FilesBlock>
      </ProfileSidebar>
    </div>
  )
}

export interface ResumeSidebarProps {
  fileName?: string | null
  fileSize?: string | null
  pages?: number | null
  uploadedAt?: string | null
  uploadedBy?: string | null
  parsedFields?: number | null
  onDownload?: () => void
  onReplace?: () => void
  onReparse?: () => void
  onDelete?: () => void
}
export function ResumeSidebar(p: ResumeSidebarProps) {
  return (
    <ProfileSidebar>
      <SidebarBlock label="File">
        <MetaRow icon={FileText} label="Name" value={p.fileName ?? null} />
        <MetaRow icon={FileText} label="Size" value={p.fileSize ?? null} />
        <MetaRow icon={FileText} label="Pages" value={p.pages ?? null} />
        <MetaRow icon={Clock} label="Uploaded" value={fmtDate(p.uploadedAt)} />
        <MetaRow icon={Users} label="By" value={p.uploadedBy ?? null} />
      </SidebarBlock>
      {typeof p.parsedFields === 'number' && p.parsedFields > 0 && (
        <SidebarBlock
          label="Parsed by Gio"
          action={
            <Badge tone="green" size="xs">
              {p.parsedFields} fields
            </Badge>
          }
        >
          <div className="font-inter text-[11.5px] text-[#5A6072]">
            Identity, Experience, Education, Skills, and Languages were extracted from this resume.
          </div>
        </SidebarBlock>
      )}
      <SidebarBlock label="Actions">
        <div className="flex flex-col gap-2">
          {p.onDownload && (
            <Button variant="primary" size="sm" onClick={p.onDownload} className="w-full justify-center">
              Download
            </Button>
          )}
          {p.onReplace && (
            <Button variant="secondary" size="sm" onClick={p.onReplace} className="w-full justify-center">
              Replace
            </Button>
          )}
          {p.onReparse && (
            <Button variant="ghost" size="sm" icon={Sparkles} onClick={p.onReparse} className="w-full justify-center">
              Re-parse with Gio
            </Button>
          )}
          {p.onDelete && (
            <Button variant="danger" size="sm" onClick={p.onDelete} className="w-full justify-center">
              Delete
            </Button>
          )}
        </div>
      </SidebarBlock>
    </ProfileSidebar>
  )
}

export interface OverviewSidebarProps {
  tags: string[]
  onAddTag?: () => void
  urls: { label: string; url: string }[]
  filesCount: number
  onUploadFile?: () => void
  fileSlots?: ReactNode
}
export function OverviewSidebar(p: OverviewSidebarProps) {
  return (
    <ProfileSidebar>
      <SidebarBlock
        label="Tags"
        action={
          p.onAddTag && (
            <Button variant="ghost" size="xs" icon={Plus} onClick={p.onAddTag}>
              Add
            </Button>
          )
        }
      >
        {p.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <Badge key={t} tone="neutral" size="xs">
                {t}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="font-inter text-[12px] text-[#8B8F9E]">No tags</div>
        )}
      </SidebarBlock>
      <LinksBlock urls={p.urls} />
      <FilesBlock count={p.filesCount} onUpload={p.onUploadFile}>{p.fileSlots}</FilesBlock>
    </ProfileSidebar>
  )
}

export interface ScorecardsSidebarProps {
  average: number | null
  panelistCount: number
  verdictBreakdown: { label: string; tone: 'green' | 'yellow' | 'red' | 'neutral'; count: number }[]
  pending: { id: string; name: string; role?: string | null; onNudge?: () => void }[]
}
export function ScorecardsSidebar(p: ScorecardsSidebarProps) {
  const total = p.verdictBreakdown.reduce((s, b) => s + b.count, 0) || 1
  return (
    <ProfileSidebar>
      <SidebarBlock label="Summary">
        <div className="flex flex-col items-center text-center py-2">
          <div className="font-poppins font-semibold text-[48px] leading-none text-emerald-600 tabular-nums">
            {p.average != null ? `${p.average.toFixed(1)}` : '—'}
            {p.average != null && <span className="text-[#8B8F9E] text-[24px]">/5</span>}
          </div>
          <div className="font-inter text-[11.5px] text-[#5A6072] mt-2">
            Across {p.panelistCount} panelist{p.panelistCount === 1 ? '' : 's'}
          </div>
          <div className="flex gap-0.5 mt-2 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-3.5 w-3.5"
                fill={p.average != null && i < Math.round(p.average) ? 'currentColor' : 'none'}
                stroke="currentColor"
              />
            ))}
          </div>
        </div>
      </SidebarBlock>
      <SidebarBlock label="Verdict distribution">
        <div className="space-y-2">
          {p.verdictBreakdown.map((b) => {
            const pct = Math.round((b.count / total) * 100)
            const fill =
              b.tone === 'green'
                ? 'bg-emerald-500'
                : b.tone === 'yellow'
                ? 'bg-amber-400'
                : b.tone === 'red'
                ? 'bg-red-500'
                : 'bg-[#8B8F9E]'
            return (
              <div key={b.label} className="flex items-center gap-2 text-[11.5px]">
                <span className="font-inter text-[#5A6072] min-w-[70px]">{b.label}</span>
                <div className="flex-1 h-1.5 bg-[#F1F0EC] rounded-full overflow-hidden">
                  <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="font-poppins text-[11px] text-[#1F2230] tabular-nums w-4 text-right">
                  {b.count}
                </span>
              </div>
            )
          })}
        </div>
      </SidebarBlock>
      {p.pending.length > 0 && (
        <SidebarBlock label="Pending">
          <div className="space-y-1.5">
            {p.pending.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 bg-[#FAFAF7] rounded-md p-2"
              >
                <div className="h-7 w-7 rounded-full bg-[#EDE4FF] text-virgilio-purple inline-flex items-center justify-center font-poppins font-semibold text-[11px] shrink-0">
                  {row.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-inter text-[12px] font-medium text-[#1F2230] truncate">{row.name}</div>
                  {row.role && (
                    <div className="font-inter text-[10.5px] text-[#8B8F9E] truncate">{row.role}</div>
                  )}
                </div>
                {row.onNudge && (
                  <Button variant="purple" size="xs" onClick={row.onNudge}>
                    Nudge
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SidebarBlock>
      )}
    </ProfileSidebar>
  )
}

export interface ActivitySidebarProps {
  counts: {
    all: number
    stageMoves: number
    scorecards: number
    emails: number
    comments: number
    files: number
  }
  filters: Record<string, boolean>
  onFilterChange: (filters: Record<string, boolean>) => void
  stats?: {
    activeDays?: number | null
    eventsLogged?: number | null
    touchesFromUs?: number | null
    lastContact?: string | null
  }
}
export function ActivitySidebar(p: ActivitySidebarProps) {
  const rows: { key: keyof typeof p.counts; label: string }[] = [
    { key: 'all', label: 'All events' },
    { key: 'stageMoves', label: 'Stage moves' },
    { key: 'scorecards', label: 'Scorecards' },
    { key: 'emails', label: 'Emails' },
    { key: 'comments', label: 'Comments' },
    { key: 'files', label: 'Files' },
  ]
  return (
    <ProfileSidebar>
      <SidebarBlock label="Filter">
        <div className="space-y-1.5">
          {rows.map(({ key, label }) => {
            const checked = p.filters[key] ?? key === 'all'
            return (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer py-1 hover:bg-[#FAFAF7] -mx-1 px-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    p.onFilterChange({ ...p.filters, [key]: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-virgilio-purple rounded"
                />
                <span className="font-inter text-[12px] text-[#1F2230] flex-1">{label}</span>
                <span className="font-inter text-[11px] text-[#8B8F9E] tabular-nums">
                  {p.counts[key]}
                </span>
              </label>
            )
          })}
        </div>
      </SidebarBlock>
      {p.stats && (
        <SidebarBlock label="Stats">
          <MetaRow label="Active" value={p.stats.activeDays != null ? `${p.stats.activeDays}d` : null} />
          <MetaRow label="Events" value={p.stats.eventsLogged ?? null} />
          <MetaRow label="Our touches" value={p.stats.touchesFromUs ?? null} />
          <MetaRow label="Last contact" value={fmtDate(p.stats.lastContact)} />
        </SidebarBlock>
      )}
    </ProfileSidebar>
  )
}

export interface EmailsSidebarProps {
  sent: number
  opened: number | null
  replied: number
  avgResponse?: string | null
  linksClicked?: number | null
  openRate?: number | null
  inboxAddress?: string | null
  inboxStatus?: 'syncing' | 'paused' | 'not_connected'
}
export function EmailsSidebar(p: EmailsSidebarProps) {
  const showEngagement = p.openRate != null
  return (
    <ProfileSidebar>
      {showEngagement && (
        <SidebarBlock label="Engagement">
          <div className="flex flex-col items-center text-center py-1">
            <div className="font-poppins font-semibold text-[36px] leading-none text-emerald-600 tabular-nums">
              {Math.round(p.openRate!)}%
            </div>
            <div className="font-inter text-[11px] text-[#5A6072] mt-1.5">
              Open rate · responds same-day
            </div>
          </div>
        </SidebarBlock>
      )}
      <SidebarBlock label="Activity">
        <MetaRow icon={Send} label="Sent" value={p.sent} />
        <MetaRow icon={Mail} label="Opened" value={p.opened ?? null} />
        <MetaRow icon={Mail} label="Replied" value={p.replied} />
        <MetaRow icon={Clock} label="Avg response" value={p.avgResponse ?? null} />
        <MetaRow icon={Globe} label="Links clicked" value={p.linksClicked ?? null} />
      </SidebarBlock>
      {p.inboxAddress && (
        <SidebarBlock label="Connected inbox">
          <div className="bg-[#FAFAF7] rounded-md p-2.5 flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-white border border-[#E7E8EE] inline-flex items-center justify-center text-[#5A6072] shrink-0">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-inter text-[12px] font-medium text-[#1F2230] truncate">
                {p.inboxAddress}
              </div>
              <div className="font-inter text-[10.5px] text-emerald-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {p.inboxStatus === 'paused'
                  ? 'Paused'
                  : p.inboxStatus === 'not_connected'
                  ? 'Not connected'
                  : 'Syncing'}
              </div>
            </div>
          </div>
        </SidebarBlock>
      )}
    </ProfileSidebar>
  )
}

export interface CommentsSidebarProps {
  mentions: { id: string; name: string; count: number }[]
  hiringTeamCount: number
}
export function CommentsSidebar(p: CommentsSidebarProps) {
  return (
    <ProfileSidebar>
      <SidebarBlock label="Mentions">
        {p.mentions.length ? (
          <div className="space-y-1.5">
            {p.mentions.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-1">
                <div className="h-7 w-7 rounded-full bg-[#EDE4FF] text-virgilio-purple inline-flex items-center justify-center font-poppins font-semibold text-[11px] shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="font-inter text-[12px] text-[#1F2230] flex-1 truncate">
                  {m.name}
                </div>
                <div className="font-inter text-[11px] text-[#8B8F9E] tabular-nums">
                  {m.count} mention{m.count === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="font-inter text-[12px] text-[#8B8F9E]">No mentions yet</div>
        )}
      </SidebarBlock>
      <SidebarBlock label="Visible to">
        <div className="bg-[#FAF8FF] border border-[#EDE4FF] rounded-md p-2.5 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-[#EDE4FF] text-virgilio-purple inline-flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="font-inter text-[12px] font-medium text-[#1F2230]">Hiring team</div>
            <div className="font-inter text-[10.5px] text-[#8B8F9E]">
              {p.hiringTeamCount} {p.hiringTeamCount === 1 ? 'person' : 'people'}
            </div>
          </div>
        </div>
      </SidebarBlock>
    </ProfileSidebar>
  )
}

/* ------------------------------------------------------------------ */

function fmtDate(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  if (diffDays < 1) return 'today'
  if (diffDays < 30) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
