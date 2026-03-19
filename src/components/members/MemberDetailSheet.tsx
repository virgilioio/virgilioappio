import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { useMemberJobAssignments } from '@/hooks/useMemberJobAssignments'
import { useWouldUpgradeSeat } from '@/hooks/useWouldUpgradeSeat'
import { SeatUpgradeConfirmDialog } from '@/components/billing/SeatUpgradeConfirmDialog'
import { EnrichedMember } from '@/components/members/MembersTable'
import { Briefcase, Calendar, Mail, Trash2, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'

interface MemberDetailSheetProps {
  member: EnrichedMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onManageJobs?: () => void
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

const AVATAR_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-blue-100 text-blue-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-emerald-100 text-emerald-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
]

function getAvatarColor(member: EnrichedMember) {
  const str = member.user_id || member.id || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
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

const ROLE_OPTIONS = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'interviewer', label: 'Interviewer' },
]

export function MemberDetailSheet({ member, open, onOpenChange, onManageJobs }: MemberDetailSheetProps) {
  const { data: assignments, isLoading: assignmentsLoading } = useMemberJobAssignments(member?.user_id)
  const queryClient = useQueryClient()
  const { wouldUpgrade, paidSeatCount } = useWouldUpgradeSeat()
  const [removeTarget, setRemoveTarget] = useState<{ id: string; jobTitle: string } | null>(null)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [seatConfirm, setSeatConfirm] = useState<{ assignmentId: string; newRole: string } | null>(null)

  if (!member) return null

  const executeRoleChange = async (assignmentId: string, newRole: string) => {
    setIsUpdating(assignmentId)
    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({ role: newRole } as any)
        .eq('id', assignmentId)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['member-job-assignments', member.user_id] })
      queryClient.invalidateQueries({ queryKey: ['recruiter-user-ids'] })
      toast({ title: 'Role updated', description: `Assignment role changed to ${ROLE_OPTIONS.find(r => r.value === newRole)?.label}` })

      try {
        await supabase.functions.invoke('update-seat-quantity')
        queryClient.invalidateQueries({ queryKey: ['billing-status'] })
      } catch (e) {
        console.warn('Seat sync failed (non-fatal):', e)
      }
    } catch (err) {
      console.error('Failed to update role:', err)
      toast({ title: 'Error', description: 'Failed to update assignment role', variant: 'destructive' })
    } finally {
      setIsUpdating(null)
    }
  }

  const handleRoleChange = async (assignmentId: string, newRole: string) => {
    if (newRole === 'recruiter' && wouldUpgrade(member.user_id, member.system_role, member.user_type)) {
      setSeatConfirm({ assignmentId, newRole })
      return
    }
    await executeRoleChange(assignmentId, newRole)
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setIsUpdating(removeTarget.id)
    try {
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', removeTarget.id)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['member-job-assignments', member.user_id] })
      queryClient.invalidateQueries({ queryKey: ['recruiter-user-ids'] })
      toast({ title: 'Assignment removed', description: `Removed from ${removeTarget.jobTitle}` })

      try {
        await supabase.functions.invoke('update-seat-quantity')
        queryClient.invalidateQueries({ queryKey: ['billing-status'] })
      } catch (e) {
        console.warn('Seat sync failed (non-fatal):', e)
      }
    } catch (err) {
      console.error('Failed to remove assignment:', err)
      toast({ title: 'Error', description: 'Failed to remove assignment', variant: 'destructive' })
    } finally {
      setIsUpdating(null)
      setRemoveTarget(null)
    }
  }

  const allJobs = assignments || []

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {member.user_avatar_url && <AvatarImage src={member.user_avatar_url} alt={getDisplayName(member)} />}
                <AvatarFallback className={`${getAvatarColor(member)} text-lg font-semibold`}>
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
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Job Assignments
              </h4>
              {onManageJobs && (
                <Button variant="outline" size="sm" onClick={onManageJobs} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Manage Jobs
                </Button>
              )}
            </div>

            {assignmentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : allJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No job assignments</p>
            ) : (
              <div className="space-y-2">
                {allJobs.map(job => (
                  <div key={job.id} className="group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{job.job_title}</div>
                      {job.organization_name && (
                        <div className="text-xs text-muted-foreground">{job.organization_name}</div>
                      )}
                    </div>
                    <Select
                      value={job.role}
                      onValueChange={(val) => handleRoleChange(job.id, val)}
                      disabled={isUpdating === job.id}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                      onClick={() => setRemoveTarget({ id: job.id, jobTitle: job.job_title })}
                      disabled={isUpdating === job.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove job assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the member from <strong>{removeTarget?.jobTitle}</strong>. This may affect their seat type and billing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
