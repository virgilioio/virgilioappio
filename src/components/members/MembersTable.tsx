
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Edit, UserMinus, Mail } from 'lucide-react'
import { Member } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { MemberOrgIndicator } from './MemberOrgIndicator'

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  onEdit: (member: Member) => void
  onDeactivate: (id: string) => void
  onResendInvitation: (id: string, email: string) => void
}

export function MembersTable({ 
  members, 
  isLoading, 
  onEdit, 
  onDeactivate, 
  onResendInvitation 
}: MembersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const permissions = usePermissions()

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'invited':
        return 'secondary'
      case 'inactive':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const filteredMembers = members.filter(member => {
    const email = member.invited_email || member.user_email || ''
    const firstName = member.user_first_name || ''
    const lastName = member.user_last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    
    const matchesSearch = email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fullName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || member.user_status === statusFilter
    const matchesRole = roleFilter === 'all' || member.member_role === roleFilter
    
    return matchesSearch && matchesStatus && matchesRole
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {members.length === 0 ? 'No team members found' : 'No members match your filters'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const firstName = member.user_first_name || ''
                const lastName = member.user_last_name || ''
                const fullName = `${firstName} ${lastName}`.trim()
                const displayName = fullName || member.invited_email
                
                return (
                  <TableRow key={member.id} interactive onClick={() => onEdit(member)}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{displayName}</div>
                        {fullName && member.invited_email && (
                          <div className="text-sm text-muted-foreground">{member.invited_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.organization_name && (
                        <MemberOrgIndicator 
                          organizationName={member.organization_name}
                          currentUserOrgId={member.organization_id}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.member_role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.user_status)}>
                        {member.user_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {member.user_status === 'invited' && permissions.canManageMembers && (
                          <Button variant="ghost" size="sm" onClick={(e) => { 
                            e.stopPropagation(); 
                            onResendInvitation(member.id, member.invited_email || ''); 
                          }}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canManageMembers && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(member); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canManageMembers && member.user_status !== 'inactive' && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDeactivate(member.id); }}>
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
