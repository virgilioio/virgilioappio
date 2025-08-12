
import { Card, CardContent } from '@/components/ui/card'
import { MembersTable } from '@/components/members/MembersTable'
import { useMembers } from '@/hooks/useMembers'
import { useState } from 'react'
import { MemberForm } from '@/components/members/MemberForm'
import { UserDeletionDialog } from '@/components/organizations/UserDeletionDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'

export function MembersTab() {
  const { members, isLoading, updateMember, deactivateMember, createMember, resendInvitation, getMembers } = useMembers()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const { organizationId } = useAuth()
  const { organizations } = useOrganizations()

  const currentOrg = organizations.find((o) => o.id === organizationId)
  const parentOrgId = currentOrg?.parent_organization_id || organizationId

  const isPayingRole = (r: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin' | 'client') =>
    r === 'admin' || r === 'recruiter' || r === 'sales' || r === 'customer_success' || r === 'billing'

  const [tab, setTab] = useState<'members' | 'guests'>('members')

  const paidMembers = members.filter(
    (m) => (isPayingRole(m.member_role) || m.user_type === 'workspace_owner') && (!parentOrgId || m.organization_id === parentOrgId)
  )
  const guestMembers = members.filter((m) => m.member_role === 'client')

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

  const handleDeleteUser = (member) => {
    setUserToDelete({
      id: member.user_id,
      memberId: member.id,
      email: member.user_email || member.invited_email,
      firstName: member.user_first_name,
      lastName: member.user_last_name,
      userStatus: member.user_status
    })
    setIsDeleteDialogOpen(true)
  }

  const handleUserDeleted = () => {
    getMembers()
    setUserToDelete(null)
    setIsDeleteDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'members' | 'guests')} className="w-full">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <MembersTable 
            members={paidMembers}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onResendInvitation={handleResendInvitation}
            onDeleteUser={handleDeleteUser}
            onAddNew={handleCreateNew}
          />
        </TabsContent>
        <TabsContent value="guests">
          <MembersTable 
            members={guestMembers}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onResendInvitation={handleResendInvitation}
            onDeleteUser={handleDeleteUser}
            onAddNew={handleCreateNew}
          />
        </TabsContent>
      </Tabs>

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

      <UserDeletionDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        userToDelete={userToDelete}
        onUserDeleted={handleUserDeleted}
      />
    </div>
  )
}
