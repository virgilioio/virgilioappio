
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useApplicationFields } from '@/hooks/useApplicationFields'
import { useJobPostingFields, FieldType, PostingField } from '@/hooks/useJobPostingFields'
import { FormField } from '@/components/ui/form-field'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

  // Add Custom Field form
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [required, setRequired] = useState(false)

  const handleAddCustom = async () => {
    if (!label.trim()) return
    await addCustomField({ field_label: label.trim(), field_type: type, is_required: required })
    setLabel('')
    setType('text')
    setRequired(false)
    await refetch()
  }

  const availableLibraryFields = useMemo(() => libraryFields, [libraryFields])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = fields.findIndex((f) => f.id === active.id)
    const newIndex = fields.findIndex((f) => f.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = arrayMove(fields, oldIndex, newIndex).map((f) => f.id)
    reorderFields(newOrder)
  }

  function SortableRow({ id, children }: { id: string; children: (handlers: { attributes: any; listeners: any }) => React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : undefined,
    }
    return (
      <div ref={setNodeRef} style={style}>
        {children({ attributes, listeners })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
                  {(['text','number','email','url','textarea','select','checkbox','date','file'] as FieldType[]).map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
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
              <div className="grid sm:grid-cols-2 gap-2">
                {availableLibraryFields.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await addFieldFromLibrary(f)
                      await refetch()
                    }}
                    disabled={readOnly}
                    className="justify-start"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="font-medium mr-2">{f.field_label}</span>
                    <span className="text-xs text-muted-foreground">({f.field_type})</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Form Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading fields...</p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Add from library or create a custom field.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {fields.map((f) => (
                  <SortableRow key={f.id} id={f.id}>
                    {({ attributes, listeners }) => (
                      <div className="p-3 border border-border/40 rounded-brand">
                        <div className="grid md:grid-cols-6 gap-3 items-end">
                          <FormField label="Label" className="md:col-span-2">
                            <Input
                              value={f.field_label}
                              onChange={(e) => updateField(f.id, { field_label: e.target.value })}
                              disabled={readOnly}
                            />
                          </FormField>
                          <FormField label="Type">
                            <Select
                              value={f.field_type}
                              onValueChange={(v: FieldType) => updateField(f.id, { field_type: v })}
                              disabled={readOnly}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(['text','number','email','url','textarea','select','checkbox','date','file'] as FieldType[]).map((t) => (
                                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormField>
                          <FormField label="Required">
                            <div className="flex items-center h-10">
                              <Checkbox
                                checked={f.is_required}
                                onCheckedChange={(c) => updateField(f.id, { is_required: !!c })}
                                disabled={readOnly}
                              />
                              <span className="ml-2 text-sm text-muted-foreground">Required</span>
                            </div>
                          </FormField>
                          <div className="flex items-center gap-2 md:justify-end">
                            <Button
                              variant="outline"
                              size="icon"
                              {...attributes}
                              {...listeners}
                              disabled={readOnly}
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                await deleteField(f.id)
                                await refetch()
                              }}
                              disabled={readOnly}
                              title="Delete field"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableRow>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
