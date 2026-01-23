import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Coins, RefreshCw } from 'lucide-react'

interface AssignCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (collectLimit: number, resetUsage: boolean) => void
  tenantName: string
  currentCollectLimit?: number
  isPending: boolean
}

export function AssignCreditsDialog({
  open,
  onOpenChange,
  onConfirm,
  tenantName,
  currentCollectLimit,
  isPending,
}: AssignCreditsDialogProps) {
  const [collectLimit, setCollectLimit] = useState(currentCollectLimit?.toString() || '100')
  const [resetUsage, setResetUsage] = useState(false)

  const handleConfirm = () => {
    const collectNum = parseInt(collectLimit, 10)

    if (isNaN(collectNum) || collectNum < 0) {
      return
    }

    onConfirm(collectNum, resetUsage)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-virgilio-purple" />
            Assign Enrichment Credits
          </DialogTitle>
          <DialogDescription>
            Manually set enrichment credit limits for <strong>{tenantName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="collect-limit">Enrichment Credits Limit</Label>
            <Input
              id="collect-limit"
              type="number"
              min="0"
              value={collectLimit}
              onChange={(e) => setCollectLimit(e.target.value)}
              placeholder="e.g., 100"
            />
            <p className="text-sm text-muted-foreground">
              Number of profile enrichments allowed per billing cycle
            </p>
          </div>

          <div className="flex items-center space-x-2 pt-4 border-t">
            <Checkbox
              id="reset-usage"
              checked={resetUsage}
              onCheckedChange={(checked) => setResetUsage(checked as boolean)}
            />
            <Label
              htmlFor="reset-usage"
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Also reset current usage to 0
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Assigning...' : 'Assign Credits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
