
import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { MembersTable } from '@/components/members/MembersTable'
import { MemberForm } from '@/components/members/MemberForm'
import { useMembers, Member } from '@/hooks/useMembers'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'

export default function Members() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [deactivateMemberId, setDeactivateMemberId] = useState<string | null>(null)
  
  const {
    members,
    isLoading,
    createMember,
    updateMember,
    deactivateMember
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

  return (
    <AuthGate>
      <PermissionGate permission="canManageMembers">
        <Section className="min-h-screen">
          <AppContainer variant="default">
            <div className="py-6 lg:py-8">
              <div className="mb-6 lg:mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
                <p className="text-muted-foreground mt-2">
                  Manage team members and their roles within your organization
                </p>
              </div>

              <MembersTable
                members={members}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDeactivate={handleDeactivate}
                onCreateNew={handleCreateNew}
              />

              <MemberForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleFormSubmit}
                member={selectedMember}
                isLoading={isLoading}
              />

              <AlertDialog open={!!deactivateMemberId} onOpenChange={() => setDeactivateMemberId(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate Member</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to deactivate this member? They will lose access to the organization but can be reactivated later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDeactivate}>
                      Deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </AppContainer>
        </Section>
      </PermissionGate>
    </AuthGate>
  )
}
