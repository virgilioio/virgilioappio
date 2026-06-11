import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { JobStage, useJobStages } from '@/hooks/useJobStages'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftFlag } from '@/components/ui/EmptyIllustrations'
import { TableSkeleton } from '@/components/ui/skeleton'
import { IdentityCell, StatusCell, ActionCell } from '@/components/ui/table-cells'
import { MoreHorizontal, Edit, Trash2, Copy } from 'lucide-react'

interface JobStagesTableProps {
  stages: JobStage[]
  isLoading: boolean
  onEdit: (stage: JobStage) => void
  onDelete?: (id: string) => Promise<void>
  onCopy?: (stageId: string) => Promise<void>
  context?: 'platform-defaults' | 'organization'
  readOnly?: boolean
}

const stageTypeLabels: Record<string, string> = {
  'application': 'Application',
  'application_review': 'Application Review',
  'screening': 'Screening',
  'interview': 'Interview',
  'assessment': 'Assessment',
  'reference_check': 'Reference Check',
  'offer': 'Offer',
  'onboarding': 'Onboarding',
  'custom': 'Custom'
}

const priorityLabels: Record<number, string> = {
  1: 'First',
  2: 'Second',
  3: 'Third',
  4: 'Fourth',
  5: 'Fifth',
  99: 'Last'
}

const stageTypeVariants: Record<string, import("@/components/ui/badge").BadgeProps["variant"]> = {
  application: 'pastel-blue',
  application_review: 'info',
  screening: 'info',
  interview: 'pastel-purple',
  assessment: 'warning',
  reference_check: 'pastel-orange',
  offer: 'success',
  onboarding: 'pastel-green',
  custom: 'secondary'
}

export function JobStagesTable({ stages, isLoading, onEdit, onDelete, onCopy, context = 'organization', readOnly = false }: JobStagesTableProps) {
  const { deleteStage, isDeleting } = useJobStages()
  const [stageToDelete, setStageToDelete] = useState<JobStage | null>(null)

  const handleDelete = async (id: string) => {
    if (onDelete) {
      await onDelete(id)
    } else {
      await deleteStage(id)
    }
    setStageToDelete(null)
  }

  if (isLoading) {
    return <TableSkeleton rows={5} />
  }

  if (stages.length === 0) {
    return (
      <EmptyState
        size="card"
        illustration={<SoftFlag />}
        title="No stages yet"
        body="Create your first stage to get started."
      />
    )
  }

  return (
    <>
      <div className="rounded-xl border border-virgilio-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Priority</TableHead>
              {context === 'organization' && <TableHead>Source</TableHead>}
              <TableHead className="w-[32px] text-right" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((stage) => (
              <TableRow key={stage.id} className="group">
                <TableCell>
                  <IdentityCell
                    name={stage.stage_name}
                    sub={stage.stage_description || undefined}
                    hideAvatar
                  />
                </TableCell>
                <TableCell>
                  <StatusCell>
                    <Badge size="sm" variant={stageTypeVariants[stage.stage_type] ?? 'secondary'}>
                      {stageTypeLabels[stage.stage_type] || stage.stage_type}
                    </Badge>
                  </StatusCell>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {stage.stage_description || '-'}
                </TableCell>
                <TableCell>
                  {stage.is_default ? (
                    <StatusCell>
                      <Badge size="sm" variant="status-active">Default</Badge>
                    </StatusCell>
                  ) : (
                    <span className="text-text-tertiary">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {stage.stage_priority ? (
                    priorityLabels[stage.stage_priority] || stage.stage_priority
                  ) : (
                    <span className="text-text-tertiary">-</span>
                  )}
                </TableCell>
                {context === 'organization' && (
                  <TableCell>
                    <StatusCell>
                      <Badge size="sm" variant={stage.source === 'platform' ? 'source-inherited' : 'source-custom'}>
                        {stage.source === 'platform' ? 'Inherited' : 'Custom'}
                      </Badge>
                    </StatusCell>
                  </TableCell>
                )}
                <TableCell className="w-[32px] text-right">
                  <ActionCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="Stage actions" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {readOnly && onCopy ? (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(stage.id) }} className="gap-2">
                            <Copy className="h-4 w-4" />Copy to My Library
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(stage) }} className="gap-2">
                              <Edit className="h-4 w-4" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setStageToDelete(stage) }}
                              disabled={isDeleting || (context === 'organization' && stage.source === 'platform')}
                              className="gap-2 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ActionCell>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!stageToDelete} onOpenChange={(open) => !open && setStageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{stageToDelete?.stage_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStageToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stageToDelete && handleDelete(stageToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
