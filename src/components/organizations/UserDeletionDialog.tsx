
import { useRef } from 'react'
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

interface UserDeletionDialogProps {
  isOpen: boolean
  onClose: () => void
  userToDelete: {
    id: string | null  // null for invited members
    memberId: string   // always present for member record
    email: string
    firstName?: string
    lastName?: string
    userStatus: string // to determine if it's an invited member
    userType?: string  // a workspace owner can't be deleted here
  } | null
  organizationId?: string
  isBillingPoc?: boolean
  onUserDeleted: () => void
}

/**
 * S3 (Block B §16, 2026-10-13): one type-to-confirm dialog replaces the old
 * two-step "Next → Are you absolutely sure" flow. Its middle step (pick a new
 * billing contact) had nothing to pick since the billing POC member list was
 * removed, and the delete-user function ignores a reassignment, so the dialog
 * now just says so. Deleting yourself or the workspace owner is blocked.
 * A pending invitation (no account yet) is a plain single confirm.
 */
export function UserDeletionDialog({
  isOpen,
  onClose,
  userToDelete,
  organizationId,
  isBillingPoc = false,
  onUserDeleted
}: UserDeletionDialogProps) {
  const { userId: currentUserId } = useAuth()
  // Keep the last person through the exit animation (callers clear it on success).
  const lastUser = useRef(userToDelete)
  if (userToDelete) lastUser.current = userToDelete
  userToDelete = userToDelete ?? lastUser.current

  const name = userToDelete
    ? `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim() || userToDelete.email || 'this member'
    : ''
  const first = userToDelete?.firstName?.trim() || name
  const isInvite = !!userToDelete && !userToDelete.id
  const isSelf = !!userToDelete?.id && userToDelete.id === currentUserId
  const isOwner = userToDelete?.userType === 'workspace_owner'

  const failMessage = `Couldn’t delete ${name}. Nothing was removed; try again.`

  const deleteInvite = async () => {
    if (!userToDelete) return
    // Invited members (never registered): admin_manage_member bypasses RLS.
    const { data, error } = await supabase.rpc('admin_manage_member', {
      p_member_id: userToDelete.memberId,
      p_changes: { _delete: true },
    })
    const result = data as { success?: boolean; message?: string } | null
    if (error || (result && !result.success)) {
      console.error('Error deleting invited member:', error || result)
      toast({ title: `Couldn’t delete the invitation for ${name}`, description: 'Nothing was removed; try again.', variant: 'destructive' })
      return
    }
    toast({ title: `Invitation for ${name} deleted` })
    onUserDeleted()
  }

  // Type to confirm: the dialog waits for this and shows a throw inline.
  const deleteUser = async () => {
    if (!userToDelete?.id) return
    const requestBody: Record<string, unknown> = { userId: userToDelete.id }
    if (isBillingPoc && organizationId) {
      requestBody.reassignBillingPoc = { organizationId, newBillingPocUserId: null }
    }
    let failed = false
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: requestBody })
      if (error || data?.error) {
        console.error('Error deleting user:', error || data?.error)
        failed = true
      }
    } catch (err) {
      console.error('Unexpected error deleting user:', err)
      failed = true
    }
    if (failed) throw new Error(failMessage)
    toast({ title: `${name} deleted` })
    onUserDeleted()
  }

  if (isSelf || isOwner) {
    return (
      <ConfirmDestructiveDialog
        open={isOpen}
        onOpenChange={(o) => { if (!o) onClose() }}
        variant="blocked"
        title={isSelf ? 'You can’t delete your own account' : `${name} owns this workspace`}
        description={
          isSelf
            ? 'Ask another workspace owner to delete your account, so the workspace is never left without someone who can manage it.'
            : `The workspace owner can’t be deleted. Make someone else the owner first, then delete ${first}.`
        }
        confirmLabel=""
      />
    )
  }

  if (isInvite) {
    return (
      <ConfirmDestructiveDialog
        open={isOpen}
        onOpenChange={(o) => { if (!o) onClose() }}
        title={`Delete the invitation for ${name}?`}
        description={`The invite link stops working and ${name} can’t join with it. You can invite them again later.`}
        confirmLabel="Delete invitation"
        onConfirm={deleteInvite}
      />
    )
  }

  const billing = isBillingPoc
    ? ` They’re this organization’s billing contact, and that isn’t reassigned for you.`
    : ''

  return (
    <ConfirmDestructiveDialog
      open={isOpen}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={`Delete ${name}?`}
      description={`${first} is removed from every workspace. Their login, job assignments, connected email and calendar, booking links and activity history are deleted. Candidates and jobs they added stay.${billing} This can’t be undone.`}
      confirmLabel="Delete user"
      typeToConfirm={name}
      onConfirm={deleteUser}
    />
  )
}
