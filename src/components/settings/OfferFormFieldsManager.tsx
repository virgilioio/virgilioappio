import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, List, Link2, Trash2 } from 'lucide-react'
import { FormField } from '@/components/ui/form-field'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig } from '@/hooks/useJobPostingFields'
import { SMART_FIELD_TYPES } from '@/components/shared/FormFieldEditor'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OfferFieldEditor } from './OfferFieldEditor'

const toSnakeCase = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

type OfferFieldType = OfferFormField['field_type']

const ALL_FIELD_TYPES: OfferFieldType[] = ['text', 'number', 'email', 'url', 'textarea', 'select', 'checkbox', 'date', 'file', 'salary', 'location', 'phone', 'recruiter', 'employment_type', 'work_location']

interface OfferFormFieldsManagerProps {
  formId: string
}

function SortableFieldRow({ id, children }: { id: string; children: (handlers: { attributes: any; listeners: any }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="w-full">
      {children({ attributes, listeners })}
    </div>
  )
}

export function OfferFormFieldsManager({ formId }: OfferFormFieldsManagerProps) {
  const { fields, isLoading, createField, updateField, deleteField } = useOfferFormFields(formId)

  // Add field form state
  const [label, setLabel] = useState('')
  const [type, setType] = useState<OfferFieldType>('text')
  const [required, setRequired] = useState(false)
  const [newHelpText, setNewHelpText] = useState('')
  const [newAcceptedFileTypes, setNewAcceptedFileTypes] = useState('')
  const [newMaxFileSize, setNewMaxFileSize] = useState<number | ''>('')
  const [newSalaryConfig, setNewSalaryConfig] = useState<SalaryFieldConfig>({ currency: 'USD', period: 'annually' })
  const [newLocationConfig, setNewLocationConfig] = useState<LocationFieldConfig>({ fields: ['city', 'state', 'country'] })
  const [newPhoneConfig, setNewPhoneConfig] = useState<PhoneFieldConfig>({ defaultCountryCode: '+1' })

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<OfferFormField | null>(null)

  // Drag
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    setOrderedIds(fields.map(f => f.id))
  }, [fields])

  // Reset type-specific state when type changes
  useEffect(() => {
    setNewHelpText('')
    setNewAcceptedFileTypes('')
    setNewMaxFileSize('')
    setNewSalaryConfig({ currency: 'USD', period: 'annually' })
    setNewLocationConfig({ fields: ['city', 'state', 'country'] })
    setNewPhoneConfig({ defaultCountryCode: '+1' })
    if (type === 'salary' && !label) setLabel('Salary')
    if (type === 'location' && !label) setLabel('Location')
    if (type === 'phone' && !label) setLabel('Phone Number')
    if (type === 'employment_type' && !label) setLabel('Employment Type')
    if (type === 'work_location' && !label) setLabel('Work Location')
  }, [type])

  const sortedFields = useMemo(() => {
    return orderedIds
      .map(id => fields.find(f => f.id === id))
      .filter(Boolean) as OfferFormField[]
  }, [orderedIds, fields])

  const activeField = useMemo(() => fields.find(f => f.id === activeId) || null, [fields, activeId])

  const handleAddField = async () => {
    if (!label.trim()) return
    const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.display_order)) : -1
    const fieldConfig = type === 'salary' ? newSalaryConfig : type === 'location' ? newLocationConfig : type === 'phone' ? newPhoneConfig : undefined
    try {
      await createField({
        form_id: formId,
        field_name: toSnakeCase(label),
        field_label: label.trim(),
        field_type: type,
        is_required: required,
        display_order: maxOrder + 1,
        help_text: newHelpText || undefined,
        accepted_file_types: newAcceptedFileTypes || undefined,
        max_file_size_mb: newMaxFileSize === '' ? undefined : newMaxFileSize,
        ...(fieldConfig ? { field_config: fieldConfig } : {}),
      })
      setLabel('')
      setType('text')
      setRequired(false)
      setNewHelpText('')
      setNewAcceptedFileTypes('')
      setNewMaxFileSize('')
      setNewSalaryConfig({ currency: 'USD', period: 'annually' })
      setNewLocationConfig({ fields: ['city', 'state', 'country'] })
      setNewPhoneConfig({ defaultCountryCode: '+1' })
    } catch {
      // handled by hook
    }
  }

  const handleUpdateField = async (id: string, updates: Partial<OfferFormField>) => {
    try {
      const fieldName = updates.field_label ? toSnakeCase(updates.field_label) : undefined
      await updateField(id, { ...updates, ...(fieldName ? { field_name: fieldName } : {}) })
    } catch {
      // handled by hook
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteField(deleteTarget.id)
    } catch {
      // handled by hook
    }
    setDeleteTarget(null)
  }

  const handleDragEnd = async (event: any) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedIds.indexOf(active.id)
    const newIndex = orderedIds.indexOf(over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const newOrder = arrayMove(orderedIds, oldIndex, newIndex)
    setOrderedIds(newOrder)

    // Persist new order silently, then refetch once
    const updates = newOrder
      .map((id, i) => ({ id, index: i, field: fields.find(f => f.id === id) }))
      .filter(({ field, index }) => field && field.display_order !== index)

    await Promise.all(updates.map(({ id, index }) => updateField(id, { display_order: index }, { silent: true })))
    if (updates.length > 0) {
      refetchFields()
    }
  }

  const showHelpText = ['text', 'number', 'email', 'url', 'textarea', 'checkbox', 'date'].includes(type)
  const showFileConfig = type === 'file'
  const showSalaryConfig = type === 'salary'
  const showLocationConfig = type === 'location'
  const showPhoneConfig = type === 'phone'

  return (
    <div className="space-y-6">
      {/* Existing Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <List className="h-4 w-4" />
            Form Fields
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading fields...</p>
          ) : sortedFields.length === 0 ? (
            <div className="text-center py-8">
              <List className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No form fields yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add fields that recruiters will fill out when creating an offer
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sortedFields.map((field) => (
                    <SortableFieldRow key={field.id} id={field.id}>
                      {({ attributes, listeners }) => (
                        <OfferFieldEditor
                          field={field}
                          onUpdate={handleUpdateField}
                          onDelete={(id) => {
                            const f = fields.find(ff => ff.id === id)
                            if (f) setDeleteTarget(f)
                          }}
                          dragHandlers={{ attributes, listeners }}
                        />
                      )}
                    </SortableFieldRow>
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeId ? (
                  <div className="p-3 border border-border/40 rounded-brand bg-background shadow-lg w-[280px]">
                    <div className="text-sm font-medium">{activeField?.field_label || 'Field'}</div>
                    <div className="text-xs text-muted-foreground capitalize">{activeField?.field_type}</div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add Field */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Label">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Start Date"
              />
            </FormField>
            <FormField label="Type">
              <Select value={type} onValueChange={(v: OfferFieldType) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    {ALL_FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        <span className="flex items-center gap-2">
                          {t === 'salary' ? 'Salary' : t === 'location' ? 'Location' : t === 'phone' ? 'Phone' : t === 'employment_type' ? 'Employment Type' : t === 'work_location' ? 'Work Location' : t}
                          {SMART_FIELD_TYPES.includes(t as any) && (
                            <span className="text-[10px] font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-full leading-none">
                              Smart
                            </span>
                          )}
                        </span>
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Required">
              <div className="flex items-center h-10">
                <Checkbox checked={required} onCheckedChange={(c) => setRequired(!!c)} />
                <span className="ml-2 text-sm text-muted-foreground">Must be filled</span>
              </div>
            </FormField>
          </div>

          {showHelpText && (
            <FormField label="Help Text (optional)">
              <Input
                value={newHelpText}
                onChange={(e) => setNewHelpText(e.target.value)}
                placeholder="Help text shown below the field"
              />
            </FormField>
          )}

          {showFileConfig && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Accepted File Types">
                <Input
                  value={newAcceptedFileTypes}
                  onChange={(e) => setNewAcceptedFileTypes(e.target.value)}
                  placeholder="e.g. .pdf,.docx,.doc"
                />
              </FormField>
              <FormField label="Max File Size (MB)">
                <Input
                  type="number"
                  value={newMaxFileSize}
                  onChange={(e) => setNewMaxFileSize(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 10"
                />
              </FormField>
            </div>
          )}

          {showSalaryConfig && (
            <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-virgilio-purple">
                <Link2 className="h-4 w-4" />
                <span className="text-sm font-medium">Salary Configuration</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Currency">
                  <Select value={newSalaryConfig.currency} onValueChange={(v) => setNewSalaryConfig(prev => ({ ...prev, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['USD','EUR','GBP','CAD','AUD','CHF','JPY','INR','BRL','MXN','SGD','HKD','NZD','ZAR','AED','SAR'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Period">
                  <Select value={newSalaryConfig.period} onValueChange={(v: any) => setNewSalaryConfig(prev => ({ ...prev, period: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
          )}

          {showLocationConfig && (
            <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-virgilio-purple">
                <Link2 className="h-4 w-4" />
                <span className="text-sm font-medium">Location Configuration</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sub-fields to include</p>
                {([['city', 'City'], ['state', 'State / Province'], ['country', 'Country']] as const).map(([key, lbl]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      checked={newLocationConfig.fields.includes(key)}
                      onCheckedChange={(checked) => {
                        setNewLocationConfig(prev => ({
                          fields: checked
                            ? [...prev.fields, key]
                            : prev.fields.filter(f => f !== key)
                        }))
                      }}
                    />
                    <span className="text-sm">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPhoneConfig && (
            <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-virgilio-purple">
                <Link2 className="h-4 w-4" />
                <span className="text-sm font-medium">Phone Configuration</span>
              </div>
              <FormField label="Default Country Code">
                <Select value={newPhoneConfig.defaultCountryCode || '+1'} onValueChange={(v) => setNewPhoneConfig({ defaultCountryCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { code: '+1', flag: '🇺🇸', name: 'United States' },
                      { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
                      { code: '+33', flag: '🇫🇷', name: 'France' },
                      { code: '+49', flag: '🇩🇪', name: 'Germany' },
                      { code: '+91', flag: '🇮🇳', name: 'India' },
                      { code: '+61', flag: '🇦🇺', name: 'Australia' },
                      { code: '+55', flag: '🇧🇷', name: 'Brazil' },
                      { code: '+81', flag: '🇯🇵', name: 'Japan' },
                      { code: '+971', flag: '🇦🇪', name: 'UAE' },
                    ].map(cc => (
                      <SelectItem key={cc.code} value={cc.code}>{cc.flag} {cc.code} — {cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleAddField} disabled={!label.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Add Custom Field
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.field_label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
