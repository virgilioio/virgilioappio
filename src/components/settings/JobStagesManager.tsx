import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { JobStageForm } from './JobStageForm'
import { useJobStages, JobStage } from '@/hooks/useJobStages'
import { Plus, Copy, Pencil, Trash2, Loader2 } from 'lucide-react'
import { SpecCard } from './shared/SpecCard'
import { SpecRow, SpecEmpty, NOIR_BTN, SEC_BTN } from './shared/SpecRow'
import { SpecChip, SpecChipTone } from './shared/SpecChip'

interface JobStagesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

const TYPE_LABEL: Record<string, string> = {
  application: 'Application',
  application_review: 'Application Review',
  screening: 'Screening',
  interview: 'Interview',
  assessment: 'Assessment',
  reference_check: 'Reference Check',
  offer: 'Offer',
  onboarding: 'Onboarding',
  custom: 'Custom',
}

const TYPE_TONE: Record<string, SpecChipTone> = {
  application: 'blue',
  application_review: 'blue',
  screening: 'blue',
  interview: 'purple',
  assessment: 'amber',
  reference_check: 'amber',
  offer: 'green',
  onboarding: 'green',
  custom: 'gray',
}

export function JobStagesManager({ context = 'organization' }: JobStagesManagerProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<JobStage | null>(null)
  const [toDelete, setToDelete] = useState<JobStage | null>(null)
  const { stages, isLoading, copyPlatformTemplate, deleteStage, isDeleting } = useJobStages(context)

  const platformStages = (stages || []).filter(s => s.source === 'platform')
  const tenantStages = (stages || []).filter(s => s.source === 'tenant')
  const listStages = context === 'organization' ? tenantStages : stages || []

  return (
    <div className="max-w-[860px]">
      {context === 'organization' && (
        <SpecCard
          title="Platform library"
          description="Default stages provided by Gio. Copy to your library to rename or customize."
        >
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
          ) : platformStages.length === 0 ? (
            <SpecEmpty title="No platform stages available." />
          ) : (
            platformStages.map((s, i) => (
              <SpecRow key={s.id} last={i === platformStages.length - 1}>
                <span className="flex-1 font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {s.stage_name}
                </span>
                <SpecChip tone={TYPE_TONE[s.stage_type] || 'gray'}>{TYPE_LABEL[s.stage_type] || s.stage_type}</SpecChip>
                {s.is_default && <SpecChip tone="green">Default</SpecChip>}
                <button
                  type="button"
                  className={SEC_BTN}
                  style={{ height: 26, padding: '0 10px', fontSize: 11.5 }}
                  onClick={() => copyPlatformTemplate(s.id)}
                >
                  <Copy size={11} /> Copy to my library
                </button>
              </SpecRow>
            ))
          )}
        </SpecCard>
      )}

      <SpecCard
        title={context === 'organization' ? 'My library' : 'Stages library'}
        description={context === 'organization' ? 'Custom stages for your organization.' : 'Stages that can be used across jobs.'}
        action={
          <button
            type="button"
            className={NOIR_BTN}
            style={{ height: 30, padding: '0 12px', fontSize: 12 }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={13} /> Add stage
          </button>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : listStages.length === 0 ? (
          <SpecEmpty title="No custom stages yet" body="Copy a platform stage or create one." />
        ) : (
          listStages.map((s, i) => (
            <SpecRow key={s.id} last={i === listStages.length - 1}>
              <span className="flex-1 font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>
                {s.stage_name}
              </span>
              <SpecChip tone={TYPE_TONE[s.stage_type] || 'gray'}>{TYPE_LABEL[s.stage_type] || s.stage_type}</SpecChip>
              {s.is_default && <SpecChip tone="green">Default</SpecChip>}
              <button
                type="button"
                className="text-[#8B8F9E] hover:text-[#0d0d09] transition-colors"
                onClick={() => setEditing(s)}
                aria-label="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="text-[#8B8F9E] hover:text-[#B91C1C] transition-colors"
                onClick={() => setToDelete(s)}
                aria-label="Delete"
                disabled={context === 'organization' && s.source === 'platform'}
              >
                <Trash2 size={13} />
              </button>
            </SpecRow>
          ))
        )}
      </SpecCard>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create new stage</SheetTitle>
            <SheetDescription>Add a new stage to the library</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <JobStageForm onSuccess={() => setCreateOpen(false)} onCancel={() => setCreateOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit stage</SheetTitle>
            <SheetDescription>Update the stage details</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editing && <JobStageForm stage={editing} onSuccess={() => setEditing(null)} onCancel={() => setEditing(null)} />}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{toDelete?.stage_name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (toDelete) { await deleteStage(toDelete.id); setToDelete(null) } }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
