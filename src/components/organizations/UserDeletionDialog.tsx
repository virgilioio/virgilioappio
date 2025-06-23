
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Trash2, User, Shield } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useBillingPOCMembers } from '@/hooks/useBillingPOCMembers'

interface UserDeletionDialogProps {
  isOpen: boolean
  onClose: () => void
  userToDelete: {
    id: string
    email: string
    firstName?: string
    lastName?: string
  } | null
  organizationId?: string
  isBillingPoc?: boolean
  onUserDeleted: () => void
}

export function UserDeletionDialog({
  isOpen,
  onClose,
  userToDelete,
  organizationId,
  isBillingPoc = false,
  onUserDeleted
}: UserDeletionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [newBillingPocUserId, setNewBillingPocUserId] = useState<string>('')
  const [confirmationStep, setConfirmationStep] = useState<'initial' | 'confirm-billing-poc' | 'final-confirm'>('initial')
  
  const { members: billingPocMembers, isLoading: membersLoading } = useBillingPOCMembers(
    isBillingPoc ? organizationId : undefined
  )

  const handleDelete = async () => {
    if (!userToDelete) return

    setIsDeleting(true)
    try {
      const requestBody: any = { userId: userToDelete.id }
      
      // If user is billing POC and we have a replacement, include it
      if (isBillingPoc && organizationId) {
        requestBody.reassignBillingPoc = {
          organizationId,
          newBillingPocUserId: newBillingPocUserId || null
        }
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: requestBody
      })

      if (error) {
        console.error('Error deleting user:', error)
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete user',
          variant: 'destructive'
        })
        return
      }

      if (data.error) {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        })
        return
      }

      toast({
        title: 'Success',
        description: `User ${userToDelete.email} has been completely deleted from the system`
      })

      onUserDeleted()
      onClose()
      
    } catch (err) {
      console.error('Unexpected error:', err)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while deleting the user',
        variant: 'destructive'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNext = () => {
    if (confirmationStep === 'initial') {
      if (isBillingPoc) {
        setConfirmationStep('confirm-billing-poc')
      } else {
        setConfirmationStep('final-confirm')
      }
    } else if (confirmationStep === 'confirm-billing-poc') {
      setConfirmationStep('final-confirm')
    } else {
      handleDelete()
    }
  }

  const handleClose = () => {
    setConfirmationStep('initial')
    setNewBillingPocUserId('')
    onClose()
  }

  const getUserDisplayName = () => {
    if (!userToDelete) return ''
    const name = `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim()
    return name || userToDelete.email
  }

  const availableBillingPocMembers = billingPocMembers.filter(member => 
    member.user_id !== userToDelete?.id
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete User
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {confirmationStep === 'initial' && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>This action cannot be undone.</strong> This will permanently delete the user from all systems including authentication.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>User to delete:</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{getUserDisplayName()}</div>
                    <div className="text-sm text-muted-foreground">{userToDelete?.email}</div>
                  </div>
                </div>
              </div>

              {isBillingPoc && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    This user is currently assigned as the billing point of contact. You'll need to reassign this role in the next step.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {confirmationStep === 'confirm-billing-poc' && (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Select a new billing point of contact or leave empty to remove the assignment.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>New Billing POC (Optional)</Label>
                <Select value={newBillingPocUserId} onValueChange={setNewBillingPocUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={membersLoading ? "Loading..." : "Select a user or leave empty"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No billing POC assigned</SelectItem>
                    {availableBillingPocMembers.map((member) => {
                      const name = `${member.first_name || ''} ${member.last_name || ''}`.trim()
                      const displayName = name || 'Unknown User'
                      
                      return (
                        <SelectItem key={member.user_id} value={member.user_id!}>
                          <div className="flex flex-col">
                            <span className="font-medium">{displayName}</span>
                            <span className="text-xs text-muted-foreground">{member.email}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {confirmationStep === 'final-confirm' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Final confirmation:</strong> Are you absolutely sure you want to permanently delete {userToDelete?.email}? This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleNext}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 
             confirmationStep === 'final-confirm' ? 'Delete User' :
             'Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
