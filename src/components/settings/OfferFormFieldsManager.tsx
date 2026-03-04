import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, MoveUp, MoveDown, List } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'

interface OfferFormFieldsManagerProps {
  formId: string
}

export function OfferFormFieldsManager({ formId }: OfferFormFieldsManagerProps) {
  const { fields, isLoading, createField, updateField, deleteField } = useOfferFormFields(formId)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<OfferFormField | null>(null)

  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text' as OfferFormField['field_type'],
    is_required: false,
    display_order: 0,
    placeholder_text: '',
    help_text: '',
    accepted_file_types: '',
    max_file_size_mb: 5
  })

  const fieldTypes = [
    { value: 'text', label: 'Text Input' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'select', label: 'Select Dropdown' },
    { value: 'date', label: 'Date Picker' },
    { value: 'number', label: 'Number Input' },
    { value: 'email', label: 'Email Input' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'file', label: 'File Upload' }
  ]

  const handleCreateField = async () => {
    try {
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.display_order)) : -1
      await createField({
        form_id: formId,
        ...formData,
        display_order: maxOrder + 1
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
      await updateField(editingField.id, formData)
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
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      display_order: field.display_order,
      placeholder_text: field.placeholder_text || '',
      help_text: field.help_text || '',
      accepted_file_types: field.accepted_file_types || '',
      max_file_size_mb: field.max_file_size_mb || 5
    })
    setEditingField(field)
  }

  const resetForm = () => {
    setFormData({
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      display_order: 0,
      placeholder_text: '',
      help_text: '',
      accepted_file_types: '',
      max_file_size_mb: 5
    })
  }

  const closeDialogs = () => {
    setIsCreateDialogOpen(false)
    setEditingField(null)
    resetForm()
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
                    <Badge variant="secondary">
                      {fieldTypes.find(t => t.value === field.field_type)?.label || field.field_type}
                    </Badge>
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
                <Label htmlFor="field_name">Field Name</Label>
                <Input
                  id="field_name"
                  value={formData.field_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, field_name: e.target.value }))}
                  placeholder="start_date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field_label">Field Label</Label>
                <Input
                  id="field_label"
                  value={formData.field_label}
                  onChange={(e) => setFormData(prev => ({ ...prev, field_label: e.target.value }))}
                  placeholder="Start Date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field_type">Field Type</Label>
                <Select
                  value={formData.field_type}
                  onValueChange={(value: OfferFormField['field_type']) => setFormData(prev => ({ ...prev, field_type: value }))}
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
              <div className="space-y-2">
                <Label htmlFor="is_required">Required Field</Label>
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    id="is_required"
                    checked={formData.is_required}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_required: checked }))}
                  />
                  <Label htmlFor="is_required">This field is required</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="placeholder_text">Placeholder Text</Label>
              <Input
                id="placeholder_text"
                value={formData.placeholder_text}
                onChange={(e) => setFormData(prev => ({ ...prev, placeholder_text: e.target.value }))}
                placeholder="Enter placeholder..."
              />
            </div>

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
                disabled={!formData.field_name.trim() || !formData.field_label.trim()}
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
