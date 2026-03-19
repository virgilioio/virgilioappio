
import { Card, CardContent } from '@/components/ui/card'
import { MembersTable, EnrichedMember } from '@/components/members/MembersTable'
import { useMembers } from '@/hooks/useMembers'
import { useState, useMemo } from 'react'
import { MemberInviteSheet } from '@/components/members/MemberInviteSheet'
import { usePermissions } from '@/hooks/usePermissions'
import { UserDeletionDialog } from '@/components/organizations/UserDeletionDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { PageHeader } from '@/components/layout/PageHeader'
import { SeatUsageCard } from '@/components/members/SeatUsageCard'
import { useRecruiterUserIds } from '@/hooks/useRecruiterUserIds'
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
  const tenantId = currentOrg?.tenant_id

  const { recruiterUserIds } = useRecruiterUserIds()

  const isBillableMember = (m: any) =>
    m.system_role === 'admin'
    || m.user_type === 'workspace_owner'
    || (m.user_id && recruiterUserIds.has(m.user_id))

  const getEffectiveRole = (m: any): EnrichedMember['effectiveRole'] => {
    if (m.user_type === 'workspace_owner') return 'Owner'
    if (m.system_role === 'admin') return 'Admin'
    if (m.user_id && recruiterUserIds.has(m.user_id)) return 'Recruiter'
    return 'Hiring Manager'
  }

  const orgMembers = useMemo(() =>
    members.filter((m) => !parentOrgId || m.organization_id === parentOrgId),
    [members, parentOrgId]
  )

  const enrichedMembers: EnrichedMember[] = useMemo(() =>
    orgMembers.map(m => ({
      ...m,
      seatType: isBillableMember(m) ? 'paid' as const : 'free' as const,
      effectiveRole: getEffectiveRole(m),
    })),
    [orgMembers, recruiterUserIds]
  )

  const paidCount = enrichedMembers.filter(m => m.seatType === 'paid').length
  const freeCount = enrichedMembers.filter(m => m.seatType === 'free').length

  // Tenant subscription functionality removed
  const subscription = null as any
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
    <div className="space-y-6">
      <PageHeader title="Team Members" />

      <Card data-onboarding-target="team">
        <CardContent className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Next Billing */}
            <div className="rounded-brand border border-pastel-purple/50 bg-pastel-purple/40 p-4 shadow-[var(--shadow-xs)]">
              <div className="text-sm text-pastel-purple-foreground/80">Next Billing</div>
              <div className="text-3xl font-semibold text-pastel-purple-foreground mt-1">{nextBillingLabel}</div>
            </div>
            {/* Paid Seats */}
            <div className="rounded-brand border border-pastel-purple/50 bg-pastel-purple/40 p-4 shadow-[var(--shadow-xs)]">
              <div className="text-sm text-pastel-purple-foreground/80">Paid Seats</div>
              <div className="text-3xl font-semibold text-pastel-purple-foreground mt-1">{paidCount}</div>
              <div className="text-xs text-pastel-purple-foreground/60 mt-1">Admins, Owners & Recruiters</div>
            </div>
            {/* Free Collaborators */}
            <div className="rounded-brand border border-pastel-blue/50 bg-pastel-blue/40 p-4 shadow-[var(--shadow-xs)]">
              <div className="text-sm text-pastel-blue-foreground/80">Free Collaborators</div>
              <div className="text-3xl font-semibold text-pastel-blue-foreground mt-1">{freeCount}</div>
              <div className="text-xs text-pastel-blue-foreground/60 mt-1">Hiring Managers & Interviewers</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {tenantId && <SeatUsageCard tenantId={tenantId} />}

      <MembersTable
        members={enrichedMembers}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onResendInvitation={handleResendInvitation}
        onDeleteUser={handleDeleteUser}
        onAddNew={permissions.canCreateMembers ? handleCreateNew : undefined}
      />

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
