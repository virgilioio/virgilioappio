import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { menuItemDanger } from '@/lib/menu-classes'
import { SafeHtml } from '@/components/ui/safe-html'
import { Edit, Plus, MoreHorizontal, Pencil, Copy, Link2, Trash2 } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { HiringPlanTab } from './HiringPlanTab'
import { usePermissions } from '@/hooks/usePermissions'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { useJobPostings } from '@/hooks/useJobPostings'
import { PostingSheet } from './postings/PostingSheet'

const ROLE_LABEL: Record<string, string> = {
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

interface JobSetupLayoutProps {
  jobId: string
  jobTitle: string
  job: any
  onEdit: () => void
  onAddTeamMember?: () => void
}

const STATUS_TONE: Record<string, 'green' | 'yellow' | 'red' | 'neutral'> = {
  open: 'green',
  draft: 'yellow',
  closed: 'red',
  archived: 'neutral',
}

function formatSalary(min: number | null, max: number | null, currency: string | null) {
  const curr = currency || 'USD'
  const symbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : `${curr} `
  const fmt = (n: number) => {
    if (n >= 1000) return `${symbol}${Math.round(n / 1000)}k`
    return `${symbol}${n.toLocaleString()}`
  }
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  if (max) return `Up to ${fmt(max)}`
  return null
}

function getInitials(first?: string | null, last?: string | null, email?: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase() || '?'
  return (email || '?').slice(0, 2).toUpperCase()
}

export function JobSetupLayout({ jobId, jobTitle, job, onEdit, onAddTeamMember }: JobSetupLayoutProps) {
  const { isAdmin, isWorkspaceOwner, isPlatformAdmin } = usePermissions()
  const isReadOnly = !(isAdmin || isWorkspaceOwner || isPlatformAdmin)

  const { assignments } = useJobAssignments(jobId)
  const { members } = useMembers(true)
  const teamMembers = assignments
    .map((a) => {
      const m = members.find((mm) => mm.user_id === a.user_id)
      if (!m) return null
      const first = m.user_first_name || ''
      const last = m.user_last_name || ''
      return {
        id: a.id,
        name: `${first} ${last}`.trim() || m.user_email || 'Member',
        roleLabel: ROLE_LABEL[a.role] || a.role,
        avatarUrl: m.user_avatar_url || null,
        first,
        last,
        email: m.user_email,
      }
    })
    .filter(Boolean) as Array<{ id: string; name: string; roleLabel: string; avatarUrl: string | null; first: string; last: string; email?: string }>

  const { postings, refetch: refetchPostings, updatePosting, duplicatePosting, deletePosting } = useJobPostings(jobId)
  const [postingSheet, setPostingSheet] = useState<{ mode: 'create' | 'edit'; postingId?: string } | null>(null)
  const { toast } = useToast()

  const handleToggleActive = async (id: string, next: boolean) => {
    await updatePosting(id, { is_active: next })
  }

  const handleCopyUrl = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`)
      toast({ title: 'Link copied', description: 'Public posting URL copied to clipboard.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy URL', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this job post? This cannot be undone.')) {
      await deletePosting(id)
    }
  }

  const status = (job?.status || 'open').toLowerCase()
  const statusTone = STATUS_TONE[status] || 'neutral'
  const posted = job?.created_at
    ? formatDistanceToNowStrict(new Date(job.created_at), { addSuffix: true })
    : null
  const targetStart = job?.target_start_date
    ? new Date(job.target_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
  const slotsTotal = job?.headcount ?? null
  const slotsFilled = job?.headcount_filled ?? null
  const salary = formatSalary(job?.salary_min, job?.salary_max, job?.currency)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-6 min-w-0">
        {/* Job description */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-h4 font-poppins">Job description</CardTitle>
            {!isReadOnly && (
              <Button variant="secondary" size="sm" icon={Edit} onClick={onEdit}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {job?.description ? (
              <SafeHtml
                content={job.description}
                className="prose prose-sm max-w-none text-text-primary
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3
                  [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
                  [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3
                  [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2
                  [&_strong]:font-semibold
                  [&_a]:text-virgilio-purple [&_a]:underline hover:[&_a]:text-virgilio-purple/80
                  [&_li]:my-1"
              />
            ) : (
              <p className="text-body-sm text-text-secondary">
                No description yet. Click Edit to add one.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Hiring stages */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-h4 font-poppins">Hiring stages</CardTitle>
          </CardHeader>
          <CardContent>
            <HiringPlanTab jobId={jobId} readOnly={isReadOnly} hideHeader />
          </CardContent>
        </Card>
      </div>

      {/* Right rail */}
      <div className="lg:col-span-1 space-y-6 min-w-0">
        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-h4 font-poppins">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              label="Status"
              value={<Badge tone={statusTone} dot size="sm">{status[0].toUpperCase() + status.slice(1)}</Badge>}
            />
            {posted && <Row label="Posted" value={<span className="text-text-primary">{posted}</span>} />}
            {targetStart && <Row label="Target start" value={<span className="text-text-primary">{targetStart}</span>} />}
            {slotsTotal != null && (
              <Row
                label="Slots"
                value={
                  <span className="text-text-primary">
                    {slotsFilled ?? 0} of {slotsTotal} filled
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Compensation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-h4 font-poppins">Compensation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {salary ? (
              <div className="text-center pt-2 pb-1">
                <div className="font-poppins font-semibold tracking-[-0.04em] text-[28px] leading-tight text-text-primary">
                  {salary}
                </div>
                <div className="mt-1 text-body-sm text-text-secondary">
                  base salary
                </div>
              </div>
            ) : (
              <div className="text-body-sm text-text-secondary">Not set</div>
            )}
          </CardContent>
        </Card>

        {/* Hiring team */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-h4 font-poppins">Hiring team</CardTitle>
            {!isReadOnly && onAddTeamMember && (
              <Button variant="ghost" size="sm" icon={Plus} onClick={onAddTeamMember}>
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {teamMembers.length === 0 ? (
              <p className="text-body-sm text-text-secondary">No team members yet.</p>
            ) : (
              teamMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-[11px] bg-virgilio-purple text-white">
                      {getInitials(m.first, m.last, m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-body-sm font-medium text-text-primary truncate">{m.name}</div>
                    <div className="text-body-xs text-text-secondary truncate">{m.roleLabel}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Job posts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-h4 font-poppins">Job posts</CardTitle>
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => setPostingSheet({ mode: 'create' })}
              >
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {postings.length === 0 ? (
              <p className="text-body-sm text-text-secondary">No job posts yet.</p>
            ) : (
              postings.map((p) => (
                <div
                  key={p.id}
                  className="group w-full flex items-center gap-2 rounded-lg px-2 py-2 -mx-2 hover:bg-[#F1F0EC] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setPostingSheet({ mode: 'edit', postingId: p.id })}
                    className="min-w-0 flex-1 text-left outline-none"
                  >
                    <div className="text-body-sm font-medium text-text-primary truncate">{p.title}</div>
                    <div className="font-mono text-[11px] text-text-secondary truncate">/{p.slug}</div>
                  </button>
                  {!isReadOnly ? (
                    <>
                      <Switch
                        checked={!!p.is_active}
                        onCheckedChange={(v) => handleToggleActive(p.id, v)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={p.is_active ? 'Deactivate posting' : 'Activate posting'}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={MoreHorizontal}
                            aria-label="Posting actions"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8}>
                          <DropdownMenuItem onSelect={() => setPostingSheet({ mode: 'edit', postingId: p.id })}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={async () => { await duplicatePosting(p.id); refetchPostings() }}>
                            <Copy className="h-3.5 w-3.5" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleCopyUrl(p.slug)}>
                            <Link2 className="h-3.5 w-3.5" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="danger" onSelect={() => handleDelete(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
                    <Badge tone={p.is_active ? 'green' : 'neutral'} dot size="sm">
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {postingSheet && (
          <PostingSheet
            jobId={jobId}
            postingId={postingSheet.postingId}
            open={!!postingSheet}
            onOpenChange={(o) => !o && setPostingSheet(null)}
            onSaved={() => {
              refetchPostings()
            }}
            defaultTitle={jobTitle}
          />
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-body-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  )
}

export default JobSetupLayout
