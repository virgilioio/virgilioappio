
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Plus } from 'lucide-react'
import { MembersTable } from '@/components/members/MembersTable'
import { InviteSystemDebug } from '@/components/debug/InviteSystemDebug'
import { useMembers } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { useState } from 'react'
import { MemberForm } from '@/components/members/MemberForm'

export function MembersTab() {
  const { members, isLoading, updateMember, deactivateMember, createMember, resendInvitation } = useMembers()
  const permissions = usePermissions()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)

  const handleEdit = (member) => {
    setEditingMember(member)
  }

  const handleDeactivate = async (id) => {
    await deactivateMember(id)
  }

  const handleCreateNew = () => {
    setIsCreateModalOpen(true)
  }

  const handleCreateSubmit = async (data) => {
    await createMember(data)
    setIsCreateModalOpen(false)
  }

  const handleEditSubmit = async (data) => {
    if (editingMember) {
      await updateMember(editingMember.id, data)
      setEditingMember(null)
    }
  }

  const handleResendInvitation = async (memberId: string, email: string) => {
    await resendInvitation(memberId, email)
  }

  // Show debug panel in development
  const showDebugPanel = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'

  return (
    <div className="space-y-6">
      {/* Debug Panel for Development */}
      {showDebugPanel && (
        <InviteSystemDebug />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Manage your organization's team members and their roles
              </CardDescription>
            </div>
            {permissions.canManageMembers && (
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MembersTable 
            members={members}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onResendInvitation={handleResendInvitation}
          />
        </CardContent>
      </Card>

      <MemberForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={isLoading}
      />

      {editingMember && (
        <MemberForm
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          onSubmit={handleEditSubmit}
          member={editingMember}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
