import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { JobStage, useJobStages } from '@/hooks/useJobStages'
import { Edit, Trash2, Plus } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

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

  const handleDelete = async (id: string) => {
    if (onDelete) {
      await onDelete(id)
    } else {
      await deleteStage(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-text-secondary">Loading stages...</div>
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-sm text-text-secondary">No stages found</p>
          <p className="text-xs text-text-tertiary mt-1">Create your first stage to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-brand border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Priority</TableHead>
            {context === 'organization' && <TableHead>Source</TableHead>}
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((stage) => (
            <TableRow key={stage.id}>
              <TableCell className="font-medium">{stage.stage_name}</TableCell>
              <TableCell>
                <Badge variant={stageTypeVariants[stage.stage_type] ?? 'secondary'}>
                  {stageTypeLabels[stage.stage_type] || stage.stage_type}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {stage.stage_description || '-'}
              </TableCell>
              <TableCell>
                {stage.is_default ? (
                  <Badge variant="default">Default</Badge>
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
                  <Badge variant={stage.source === 'platform' ? 'secondary' : 'default'}>
                    {stage.source === 'platform' ? 'Inherited' : 'Custom'}
                  </Badge>
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center space-x-2">
                  {readOnly && onCopy ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCopy(stage.id)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Copy to My Library
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(stage)}
                        disabled={context === 'organization' && stage.source === 'platform'}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isDeleting || (context === 'organization' && stage.source === 'platform')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{stage.stage_name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(stage.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}