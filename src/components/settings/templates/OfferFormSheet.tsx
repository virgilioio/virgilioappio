import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { type OfferForm } from '@/hooks/useOfferForms'
import { Loader2 } from 'lucide-react'
import { OfferFormFieldsManager } from '../OfferFormFieldsManager'
import { Separator } from '@/components/ui/separator'

interface OfferFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId?: string
  forms: OfferForm[]
  createForm: (data: { name: string; description?: string }) => Promise<any>
  updateForm: (id: string, data: Partial<OfferForm>) => Promise<void>
}

export function OfferFormSheet({ open, onOpenChange, formId, forms, createForm, updateForm }: OfferFormSheetProps) {
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [activeFormId, setActiveFormId] = useState<string | undefined>(formId)

  const effectiveFormId = formId || activeFormId
  const isEditing = !!effectiveFormId
  const existingForm = forms.find(f => f.id === effectiveFormId)

  useEffect(() => {
    if (formId) {
      setActiveFormId(formId)
    } else if (!open) {
      setActiveFormId(undefined)
    }
  }, [formId, open])

  useEffect(() => {
    if (isEditing && existingForm) {
      setFormData({
        name: existingForm.name,
        description: existingForm.description || ''
      })
    } else if (!isEditing) {
      setFormData({ name: '', description: '' })
    }
  }, [effectiveFormId, existingForm, open])

  const handleSave = async () => {
    if (!formData.name.trim()) return

    try {
      setIsSaving(true)
      if (isEditing && effectiveFormId) {
        await updateForm(effectiveFormId, formData)
      } else {
        const newForm = await createForm(formData)
        if (newForm?.id) {
          setActiveFormId(newForm.id)
        }
      }
    } catch {
      // handled by hook
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Offer Form' : 'Create Offer Form'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update the offer form details and manage fields.' : 'Create a new offer form template that recruiters will fill out when making an offer.'}
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
              {isEditing ? 'Close' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>

        {effectiveFormId && (
          <>
            <Separator className="my-8" />
            <OfferFormFieldsManager formId={effectiveFormId} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
