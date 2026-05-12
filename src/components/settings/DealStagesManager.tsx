import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { useDealStages, type DealStage, type DealStageType } from '@/hooks/useDealStages'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'

function badgeClasses(t: DealStageType) {
  if (t === 'won') return 'bg-virgilio-success/10 text-virgilio-success border-0'
  if (t === 'lost') return 'bg-virgilio-error/10 text-virgilio-error border-0'
  return 'bg-virgilio-purple/10 text-virgilio-purple border-0'
}

export function DealStagesManager() {
  const { data: stages = [], isLoading, createStage, updateStage, deleteStage, reorderStages } = useDealStages()
  const [editing, setEditing] = useState<DealStage | null>(null)
  const [creating, setCreating] = useState(false)

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...stages]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    reorderStages.mutate(next.map((s) => s.id))
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Deal Stages">
        <Button
          size="sm"
          className="bg-virgilio-purple hover:bg-virgilio-purple/90"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add stage
        </Button>
      </PageHeader>

      <Card className="shadow-calendly border-virgilio-border/50 rounded-xl">
        <CardHeader>
          <CardTitle className="font-poppins font-bold tracking-[-0.04em]">Pipeline stages</CardTitle>
          <CardDescription>
            Stages used by your CRM Deals kanban. Reorder, rename, or mark a stage as Won or Lost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <GioEmptyState title="No stages yet" description="Add your first stage to start the pipeline." />
          ) : (
            <ul className="divide-y divide-virgilio-border/40">
              {stages.map((s, idx) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="text-virgilio-muted hover:text-virgilio-text disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === stages.length - 1}
                      className="text-virgilio-muted hover:text-virgilio-text disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-poppins font-semibold tracking-[-0.02em] text-virgilio-text truncate">
                      {s.name}
                    </span>
                    <Badge className={badgeClasses(s.stage_type)}>{s.stage_type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-virgilio-error" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete stage?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deals in this stage will become unassigned and stop appearing on the kanban.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-virgilio-error hover:bg-virgilio-error/90"
                            onClick={() => deleteStage.mutate(s.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
              className="bg-virgilio-purple hover:bg-virgilio-purple/90"
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
