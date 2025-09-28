
import { Card, CardContent } from '@/components/ui/card'
import { MembersTable } from '@/components/members/MembersTable'
import { useMembers } from '@/hooks/useMembers'
import { useState } from 'react'
import { MemberInviteSheet } from '@/components/members/MemberInviteSheet'
import { usePermissions } from '@/hooks/usePermissions'
import { UserDeletionDialog } from '@/components/organizations/UserDeletionDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
// Tenant subscription functionality removed
import { addMonths, addYears, format } from 'date-fns'

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

  const isPayingRole = (r: 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer') =>
    r === 'admin' || r === 'recruiter'

  const [tab, setTab] = useState<'members' | 'guests'>('members')

  const paidMembers = members.filter(
    (m) => (isPayingRole(m.member_role) || m.user_type === 'workspace_owner') && (!parentOrgId || m.organization_id === parentOrgId)
  )
  const guestMembers = members.filter((m) => m.member_role === 'hiring_manager' || m.member_role === 'interviewer')

  // Tenant subscription functionality removed
  const subscriptionData = null
  const subscription = null
  const nextBillingDate = (() => {
    if (!subscription?.created_at) return null
    const start = new Date(subscription.created_at)
    const interval = subscription.billing_interval || 'month'
    let next = new Date(start)
    const now = new Date()
    while (next <= now) {
      next = interval === 'year' ? addYears(next, 1) : addMonths(next, 1)
    }
    return next
  })()
  const nextBillingLabel = nextBillingDate ? format(nextBillingDate, 'PPP') : '—'

  const handleEdit = (member) => {
    setEditingMember(member)
  }

  const handleDeactivate = async (id) => {
    await deactivateMember(id)
  }

  const handleCreateNew = () => {
    // Use new invite sheet for inviting members
    setIsInviteSheetOpen(true)
  }


  const handleInviteSubmit = async (data) => {
    const result = await createMember(data)
    // Check if the result has inviteUrl property (successful invitation)
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
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'members' | 'guests')} className="w-full">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Next Billing - Purple */}
              <div className="rounded-brand border border-pastel-purple/50 bg-pastel-purple/40 p-4 shadow-[var(--shadow-xs)]">
                <div className="text-sm text-pastel-purple-foreground/80">Next Billing</div>
                <div className="text-3xl font-semibold text-pastel-purple-foreground mt-1">{nextBillingLabel}</div>
                
              </div>
              {/* Paid Seats - Purple */}
              <div className="rounded-brand border border-pastel-purple/50 bg-pastel-purple/40 p-4 shadow-[var(--shadow-xs)]">
                <div className="text-sm text-pastel-purple-foreground/80">Paid Seats</div>
                <div className="text-3xl font-semibold text-pastel-purple-foreground mt-1">{paidMembers.length}</div>
                
              </div>
              {/* Guests - Blue */}
              <div className="rounded-brand border border-pastel-blue/50 bg-pastel-blue/40 p-4 shadow-[var(--shadow-xs)]">
                <div className="text-sm text-pastel-blue-foreground/80">Guests</div>
                <div className="text-3xl font-semibold text-pastel-blue-foreground mt-1">{guestMembers.length}</div>
                
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="members">
          <MembersTable 
            members={paidMembers}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onResendInvitation={handleResendInvitation}
            onDeleteUser={handleDeleteUser}
            onAddNew={permissions.canCreateMembers ? handleCreateNew : undefined}
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
            onAddNew={permissions.canCreateMembers ? handleCreateNew : undefined}
          />
        </TabsContent>
      </Tabs>


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
