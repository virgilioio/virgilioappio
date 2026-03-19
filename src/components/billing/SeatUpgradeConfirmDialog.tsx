import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useStripePricing } from '@/hooks/useStripePricing'
import { formatPrice } from '@/utils/pricing'
import { ArrowRight, CreditCard } from 'lucide-react'

interface SeatUpgradeConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  memberName: string
  currentPaidSeats?: number
}

export function SeatUpgradeConfirmDialog({
  open,
  onConfirm,
  onCancel,
  memberName,
  currentPaidSeats,
}: SeatUpgradeConfirmDialogProps) {
  const { data: pricing } = useStripePricing()
  const monthlyCost = pricing?.seatMonthly?.amount
    ? formatPrice(pricing.seatMonthly.amount, pricing.seatMonthly.currency)
    : null

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            This will add a paid seat
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Assigning <strong className="text-foreground">{memberName}</strong> as a <strong className="text-foreground">Recruiter</strong> will convert them from a free collaborator to a paid seat.
              </p>
              {(currentPaidSeats !== undefined || monthlyCost) && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
                  {currentPaidSeats !== undefined && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{currentPaidSeats} seats</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="default">{currentPaidSeats + 1} seats</Badge>
                    </div>
                  )}
                  {monthlyCost && (
                    <span className="ml-auto text-muted-foreground">
                      +{monthlyCost}/mo per seat
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Admins and Recruiters are billed as paid seats. Hiring Managers and Interviewers remain free.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Confirm & Assign
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
