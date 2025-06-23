
import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { MembersTable } from '@/components/members/MembersTable'
import { MemberForm } from '@/components/members/MemberForm'
import { useMembers } from '@/hooks/useMembers'
import { useMembersWithProfiles, type MemberWithProfile } from '@/hooks/useMembersWithProfiles'
import { Users, Plus } from 'lucide-react'

export default function Members() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberWithProfile | null>(null)
  const [deactivateMemberId, setDeactivateMemberId] = useState<string | null>(null)
  
  const { members, isLoading } = useMembersWithProfiles()
  const { createMember, updateMember, deactivateMember, resendInvitation } = useMembers()

  const handleCreateNew = () => {
    setSelectedMember(null)
    setIsFormOpen(true)
  }

  const handleEdit = (member: MemberWithProfile) => {
    setSelectedMember(member)
    setIsFormOpen(true)
  }

  const handleDeactivate = (id: string) => {
    setDeactivateMemberId(id)
  }

  const handleConfirmDeactivate = async () => {
    if (deactivateMemberId) {
      await deactivateMember.mutateAsync(deactivateMemberId)
      setDeactivateMemberId(null)
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (selectedMember) {
      await updateMember.mutateAsync({ id: selectedMember.id, ...data })
    } else {
      await createMember.mutateAsync(data)
    }
  }

  const handleResendInvitation = async (memberId: string, email: string) => {
    await resendInvitation.mutateAsync({ memberId, email })
  }

  return (
    <AuthGate>
      <PermissionGate permission="canManageMembers">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 sm:mb-8 lg:mb-12 flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Users className="h-6 w-6 sm:h-7 sm:w-7" />
                  Team Members
                </h1>
                <p className="text-muted-foreground mt-2 text-sm sm:text-md">
                  Manage team members and their roles within your organization
                </p>
              </div>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>

            <MembersTable
              members={members || []}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDeactivate={handleDeactivate}
              onResendInvitation={handleResendInvitation}
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
                  <AlertDialogCancel className="w-full sm:w-auto min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeactivate} className="w-full sm:w-auto min-h-[44px]">
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
