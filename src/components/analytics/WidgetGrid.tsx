import { useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LayoutGrid } from 'lucide-react'
import { WidgetFrame } from './widgets/WidgetFrame'
import { AddWidgetTile } from './widgets/AddWidgetTile'
import { defaultSpan } from './model/viz'
import type { WidgetConfig } from './model/types'

interface Props {
  widgets: WidgetConfig[]
  onChange: (widgets: WidgetConfig[]) => void
}

function newWidget(): WidgetConfig {
  return {
    id: crypto.randomUUID(),
    metric: 'applications',
    groupBy: 'none',
    viz: 'kpi',
    span: defaultSpan('kpi'),
  }
}

export function WidgetGrid({ widgets, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => widgets.map(w => w.id), [widgets])

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = widgets.findIndex(w => w.id === active.id)
    const newIdx = widgets.findIndex(w => w.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    onChange(arrayMove(widgets, oldIdx, newIdx))
  }

  const update = (id: string, next: WidgetConfig) => onChange(widgets.map(w => (w.id === id ? next : w)))
  const remove = (id: string) => onChange(widgets.filter(w => w.id !== id))
  const add = () => onChange([...widgets, newWidget()])

  if (widgets.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[#D8D5CC] bg-white/30 p-10 flex flex-col items-center justify-center gap-3">
        <span className="h-10 w-10 rounded-full bg-[#F1F0EC] text-[#5A6072] flex items-center justify-center">
          <LayoutGrid size={16} />
        </span>
        <div className="text-center">
          <div className="font-poppins font-semibold text-[14px] text-[#0d0d09]">This view is empty</div>
          <div className="text-[12.5px] font-inter text-[#5A6072] mt-0.5">Add a widget to start building your dashboard.</div>
        </div>
        <button
          onClick={add}
          className="mt-1 h-9 px-3.5 rounded-[8px] bg-[#6F3FF5] text-white font-poppins font-semibold text-[12.5px] hover:bg-[#5B21B6] transition-colors"
        >
          + Add your first widget
        </button>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-12 gap-4 items-start">
          {widgets.map(w => (
            <SortableWidget key={w.id} cfg={w} onChange={n => update(w.id, n)} onRemove={() => remove(w.id)} />
          ))}
          <AddWidgetTile onClick={add} />
        </div>
      </SortableContext>
      <DragOverlay />
    </DndContext>
  )
}

function SortableWidget({ cfg, onChange, onRemove }: { cfg: WidgetConfig; onChange: (n: WidgetConfig) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cfg.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${cfg.span} / span ${cfg.span}`,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <WidgetFrame cfg={cfg} onChange={onChange} onRemove={onRemove} dragHandleProps={listeners as Record<string, unknown>} isDragging={isDragging} />
    </div>
  )
}
