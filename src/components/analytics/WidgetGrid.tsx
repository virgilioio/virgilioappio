import { useMemo, useRef } from 'react'
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
import { Plus } from 'lucide-react'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftChart } from '@/components/ui/EmptyIllustrations'
import { WidgetFrame, autoTitle } from './widgets/WidgetFrame'
import { undoToast } from '@/lib/undoToast'
import { AddWidgetTile } from './widgets/AddWidgetTile'
import { useWidgetCatalog } from './widgets/WidgetCatalog'
import type { WidgetConfig } from './model/types'

interface Props {
  widgets: WidgetConfig[]
  onChange: (widgets: WidgetConfig[]) => void
}

export function WidgetGrid({ widgets, onChange }: Props) {
  const { newWidget } = useWidgetCatalog()
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
  // O17 (Block B §16): removing autosaves at once; Undo puts the widget back where
  // it was, into whatever the grid holds by then.
  const latest = useRef(widgets)
  latest.current = widgets
  const remove = (id: string) => {
    const index = widgets.findIndex(w => w.id === id)
    const removed = widgets[index]
    const rest = widgets.filter(w => w.id !== id)
    onChange(rest)
    if (!removed) return
    undoToast(`${autoTitle(removed)} removed`, () => {
      const now = latest.current
      if (now.some(w => w.id === removed.id)) return
      // Another view is showing now: don't put the widget into it.
      if (rest.length > 0 && !now.some(w => rest.some(r => r.id === w.id))) return
      const at = Math.min(index, now.length)
      onChange([...now.slice(0, at), removed, ...now.slice(at)])
    })
  }
  const add = () => onChange([...widgets, newWidget()])

  if (widgets.length === 0) {
    return (
      <EmptyState
        size="card"
        illustration={<SoftChart />}
        title="This view is empty"
        body="Add a widget to start building your dashboard."
        primary={
          <EmptyAction icon={<Plus size={16} />} onClick={add}>
            Add your first widget
          </EmptyAction>
        }
      />
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
    ['--span' as string]: cfg.span,
  }
  // Full width on phones; the saved span from tablet width up.
  return (
    <div ref={setNodeRef} style={style} className="col-span-12 md:[grid-column:span_var(--span)/span_var(--span)]" {...attributes}>
      <WidgetFrame cfg={cfg} onChange={onChange} onRemove={onRemove} dragHandleProps={listeners as Record<string, unknown>} isDragging={isDragging} />
    </div>
  )
}
