import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Users, TrendingUp } from 'lucide-react'
import { useCreateCheckout } from '@/hooks/useBillingPortal'

interface SeatLimitUpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTier: 'solo' | 'launch' | 'growth' | 'business' | null
  currentSeats: number
  seatLimit: number | null
}

const tierInfo = {
  solo: { name: 'Solo', maxUsers: 1, price: 29, yearlyPrice: 306 },
  launch: { name: 'Launch', maxUsers: 5, price: 149, yearlyPrice: 1519 },
  growth: { name: 'Growth', maxUsers: 15, price: 399, yearlyPrice: 4069 },
  business: { name: 'Business', maxUsers: 50, price: 799, yearlyPrice: 8149 },
}

export function SeatLimitUpgradeDialog({
  open,
  onOpenChange,
  currentTier,
  currentSeats,
  seatLimit,
}: SeatLimitUpgradeDialogProps) {
  const createCheckout = useCreateCheckout()

  const getNextTier = (): 'launch' | 'growth' | 'business' | null => {
    if (currentTier === 'solo') return 'launch'
    if (currentTier === 'launch') return 'growth'
    if (currentTier === 'growth') return 'business'
    return null
  }

  const nextTier = getNextTier()
  const nextTierInfo = nextTier ? tierInfo[nextTier] : null

  const handleUpgrade = (interval: 'month' | 'year') => {
    if (!nextTier) return
    
    createCheckout.mutate(
      { tier: nextTier, interval },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Seat Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've reached your plan's user limit ({seatLimit} {seatLimit === 1 ? 'user' : 'users'}). 
            Upgrade to add more team members.
          </DialogDescription>
        </DialogHeader>

        {nextTierInfo ? (
          <div className="space-y-6 mt-4">
            {/* Current Status */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Current Plan</div>
                  <div className="font-semibold">
                    GoGio: {currentTier ? tierInfo[currentTier].name : 'Unknown'}!
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Users</div>
                  <div className="font-semibold">
                    {currentSeats} / {seatLimit}
                  </div>
                </div>
              </div>
            </div>

            {/* Upgrade Plan Card */}
            <div className="border-2 border-primary rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">GoGio: {nextTierInfo.name}!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {nextTierInfo.maxUsers === null 
                      ? 'Unlimited users' 
                      : `Up to ${nextTierInfo.maxUsers} users`}
                  </p>
                </div>
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    {nextTierInfo.maxUsers === null 
                      ? 'Unlimited team members' 
                      : `Up to ${nextTierInfo.maxUsers} team members`}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    {nextTier === 'launch' ? '25 searches / 10 enrichments per month' : 
                     nextTier === 'growth' ? '100 searches / 50 enrichments per month' : 
                     '250 searches / 125 enrichments per month'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm">All premium features</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => handleUpgrade('month')}
                  disabled={createCheckout.isPending}
                >
                  Upgrade - ${nextTierInfo.price}/month
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleUpgrade('year')}
                  disabled={createCheckout.isPending}
                >
                  Upgrade - ${nextTierInfo.yearlyPrice}/year
                  <span className="ml-2 text-xs text-success">(Save 15%)</span>
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              You're already on our highest tier with unlimited users. Please contact support for assistance.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
