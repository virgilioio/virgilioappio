
import { Card, CardContent } from '@/components/ui/card'
import { MembersTable } from '@/components/members/MembersTable'
import { useMembers } from '@/hooks/useMembers'
import { useState } from 'react'
import { MemberForm } from '@/components/members/MemberForm'
import { UserDeletionDialog } from '@/components/organizations/UserDeletionDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useTenantSubscription } from '@/hooks/useTenantSubscription'
import { addMonths, addYears, format } from 'date-fns'

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

  const { data: subscriptionData } = useTenantSubscription()
  const subscription = subscriptionData?.subscription || null
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

        <Card>
          <CardContent className="py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-brand border border-border/50 bg-surface-secondary/40 p-4 shadow-[var(--shadow-xs)]">
                <div className="text-text-secondary text-sm">Paid Seats</div>
                <div className="text-3xl font-semibold text-text-primary mt-1">{paidMembers.length}</div>
                <div className="text-xs text-text-tertiary mt-1">Admins, Recruiters, Sales, CS, Billing, Owner</div>
              </div>
              <div className="rounded-brand border border-border/50 bg-surface-secondary/40 p-4 shadow-[var(--shadow-xs)]">
                <div className="text-text-secondary text-sm">Guests</div>
                <div className="text-3xl font-semibold text-text-primary mt-1">{guestMembers.length}</div>
                <div className="text-xs text-text-tertiary mt-1">Clients (non-billing)</div>
              </div>
              <div className="rounded-brand border border-border/50 bg-surface-secondary/40 p-4 shadow-[var(--shadow-xs)]">
                <div className="text-text-secondary text-sm">Next Billing</div>
                <div className="text-3xl font-semibold text-text-primary mt-1">{nextBillingLabel}</div>
                <div className="text-xs text-text-tertiary mt-1">Based on subscription start date</div>
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
