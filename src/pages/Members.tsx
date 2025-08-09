
import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { MembersTable } from '@/components/members/MembersTable'
import { MemberForm } from '@/components/members/MemberForm'
import { UserDeletionDialog } from '@/components/organizations/UserDeletionDialog'
import { useMembers, Member } from '@/hooks/useMembers'
import { Users } from 'lucide-react'

export default function Members() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [deactivateMemberId, setDeactivateMemberId] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  const {
    members,
    isLoading,
    createMember,
    updateMember,
    deactivateMember,
    resendInvitation,
    getMembers
  } = useMembers()

  const handleCreateNew = () => {
    setSelectedMember(null)
    setIsFormOpen(true)
  }

  const handleEdit = (member: Member) => {
    setSelectedMember(member)
    setIsFormOpen(true)
  }

  const handleDeactivate = (id: string) => {
    setDeactivateMemberId(id)
  }

  const handleConfirmDeactivate = async () => {
    if (deactivateMemberId) {
      await deactivateMember(deactivateMemberId)
      setDeactivateMemberId(null)
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (selectedMember) {
      await updateMember(selectedMember.id, data)
    } else {
      await createMember(data)
    }
  }

  const handleResendInvitation = async (memberId: string, email: string) => {
    await resendInvitation(memberId, email)
  }

  const handleDeleteUser = (member: Member) => {
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
    <AuthGate>
      <PermissionGate permission="canManageMembers">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 sm:mb-8 lg:mb-12">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Users className="h-6 w-6 sm:h-7 sm:w-7" />
                Team Members
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-md">
                Manage team members and their roles within your organization
              </p>
            </div>

            <MembersTable
              members={members}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDeactivate={handleDeactivate}
              onResendInvitation={handleResendInvitation}
              onDeleteUser={handleDeleteUser}
              onAddNew={handleCreateNew}
            />

            <MemberForm
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSubmit={handleFormSubmit}
              member={selectedMember}
              isLoading={isLoading}
            />

            <AlertDialog open={!!deactivateMemberId} onOpenChange={() => setDeactivateMemberId(null)}>
              <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate Member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to deactivate this member? They will lose access to the organization but can be reactivated later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeactivate} className="w-full sm:w-auto">
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <UserDeletionDialog
              isOpen={isDeleteDialogOpen}
              onClose={() => setIsDeleteDialogOpen(false)}
              userToDelete={userToDelete}
              onUserDeleted={handleUserDeleted}
            />
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
