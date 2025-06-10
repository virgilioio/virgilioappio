
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { MembersTable } from '@/components/members/MembersTable'
import { useMembers } from '@/hooks/useMembers'
import { useState } from 'react'
import { MemberForm } from '@/components/members/MemberForm'

export function MembersTab() {
  const { members, isLoading, updateMember, deactivateMember, createMember } = useMembers()
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
    </>
  )
}
