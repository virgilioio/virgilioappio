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
import { Input } from '@/components/ui/input'
import { Calendar } from 'lucide-react'
import { format, addDays } from 'date-fns'

interface ExtendTrialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newEndDate: Date) => void
  organizationName: string
  currentTrialEnd?: Date | null
  isPending?: boolean
}

export function ExtendTrialDialog({
  open,
  onOpenChange,
  onConfirm,
  organizationName,
  currentTrialEnd,
  isPending = false
}: ExtendTrialDialogProps) {
  const [endDate, setEndDate] = useState('')

  // Set default date when dialog opens
  useEffect(() => {
    if (open) {
      const defaultDate = currentTrialEnd 
        ? addDays(new Date(currentTrialEnd), 14)
        : addDays(new Date(), 30)
      
      setEndDate(format(defaultDate, 'yyyy-MM-dd'))
    }
  }, [open, currentTrialEnd])

  const handleConfirm = () => {
    if (endDate) {
      onConfirm(new Date(endDate))
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const minDate = format(new Date(), 'yyyy-MM-dd')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-lg">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Extend Trial Period</DialogTitle>
              <DialogDescription>
                Set a new trial end date for {organizationName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentTrialEnd && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <span className="text-muted-foreground">Current trial ends: </span>
              <span className="font-medium">
                {format(new Date(currentTrialEnd), 'MMMM d, yyyy')}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="trial-end-date">New trial end date *</Label>
            <Input
              id="trial-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={minDate}
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              The organization's status will be set to "trialing" until this date.
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
            onClick={handleConfirm}
            disabled={!endDate || isPending}
          >
            {isPending ? 'Extending...' : 'Extend Trial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
