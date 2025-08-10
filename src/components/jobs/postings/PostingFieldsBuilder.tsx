
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
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

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

  const [isDragging, setIsDragging] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeField = useMemo(() => fields.find((f) => f.id === activeId) || null, [fields, activeId])
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

  const rows = useMemo(() => computeRows(fields), [fields])

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

  async function handleDragEnd(event: any) {
    setIsDragging(false)
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const overId: string = String(over.id)

    const oldIndex = fields.findIndex((f) => f.id === active.id)
    if (oldIndex < 0) return

    const insertAt = (list: PostingField[], index: number, item: PostingField) => {
      const copy = list.filter((x) => x.id !== item.id)
      const pos = Math.max(0, Math.min(index, copy.length))
      copy.splice(pos, 0, item)
      return copy
    }

    // Drop into a row boundary
    if (overId.startsWith('row-')) {
      const rows = computeRows(fields)
      const rowIdx = parseInt(overId.split('-')[1] || '0', 10)
      // insertion index is the number of items in prior rows
      const insertionIndex = rows.slice(0, rowIdx).reduce((acc, r) => acc + r.length, 0)
      const activeItem = fields[oldIndex]
      const newOrderFields = insertAt(fields, insertionIndex, activeItem)

      // Ensure full-width in its own row
      if ((activeItem.column_span ?? 4) !== 4) {
        await updateField(activeItem.id, { column_span: 4 } as any)
      }

      await reorderFields(newOrderFields.map((f) => f.id))
      return
    }

    // Drop beside a specific field
    if (overId.startsWith('beside|')) {
      const parts = overId.split('|') // beside|{id}|left|right
      const targetId = parts[1]
      const side = parts[2]
      const targetIndex = fields.findIndex((f) => f.id === targetId)
      if (targetIndex < 0) return
      const activeItem = fields[oldIndex]
      const after = side === 'right'
      const insertionIndex = targetIndex + (after ? 1 : 0)
      const newOrderFields = insertAt(fields, insertionIndex, activeItem)

      // Recompute rows after insertion but force active to minimal span so it joins the target row
      const tempForRows = newOrderFields.map((it) => it.id === activeItem.id ? { ...it, column_span: 1 } : it)
      const rowsAfter = computeRows(tempForRows)
      // Find the row containing targetId (and thus the active item now)
      let rowContaining: PostingField[] | null = null
      for (const r of rowsAfter) {
        if (r.some((x) => x.id === targetId)) { rowContaining = r; break }
      }
      if (!rowContaining) rowContaining = rowsAfter[0] || []

      // Assign equalized spans for that row
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

      await Promise.all(rowContaining.map((it) => {
        const span = spanMap.get(it.id) ?? 4
        return (it.column_span ?? 4) !== span ? updateField(it.id, { column_span: span } as any) : Promise.resolve()
      }))

      await reorderFields(newOrderFields.map((f) => f.id))
      return
    }

    // Default sortable behavior: reorder without changing spans
    const overIndex = fields.findIndex((f) => f.id === over.id)
    if (overIndex < 0) return
    const newOrder = arrayMove(fields, oldIndex, overIndex).map((f) => f.id)
    await reorderFields(newOrder)
  }

  function SortableRow({ id, children }: { id: string; children: (handlers: { attributes: any; listeners: any }) => React.ReactNode }) {
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={rectSortingStrategy}>
                <div className="space-y-2">
                  {isDragging && <DropBox id={`row-0`} orientation="row" />}
                  {rows.map((row, rIdx) => (
                    <div key={`row-${rIdx}`} className="w-full">
                      <div className="grid w-full grid-cols-1 md:grid-cols-4 gap-3">
                        {row.map((f) => (
                          <div key={f.id} className="flex items-stretch w-full min-w-0" style={{ gridColumn: `span ${f.column_span || 4} / span ${f.column_span || 4}` }}>
                            {isDragging && <DropBox id={`beside|${f.id}|left`} orientation="col" />}
                            <SortableRow id={f.id}>
                              {({ attributes, listeners }) => (
                                <div className="p-3 border border-border/40 rounded-brand flex-1">
                                  <div className="flex items-start gap-3">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      {...attributes}
                                      {...listeners}
                                      disabled={readOnly}
                                      title="Drag to reorder"
                                      className="self-center shrink-0"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </Button>
                                    <div className="flex-1">
                                      <div className="grid md:grid-cols-6 gap-3 items-end">
                                        <div className="md:col-span-2">
                                          <Input
                                            value={f.field_label}
                                            onChange={(e) => updateField(f.id, { field_label: e.target.value })}
                                            disabled={readOnly}
                                            placeholder="Label"
                                          />
                                        </div>
                                        <div>
                                          <Select
                                            value={f.field_type}
                                            onValueChange={(v: FieldType) => updateField(f.id, { field_type: v })}
                                            disabled={readOnly}
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
                                            checked={f.is_required}
                                            onCheckedChange={(c) => updateField(f.id, { is_required: !!c })}
                                            disabled={readOnly}
                                            id={`req-${f.id}`}
                                          />
                                          <label htmlFor={`req-${f.id}`} className="ml-2 text-sm text-muted-foreground">Required</label>
                                        </div>
                                        <div className="flex items-center gap-2 md:justify-end">
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
                                  </div>
                                </div>
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
    </div>
  )
}
