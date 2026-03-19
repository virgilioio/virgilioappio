import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useMemberJobAssignments } from '@/hooks/useMemberJobAssignments'
import { EnrichedMember } from '@/components/members/MembersTable'
import { Briefcase, Calendar, Mail } from 'lucide-react'
import { format } from 'date-fns'

interface MemberDetailSheetProps {
  member: EnrichedMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getRoleBadgeVariant = (role?: string) => {
  switch (role) {
    case 'Owner': return 'role-owner' as const
    case 'Admin': return 'role-admin' as const
    case 'Recruiter': return 'role-recruiter' as const
    case 'Hiring Manager': return 'role-hiring-manager' as const
    case 'Interviewer': return 'role-interviewer' as const
    default: return 'secondary' as const
  }
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active': return 'status-active' as const
    case 'invited': return 'status-invited' as const
    case 'inactive': return 'status-inactive' as const
    default: return 'secondary' as const
  }
}

function getInitials(member: EnrichedMember) {
  const first = member.user_first_name?.[0] || ''
  const last = member.user_last_name?.[0] || ''
  if (first || last) return `${first}${last}`.toUpperCase()
  return (member.user_email || member.invited_email || '?')[0].toUpperCase()
}

function getDisplayName(member: EnrichedMember) {
  if (member.user_first_name && member.user_last_name)
    return `${member.user_first_name} ${member.user_last_name}`
  if (member.user_first_name) return member.user_first_name
  return member.user_email || member.invited_email || 'Unknown User'
}

export function MemberDetailSheet({ member, open, onOpenChange }: MemberDetailSheetProps) {
  const { data: assignments, isLoading: assignmentsLoading } = useMemberJobAssignments(member?.user_id)

  if (!member) return null

  const recruiterJobs = assignments?.filter(a => a.role === 'recruiter') || []
  const hmJobs = assignments?.filter(a => a.role === 'hiring_manager') || []
  const interviewerJobs = assignments?.filter(a => a.role === 'interviewer') || []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
                {getInitials(member)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <SheetTitle className="text-lg">{getDisplayName(member)}</SheetTitle>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {member.user_email || member.invited_email}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            <Badge variant={getRoleBadgeVariant(member.effectiveRole)}>
              {member.effectiveRole || 'Member'}
            </Badge>
            <Badge variant={member.seatType === 'paid' ? 'seat-paid' : 'seat-free'}>
              {member.seatType === 'paid' ? 'Paid Seat' : 'Free Seat'}
            </Badge>
            <Badge variant={getStatusBadgeVariant(member.user_status)}>
              {member.user_status}
            </Badge>
          </div>
        </SheetHeader>

        <Separator />

        {/* Member Info */}
        <div className="space-y-4 py-4">
          <h4 className="text-sm font-medium text-muted-foreground">Member Information</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Role</div>
              <div className="font-medium">{member.effectiveRole || 'Member'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">System Role</div>
              <div className="font-medium capitalize">{member.system_role}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Seat Type</div>
              <div className="font-medium capitalize">{member.seatType || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Joined</div>
              <div className="font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {format(new Date(member.created_at), 'PP')}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Job Assignments */}
        <div className="space-y-4 py-4">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Job Assignments
          </h4>

          {assignmentsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (!assignments || assignments.length === 0) ? (
            <p className="text-sm text-muted-foreground">No job assignments</p>
          ) : (
            <div className="space-y-4">
              {recruiterJobs.length > 0 && (
                <JobGroup label="Recruiter" variant="role-recruiter" jobs={recruiterJobs} />
              )}
              {hmJobs.length > 0 && (
                <JobGroup label="Hiring Manager" variant="role-hiring-manager" jobs={hmJobs} />
              )}
              {interviewerJobs.length > 0 && (
                <JobGroup label="Interviewer" variant="role-interviewer" jobs={interviewerJobs} />
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function JobGroup({ label, variant, jobs }: { label: string; variant: any; jobs: any[] }) {
  return (
    <div className="space-y-2">
      <Badge variant={variant} className="text-xs">{label} ({jobs.length})</Badge>
      <div className="space-y-1.5">
        {jobs.map(job => (
          <div key={job.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{job.job_title}</div>
              {job.organization_name && (
                <div className="text-xs text-muted-foreground">{job.organization_name}</div>
              )}
            </div>
            <Badge variant={job.job_status === 'published' ? 'status-active' : 'secondary'} className="text-[10px]">
              {job.job_status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
