import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string, isDefault: boolean) => void
  initialName?: string
  mode?: 'create' | 'rename'
  isLoading?: boolean
}

export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
  initialName = '',
  mode = 'create',
  isLoading,
}: SaveViewDialogProps) {
  const [name, setName] = useState(initialName)
  const [isDefault, setIsDefault] = useState(false)

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, isDefault)
    setName('')
    setIsDefault(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setName(initialName); setIsDefault(false) } }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="font-poppins text-lg">
            {mode === 'create' ? 'Save view' : 'Rename view'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-inter">
            {mode === 'create'
              ? 'Save your current filters as a reusable view.'
              : 'Give this view a new name.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="view-name" className="text-xs font-poppins font-medium">View name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Active Engineering"
              className="h-9 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          {mode === 'create' && (
            <div className="flex items-center justify-between">
              <Label htmlFor="set-default" className="text-xs font-poppins font-medium text-muted-foreground">
                Set as default view
              </Label>
              <Switch
                id="set-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="font-poppins">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
            className="font-poppins"
          >
            {mode === 'create' ? 'Save view' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
