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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Gift } from 'lucide-react'

interface GrantCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (credits: number, reason: string) => void
  tenantName: string
  isPending: boolean
}

const PRESET_AMOUNTS = [100, 250, 500, 1000]

export function GrantCreditsDialog({
  open,
  onOpenChange,
  onConfirm,
  tenantName,
  isPending,
}: GrantCreditsDialogProps) {
  const [credits, setCredits] = useState<number>(100)
  const [customCredits, setCustomCredits] = useState<string>('')
  const [reason, setReason] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const handleConfirm = () => {
    const finalCredits = useCustom ? parseInt(customCredits, 10) : credits
    if (finalCredits > 0 && reason.trim()) {
      onConfirm(finalCredits, reason.trim())
      // Reset form
      setCredits(100)
      setCustomCredits('')
      setReason('')
      setUseCustom(false)
    }
  }

  const isValid = () => {
    const finalCredits = useCustom ? parseInt(customCredits, 10) : credits
    return finalCredits > 0 && reason.trim().length > 0
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-poppins">
            <Gift className="h-5 w-5 text-virgilio-purple" />
            Grant Complimentary Credits
          </DialogTitle>
          <DialogDescription>
            Grant free credits to <span className="font-semibold">{tenantName}</span>. 
            These credits will be added to their bonus balance immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Credits to Grant</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant={!useCustom && credits === amount ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setCredits(amount)
                    setUseCustom(false)
                  }}
                >
                  {amount}
                </Button>
              ))}
              <Button
                type="button"
                variant={useCustom ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseCustom(true)}
              >
                Custom
              </Button>
            </div>
            
            {useCustom && (
              <Input
                type="number"
                min="1"
                placeholder="Enter custom amount"
                value={customCredits}
                onChange={(e) => setCustomCredits(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Grant <span className="text-destructive">*</span></Label>
            <Textarea
              id="reason"
              placeholder="e.g., Customer support compensation, promotional offer, partnership bonus..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded for audit purposes.
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
          <Button
            onClick={handleConfirm}
            disabled={isPending || !isValid()}
            className="gap-2"
          >
            <Gift className="h-4 w-4" />
            {isPending ? 'Granting...' : 'Grant Credits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
