import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FormField } from '@/components/ui/form-field'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { User, UserMinus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface JobAssignmentsPanelProps {
  jobId: string
  jobTitle: string
}

export function JobAssignmentsPanel({ jobId, jobTitle }: JobAssignmentsPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const { assignments, assignUserToJob, removeUserFromJob, isLoading: assignmentsLoading } = useJobAssignments(jobId)
  const { members, isLoading: membersLoading } = useMembers()
  const { organizations } = useOrganizations()
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
  
  // Get unassigned users for the dropdown
  const unassignedUsers = members.filter(member => {
    return member.user_id && !assignedUserIds.has(member.user_id)
  })

  // Create options for the searchable select with organization names
  const userOptions = unassignedUsers.map(member => {
    const firstName = member.user_first_name || ''
    const lastName = member.user_last_name || ''
    const displayName = `${firstName} ${lastName}`.trim() || 'Unnamed User'
    
    // Find the organization name
    const organization = organizations.find(org => org.id === member.organization_id)
    const organizationName = organization?.name || 'Unknown Organization'
    
    return {
      value: member.user_id!,
      label: `${displayName} - ${organizationName}`
    }
  })

  // Get assigned users with their details
  const assignedUsers = assignments.map(assignment => {
    const member = members.find(m => m.user_id === assignment.user_id)
    if (!member) return null
    
    const firstName = member.user_first_name || ''
    const lastName = member.user_last_name || ''
    const displayName = `${firstName} ${lastName}`.trim() || 'Unnamed User'
    const email = member.user_email || 'No email'
    
    return {
      assignment,
      member,
      displayName,
      email
    }
  }).filter(Boolean)

  const handleAssignUser = async () => {
    if (!selectedUserId) return

    const member = members.find(m => m.user_id === selectedUserId)
    if (!member) return

    try {
      await assignUserToJob({
        job_id: jobId,
        user_id: selectedUserId,
        organization_id: member.organization_id
      })
      setSelectedUserId('') // Clear selection after successful assignment
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

      {/* Add User Assignment Section */}
      <div className="bg-surface-primary border border-border rounded-brand p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Add User Assignment</h3>
        <div className="space-y-4">
          <FormField label="Select user to assign">
            <SearchableSelect
              options={userOptions}
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              placeholder="Search for a user to assign..."
              searchPlaceholder="Type to search users..."
              emptyMessage="No unassigned users found."
              disabled={assignmentsLoading}
            />
          </FormField>
          <Button
            onClick={handleAssignUser}
            disabled={!selectedUserId || assignmentsLoading}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Assign User
          </Button>
        </div>
      </div>

      {/* Current Assignments Section */}
      <div className="bg-surface-primary border border-border rounded-brand p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-text-primary">Current Assignments</h3>
          <Badge variant="secondary">
            {assignments.length} assigned
          </Badge>
        </div>

        {assignedUsers.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No users are currently assigned to this job.</p>
            <p className="text-sm mt-1">Use the form above to assign users.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedUsers.map((item) => {
              if (!item) return null
              
              return (
                <div key={item.assignment.id} className="flex items-center justify-between p-4 border border-border rounded-md bg-background">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium text-text-primary">{item.displayName}</div>
                      <div className="text-sm text-text-secondary">{item.email}</div>
                    </div>
                    <Badge variant={getRoleBadgeVariant(item.member.member_role)}>
                      {item.member.member_role}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnassignUser(item.member.user_id!)}
                    disabled={assignmentsLoading}
                    className="gap-2"
                  >
                    <UserMinus className="h-3 w-3" />
                    Unassign
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Assignment Summary */}
      <div className="bg-surface-primary border border-border rounded-brand p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            Available Users: {unassignedUsers.length}
          </span>
          <span className="text-text-secondary">
            Assigned Users: {assignments.length}
          </span>
        </div>
      </div>
    </div>
  )
}
