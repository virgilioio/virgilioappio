import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { makeId, type RefereeField, type RefereeFieldType } from '@/lib/references/templateModel'

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'

/** Referee fields reuse the existing field_type enum values — no new field types. */
const FIELD_TYPES: { value: RefereeFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Select' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Long text' },
]

function FieldRow({
  field,
  onChange,
  onDelete,
}: {
  field: RefereeField
  onChange: (patch: Partial<RefereeField>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        translate: CSS.Translate.toString(transform) ?? undefined,
        transition,
        borderColor: HAIRLINE,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="grid items-center gap-2.5 bg-white border rounded-xl px-2.5 py-2"
      // grip · label · type · required · delete
      {...{ ['data-field-row']: field.key }}
    >
      <div
        className="grid items-center gap-2.5"
        style={{ gridTemplateColumns: '20px minmax(0,1fr) 132px auto 28px' }}
      >
        <button
          type="button"
          className="grid place-items-center text-[#B5B9C4] hover:text-[#5A6072] cursor-grab active:cursor-grabbing"
          aria-label="Reorder field"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-[15px] h-[15px]" />
        </button>

        <div className="min-w-0">
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="h-[34px] font-inter text-[13px]"
            placeholder="Field label"
          />
          {field.helper && (
            <p className="mt-1 font-inter" style={{ fontSize: 11, color: MUTED }}>
              {field.helper}
            </p>
          )}
        </div>

        <Select value={field.type} onValueChange={(v) => onChange({ type: v as RefereeFieldType })}>
          <SelectTrigger className="h-[32px] font-inter text-[12.5px]">
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

        <label className="flex items-center gap-2 font-inter" style={{ fontSize: 12, color: '#5A6072' }}>
          <Switch
            checked={field.required}
            onCheckedChange={(v) => onChange({ required: v })}
            className="h-[18px] w-[32px] [&>span]:h-[14px] [&>span]:w-[14px] [&>span]:data-[state=checked]:translate-x-[14px]"
          />
          Required
        </label>

        <Button
          variant="ghost"
          size="xs"
          icon={Trash2}
          iconOnly
          aria-label="Delete field"
          onClick={onDelete}
        />
      </div>
    </div>
  )
}

export function RefereeFieldsSection({
  fields,
  onChange,
}: {
  fields: RefereeField[]
  onChange: (fields: RefereeField[]) => void
}) {
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = fields.findIndex((f) => f.id === active.id)
    const to = fields.findIndex((f) => f.id === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(fields, from, to))
  }

  return (
    <div className="space-y-3">
      <div>
        <h3
          className="font-poppins font-semibold text-[#0d0d09]"
          style={{ fontSize: 18, letterSpacing: '-0.04em' }}
        >
          Referee fields
        </h3>
        <p className="mt-1 font-inter text-[12.5px] text-[#5A6072]">
          What the candidate must supply for each referee. Drag to reorder.
        </p>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onChange={(patch) =>
                  onChange(fields.map((f) => (f.id === field.id ? { ...f, ...patch } : f)))
                }
                onDelete={() => onChange(fields.filter((f) => f.id !== field.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="secondary"
        size="sm"
        icon={Plus}
        onClick={() =>
          onChange([
            ...fields,
            { id: makeId(), key: `field_${fields.length + 1}`, label: '', type: 'text', required: false },
          ])
        }
      >
        Add field
      </Button>
    </div>
  )
}
