import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { Member } from '@/hooks/useMembers'
import { MoreVertical, Plus, Send, UserCheck, UserX, Trash2, Copy, Briefcase, Mail, MailX, Clock, Search, X } from 'lucide-react'

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  onEdit: (member: Member) => void
  onDeactivate: (id: string) => void
  onResendInvitation: (memberId: string, email: string) => void
  onDeleteUser: (member: Member) => void
  onManageJobAssignments?: (member: Member) => void
  onAddNew?: () => void
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
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const hasActiveFilters = searchTerm || roleFilter !== 'all' || statusFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setStatusFilter('all')
  }
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive'
      case 'member':
        return 'bg-primary/10 text-primary'
      default:
        return 'bg-muted/10 text-muted-foreground'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success'
      case 'invited':
        return 'bg-warning/10 text-warning'
      case 'inactive':
        return 'bg-muted/10 text-muted-foreground'
      default:
        return 'bg-muted/10 text-muted-foreground'
    }
  }

  // P1: Get email delivery status icon for invited members
  const getEmailStatusIndicator = (member: Member) => {
    if (member.user_status !== 'invited') return null;
    
    switch (member.invitation_email_status) {
      case 'sent':
      case 'delivered':
        return (
          <span title="Email sent successfully" className="ml-1">
            <Mail className="inline h-3.5 w-3.5 text-success" />
          </span>
        );
      case 'failed':
      case 'bounced':
        return (
          <span title={`Email failed: ${member.invitation_email_error || 'Unknown error'}`} className="ml-1">
            <MailX className="inline h-3.5 w-3.5 text-destructive" />
          </span>
        );
      case 'pending':
      default:
        return (
          <span title="Email pending" className="ml-1">
            <Clock className="inline h-3.5 w-3.5 text-warning" />
          </span>
        );
    }
  }

  const getDisplayName = (member: Member) => {
    if (member.user_first_name && member.user_last_name) {
      return `${member.user_first_name} ${member.user_last_name}`
    }
    if (member.user_first_name) {
      return member.user_first_name
    }
    return member.user_email || member.invited_email || 'Unknown User'
  }

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const name = getDisplayName(m).toLowerCase()
      const email = (m.user_email || m.invited_email || '').toLowerCase()
      const term = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || name.includes(term) || email.includes(term)
      const matchesRole = roleFilter === 'all' || m.system_role === roleFilter
      const matchesStatus = statusFilter === 'all' || m.user_status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [members, searchTerm, roleFilter, statusFilter])

  const getDisplayEmail = (member: Member) => {
    // Show email even for active users now (since we preserve invited_email)
    return member.user_email || member.invited_email || 'No email available'
  }

  const copyInviteLink = async (member: Member) => {
    if (!window.location) return
    
    // Validate that the member has a valid invite token
    if (!member.invite_token) {
      toast({
        title: 'Error',
        description: 'No invitation token found. Please resend the invitation first.',
        variant: 'destructive'
      })
      return
    }
    
    setCopyingInvite(member.id)
    try {
      // Generate invite URL using the INVITE TOKEN (not member ID)
      const baseUrl = window.location.origin
      const inviteUrl = `${baseUrl}/accept-invite/${member.invite_token}`
      
      await navigator.clipboard.writeText(inviteUrl)
      toast({
        title: 'Success',
        description: 'Invitation link copied to clipboard'
      })
    } catch (error) {
      console.error('Failed to copy invite link:', error)
      toast({
        title: 'Error',
        description: 'Failed to copy invitation link',
        variant: 'destructive'
      })
    } finally {
      setCopyingInvite(null)
    }
  }

  const handleResendInvitation = async (member: Member) => {
    const email = member.user_email || member.invited_email
    if (!email) {
      toast({
        title: 'Error',
        description: 'No email address found for this member',
        variant: 'destructive'
      })
      return
    }
    
    try {
      await onResendInvitation(member.id, email)
    } catch (error) {
      console.error('Failed to resend invitation:', error)
    }
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
        <CardContent>
          <TableSkeleton rows={5} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Team Members</CardTitle>
          {onAddNew && (
            <Button onClick={onAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            assetType="empty-state-members"
            title="No team members yet"
            description="Invite your first team member to start collaborating"
            fallbackIcon={UserCheck}
            action={onAddNew ? {
              label: "Add Member",
              onClick: onAddNew
            } : undefined}
          />
        ) : (
          <>
            {/* Toolbar: Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="invited">Invited</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Result count */}
            <p className="text-xs text-muted-foreground mb-3">
              Showing {filteredMembers.length} of {members.length} members
            </p>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No members match your filters
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {getDisplayName(member)}
                    </TableCell>
                    <TableCell>
                      <span className={member.user_status === 'invited' ? 'text-muted-foreground italic' : ''}>
                        {getDisplayEmail(member)}
                        {member.user_status === 'invited' && (
                          <span className="ml-2 text-xs text-muted-foreground">(pending)</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(member.system_role)}>
                        {member.system_role === 'admin' ? 'Admin' : 'Member'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={getStatusColor(member.user_status)}>
                          {member.user_status}
                        </Badge>
                        {getEmailStatusIndicator(member)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {member.organization_name || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(member)}>
                            Edit Member
                          </DropdownMenuItem>
                          
                          {/* Job Assignments - any active member can have job assignments */}
                          {onManageJobAssignments && 
                           member.user_status === 'active' && (
                            <DropdownMenuItem 
                              onClick={() => onManageJobAssignments(member)}
                              className="gap-2"
                            >
                              <Briefcase className="h-4 w-4" />
                              Manage Job Access
                            </DropdownMenuItem>
                          )}
                          
                          {member.user_status === 'invited' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleResendInvitation(member)}
                                className="gap-2"
                              >
                                <Send className="h-4 w-4" />
                                Resend Invitation
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => copyInviteLink(member)}
                                disabled={copyingInvite === member.id}
                                className="gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                {copyingInvite === member.id ? 'Copying...' : 'Copy Invite Link'}
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {member.user_status === 'active' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => onDeactivate(member.id)}
                                className="gap-2"
                              >
                                <UserX className="h-4 w-4" />
                                Deactivate Member
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {member.user_status === 'inactive' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => onEdit(member)}
                                className="gap-2"
                              >
                                <UserCheck className="h-4 w-4" />
                                Reactivate Member
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onDeleteUser(member)}
                            className="gap-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
