import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Department } from '@/hooks/useDepartments'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Department | null
  onSubmit: (data: { name: string; description?: string | null }) => Promise<void> | void
  isSubmitting?: boolean
}

export function DepartmentFormDialog({ open, onOpenChange, initial, onSubmit, isSubmitting }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
    }
  }, [open, initial])

  const isEdit = !!initial
  const canSubmit = name.trim().length > 0 && !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    await onSubmit({ name: name.trim(), description: description.trim() || null })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit department' : 'Create department'}</DialogTitle>
          <DialogDescription>
            Departments group jobs by function (Sales, People, Engineering…). They are shared across all clients in your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              autoFocus
              disabled={initial?.is_system}
            />
            {initial?.is_system && (
              <p className="text-xs text-text-tertiary">The default department cannot be renamed.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-description">Description (optional)</Label>
            <Textarea
              id="dept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about this department."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create department'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
