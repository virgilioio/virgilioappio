import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Check, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SeatLimitUpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentSeats: number
  billingInterval?: 'month' | 'year'
  // Legacy props - kept for backward compatibility but ignored
  currentTier?: string | null
  seatLimit?: number | null
}

export function SeatLimitUpgradeDialog({
  open,
  onOpenChange,
  currentSeats,
  billingInterval = 'month',
}: SeatLimitUpgradeDialogProps) {
  const creditsPerSeat = billingInterval === 'year' ? 120 : 100
  const seatPrice = billingInterval === 'year' ? '$999/year' : '$99/month'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add Team Members
          </DialogTitle>
          <DialogDescription>
            Your per-seat subscription automatically scales with your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current seats</span>
              <Badge variant="secondary">{currentSeats} recruiter{currentSeats !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Per seat</span>
              <span className="text-sm">{seatPrice}</span>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">How per-seat billing works:</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Adding members automatically adjusts your subscription</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Billing is prorated—you only pay for the remainder of the cycle</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Each seat adds {creditsPerSeat} enrichment credits to your pool</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Hiring managers and interviewers are always free</span>
              </li>
            </ul>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Only users with the "Recruiter" role count as paid seats. 
              Add unlimited hiring managers and interviewers at no extra cost.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
