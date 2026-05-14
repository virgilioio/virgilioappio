import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SafeHtml } from '@/components/ui/safe-html'
import { Edit, Plus, Sparkles } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { HiringPlanTab } from './HiringPlanTab'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { usePermissions } from '@/hooks/usePermissions'

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
        {salary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-h4 font-poppins">Compensation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center pt-2 pb-1">
                <div className="font-poppins font-semibold tracking-[-0.04em] text-[28px] leading-tight text-text-primary">
                  {salary}
                </div>
                <div className="mt-1 text-body-sm text-text-secondary">
                  base · plus equity &amp; bonus
                </div>
              </div>
              <div className="rounded-lg bg-pastel-purple/30 px-3 py-2 flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-virgilio-purple mt-0.5 shrink-0" />
                <span className="text-body-sm text-text-primary">
                  Above market median for SF · 80th percentile in NYC
                </span>
              </div>
            </CardContent>
          </Card>
        )}

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
            {!assignments || assignments.length === 0 ? (
              <p className="text-body-sm text-text-secondary">No team members yet.</p>
            ) : (
              assignments.map((a: any) => {
                const profile = a.profile || a.profiles || a
                const name =
                  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
                  profile?.email ||
                  'Member'
                const role = a.role_label || a.role || a.assignment_type || ''
                return (
                  <div key={a.id || `${profile?.user_id}-${role}`} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-[11px] bg-virgilio-purple text-white">
                        {getInitials(profile?.first_name, profile?.last_name, profile?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-body-sm font-medium text-text-primary truncate">{name}</div>
                      {role && (
                        <div className="text-body-xs text-text-secondary truncate">
                          {String(role).replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
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
