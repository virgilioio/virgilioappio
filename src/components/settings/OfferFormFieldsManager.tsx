import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, MoveUp, MoveDown, List, Link2, DollarSign, MapPin } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import type { SalaryFieldConfig, LocationFieldConfig } from '@/hooks/useJobPostingFields'

const toSnakeCase = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

interface OfferFormFieldsManagerProps {
  formId: string
}

export function OfferFormFieldsManager({ formId }: OfferFormFieldsManagerProps) {
  const { fields, isLoading, createField, updateField, deleteField } = useOfferFormFields(formId)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<OfferFormField | null>(null)

  const [formData, setFormData] = useState({
    field_label: '',
    field_type: 'text' as OfferFormField['field_type'],
    is_required: false,
    display_order: 0,
    placeholder_text: '',
    help_text: '',
    accepted_file_types: '',
    max_file_size_mb: 5,
    salaryConfig: { currency: 'USD', period: 'annually' } as SalaryFieldConfig,
    locationConfig: { fields: ['city', 'state', 'country'] as ('city' | 'state' | 'country')[] } as LocationFieldConfig,
  })

  const fieldTypes = [
    { value: 'text', label: 'Text Input' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'select', label: 'Select Dropdown' },
    { value: 'date', label: 'Date Picker' },
    { value: 'number', label: 'Number Input' },
    { value: 'email', label: 'Email Input' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'file', label: 'File Upload' },
    { value: 'salary', label: 'Salary / Compensation' },
    { value: 'location', label: 'Location' },
  ]

  const handleCreateField = async () => {
    try {
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.display_order)) : -1
      const fieldName = toSnakeCase(formData.field_label)
      const field_config = formData.field_type === 'salary' ? formData.salaryConfig
        : formData.field_type === 'location' ? formData.locationConfig
        : undefined
      await createField({
        form_id: formId,
        field_name: fieldName,
        field_label: formData.field_label,
        field_type: formData.field_type,
        is_required: formData.is_required,
        display_order: maxOrder + 1,
        placeholder_text: formData.placeholder_text,
        help_text: formData.help_text,
        accepted_file_types: formData.accepted_file_types,
        max_file_size_mb: formData.max_file_size_mb,
        ...(field_config ? { field_config } : {}),
      })
      setIsCreateDialogOpen(false)
      resetForm()
    } catch {
      // handled by hook
    }
  }

  const handleUpdateField = async () => {
    if (!editingField) return
    try {
      const fieldName = toSnakeCase(formData.field_label)
      const field_config = formData.field_type === 'salary' ? formData.salaryConfig
        : formData.field_type === 'location' ? formData.locationConfig
        : null
      await updateField(editingField.id, {
        field_name: fieldName,
        field_label: formData.field_label,
        field_type: formData.field_type,
        is_required: formData.is_required,
        placeholder_text: formData.placeholder_text,
        help_text: formData.help_text,
        accepted_file_types: formData.accepted_file_types,
        max_file_size_mb: formData.max_file_size_mb,
        field_config,
      })
      setEditingField(null)
      resetForm()
    } catch {
      // handled by hook
    }
  }

  const handleDeleteField = async (field: OfferFormField) => {
    try {
      await deleteField(field.id)
    } catch {
      // handled by hook
    }
  }

  const moveField = async (field: OfferFormField, direction: 'up' | 'down') => {
    const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order)
    const currentIndex = sortedFields.findIndex(f => f.id === field.id)

    if (direction === 'up' && currentIndex > 0) {
      const targetField = sortedFields[currentIndex - 1]
      await updateField(field.id, { display_order: targetField.display_order })
      await updateField(targetField.id, { display_order: field.display_order })
    } else if (direction === 'down' && currentIndex < sortedFields.length - 1) {
      const targetField = sortedFields[currentIndex + 1]
      await updateField(field.id, { display_order: targetField.display_order })
      await updateField(targetField.id, { display_order: field.display_order })
    }
  }

  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (field: OfferFormField) => {
    setFormData({
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      display_order: field.display_order,
      placeholder_text: field.placeholder_text || '',
      help_text: field.help_text || '',
      accepted_file_types: field.accepted_file_types || '',
      max_file_size_mb: field.max_file_size_mb || 5,
      salaryConfig: (field.field_config as SalaryFieldConfig) || { currency: 'USD', period: 'annually' },
      locationConfig: (field.field_config as LocationFieldConfig) || { fields: ['city', 'state', 'country'] },
    })
    setEditingField(field)
  }

  const resetForm = () => {
    setFormData({
      field_label: '',
      field_type: 'text',
      is_required: false,
      display_order: 0,
      placeholder_text: '',
      help_text: '',
      accepted_file_types: '',
      max_file_size_mb: 5,
      salaryConfig: { currency: 'USD', period: 'annually' },
      locationConfig: { fields: ['city', 'state', 'country'] },
    })
  }

  const closeDialogs = () => {
    setIsCreateDialogOpen(false)
    setEditingField(null)
    resetForm()
  }

  const handleTypeChange = (value: OfferFormField['field_type']) => {
    const updates: Partial<typeof formData> = { field_type: value }
    if (value === 'salary' && !formData.field_label) updates.field_label = 'Salary'
    if (value === 'location' && !formData.field_label) updates.field_label = 'Location'
    setFormData(prev => ({ ...prev, ...updates }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <List className="h-4 w-4" />
          Form Fields
        </h3>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : fields.length === 0 ? (
        <div className="text-center py-8">
          <List className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No form fields yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add fields that recruiters will fill out when creating an offer
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Field Name</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields
              .sort((a, b) => a.display_order - b.display_order)
              .map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">{index + 1}</span>
                      <div className="flex flex-col">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveField(field, 'up')} disabled={index === 0}>
                          <MoveUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveField(field, 'down')} disabled={index === fields.length - 1}>
                          <MoveDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-1 rounded">{field.field_name}</code>
                  </TableCell>
                  <TableCell className="font-medium">{field.field_label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary">
                        {field.field_type === 'salary' && <DollarSign className="h-3 w-3 mr-1" />}
                        {field.field_type === 'location' && <MapPin className="h-3 w-3 mr-1" />}
                        {fieldTypes.find(t => t.value === field.field_type)?.label || field.field_type}
                      </Badge>
                      {field.field_type === 'salary' && field.field_config && (
                        <Badge variant="outline" className="text-xs">
                          {(field.field_config as SalaryFieldConfig).currency} / {(field.field_config as SalaryFieldConfig).period}
                        </Badge>
                      )}
                      {field.field_type === 'location' && field.field_config && (
                        <Badge variant="outline" className="text-xs">
                          {(field.field_config as LocationFieldConfig).fields?.map(f => f === 'city' ? 'City' : f === 'state' ? 'State' : 'Country').join(', ')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {field.is_required ? (
                      <Badge variant="destructive">Required</Badge>
                    ) : (
                      <Badge variant="outline">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(field)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Field</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{field.field_label}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteField(field)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Field Dialog */}
      <Dialog open={isCreateDialogOpen || !!editingField} onOpenChange={closeDialogs}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Form Field'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field_label">Field Label</Label>
                <Input
                  id="field_label"
                  value={formData.field_label}
                  onChange={(e) => setFormData(prev => ({ ...prev, field_label: e.target.value }))}
                  placeholder="e.g. Start Date"
                />
                {formData.field_label && (
                  <p className="text-xs text-muted-foreground">
                    Field name: <code className="bg-muted px-1 rounded">{toSnakeCase(formData.field_label)}</code>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="field_type">Field Type</Label>
                <Select
                  value={formData.field_type}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_required"
                checked={formData.is_required}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_required: checked }))}
              />
              <Label htmlFor="is_required">This field is required</Label>
            </div>

            {/* Salary config */}
            {formData.field_type === 'salary' && (
              <div className="bg-virgilio-purple/5 border border-virgilio-purple/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-virgilio-purple">
                  <Link2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Salary Configuration</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Currency</p>
                    <Select value={formData.salaryConfig.currency} onValueChange={(v) => setFormData(prev => ({ ...prev, salaryConfig: { ...prev.salaryConfig, currency: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['USD','EUR','GBP','CAD','AUD','CHF','JPY','INR','BRL','MXN','SGD','HKD','NZD','ZAR','AED','SAR'].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Period</p>
                    <Select value={formData.salaryConfig.period} onValueChange={(v: any) => setFormData(prev => ({ ...prev, salaryConfig: { ...prev.salaryConfig, period: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Location config */}
            {formData.field_type === 'location' && (
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
                        checked={formData.locationConfig.fields.includes(key)}
                        onCheckedChange={(checked) => {
                          setFormData(prev => ({
                            ...prev,
                            locationConfig: {
                              fields: checked
                                ? [...prev.locationConfig.fields, key]
                                : prev.locationConfig.fields.filter(f => f !== key)
                            }
                          }))
                        }}
                      />
                      <span className="text-sm">{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.field_type !== 'salary' && formData.field_type !== 'location' && (
              <div className="space-y-2">
                <Label htmlFor="placeholder_text">Placeholder Text</Label>
                <Input
                  id="placeholder_text"
                  value={formData.placeholder_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, placeholder_text: e.target.value }))}
                  placeholder="Enter placeholder..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="help_text">Help Text</Label>
              <Textarea
                id="help_text"
                value={formData.help_text}
                onChange={(e) => setFormData(prev => ({ ...prev, help_text: e.target.value }))}
                placeholder="Additional instructions for this field"
                rows={2}
              />
            </div>

            {formData.field_type === 'file' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accepted_file_types">Accepted File Types</Label>
                  <Input
                    id="accepted_file_types"
                    value={formData.accepted_file_types}
                    onChange={(e) => setFormData(prev => ({ ...prev, accepted_file_types: e.target.value }))}
                    placeholder=".pdf,.doc,.docx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_file_size_mb">Max File Size (MB)</Label>
                  <Input
                    id="max_file_size_mb"
                    type="number"
                    value={formData.max_file_size_mb}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_file_size_mb: parseInt(e.target.value) || 5 }))}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialogs}>Cancel</Button>
              <Button
                onClick={editingField ? handleUpdateField : handleCreateField}
                disabled={!formData.field_label.trim()}
              >
                {editingField ? 'Update Field' : 'Add Field'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
