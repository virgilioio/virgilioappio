import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { AtSign, CalendarDays, List, Phone, Text, Type, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TypeChip } from '@/components/references/TypeChip'
import { RowShell, SectionCard, SectionHead, TrailingToggle } from '../rowKit'
import { makeId, type RefereeField, type RefereeFieldType } from '@/lib/references/templateModel'

const FIELD_TYPE_META: Record<RefereeFieldType, { label: string; icon: typeof Type }> = {
  text: { label: 'Short text', icon: Type },
  email: { label: 'Email', icon: AtSign },
  phone: { label: 'Phone', icon: Phone },
  select: { label: 'Select', icon: List },
  date: { label: 'Date', icon: CalendarDays },
  textarea: { label: 'Long text', icon: Text },
}

function FieldRow({
  field,
  last,
  onChange,
  onDelete,
}: {
  field: RefereeField
  last: boolean
  onChange: (patch: Partial<RefereeField>) => void
  onDelete: () => void
}) {
  const meta = FIELD_TYPE_META[field.type] ?? FIELD_TYPE_META.text

  return (
    <RowShell id={field.id} last={last} onDelete={onDelete} deleteLabel="Delete field">
      <div className="min-w-0" style={{ flex: 1 }}>
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
          className="h-[30px] border-0 bg-transparent px-0 font-inter shadow-none focus-visible:ring-0"
          style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
        />
        {field.helper && (
          <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}>
            {field.helper}
          </p>
        )}
        {field.options && field.options.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 4, marginTop: 5 }}>
            {field.options.map((o) => (
              <span
                key={o}
                className="font-inter"
                style={{
                  fontSize: 10.5,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: '#F1F0EC',
                  color: '#5A6072',
                }}
              >
                {o}
              </span>
            ))}
          </div>
        )}
      </div>

      <TypeChip label={meta.label} icon={meta.icon} />

      <TrailingToggle
        label="Required"
        width={84}
        checked={field.required}
        onChange={(v) => onChange({ required: v })}
      />
    </RowShell>
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
    <SectionCard>
      <SectionHead
        title="Referee fields"
        subtitle="What the candidate must provide for each referee they submit."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={() =>
              onChange([
                ...fields,
                {
                  id: makeId(),
                  key: `field_${fields.length + 1}`,
                  label: '',
                  type: 'text',
                  required: false,
                },
              ])
            }
          >
            Add field
          </Button>
        }
      />

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div>
            {fields.map((field, i) => (
              <FieldRow
                key={field.id}
                field={field}
                last={i === fields.length - 1}
                onChange={(patch) =>
                  onChange(fields.map((f) => (f.id === field.id ? { ...f, ...patch } : f)))
                }
                onDelete={() => onChange(fields.filter((f) => f.id !== field.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </SectionCard>
  )
}
