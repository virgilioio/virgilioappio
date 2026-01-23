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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2, Users, Check, DollarSign, Coins } from 'lucide-react'

interface ChangePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newInterval: string, newSeats?: number) => void
  organizationName: string
  currentSeats: number | null
  currentInterval: string | null
  isPending?: boolean
}

const MONTHLY_PRICE_PER_SEAT = 99
const YEARLY_PRICE_PER_SEAT = 999
const MONTHLY_CREDITS_PER_SEAT = 100
const YEARLY_CREDITS_PER_SEAT = 120

const intervalOptions = [
  { value: 'month', label: 'Monthly ($99/seat/mo)' },
  { value: 'year', label: 'Annual ($999/seat/yr)' },
]

export function ChangePlanDialog({
  open,
  onOpenChange,
  onConfirm,
  organizationName,
  currentSeats,
  currentInterval,
  isPending,
}: ChangePlanDialogProps) {
  const [selectedInterval, setSelectedInterval] = useState<string>(currentInterval || 'month')
  const [newSeats, setNewSeats] = useState<string>(String(currentSeats || 1))

  const handleConfirm = () => {
    const seatsNum = parseInt(newSeats, 10)
    onConfirm(selectedInterval, seatsNum !== (currentSeats || 1) ? seatsNum : undefined)
  }

  const getCurrentPrice = () => {
    if (!currentSeats || !currentInterval) return null
    const pricePerSeat = currentInterval === 'year' ? YEARLY_PRICE_PER_SEAT : MONTHLY_PRICE_PER_SEAT
    return currentSeats * pricePerSeat
  }

  const getNewPrice = () => {
    const seats = parseInt(newSeats, 10) || 1
    const pricePerSeat = selectedInterval === 'year' ? YEARLY_PRICE_PER_SEAT : MONTHLY_PRICE_PER_SEAT
    return seats * pricePerSeat
  }

  const getCreditsPerMonth = (interval: string, seats: number) => {
    const creditsPerSeat = interval === 'year' ? YEARLY_CREDITS_PER_SEAT : MONTHLY_CREDITS_PER_SEAT
    return seats * creditsPerSeat
  }

  const currentPrice = getCurrentPrice()
  const newPrice = getNewPrice()
  const newSeatsNum = parseInt(newSeats, 10) || 1
  const hasIntervalChange = selectedInterval !== currentInterval
  const hasSeatsChange = newSeatsNum !== (currentSeats || 1)
  const hasChanges = hasIntervalChange || hasSeatsChange

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-poppins font-bold text-virgilio-text">
            Update Subscription<span className="text-virgilio-purple">.</span>
          </DialogTitle>
          <DialogDescription className="text-virgilio-muted">
            Update billing for <span className="font-medium text-virgilio-text">{organizationName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Plan Display */}
          {currentSeats && currentInterval && (
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="text-sm text-muted-foreground mb-1">Current Plan</div>
              <div className="font-medium text-foreground">
                GoGio ATS - {currentSeats} seat{currentSeats !== 1 ? 's' : ''} ({currentInterval === 'year' ? 'Annual' : 'Monthly'})
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  ${currentPrice}/{currentInterval === 'year' ? 'yr' : 'mo'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5" />
                  {getCreditsPerMonth(currentInterval, currentSeats)} credits/mo
                </span>
              </div>
            </div>
          )}

          {/* Interval Selection */}
          <div className="space-y-2">
            <Label htmlFor="interval" className="text-virgilio-text">
              Billing Interval
            </Label>
            <Select value={selectedInterval} onValueChange={setSelectedInterval}>
              <SelectTrigger id="interval">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInterval === 'year' && currentInterval === 'month' && (
              <p className="text-xs text-virgilio-success">
                Save ~15% with annual billing + 20% more credits per seat
              </p>
            )}
          </div>

          {/* Seat Override (Admin) */}
          <div className="space-y-2">
            <Label htmlFor="seats" className="text-virgilio-text">
              Seat Quantity (Admin Override)
            </Label>
            <Input
              id="seats"
              type="number"
              min={1}
              value={newSeats}
              onChange={(e) => setNewSeats(e.target.value)}
              className="max-w-32"
            />
            <p className="text-xs text-muted-foreground">
              Only use this to override seat count. Normally, seat changes are handled via Stripe.
            </p>
          </div>

          {/* New Plan Preview */}
          {hasChanges && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-sm text-muted-foreground mb-1">New Plan</div>
              <div className="font-bold text-lg text-foreground">
                GoGio ATS - {newSeatsNum} seat{newSeatsNum !== 1 ? 's' : ''}
              </div>
              <div className="text-muted-foreground mb-3">
                ${newPrice}/{selectedInterval === 'year' ? 'year' : 'month'}
              </div>
              
              {/* Plan features */}
              <div className="space-y-1.5 pt-3 border-t border-primary/10">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  <span className="text-foreground">
                    {newSeatsNum} recruiter seat{newSeatsNum !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  <span className="text-foreground">
                    {getCreditsPerMonth(selectedInterval, newSeatsNum)} sourcing credits/month
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  <span className="text-foreground">Unlimited hiring managers</span>
                </div>
              </div>
            </div>
          )}

          {/* Proration Info */}
          {hasChanges && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {hasIntervalChange && selectedInterval === 'year' && (
                  <>Switching to annual billing will be prorated and charged immediately.</>
                )}
                {hasIntervalChange && selectedInterval === 'month' && (
                  <>Switching to monthly billing will take effect at the end of the current period.</>
                )}
                {!hasIntervalChange && hasSeatsChange && (
                  <>Seat changes will be applied immediately with prorated billing.</>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="border-virgilio-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !hasChanges}
            className="bg-virgilio-purple hover:bg-virgilio-purple/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
