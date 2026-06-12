import { useEffect, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus } from 'lucide-react'
import { useDealStages, type DealStage, type DealStageType } from '@/hooks/useDealStages'
import { DraggableDealStageItem } from './DraggableDealStageItem'

export function DealStagesManager() {
  const {
    data: stagesData = [], isLoading,
    createStage, updateStage, deleteStage, reorderStages,
  } = useDealStages()

  const [orderedStages, setOrderedStages] = useState<DealStage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DealStage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DealStage | null>(null)

  useEffect(() => { setOrderedStages(stagesData) }, [stagesData])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = orderedStages.findIndex((s) => s.id === active.id)
    const newIndex = orderedStages.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(orderedStages, oldIndex, newIndex)
    setOrderedStages(next)
    reorderStages.mutate(next.map((s) => s.id))
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteStage.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const activeStage = activeId ? orderedStages.find((s) => s.id === activeId) : null

  return (
    <div>
      <section
        className="bg-white rounded-[12px] overflow-hidden mb-[14px]"
        style={{ border: '1px solid #E7E8EE' }}
      >
        <header
          className="flex items-start justify-between gap-4"
          style={{ padding: '14px 18px', borderBottom: '1px solid #F1F0EC' }}
        >
          <div className="min-w-0">
            <h3
              className="font-poppins font-semibold text-[#0d0d09] m-0"
              style={{ fontSize: 13.5, letterSpacing: '-0.01em', lineHeight: 1.2 }}
            >
              Deal stages
            </h3>
            <p
              className="font-inter text-[#8B8F9E] m-0"
              style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}
            >
              The columns of your CRM Deals kanban. Drag to reorder; mark a stage as Won or Lost.
            </p>
          </div>
          <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
            Add stage
          </Button>
        </header>

        {isLoading ? (
          <div style={{ padding: '18px', fontSize: 12, color: '#8B8F9E' }} className="font-inter">
            Loading…
          </div>
        ) : orderedStages.length === 0 ? (
          <div
            className="font-inter text-center"
            style={{ padding: '24px 18px', fontSize: 12, color: '#8B8F9E' }}
          >
            No stages yet — add the first stage of your pipeline.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div>
                {orderedStages.map((stage, idx) => (
                  <DraggableDealStageItem
                    key={stage.id}
                    stage={stage}
                    onEdit={(s) => setEditing(s)}
                    onRemove={(s) => setDeleteTarget(s)}
                    isDragging={activeId === stage.id}
                    isLast={idx === orderedStages.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
              {activeStage && (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E7E8EE',
                    borderRadius: 8,
                    boxShadow: '0 12px 24px rgba(0,0,0,0.10)',
                  }}
                >
                  <DraggableDealStageItem
                    stage={activeStage}
                    onEdit={() => {}}
                    onRemove={() => {}}
                    isLast
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      <StageFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSubmit={async (v) => {
          await createStage.mutateAsync(v)
          setCreating(false)
        }}
      />
      <StageFormSheet
        stage={editing ?? undefined}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={async (v) => {
          if (editing) {
            await updateStage.mutateAsync({ id: editing.id, ...v })
            setEditing(null)
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove stage?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>Deals in "{deleteTarget.name}" will become unassigned and stop appearing on the kanban.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-virgilio-error hover:bg-virgilio-error/90"
              onClick={handleConfirmDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface StageFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stage?: DealStage
  onSubmit: (values: { name: string; stage_type: DealStageType }) => Promise<void>
}

function StageFormSheet({ open, onOpenChange, stage, onSubmit }: StageFormSheetProps) {
  const [name, setName] = useState(stage?.name ?? '')
  const [type, setType] = useState<DealStageType>(stage?.stage_type ?? 'open')

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (o) {
          setName(stage?.name ?? '')
          setType(stage?.stage_type ?? 'open')
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-poppins font-bold tracking-[-0.04em]">
            {stage ? 'Edit stage' : 'Add stage'}
          </SheetTitle>
          <SheetDescription>
            Configure the stage label and whether it represents a Won or Lost outcome.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stage-name">Name</Label>
            <Input
              id="stage-name"
              className="h-11 focus-visible:ring-virgilio-purple"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Proposal"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DealStageType)}>
              <SelectTrigger className="h-8 focus:ring-virgilio-purple">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim()}
              onClick={() => onSubmit({ name: name.trim(), stage_type: type })}
            >
              {stage ? 'Save changes' : 'Create stage'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
