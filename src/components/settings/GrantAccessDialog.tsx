import { useState, useEffect } from 'react'
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
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { Unlock } from 'lucide-react'
import { addDays } from 'date-fns'

interface GrantAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (endDate: Date, reason: string) => void
  organizationName: string
  isPending?: boolean
}

export function GrantAccessDialog({
  open,
  onOpenChange,
  onConfirm,
  organizationName,
  isPending = false,
}: GrantAccessDialogProps) {
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setEndDate(addDays(new Date(), 14))
      setReason('')
    }
  }, [open])

  const minDate = addDays(new Date(), 1)
  const canSubmit = !!endDate && reason.trim().length >= 5 && !isPending

  const handleConfirm = () => {
    if (endDate && reason.trim().length >= 5) {
      onConfirm(endDate, reason.trim())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-lg">
              <Unlock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Grant Access</DialogTitle>
              <DialogDescription>
                Temporarily unlock {organizationName} without starting a trial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="grant-end-date">Access ends on *</Label>
            <DatePickerVirgilio
              value={endDate}
              onChange={setEndDate}
              minDate={minDate}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              The tenant regains access until this date, then automatically reverts to locked. This is not a trial and is not billed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-reason">Reason *</Label>
            <Textarea
              id="grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. sales negotiation in progress, service credit, paid offline…"
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Recorded in the audit log and visible on this customer profile.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isPending ? 'Granting…' : 'Grant Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
