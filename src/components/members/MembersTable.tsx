import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit, UserMinus, MoreHorizontal, Mail, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Member } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  onEdit: (member: Member) => void
  onDeactivate: (id: string) => void
  onCreateNew: () => void
  onResendInvitation?: (memberId: string, email: string) => void
}

export function MembersTable({
  members,
  isLoading,
  onEdit,
  onDeactivate,
  onCreateNew,
  onResendInvitation
}: MembersTableProps) {
  const permissions = usePermissions()
  const [resendingId, setResendingId] = useState<string | null>(null)

  const handleResendInvitation = async (member: Member) => {
    if (!onResendInvitation || !member.invited_email) return
    
    setResendingId(member.id)
    try {
      await onResendInvitation(member.id, member.invited_email)
    } finally {
      setResendingId(null)
    }
  }

  const getMemberDisplayName = (member: Member) => {
    // For invited members, show the invited email
    if (member.user_status === 'invited' && member.invited_email) {
      return member.invited_email
    }
    
    // For active members, try to show the full name
    if (member.user_first_name && member.user_last_name) {
      return `${member.user_first_name} ${member.user_last_name}`
    }
    
    // Fall back to first name only if available
    if (member.user_first_name) {
      return member.user_first_name
    }
    
    // Fall back to email if available
    if (member.user_email) {
      return member.user_email
    }
    
    // Last resort - show invited email or indicate pending
    return member.invited_email || 'Member (Name Pending)'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'invited':
        return <Badge variant="outline" className="border-yellow-200 text-yellow-800">Invited</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    const roleColors = {
      admin: 'bg-purple-100 text-purple-800',
      recruiter: 'bg-blue-100 text-blue-800',
      customer_success: 'bg-green-100 text-green-800',
      sales: 'bg-orange-100 text-orange-800',
      billing: 'bg-gray-100 text-gray-800',
      client: 'bg-indigo-100 text-indigo-800'
    }

    return (
      <Badge 
        variant="secondary" 
        className={roleColors[role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}
      >
        {role.replace('_', ' ')}
      </Badge>
    )
  }

  const isInvitationExpired = (member: Member) => {
    if (member.user_status !== 'invited' || !member.invite_expires_at) return false
    return new Date(member.invite_expires_at) < new Date()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your organization's team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading members...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your organization's team members and their roles
            </CardDescription>
          </div>
          <Button onClick={onCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">No team members found</div>
            <Button onClick={onCreateNew} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Invite Your First Member
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isExpired = isInvitationExpired(member)
                  const displayName = getMemberDisplayName(member)
                  
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {displayName}
                            {member.user_status === 'invited' && (
                              <Mail className="inline h-3 w-3 ml-1 text-muted-foreground" />
                            )}
                          </div>
                          {member.user_status === 'invited' && member.invite_expires_at && (
                            <div className={`text-xs ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {isExpired ? 'Expired' : 'Expires'}: {new Date(member.invite_expires_at).toLocaleDateString()}
                            </div>
                          )}
                          {member.user_email && member.user_email !== displayName && (
                            <div className="text-xs text-muted-foreground">
                              {member.user_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(member.member_role)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(member.user_status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {member.organization_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(member)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            
                            {member.user_status === 'invited' && onResendInvitation && member.invited_email && (
                              <DropdownMenuItem 
                                onClick={() => handleResendInvitation(member)}
                                disabled={resendingId === member.id}
                              >
                                <RefreshCw className={`mr-2 h-4 w-4 ${resendingId === member.id ? 'animate-spin' : ''}`} />
                                {resendingId === member.id ? 'Sending...' : 'Resend Invitation'}
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => onDeactivate(member.id)}
                              className="text-red-600"
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
