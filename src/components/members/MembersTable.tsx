import { useState, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { TableFilteredEmpty } from '@/components/ui/table-states'
import { SoftPeople } from '@/components/ui/EmptyIllustrations'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { Input } from '@/components/ui/input'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { Member } from '@/hooks/useMembers'
import { MemberDetailSheet } from '@/components/members/MemberDetailSheet'
import { MoreVertical, Plus, Send, UserCheck, UserX, UserPlus, Trash2, Copy, Briefcase, Mail, MailX, Clock, Search } from 'lucide-react'

export interface EnrichedMember extends Member {
  seatType?: 'paid' | 'free'
  effectiveRole?: 'Owner' | 'Admin' | 'Sales' | 'Recruiter' | 'Hiring Manager' | 'Interviewer'
}

interface MembersTableProps {
  members: EnrichedMember[]
  isLoading: boolean
  onEdit: (member: EnrichedMember) => void
  onDeactivate: (id: string) => void
  onResendInvitation: (memberId: string, email: string) => void
  onDeleteUser: (member: EnrichedMember) => void
  onManageJobAssignments?: (member: EnrichedMember) => void
  onAddNew?: () => void
}

const getRoleBadgeVariant = (role?: EnrichedMember['effectiveRole']) => {
  switch (role) {
    case 'Owner': return 'role-owner' as const
    case 'Admin': return 'role-admin' as const
    case 'Sales': return 'purple' as const
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

export function MembersTable({
  members,
  isLoading,
  onEdit,
  onDeactivate,
  onResendInvitation,
  onDeleteUser,
  onManageJobAssignments,
  onAddNew
}: MembersTableProps) {
  const [copyingInvite, setCopyingInvite] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [seatFilter, setSeatFilter] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailMember, setDetailMember] = useState<EnrichedMember | null>(null)

  const hasActiveFilters = searchTerm || roleFilter.length > 0 || statusFilter.length > 0 || seatFilter.length > 0

  const clearFilters = () => {
    setSearchTerm('')
    setRoleFilter([])
    setStatusFilter([])
    setSeatFilter([])
  }

  const seatOptions = useMemo(() => [
    { value: 'paid', label: 'Paid', count: members.filter(m => m.seatType === 'paid').length },
    { value: 'free', label: 'Free', count: members.filter(m => m.seatType === 'free').length },
  ], [members])

  const roleOptions = useMemo(() => {
    const roles: EnrichedMember['effectiveRole'][] = ['Owner', 'Admin', 'Sales', 'Recruiter', 'Hiring Manager', 'Interviewer']
    return roles.map(r => ({ value: r!, label: r!, count: members.filter(m => m.effectiveRole === r).length })).filter(o => o.count > 0)
  }, [members])

  const statusOptions = useMemo(() => [
    { value: 'active', label: 'Active', count: members.filter(m => m.user_status === 'active').length },
    { value: 'invited', label: 'Invited', count: members.filter(m => m.user_status === 'invited').length },
    { value: 'inactive', label: 'Inactive', count: members.filter(m => m.user_status === 'inactive').length },
  ].filter(o => o.count > 0), [members])

  const getDisplayName = (member: EnrichedMember) => {
    if (member.user_first_name && member.user_last_name)
      return `${member.user_first_name} ${member.user_last_name}`
    if (member.user_first_name) return member.user_first_name
    return member.user_email || member.invited_email || 'Unknown User'
  }

  const getDisplayEmail = (member: EnrichedMember) => {
    return member.user_email || member.invited_email || 'No email available'
  }

  const getEmailStatusIndicator = (member: EnrichedMember) => {
    if (member.user_status !== 'invited') return null
    switch (member.invitation_email_status) {
      case 'sent':
      case 'delivered':
        return <span title="Email sent successfully" className="ml-1"><Mail className="inline h-3.5 w-3.5 text-emerald-600" /></span>
      case 'failed':
      case 'bounced':
        return <span title={`Email failed: ${member.invitation_email_error || 'Unknown error'}`} className="ml-1"><MailX className="inline h-3.5 w-3.5 text-destructive" /></span>
      case 'pending':
      default:
        return <span title="Email pending" className="ml-1"><Clock className="inline h-3.5 w-3.5 text-amber-500" /></span>
    }
  }

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const name = getDisplayName(m).toLowerCase()
      const email = (m.user_email || m.invited_email || '').toLowerCase()
      const term = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || name.includes(term) || email.includes(term)
      const matchesRole = roleFilter.length === 0 || roleFilter.includes(m.effectiveRole || (m.system_role === 'admin' ? 'Admin' : 'Hiring Manager'))
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(m.user_status)
      const matchesSeat = seatFilter.length === 0 || (m.seatType && seatFilter.includes(m.seatType))
      return matchesSearch && matchesRole && matchesStatus && matchesSeat
    })
  }, [members, searchTerm, roleFilter, statusFilter, seatFilter])

  // Selection logic
  const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.includes(m.id))
  const someFilteredSelected = filteredMembers.some(m => selectedIds.includes(m.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredMembers.find(m => m.id === id)))
    } else {
      const newIds = filteredMembers.map(m => m.id)
      setSelectedIds(prev => [...new Set([...prev, ...newIds])])
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const copyInviteLink = async (member: EnrichedMember) => {
    if (!member.invite_token) {
      toast({ title: 'Error', description: 'No invitation token found. Please resend the invitation first.', variant: 'destructive' })
      return
    }
    setCopyingInvite(member.id)
    try {
      const inviteUrl = `${window.location.origin}/accept-invite/${member.invite_token}`
      await navigator.clipboard.writeText(inviteUrl)
      toast({ title: 'Success', description: 'Invitation link copied to clipboard' })
    } catch (error) {
      console.error('Failed to copy invite link:', error)
      toast({ title: 'Error', description: 'Failed to copy invitation link', variant: 'destructive' })
    } finally {
      setCopyingInvite(null)
    }
  }

  const handleResendInvitation = async (member: EnrichedMember) => {
    const email = member.user_email || member.invited_email
    if (!email) {
      toast({ title: 'Error', description: 'No email address found for this member', variant: 'destructive' })
      return
    }
    try { await onResendInvitation(member.id, email) } catch (error) { console.error('Failed to resend invitation:', error) }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Team Members</CardTitle>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent><TableSkeleton rows={5} /></CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <CardTitle>Team members</CardTitle>
              <p className="font-inter text-[13px] text-muted-foreground">
                Paid seats: admins, owners &amp; recruiters. Hiring managers and interviewers are free.
              </p>
            </div>
            {onAddNew && (
              <Button onClick={onAddNew} variant="secondary" className="hidden sm:inline-flex gap-2 shrink-0">
                <UserPlus className="h-4 w-4" />
                Add member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {members.length === 0 ? (
            <EmptyState
              size="card"
              illustration={<SoftPeople />}
              title="No team members yet"
              body="Invite your first team member to start collaborating."
              primary={onAddNew ? (
                <EmptyAction icon={<Plus size={16} strokeWidth={2} />} onClick={onAddNew}>
                  Add member
                </EmptyAction>
              ) : undefined}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {members.map((member) => {
                const isInactive = member.user_status === 'inactive'
                const isInvited = member.user_status === 'invited'
                const statusLabel = isInactive ? 'Inactive' : isInvited ? 'Invited' : 'Active'
                return (
                  <li
                    key={member.id}
                    className={`flex items-center gap-3 py-3 px-1 cursor-pointer hover:bg-muted/40 rounded-md transition-colors ${isInactive ? 'opacity-60' : ''}`}
                    onClick={() => setDetailMember(member)}
                  >
                    <Avatar className={`h-9 w-9 shrink-0 ${isInactive ? 'grayscale' : ''}`}>
                      {member.user_avatar_url && <AvatarImage src={member.user_avatar_url} alt={getDisplayName(member)} />}
                      <AvatarFallback className={`${isInactive ? 'bg-muted text-muted-foreground' : getAvatarColor(member)} text-xs font-semibold`}>
                        {getInitials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-poppins font-semibold text-[14px] text-foreground truncate">
                        {isInvited ? getDisplayEmail(member) : getDisplayName(member)}
                      </div>
                      <div className="font-inter text-[12.5px] text-muted-foreground truncate">
                        {isInvited ? (
                          <span className="italic">Invite pending</span>
                        ) : (
                          getDisplayEmail(member)
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={isInactive ? 'secondary' : getRoleBadgeVariant(member.effectiveRole)}>
                        {member.effectiveRole || (member.system_role === 'admin' ? 'Admin' : 'Member')}
                      </Badge>
                      {member.seatType && (
                        <Badge variant={member.seatType === 'paid' ? 'seat-paid' : 'seat-free'}>
                          {member.seatType === 'paid' ? 'Paid' : 'Free'}
                        </Badge>
                      )}
                      <Badge variant={getStatusBadgeVariant(member.user_status)}>
                        {statusLabel}
                      </Badge>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(member)}>Edit Member</DropdownMenuItem>
                            {onManageJobAssignments && member.user_status === 'active' && (
                              <DropdownMenuItem onClick={() => onManageJobAssignments(member)} className="gap-2">
                                <Briefcase className="h-4 w-4" />Manage Job Access
                              </DropdownMenuItem>
                            )}
                            {member.user_status === 'invited' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleResendInvitation(member)} className="gap-2">
                                  <Send className="h-4 w-4" />Resend Invitation
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInviteLink(member)} disabled={copyingInvite === member.id} className="gap-2">
                                  <Copy className="h-4 w-4" />{copyingInvite === member.id ? 'Copying...' : 'Copy Invite Link'}
                                </DropdownMenuItem>
                              </>
                            )}
                            {member.user_status === 'active' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onDeactivate(member.id)} className="gap-2">
                                  <UserX className="h-4 w-4" />Deactivate Member
                                </DropdownMenuItem>
                              </>
                            )}
                            {member.user_status === 'inactive' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onEdit(member)} className="gap-2">
                                  <UserCheck className="h-4 w-4" />Reactivate Member
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDeleteUser(member)} className="gap-2 text-destructive">
                              <Trash2 className="h-4 w-4" />Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>


      <MemberDetailSheet
        member={detailMember}
        open={!!detailMember}
        onOpenChange={(open) => { if (!open) setDetailMember(null) }}
        onManageJobs={detailMember && onManageJobAssignments ? () => onManageJobAssignments(detailMember) : undefined}
      />
    </>
  )
}
