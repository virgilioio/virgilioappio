
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { MembersTable } from '@/components/members/MembersTable'
import { InviteSystemDebug } from '@/components/debug/InviteSystemDebug'
import { useMembers } from '@/hooks/useMembers'
import { useState } from 'react'
import { MemberForm } from '@/components/members/MemberForm'

export function MembersTab() {
  const { members, isLoading, updateMember, deactivateMember, createMember, resendInvitation } = useMembers()
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
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Manage your organization's team members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable 
            members={members}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onCreateNew={handleCreateNew}
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
