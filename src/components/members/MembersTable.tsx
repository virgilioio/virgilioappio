
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { Member } from '@/hooks/useMembers'
import { MoreVertical, Plus, Send, UserCheck, UserX, Trash2, Copy } from 'lucide-react'

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  onEdit: (member: Member) => void
  onDeactivate: (id: string) => void
  onResendInvitation: (memberId: string, email: string) => void
  onDeleteUser: (member: Member) => void
  onAddNew?: () => void
}

export function MembersTable({
  members,
  isLoading,
  onEdit,
  onDeactivate,
  onResendInvitation,
  onDeleteUser,
  onAddNew
}: MembersTableProps) {
  const [copyingInvite, setCopyingInvite] = useState<string | null>(null)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive'
      case 'recruiter':
        return 'bg-primary/10 text-primary'
      case 'customer_success':
        return 'bg-accent/10 text-accent'
      case 'billing':
        return 'bg-secondary/10 text-secondary'
      case 'sales':
        return 'bg-success/10 text-success'
      case 'client':
        return 'bg-warning/10 text-warning'
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

  const getDisplayName = (member: Member) => {
    if (member.user_first_name && member.user_last_name) {
      return `${member.user_first_name} ${member.user_last_name}`
    }
    if (member.user_first_name) {
      return member.user_first_name
    }
    return member.user_email || member.invited_email || 'Unknown User'
  }

  const getDisplayEmail = (member: Member) => {
    // Show email even for active users now (since we preserve invited_email)
    return member.user_email || member.invited_email || 'No email available'
  }

  const copyInviteLink = async (memberId: string) => {
    if (!window.location) return
    
    setCopyingInvite(memberId)
    try {
      // Generate invite URL using current domain
      const baseUrl = window.location.origin
      const inviteUrl = `${baseUrl}/accept-invite/${memberId}`
      
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
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
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
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No team members found</p>
            {onAddNew && (
              <Button onClick={onAddNew} variant="outline">
                Add your first team member
              </Button>
            )}
          </div>
        ) : (
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
                {members.map((member) => (
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
                      <Badge className={getRoleColor(member.member_role)}>
                        {member.member_role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(member.user_status)}>
                        {member.user_status}
                      </Badge>
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
                                onClick={() => copyInviteLink(member.id)}
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
        )}
      </CardContent>
    </Card>
  )
}
