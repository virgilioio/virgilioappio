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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2 } from 'lucide-react'

interface ChangePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newTier: string, newInterval: string) => void
  organizationName: string
  currentTier: string | null
  currentInterval: string | null
  isPending?: boolean
}

const tierOptions = [
  { value: 'launch', label: 'GoGio: Launch!' },
  { value: 'growth', label: 'GoGio: Growth!' },
  { value: 'business', label: 'GoGio: Business!' },
]

const intervalOptions = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const tierPricing = {
  launch: { monthly: 99, yearly: 950 },
  growth: { monthly: 299, yearly: 2870 },
  business: { monthly: 599, yearly: 5750 },
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  onConfirm,
  organizationName,
  currentTier,
  currentInterval,
  isPending,
}: ChangePlanDialogProps) {
  const [selectedTier, setSelectedTier] = useState<string>(currentTier || 'launch')
  const [selectedInterval, setSelectedInterval] = useState<string>(currentInterval || 'monthly')

  const handleConfirm = () => {
    onConfirm(selectedTier, selectedInterval)
  }

  const getCurrentPrice = () => {
    if (!currentTier || !currentInterval) return null
    const tier = currentTier as keyof typeof tierPricing
    const interval = currentInterval as 'monthly' | 'yearly'
    return tierPricing[tier]?.[interval]
  }

  const getNewPrice = () => {
    const tier = selectedTier as keyof typeof tierPricing
    const interval = selectedInterval as 'monthly' | 'yearly'
    return tierPricing[tier]?.[interval]
  }

  const currentPrice = getCurrentPrice()
  const newPrice = getNewPrice()
  const isUpgrade = newPrice && currentPrice && newPrice > currentPrice
  const isDowngrade = newPrice && currentPrice && newPrice < currentPrice

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-poppins font-bold text-virgilio-text">
            Change Subscription Plan<span className="text-virgilio-purple">.</span>
          </DialogTitle>
          <DialogDescription className="text-virgilio-muted">
            Update the subscription plan for <span className="font-medium text-virgilio-text">{organizationName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Plan Display */}
          {currentTier && currentInterval && (
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="text-sm text-virgilio-muted mb-1">Current Plan</div>
              <div className="font-medium text-virgilio-text">
                {tierOptions.find(t => t.value === currentTier)?.label} - {' '}
                <span className="capitalize">{currentInterval}</span>
                {currentPrice && (
                  <span className="text-virgilio-muted ml-2">
                    ${currentPrice}/{currentInterval === 'monthly' ? 'mo' : 'yr'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tier Selection */}
          <div className="space-y-2">
            <Label htmlFor="tier" className="text-virgilio-text">
              New Subscription Tier
            </Label>
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger id="tier">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {tierOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
          </div>

          {/* New Plan Preview */}
          {newPrice && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-sm text-virgilio-muted mb-1">New Plan</div>
              <div className="font-bold text-lg text-virgilio-text">
                {tierOptions.find(t => t.value === selectedTier)?.label}
              </div>
              <div className="text-virgilio-muted">
                ${newPrice}/{selectedInterval === 'monthly' ? 'month' : 'year'}
              </div>
            </div>
          )}

          {/* Proration Info */}
          {(isUpgrade || isDowngrade) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {isUpgrade && (
                  <>The customer will be charged a prorated amount for the plan upgrade immediately.</>
                )}
                {isDowngrade && (
                  <>The plan will be downgraded at the end of the current billing period. No immediate charge.</>
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
            disabled={isPending || (selectedTier === currentTier && selectedInterval === currentInterval)}
            className="bg-virgilio-purple hover:bg-virgilio-purple/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Plan Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
