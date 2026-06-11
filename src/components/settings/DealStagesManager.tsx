import { useEffect, useState } from 'react'
import { InlineEmpty } from '@/components/ui/empty-state'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'
import { useDealStages, type DealStage, type DealStageType } from '@/hooks/useDealStages'
import { DraggableDealStageItem } from './DraggableDealStageItem'


export function DealStagesManager() {
  const { data: stagesData = [], isLoading, createStage, updateStage, deleteStage, reorderStages } = useDealStages()

  const [orderedStages, setOrderedStages] = useState<DealStage[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DealStage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DealStage | null>(null)

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setOrderedStages(stagesData)
    }
  }, [stagesData, hasUnsavedChanges])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    setOrderedStages((items) => {
      const oldIndex = items.findIndex((s) => s.id === active.id)
      const newIndex = items.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    await reorderStages.mutateAsync(orderedStages.map((s) => s.id))
    setHasUnsavedChanges(false)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteStage.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const activeStage = activeId ? orderedStages.find((s) => s.id === activeId) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
          Add stage
        </Button>
      </div>


      <div>
        <h3 className="text-lg font-medium text-text-primary mb-2">Pipeline Stages</h3>
        <p className="text-sm text-text-secondary mb-4">
          Customize the stages used by the CRM Deals kanban. Drag to reorder, edit names, or mark a stage as Won or Lost.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-base font-medium text-text-primary mb-3">Current Pipeline Stages</h4>
          {orderedStages.length === 0 ? (
            <InlineEmpty text="No stages in the pipeline yet." />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={orderedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {orderedStages.map((stage) => (
                    <DraggableDealStageItem
                      key={stage.id}
                      stage={stage}
                      onEdit={(s) => setEditing(s)}
                      onRemove={(s) => setDeleteTarget(s)}
                      isDragging={activeId === stage.id}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {activeStage && (
                  <div style={{ transform: 'rotate(-1.5deg) scale(1.03)', boxShadow: '0 12px 24px rgba(0,0,0,0.15)' }}>
                    <DraggableDealStageItem stage={activeStage} onEdit={() => {}} onRemove={() => {}} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-border/50">
        <div className="flex justify-between items-center">
          <p className="text-sm text-text-secondary">Total stages: {orderedStages.length}</p>
          <Button disabled={!hasUnsavedChanges || reorderStages.isPending} onClick={handleSave}>
            {reorderStages.isPending ? 'Saving...' : 'Save Pipeline'}
          </Button>
        </div>
      </div>

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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
