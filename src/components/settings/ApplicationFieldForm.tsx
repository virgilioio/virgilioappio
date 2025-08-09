import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { FieldType, ApplicationField, useApplicationFields } from '@/hooks/useApplicationFields'

interface SelectOption { value: string; label: string }
interface ValidationRule { type: string; value: string; message: string }

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File Upload' },
]

const FILE_TYPES = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPEG Image' },
  { value: 'image/png', label: 'PNG Image' },
  { value: 'image/gif', label: 'GIF Image' },
  { value: 'application/msword', label: 'Word Document' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word Document (DOCX)' },
  { value: 'text/plain', label: 'Text File' },
]

export function ApplicationFieldForm({ field, onClose, onSaved }: { field?: ApplicationField | null; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const { createField, updateField, fields } = useApplicationFields()
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text' as FieldType,
    is_required: false, // repurposed as "is_default" toggle in the UI
    display_order: 1,
    placeholder_text: '',
    help_text: '',
    accepted_file_types: [] as string[],
    max_file_size_mb: 5,
  })

  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([])
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([])

  useEffect(() => {
    if (field) {
      setFormData({
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        is_required: field.is_default, // initialize from is_default
        display_order: field.display_order,
        placeholder_text: field.placeholder_text || '',
        help_text: field.help_text || '',
        accepted_file_types: field.accepted_file_types ? JSON.parse(field.accepted_file_types) : [],
        max_file_size_mb: field.max_file_size_mb || 5,
      })

      const existing = fields.find((f) => f.id === field.id)
      if (existing) {
        setSelectOptions(
          (existing.select_options || []).map((o) => ({ value: o.option_value, label: o.option_label }))
        )
        setValidationRules(
          (existing.validation_rules || []).map((r) => ({ type: r.rule_type, value: r.rule_value, message: r.error_message }))
        )
      }
    } else {
      setFormData({
        field_name: '',
        field_label: '',
        field_type: 'text',
        is_required: false, // default not auto-included
        display_order: 1,
        placeholder_text: '',
        help_text: '',
        accepted_file_types: [],
        max_file_size_mb: 5,
      })
      setSelectOptions([])
      setValidationRules([])
    }
  }, [field, fields])

  const updateForm = (key: string, value: any) => setFormData((p) => ({ ...p, [key]: value }))

  const addSelectOption = () => setSelectOptions((p) => [...p, { value: '', label: '' }])
  const updateSelectOption = (idx: number, key: 'value' | 'label', value: string) =>
    setSelectOptions((p) => p.map((o, i) => (i === idx ? { ...o, [key]: value } : o)))
  const removeSelectOption = (idx: number) => setSelectOptions((p) => p.filter((_, i) => i !== idx))

  const addValidationRule = () => setValidationRules((p) => [...p, { type: '', value: '', message: '' }])
  const updateValidationRule = (idx: number, key: 'type' | 'value' | 'message', value: string) =>
    setValidationRules((p) => p.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  const removeValidationRule = (idx: number) => setValidationRules((p) => p.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.field_type === 'select' && selectOptions.length === 0) {
      alert('Select fields must have at least one option')
      return
    }

    setIsLoading(true)
    try {
      const payload: any = {
        field_name: formData.field_name,
        field_label: formData.field_label,
        field_type: formData.field_type,
        // For library: use is_default as the new semantic toggle.
        is_default: formData.is_required,
        // Keep is_required off at the library level for compatibility.
        is_required: false,
        display_order: formData.display_order,
        placeholder_text: formData.placeholder_text || null,
        help_text: formData.help_text || null,
        accepted_file_types:
          formData.field_type === 'file' && formData.accepted_file_types.length > 0
            ? JSON.stringify(formData.accepted_file_types)
            : null,
        max_file_size_mb: formData.field_type === 'file' ? formData.max_file_size_mb : null,
      }

      if (field) {
        await updateField(field.id, payload, formData.field_type === 'select' ? selectOptions : undefined, validationRules)
      } else {
        await createField(payload, formData.field_type === 'select' ? selectOptions : undefined, validationRules)
      }

      await onSaved()
      onClose()
    } catch (err) {
      console.error('Error saving application field:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const FILE_VALIDATION_APPLIES = formData.field_type === 'file'
  const SHOW_SELECT_OPTIONS = formData.field_type === 'select'
  const SHOW_VALIDATION = ['text', 'textarea', 'number'].includes(formData.field_type)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Field Name" required htmlFor="field_name">
          <Input
            id="field_name"
            value={formData.field_name}
            onChange={(e) => updateForm('field_name', e.target.value)}
            placeholder="e.g., first_name, portfolio_url"
            required
          />
        </FormField>
        <FormField label="Display Label" required htmlFor="field_label">
          <Input
            id="field_label"
            value={formData.field_label}
            onChange={(e) => updateForm('field_label', e.target.value)}
            placeholder="e.g., First Name, Portfolio URL"
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Field Type" required htmlFor="field_type">
          <Select value={formData.field_type} onValueChange={(v: FieldType) => updateForm('field_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Display Order" htmlFor="display_order">
          <Input
            id="display_order"
            type="number"
            min={1}
            value={formData.display_order}
            onChange={(e) => updateForm('display_order', parseInt(e.target.value))}
          />
        </FormField>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="is_default" checked={formData.is_required} onCheckedChange={(c) => updateForm('is_required', c)} />
        <label htmlFor="is_default" className="text-sm font-medium">Default field (auto-add to new job posts)</label>
      </div>

      <FormField label="Placeholder Text" htmlFor="placeholder_text">
        <Input
          id="placeholder_text"
          value={formData.placeholder_text}
          onChange={(e) => updateForm('placeholder_text', e.target.value)}
          placeholder="Placeholder text shown in the input"
        />
      </FormField>

      <FormField label="Help Text" htmlFor="help_text">
        <Textarea
          id="help_text"
          value={formData.help_text}
          onChange={(e) => updateForm('help_text', e.target.value)}
          placeholder="Additional help text to guide applicants"
          rows={2}
        />
      </FormField>

      {FILE_VALIDATION_APPLIES && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">File Upload Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Maximum File Size (MB)" htmlFor="max_file_size">
              <Input
                id="max_file_size"
                type="number"
                min={1}
                max={50}
                value={formData.max_file_size_mb}
                onChange={(e) => updateForm('max_file_size_mb', parseInt(e.target.value))}
              />
            </FormField>

            <FormField label="Accepted File Types">
              <div className="grid grid-cols-2 gap-2">
                {FILE_TYPES.map((ft) => (
                  <div key={ft.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={ft.value}
                      checked={formData.accepted_file_types.includes(ft.value)}
                      onCheckedChange={() =>
                        updateForm(
                          'accepted_file_types',
                          formData.accepted_file_types.includes(ft.value)
                            ? formData.accepted_file_types.filter((x) => x !== ft.value)
                            : [...formData.accepted_file_types, ft.value]
                        )
                      }
                    />
                    <label htmlFor={ft.value} className="text-sm">{ft.label}</label>
                  </div>
                ))}
              </div>
              {formData.accepted_file_types.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.accepted_file_types.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {FILE_TYPES.find((ft) => ft.value === t)?.label || t}
                    </Badge>
                  ))}
                </div>
              )}
            </FormField>
          </CardContent>
        </Card>
      )}

      {formData.field_type === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Select Options
              <Button type="button" variant="outline" size="sm" onClick={addSelectOption}>
                <Plus className="h-4 w-4 mr-1" /> Add Option
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectOptions.map((opt, i) => (
              <div key={i} className="flex gap-2 items-end">
                <FormField label="Value" className="flex-1">
                  <Input value={opt.value} onChange={(e) => updateSelectOption(i, 'value', e.target.value)} placeholder="option_value" required />
                </FormField>
                <FormField label="Label" className="flex-1">
                  <Input value={opt.label} onChange={(e) => updateSelectOption(i, 'label', e.target.value)} placeholder="Display Label" required />
                </FormField>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSelectOption(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {selectOptions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No options added yet. Click "Add Option".</p>
            )}
          </CardContent>
        </Card>
      )}

      {['text', 'textarea', 'number'].includes(formData.field_type) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Validation Rules
              <Button type="button" variant="outline" size="sm" onClick={addValidationRule}>
                <Plus className="h-4 w-4 mr-1" /> Add Rule
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {validationRules.map((rule, i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label="Type">
                      <Input value={rule.type} onChange={(e) => updateValidationRule(i, 'type', e.target.value)} placeholder="e.g., min_length, max_length, pattern" />
                    </FormField>
                    <FormField label="Value">
                      <Input value={rule.value} onChange={(e) => updateValidationRule(i, 'value', e.target.value)} placeholder="e.g., 2, 255, ^[A-Za-z]+$" />
                    </FormField>
                    <FormField label="Error Message">
                      <Input value={rule.message} onChange={(e) => updateValidationRule(i, 'message', e.target.value)} placeholder="What to show when validation fails" />
                    </FormField>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeValidationRule(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {validationRules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No validation rules added yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{field ? 'Save Changes' : 'Create Field'}</Button>
      </div>
    </form>
  )
}
