import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2, Edit, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PostingField, FieldType } from '@/hooks/useJobPostingFields'

interface FieldEditorProps {
  field: PostingField
  onUpdate: (fieldId: string, updates: Partial<PostingField>) => void
  onDelete: (fieldId: string) => void
  disabled?: boolean
  readOnly?: boolean
  dragHandlers?: {
    attributes: any
    listeners: any
  }
  isDefaultLibraryField?: boolean
}

export function FieldEditor({ 
  field, 
  onUpdate, 
  onDelete, 
  disabled, 
  readOnly, 
  dragHandlers,
  isDefaultLibraryField 
}: FieldEditorProps) {
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  
  // Local state for editing
  const [localLabel, setLocalLabel] = useState(field.field_label || '')
  const [localType, setLocalType] = useState(field.field_type || 'text')
  const [localRequired, setLocalRequired] = useState(field.is_required || false)
  
  const handleEdit = () => {
    // Reset local state to current field values when entering edit mode
    setLocalLabel(field.field_label || '')
    setLocalType(field.field_type || 'text')
    setLocalRequired(field.is_required || false)
    setIsEditing(true)
  }
  
  const handleSave = () => {
    onUpdate(field.id, {
      field_label: localLabel,
      field_type: localType,
      is_required: localRequired
    })
    setIsEditing(false)
  }
  
  const handleCancel = () => {
    // Reset local state to field values
    setLocalLabel(field.field_label || '')
    setLocalType(field.field_type || 'text')
    setLocalRequired(field.is_required || false)
    setIsEditing(false)
  }
  
  const isDisabled = disabled || readOnly || isDefaultLibraryField
  
  return (
    <div className={cn(
      "p-3 border border-border/40 rounded-brand flex-1",
      isDefaultLibraryField && 'bg-muted/20'
    )}>
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          {...dragHandlers?.attributes}
          {...dragHandlers?.listeners}
          disabled={isDisabled}
          title="Drag to reorder"
          className="self-center shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {isEditing ? (
            // Edit Mode
            <div className="space-y-3">
              <div className="grid md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-2">
                  <Input
                    value={localLabel}
                    onChange={(e) => setLocalLabel(e.target.value)}
                    placeholder="Label"
                    autoFocus
                  />
                </div>
                <div>
                  <Select
                    value={localType}
                    onValueChange={(value: FieldType) => setLocalType(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {(['text','number','email','url','textarea','select','checkbox','date','file'] as FieldType[]).map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center h-10">
                  <Checkbox
                    checked={localRequired}
                    onCheckedChange={(checked) => setLocalRequired(checked as boolean)}
                  />
                  <span className="ml-2 text-xs text-muted-foreground">Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {field.source === 'library' ? 'Library' : 'Custom'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  className="h-8"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // View Mode
            <div className="grid md:grid-cols-6 gap-3 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-medium">{field.field_label}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground capitalize">{field.field_type}</div>
              </div>
              <div className="flex items-center">
                <div className="text-sm text-muted-foreground">
                  {field.is_required ? 'Required' : 'Optional'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {field.source === 'library' ? 'Library' : 'Custom'}
                </span>
                {!readOnly && !isDefaultLibraryField && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="h-8"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onDelete(field.id)}
                      title="Delete field"
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}