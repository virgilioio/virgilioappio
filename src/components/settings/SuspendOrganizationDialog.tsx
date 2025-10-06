import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle } from 'lucide-react'

interface SuspendOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  organizationName: string
  isPending?: boolean
}

export function SuspendOrganizationDialog({
  open,
  onOpenChange,
  onConfirm,
  organizationName,
  isPending = false
}: SuspendOrganizationDialogProps) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim())
      setReason('') // Reset for next time
    }
  }

  const handleCancel = () => {
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Suspend Organization</DialogTitle>
              <DialogDescription>
                This will immediately suspend {organizationName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for suspension *</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for suspending this organization..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              This reason will be visible to platform administrators.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? 'Suspending...' : 'Suspend Organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
