import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2 } from 'lucide-react'
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
  // Local state for immediate input updates
  const [localLabel, setLocalLabel] = useState(field.field_label || '')
  const [localType, setLocalType] = useState(field.field_type || 'text')
  const [localRequired, setLocalRequired] = useState(field.is_required || false)
  
  // Refs to track if we need to sync changes
  const syncTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Update local state when field prop changes (from external updates)
  useEffect(() => {
    setLocalLabel(field.field_label || '')
    setLocalType(field.field_type || 'text')
    setLocalRequired(field.is_required || false)
  }, [field.field_label, field.field_type, field.is_required])
  
  // Debounced sync to parent
  const syncToParent = (updates: Partial<PostingField>) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      onUpdate(field.id, updates)
    }, 300) // 300ms debounce
  }
  
  const handleLabelChange = (value: string) => {
    setLocalLabel(value)
    syncToParent({ field_label: value })
  }
  
  const handleTypeChange = (value: FieldType) => {
    setLocalType(value)
    onUpdate(field.id, { field_type: value }) // Immediate for selects
  }
  
  const handleRequiredChange = (checked: boolean) => {
    setLocalRequired(checked)
    onUpdate(field.id, { is_required: checked }) // Immediate for checkboxes
  }
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])
  
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
          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <Input
                value={localLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                disabled={isDisabled}
                placeholder="Label"
              />
            </div>
            <div>
              <Select
                value={localType}
                onValueChange={handleTypeChange}
                disabled={isDisabled}
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
                onCheckedChange={handleRequiredChange}
                disabled={isDisabled}
              />
              <span className="ml-2 text-xs text-muted-foreground">Required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {field.source === 'library' ? 'Library' : 'Custom'}
              </span>
              {!readOnly && !isDefaultLibraryField && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onDelete(field.id)}
                  title="Delete field"
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}