
import { MembersTable, EnrichedMember } from '@/components/members/MembersTable'
import { useMembers } from '@/hooks/useMembers'
import { useState, useMemo } from 'react'
import { MemberInviteSheet } from '@/components/members/MemberInviteSheet'
import { usePermissions } from '@/hooks/usePermissions'
import { UserDeletionDialog } from '@/components/organizations/UserDeletionDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useRecruiterUserIds } from '@/hooks/useRecruiterUserIds'
import { Users, UserPlus, Archive, Lock } from 'lucide-react'
import { MetricStrip, type MetricItem } from '@/components/ui/metric-strip'

export function MembersTab() {
  const { members, isLoading, updateMember, deactivateMember, createMember, resendInvitation, getMembers } = useMembers()
  const [isInviteSheetOpen, setIsInviteSheetOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [userToDelete, setUserToDelete] = useState(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const { organizationId } = useAuth()
  const { organizations } = useOrganizations()
  const permissions = usePermissions()

  const currentOrg = organizations.find((o) => o.id === organizationId)
  const parentOrgId = currentOrg?.parent_organization_id || organizationId
  const tenantId = currentOrg?.tenant_id

  const { recruiterUserIds } = useRecruiterUserIds()

  const isBillableMember = (m: any) =>
    m.system_role === 'admin'
    || m.system_role === 'sales'
    || m.user_type === 'workspace_owner'
    || (m.user_id && recruiterUserIds.has(m.user_id))

  const getEffectiveRole = (m: any): EnrichedMember['effectiveRole'] => {
    if (m.user_type === 'workspace_owner') return 'Owner'
    if (m.system_role === 'admin') return 'Admin'
    if (m.system_role === 'sales') return 'Sales'
    if (m.user_id && recruiterUserIds.has(m.user_id)) return 'Recruiter'
    return 'Hiring Manager'
  }

  const orgMembers = useMemo(() =>
    members.filter((m) => !parentOrgId || m.organization_id === parentOrgId),
    [members, parentOrgId]
  )

  const enrichedMembers: EnrichedMember[] = useMemo(() =>
    orgMembers.map(m => {
      const isInactive = m.user_status === 'inactive'
      return {
        ...m,
        seatType: isInactive ? undefined : (isBillableMember(m) ? 'paid' as const : 'free' as const),
        effectiveRole: getEffectiveRole(m),
      }
    }),
    [orgMembers, recruiterUserIds]
  )

  const activeMembers = enrichedMembers.filter(m => m.user_status !== 'inactive')
  const paidCount = activeMembers.filter(m => m.seatType === 'paid').length
  const freeCount = activeMembers.filter(m => m.seatType === 'free').length
  const deactivatedCount = enrichedMembers.filter(m => m.user_status === 'inactive').length

  // Next billing date is shown on the Billing tab — keep Members focused on seats.

  const handleEdit = (member) => {
    setEditingMember(member)
  }

  const handleDeactivate = async (id) => {
    await deactivateMember(id)
  }

  const handleCreateNew = () => {
    setIsInviteSheetOpen(true)
  }

  const handleInviteSubmit = async (data) => {
    const result = await createMember(data)
    if (!(result as any)?.inviteUrl) {
      setIsInviteSheetOpen(false)
    }
    return result
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
    <div className="space-y-4">
      <MetricStrip
        items={[
          { icon: Users, tone: 'purple', label: 'Paid seats', value: paidCount },
          { icon: UserPlus, tone: 'green', label: 'Free collaborators', value: freeCount },
          { icon: Archive, tone: 'neutral', label: 'Deactivated', value: deactivatedCount },
        ] satisfies MetricItem[]}
      />



      <MembersTable
        members={enrichedMembers}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onResendInvitation={handleResendInvitation}
        onDeleteUser={handleDeleteUser}
        onAddNew={permissions.canCreateMembers ? handleCreateNew : undefined}
      />

      <p className="flex items-center justify-center gap-1.5 font-inter pt-1" style={{ fontSize: 11, color: '#8B8F9E' }}>
        <Lock style={{ width: 11, height: 11 }} />
        Billing &amp; invoices are visible to workspace owners.
      </p>


      <MemberInviteSheet
        isOpen={isInviteSheetOpen}
        onClose={() => setIsInviteSheetOpen(false)}
        onSubmit={handleInviteSubmit}
        isLoading={isLoading}
      />

      {editingMember && (
        <MemberInviteSheet
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
