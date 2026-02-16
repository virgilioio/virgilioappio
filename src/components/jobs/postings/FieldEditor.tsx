import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2, Edit, Save, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PostingField, FieldType, SelectOptionData } from '@/hooks/useJobPostingFields'
import { supabase } from '@/lib/supabaseClient'

interface FieldEditorProps {
  field: PostingField
  onUpdate: (fieldId: string, updates: Partial<PostingField> & { select_options?: SelectOptionData[] }) => void
  onDelete: (fieldId: string) => void
  disabled?: boolean
  readOnly?: boolean
  dragHandlers?: {
    attributes: any
    listeners: any
  }
  isDefaultLibraryField?: boolean
}

const ALL_FIELD_TYPES: FieldType[] = ['text','number','email','url','textarea','select','checkbox','checkbox_group','date','file']

export function FieldEditor({ 
  field, 
  onUpdate, 
  onDelete, 
  disabled, 
  readOnly, 
  dragHandlers,
  isDefaultLibraryField 
}: FieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  
  // Local state for editing
  const [localLabel, setLocalLabel] = useState(field.field_label || '')
  const [localType, setLocalType] = useState(field.field_type || 'text')
  const [localRequired, setLocalRequired] = useState(field.is_required || false)
  const [localHelpText, setLocalHelpText] = useState(field.help_text || '')
  const [localAcceptedFileTypes, setLocalAcceptedFileTypes] = useState(field.accepted_file_types || '')
  const [localMaxFileSize, setLocalMaxFileSize] = useState<number | ''>(field.max_file_size_mb ?? '')
  const [localOptions, setLocalOptions] = useState<SelectOptionData[]>([])
  
  const handleEdit = async () => {
    setLocalLabel(field.field_label || '')
    setLocalType(field.field_type || 'text')
    setLocalRequired(field.is_required || false)
    setLocalHelpText(field.help_text || '')
    setLocalAcceptedFileTypes(field.accepted_file_types || '')
    setLocalMaxFileSize(field.max_file_size_mb ?? '')
    
    // Load existing select options from DB
    if (field.field_type === 'select' || field.field_type === 'checkbox_group') {
      const { data } = await supabase
        .from('posting_field_select_options')
        .select('option_value, option_label, display_order')
        .eq('posting_field_id', field.id)
        .order('display_order', { ascending: true })
      setLocalOptions((data || []).map(o => ({ option_value: o.option_value, option_label: o.option_label, display_order: o.display_order })))
    } else {
      setLocalOptions([])
    }
    
    setIsEditing(true)
  }
  
  const handleSave = () => {
    const updates: Partial<PostingField> & { select_options?: SelectOptionData[] } = {
      field_label: localLabel,
      field_type: localType,
      is_required: localRequired,
      help_text: localHelpText || null,
      accepted_file_types: localAcceptedFileTypes || null,
      max_file_size_mb: localMaxFileSize === '' ? null : localMaxFileSize,
    }
    if (localType === 'select' || localType === 'checkbox_group') {
      updates.select_options = localOptions
    }
    onUpdate(field.id, updates)
    setIsEditing(false)
  }
  
  const handleCancel = () => {
    setIsEditing(false)
  }

  // When type changes in edit mode, reset irrelevant fields
  useEffect(() => {
    if (localType === 'select' || localType === 'checkbox_group') {
      // keep options
    } else {
      setLocalOptions([])
    }
    if (localType !== 'file') {
      setLocalAcceptedFileTypes('')
      setLocalMaxFileSize('')
    }
  }, [localType])

  const addOption = () => {
    setLocalOptions(prev => [...prev, { option_value: '', option_label: '', display_order: prev.length }])
  }

  const removeOption = (index: number) => {
    setLocalOptions(prev => prev.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, key: 'option_value' | 'option_label', value: string) => {
    setLocalOptions(prev => prev.map((o, i) => i === index ? { ...o, [key]: value } : o))
  }

  const showHelpText = ['text', 'number', 'email', 'url', 'textarea', 'checkbox', 'checkbox_group', 'date'].includes(localType)
  const showOptions = ['select', 'checkbox_group'].includes(localType)
  const showFileConfig = localType === 'file'
  
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
            <div className="space-y-3">
              {/* Row 1: Label, Type, Required */}
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
                      {ALL_FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t === 'checkbox_group' ? 'Checkbox Group' : t}</SelectItem>
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

              {/* Type-specific config */}
              {showHelpText && (
                <Input
                  value={localHelpText}
                  onChange={(e) => setLocalHelpText(e.target.value)}
                  placeholder="Help text (shown below field)"
                />
              )}

              {showOptions && (
                <div className="space-y-2 border border-border/30 rounded-brand p-3">
                  <p className="text-xs font-medium text-muted-foreground">Options</p>
                  {localOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={opt.option_value}
                        onChange={(e) => updateOption(i, 'option_value', e.target.value)}
                        placeholder="Value"
                        className="flex-1"
                      />
                      <Input
                        value={opt.option_label}
                        onChange={(e) => updateOption(i, 'option_label', e.target.value)}
                        placeholder="Label"
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeOption(i)} className="shrink-0 h-8 w-8">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Option
                  </Button>
                </div>
              )}

              {showFileConfig && (
                <div className="grid md:grid-cols-2 gap-3">
                  <Input
                    value={localAcceptedFileTypes}
                    onChange={(e) => setLocalAcceptedFileTypes(e.target.value)}
                    placeholder="Accepted file types (e.g. .pdf,.docx)"
                  />
                  <Input
                    type="number"
                    value={localMaxFileSize}
                    onChange={(e) => setLocalMaxFileSize(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Max file size (MB)"
                  />
                </div>
              )}

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
                <div className="text-sm text-muted-foreground capitalize">{field.field_type === 'checkbox_group' ? 'Checkbox Group' : field.field_type}</div>
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
