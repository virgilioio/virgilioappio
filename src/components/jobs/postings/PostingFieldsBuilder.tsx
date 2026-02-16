
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useApplicationFields } from '@/hooks/useApplicationFields'
import { useJobPostingFields, FieldType, PostingField, SelectOptionData } from '@/hooks/useJobPostingFields'
import { FormField } from '@/components/ui/form-field'
import { GripVertical, Plus, Trash2, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { FieldEditor } from './FieldEditor'

interface PostingFieldsBuilderProps {
  postingId: string
  readOnly?: boolean
}

export function PostingFieldsBuilder({ postingId, readOnly }: PostingFieldsBuilderProps) {
  const { fields: libraryFields, isLoading: loadingLibrary } = useApplicationFields()
  const {
    fields,
    isLoading,
    refetch,
    addCustomField,
    addFieldFromLibrary,
    updateField,
    deleteField,
    reorderFields
  } = useJobPostingFields(postingId)
  
  const { toast } = useToast()

  // Local state for all changes until save
  const [editedFields, setEditedFields] = useState<Record<string, Partial<PostingField>>>({})
  const [pendingAdditions, setPendingAdditions] = useState<Array<{ tempId: string; field: Omit<PostingField, 'id' | 'created_at' | 'updated_at'> }>>([])
  const [pendingLibraryAdditions, setPendingLibraryAdditions] = useState<Array<{ tempId: string; libraryId: string }>>([])
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Add Custom Field form
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [required, setRequired] = useState(false)
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('')
  
  // Type-specific config for Add Custom Field
  const [newHelpText, setNewHelpText] = useState('')
  const [newAcceptedFileTypes, setNewAcceptedFileTypes] = useState('')
  const [newMaxFileSize, setNewMaxFileSize] = useState<number | ''>('')
  const [newOptions, setNewOptions] = useState<Array<{ option_value: string; option_label: string }>>([])

  // Reset type-specific state when type changes
  useEffect(() => {
    setNewHelpText('')
    setNewAcceptedFileTypes('')
    setNewMaxFileSize('')
    setNewOptions([])
  }, [type])

  // Initialize order from fetched fields
  useEffect(() => {
    setOrderedIds(fields.map((f) => f.id))
  }, [fields])

  // Helper to get field value (from edited state or original) - memoized to prevent re-renders
  const getFieldValue = useCallback((field: PostingField, key: keyof PostingField) => {
    return editedFields[field.id]?.[key] ?? field[key]
  }, [editedFields])

  // Helper to update local state - memoized to prevent re-renders
  const updateLocalField = useCallback((fieldId: string, updates: Partial<PostingField>) => {
    setEditedFields(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], ...updates }
    }))
  }, [])

  // Get combined fields (existing + pending - deleted)
  const displayFields = useMemo(() => {
    const existingFields = fields.filter(f => !deletedIds.has(f.id))
    const customFields = pendingAdditions.map(p => ({
      ...p.field,
      id: p.tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as PostingField))
    const libraryBasedFields = pendingLibraryAdditions.map(p => {
      const libField = libraryFields.find(f => f.id === p.libraryId)
      return {
        id: p.tempId,
        posting_id: postingId,
        field_label: libField?.field_label || '',
        field_name: libField?.field_name || '',
        field_type: libField?.field_type || 'text',
        is_required: libField?.is_required || false,
        display_order: 0,
        column_span: 4,
        source: 'library' as const,
        application_field_id: p.libraryId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as PostingField
    })
    
    const allFields = [...existingFields, ...customFields, ...libraryBasedFields]
    
    // Apply edited changes to each field before ordering
    const fieldsWithEdits = allFields.map(field => {
      const edits = editedFields[field.id]
      if (edits) {
        return { ...field, ...edits }
      }
      return field
    })
    
    // Apply ordering
    return orderedIds
      .map(id => fieldsWithEdits.find(f => f.id === id))
      .filter(Boolean) as PostingField[]
  }, [fields, deletedIds, pendingAdditions, pendingLibraryAdditions, orderedIds, libraryFields, postingId, editedFields])

  // Check if there are any changes
  const hasChanges = useMemo(() => {
    return Object.keys(editedFields).length > 0 || 
           deletedIds.size > 0 || 
           pendingAdditions.length > 0 || 
           pendingLibraryAdditions.length > 0 ||
           JSON.stringify(orderedIds) !== JSON.stringify(fields.map(f => f.id))
  }, [editedFields, deletedIds, pendingAdditions, pendingLibraryAdditions, orderedIds, fields])

  // Save all changes
  const handleSaveChanges = async () => {
    if (!hasChanges) return
    
    setIsSaving(true)
    try {
      // 1. Delete fields
      for (const id of deletedIds) {
        await deleteField(id)
      }

      // 2. Add custom fields
      for (const addition of pendingAdditions) {
        await addCustomField(addition.field)
      }

      // 3. Add library fields
      for (const addition of pendingLibraryAdditions) {
        const libField = libraryFields.find(f => f.id === addition.libraryId)
        if (libField) {
          await addFieldFromLibrary(libField)
        }
      }

      // 4. Update edited fields
      const updates = Object.entries(editedFields).map(([fieldId, changes]) => 
        updateField(fieldId, changes)
      )
      await Promise.all(updates)

      // 5. Update order (only for fields that still exist)
      await refetch()
      if (orderedIds.length > 0) {
        const validIds = orderedIds.filter(id => !deletedIds.has(id) && !id.startsWith('temp-'))
        if (validIds.length > 0) {
          await reorderFields(validIds)
        }
      }
      
      // Clear all local state
      setEditedFields({})
      setDeletedIds(new Set())
      setPendingAdditions([])
      setPendingLibraryAdditions([])
      
      await refetch()
      
      toast({
        title: "Changes saved",
        description: "All changes have been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Error saving changes", 
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddCustom = async () => {
    if (!label.trim()) return
    
    await addCustomField({
      field_label: label.trim(),
      field_type: type,
      is_required: required,
      help_text: newHelpText || undefined,
      accepted_file_types: newAcceptedFileTypes || undefined,
      max_file_size_mb: newMaxFileSize === '' ? undefined : newMaxFileSize,
      select_options: (type === 'select' || type === 'checkbox_group') && newOptions.length > 0
        ? newOptions.map((o, i) => ({ ...o, display_order: i }))
        : undefined,
    })
    
    setLabel('')
    setType('text')
    setRequired(false)
    setNewHelpText('')
    setNewAcceptedFileTypes('')
    setNewMaxFileSize('')
    setNewOptions([])
  }

  const availableLibraryFields = useMemo(() => libraryFields, [libraryFields])
  const defaultLibraryIds = useMemo(() => new Set(availableLibraryFields.filter((f) => f.is_default).map((f) => f.id)), [availableLibraryFields])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const [isDragging, setIsDragging] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeField = useMemo(() => displayFields.find((f) => f.id === activeId) || null, [displayFields, activeId])
  const computeRows = (list: PostingField[]) => {
    const rows: PostingField[][] = []
    let current: PostingField[] = []
    let sum = 0
    for (const f of list) {
      const span = f.column_span ?? 4
      if (sum + span > 4) {
        rows.push(current)
        current = [f]
        sum = span
      } else {
        current.push(f)
        sum += span
      }
    }
    if (current.length) rows.push(current)
    return rows
  }

  const rows = useMemo(() => computeRows(displayFields), [displayFields])

  function DropBox({ id, orientation }: { id: string; orientation: 'row' | 'col' }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return (
      <div
        ref={setNodeRef}
        className={cn(
          orientation === 'row' ? 'h-8 w-full my-2' : 'h-24 w-3 mx-1',
          'rounded-brand border border-dashed transition-colors',
          isOver ? 'border-primary bg-primary/10' : 'border-border/40 bg-transparent'
        )}
      />
    )
  }

  function handleDragStart(event: any) {
    setIsDragging(true)
    setActiveId(event.active?.id as string)
  }

  function handleDragEnd(event: any) {
    setIsDragging(false)
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const overId: string = String(over.id)

    const oldIndex = displayFields.findIndex((f) => f.id === active.id)
    if (oldIndex < 0) return

    const insertAt = (list: PostingField[], index: number, item: PostingField) => {
      const copy = list.filter((x) => x.id !== item.id)
      const pos = Math.max(0, Math.min(index, copy.length))
      copy.splice(pos, 0, item)
      return copy
    }

    // Drop into a row boundary
    if (overId.startsWith('row-')) {
      const rows = computeRows(displayFields)
      const rowIdx = parseInt(overId.split('-')[1] || '0', 10)
      // insertion index is the number of items in prior rows
      const insertionIndex = rows.slice(0, rowIdx).reduce((acc, r) => acc + r.length, 0)
      const activeItem = displayFields[oldIndex]
      const newOrderFields = insertAt(displayFields, insertionIndex, activeItem)

      // Store span change locally
      if ((activeItem.column_span ?? 4) !== 4) {
        updateLocalField(activeItem.id, { column_span: 4 })
      }

      setOrderedIds(newOrderFields.map((f) => f.id))
      return
    }

    // Drop beside a specific field
    if (overId.startsWith('beside|')) {
      const parts = overId.split('|') // beside|{id}|left|right
      const targetId = parts[1]
      const side = parts[2]
      const targetIndex = displayFields.findIndex((f) => f.id === targetId)
      if (targetIndex < 0) return
      const activeItem = displayFields[oldIndex]
      const after = side === 'right'
      const insertionIndex = targetIndex + (after ? 1 : 0)
      const newOrderFields = insertAt(displayFields, insertionIndex, activeItem)

      // Recompute rows after insertion but force active to minimal span so it joins the target row
      const tempForRows = newOrderFields.map((it) => it.id === activeItem.id ? { ...it, column_span: 1 } : it)
      const rowsAfter = computeRows(tempForRows)
      // Find the row containing targetId (and thus the active item now)
      let rowContaining: PostingField[] | null = null
      for (const r of rowsAfter) {
        if (r.some((x) => x.id === targetId)) { rowContaining = r; break }
      }
      if (!rowContaining) rowContaining = rowsAfter[0] || []

      // Assign equalized spans for that row - store locally
      const len = rowContaining.length
      const spanMap = new Map<string, number>()
      if (len <= 1) {
        spanMap.set(rowContaining[0].id, 4)
      } else if (len === 2) {
        spanMap.set(rowContaining[0].id, 2)
        spanMap.set(rowContaining[1].id, 2)
      } else if (len === 3) {
        spanMap.set(rowContaining[0].id, 1)
        spanMap.set(rowContaining[1].id, 1)
        spanMap.set(rowContaining[2].id, 2)
      } else {
        rowContaining.forEach((it) => spanMap.set(it.id, 1))
      }

      rowContaining.forEach((it) => {
        const span = spanMap.get(it.id) ?? 4
        if ((it.column_span ?? 4) !== span) {
          updateLocalField(it.id, { column_span: span })
        }
      })

      setOrderedIds(newOrderFields.map((f) => f.id))
      return
    }

    // Default sortable behavior: reorder without changing spans
    const overIndex = displayFields.findIndex((f) => f.id === over.id)
    if (overIndex < 0) return
    const newOrder = arrayMove(displayFields, oldIndex, overIndex).map((f) => f.id)
    setOrderedIds(newOrder)
  }

  function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: (handlers: { attributes: any; listeners: any }) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !!disabled })
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Form Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading fields...</p>
          ) : displayFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Add from library or create a custom field.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={displayFields.map((f) => f.id)} strategy={rectSortingStrategy}>
                <div className="space-y-2">
                  {isDragging && <DropBox id={`row-0`} orientation="row" />}
                  {rows.map((row, rIdx) => (
                    <div key={`row-${rIdx}`} className="w-full">
                      <div className="grid w-full grid-cols-1 md:grid-cols-4 gap-3">
                        {row.map((f) => (
                          <div key={f.id} className="flex items-stretch w-full min-w-0" style={{ gridColumn: `span ${f.column_span || 4} / span ${f.column_span || 4}` }}>
                            {isDragging && <DropBox id={`beside|${f.id}|left`} orientation="col" />}
                             <SortableRow id={f.id} disabled={(f.source === 'library' && f.application_field_id && defaultLibraryIds.has(f.application_field_id))}>
                               {({ attributes, listeners }) => (
                                 <FieldEditor
                                    field={f}
                                    onUpdate={async (fieldId, updates) => {
                                      if (fieldId.startsWith('temp-')) {
                                        // For pending fields, just update local state
                                        updateLocalField(fieldId, updates)
                                      } else {
                                        // For existing fields, persist directly to DB
                                        await updateField(fieldId, updates)
                                        await refetch()
                                      }
                                    }}
                                    onDelete={(fieldId) => {
                                     if (fieldId.startsWith('temp-')) {
                                       setPendingAdditions(prev => prev.filter(p => p.tempId !== fieldId))
                                       setPendingLibraryAdditions(prev => prev.filter(p => p.tempId !== fieldId))
                                       setOrderedIds(prev => prev.filter(id => id !== fieldId))
                                     } else {
                                       setDeletedIds(prev => new Set([...prev, fieldId]))
                                       setOrderedIds(prev => prev.filter(id => id !== fieldId))
                                     }
                                   }}
                                   disabled={readOnly}
                                   readOnly={readOnly}
                                   dragHandlers={{ attributes, listeners }}
                                   isDefaultLibraryField={f.source === 'library' && f.application_field_id && defaultLibraryIds.has(f.application_field_id)}
                                 />
                               )}
                             </SortableRow>
                            {isDragging && <DropBox id={`beside|${f.id}|right`} orientation="col" />}
                          </div>
                        ))}
                      </div>
                      {isDragging && <DropBox id={`row-${rIdx + 1}`} orientation="row" />}
                    </div>
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
                placeholder="e.g., Portfolio URL"
                disabled={readOnly}
              />
            </FormField>
            <FormField label="Type">
              <Select value={type} onValueChange={(v: FieldType) => setType(v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['text','number','email','url','textarea','select','checkbox','checkbox_group','date','file'] as FieldType[]).map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t === 'checkbox_group' ? 'Checkbox Group' : t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Required">
              <div className="flex items-center h-10">
                <Checkbox checked={required} onCheckedChange={(c) => setRequired(!!c)} disabled={readOnly} />
                <span className="ml-2 text-sm text-muted-foreground">Applicants must fill this field</span>
              </div>
            </FormField>
          </div>

          {/* Type-specific configuration */}
          {(type === 'select' || type === 'checkbox_group') && (
            <div className="border border-border/30 rounded-brand p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {type === 'select' ? 'Dropdown Options' : 'Checkbox Group Options'}
              </p>
              {newOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt.option_value}
                    onChange={(e) => setNewOptions(prev => prev.map((o, idx) => idx === i ? { ...o, option_value: e.target.value } : o))}
                    placeholder="Value"
                    className="flex-1"
                    disabled={readOnly}
                  />
                  <Input
                    value={opt.option_label}
                    onChange={(e) => setNewOptions(prev => prev.map((o, idx) => idx === i ? { ...o, option_label: e.target.value } : o))}
                    placeholder="Label"
                    className="flex-1"
                    disabled={readOnly}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setNewOptions(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 h-8 w-8" disabled={readOnly}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setNewOptions(prev => [...prev, { option_value: '', option_label: '' }])} className="h-7 text-xs" disabled={readOnly}>
                <Plus className="h-3 w-3 mr-1" /> Add Option
              </Button>
            </div>
          )}

          {type === 'file' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Accepted File Types">
                <Input
                  value={newAcceptedFileTypes}
                  onChange={(e) => setNewAcceptedFileTypes(e.target.value)}
                  placeholder="e.g. .pdf,.docx,.doc"
                  disabled={readOnly}
                />
              </FormField>
              <FormField label="Max File Size (MB)">
                <Input
                  type="number"
                  value={newMaxFileSize}
                  onChange={(e) => setNewMaxFileSize(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 10"
                  disabled={readOnly}
                />
              </FormField>
            </div>
          )}

          {['text', 'number', 'email', 'url', 'textarea'].includes(type) && (
            <FormField label="Help Text (optional)">
              <Input
                value={newHelpText}
                onChange={(e) => setNewHelpText(e.target.value)}
                placeholder="Help text shown below the field"
                disabled={readOnly}
              />
            </FormField>
          )}

          {['checkbox', 'date'].includes(type) && (
            <FormField label="Help Text">
              <Input
                value={newHelpText}
                onChange={(e) => setNewHelpText(e.target.value)}
                placeholder="Help text shown below the field"
                disabled={readOnly}
              />
            </FormField>
          )}

          <div className="flex justify-end">
            <Button onClick={handleAddCustom} disabled={readOnly || !label.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Add Custom Field
            </Button>
          </div>

          <div className="border-t border-border/40 pt-4">
            <p className="text-sm font-medium mb-2">Add from Library</p>
            {loadingLibrary ? (
              <p className="text-sm text-muted-foreground">Loading library...</p>
            ) : (
              <Select
                value={selectedLibraryId}
                onValueChange={(id) => {
                  const tempId = `temp-${Date.now()}-${Math.random()}`
                  setPendingLibraryAdditions(prev => [...prev, { tempId, libraryId: id }])
                  setOrderedIds(prev => [...prev, tempId])
                  setSelectedLibraryId('')
                }}
                disabled={readOnly || availableLibraryFields.length === 0}
              >
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Choose a field to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableLibraryFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {`${f.field_label} (${f.field_type})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>
      {hasChanges && !readOnly && (
        <div className="sticky bottom-0 z-10 bg-background border-t border-border p-4 flex justify-end gap-3 -mx-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditedFields({})
              setDeletedIds(new Set())
              setPendingAdditions([])
              setPendingLibraryAdditions([])
              setOrderedIds(fields.map(f => f.id))
            }}
            disabled={isSaving}
          >
            Discard
          </Button>
          <Button
            onClick={handleSaveChanges}
            disabled={isSaving}
            size="sm"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
