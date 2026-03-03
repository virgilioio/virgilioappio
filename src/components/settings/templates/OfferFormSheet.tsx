import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { useOfferForms, type OfferFormsContext } from '@/hooks/useOfferForms'
import { Loader2 } from 'lucide-react'

interface OfferFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId?: string
  context?: OfferFormsContext
}

export function OfferFormSheet({ open, onOpenChange, formId, context = 'organization' }: OfferFormSheetProps) {
  const { forms, createForm, updateForm } = useOfferForms(context)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [isSaving, setIsSaving] = useState(false)

  const isEditing = !!formId
  const existingForm = forms.find(f => f.id === formId)

  useEffect(() => {
    if (isEditing && existingForm) {
      setFormData({
        name: existingForm.name,
        description: existingForm.description || ''
      })
    } else if (!isEditing) {
      setFormData({ name: '', description: '' })
    }
  }, [formId, existingForm, open])

  const handleSave = async () => {
    if (!formData.name.trim()) return

    try {
      setIsSaving(true)
      if (isEditing && formId) {
        await updateForm(formId, formData)
      } else {
        await createForm(formData)
      }
      onOpenChange(false)
    } catch {
      // handled by hook
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Offer Form' : 'Create Offer Form'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update the offer form details.' : 'Create a new offer form template that recruiters will fill out when making an offer.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <FormField label="Form Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Standard Full-Time Offer"
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe when this form should be used..."
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
