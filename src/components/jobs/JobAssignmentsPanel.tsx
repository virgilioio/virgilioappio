
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FormField } from '@/components/ui/form-field'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { User, UserMinus, Search } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface JobAssignmentsPanelProps {
  jobId: string
  jobTitle: string
}

export function JobAssignmentsPanel({ jobId, jobTitle }: JobAssignmentsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const { assignments, assignUserToJob, removeUserFromJob, isLoading: assignmentsLoading } = useJobAssignments(jobId)
  const { members, isLoading: membersLoading } = useMembers()
  const permissions = usePermissions()

  // Security check - only platform admins and customer success can access
  if (!permissions.isPlatformAdmin && !['admin', 'customer_success'].includes(permissions.isClient ? '' : 'admin')) {
    return (
      <div className="p-6 text-center">
        <p className="text-text-secondary">You don't have permission to manage job assignments.</p>
      </div>
    )
  }

  const assignedUserIds = new Set(assignments.map(a => a.user_id))
  
  // Filter members based on search term
  const filteredMembers = members.filter(member => {
    if (!member.user_id) return false // Skip invited members
    
    const searchLower = searchTerm.toLowerCase()
    const firstName = member.user_first_name || ''
    const lastName = member.user_last_name || ''
    const email = member.invited_email || ''
    const fullName = `${firstName} ${lastName}`.trim()
    
    return (
      fullName.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      member.member_role.toLowerCase().includes(searchLower)
    )
  })

  const handleAssignUser = async (userId: string, organizationId: string) => {
    try {
      await assignUserToJob({
        job_id: jobId,
        user_id: userId,
        organization_id: organizationId
      })
    } catch (error) {
      console.error('Failed to assign user:', error)
    }
  }

  const handleUnassignUser = async (userId: string) => {
    const assignment = assignments.find(a => a.user_id === userId)
    if (!assignment) return

    if (confirm('Are you sure you want to remove this user from the job?')) {
      try {
        await removeUserFromJob(assignment.id)
      } catch (error) {
        console.error('Failed to unassign user:', error)
      }
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'recruiter': return 'default'
      case 'client': return 'secondary'
      case 'billing': return 'outline'
      default: return 'secondary'
    }
  }

  if (membersLoading || assignmentsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Job Assignments</h2>
        <p className="text-sm text-text-secondary">
          Manage which users can access "{jobTitle}" and its candidates.
        </p>
      </div>

      {/* Search */}
      <FormField label="Search users">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary h-4 w-4" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </FormField>

      {/* Members Table */}
      <div className="border border-border rounded-brand overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assignment Status</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-text-secondary">
                  {searchTerm ? 'No users match your search criteria.' : 'No users found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const isAssigned = member.user_id && assignedUserIds.has(member.user_id)
                const firstName = member.user_first_name || ''
                const lastName = member.user_last_name || ''
                const displayName = `${firstName} ${lastName}`.trim() || 'Unnamed User'
                const email = member.invited_email || 'No email'

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-text-primary">{displayName}</div>
                        <div className="text-sm text-text-secondary">{email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.member_role)}>
                        {member.member_role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isAssigned ? 'default' : 'secondary'}>
                        {isAssigned ? 'Assigned' : 'Not Assigned'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.user_id && (
                        <div className="flex gap-2">
                          {isAssigned ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnassignUser(member.user_id!)}
                              disabled={assignmentsLoading}
                              className="gap-1"
                            >
                              <UserMinus className="h-3 w-3" />
                              Unassign
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAssignUser(member.user_id!, member.organization_id)}
                              disabled={assignmentsLoading}
                              className="gap-1"
                            >
                              <User className="h-3 w-3" />
                              Assign
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assignment Summary */}
      <div className="bg-surface-primary border border-border rounded-brand p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            Total Users: {filteredMembers.length}
          </span>
          <span className="text-text-secondary">
            Assigned: {assignments.length}
          </span>
        </div>
      </div>
    </div>
  )
}
