import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { confirmDeleteStage } from './confirmDeleteStage'
import { JobStageForm } from './JobStageForm'
import { useJobStages, JobStage } from '@/hooks/useJobStages'
import { LibraryCard } from './shared/LibraryCard'
import { SpecChip, SpecChipTone } from './shared/SpecChip'

const TYPE_LABEL: Record<string, string> = {
  application: 'Application',
  application_review: 'Application review',
  screening: 'Screening',
  interview: 'Interview',
  assessment: 'Assessment',
  reference_check: 'Reference check',
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

/**
 * Settings › Pipeline stages (2026-10-19): one library of stages, the shared
 * ones and Virgilio's own together, all editable by workspace admins
 * (library_editor). "Default" stages are added to every new job.
 */
export function JobStagesManager() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<JobStage | null>(null)
  const { stages, isLoading, loadError, refetch, deleteStage } = useJobStages('organization')

  return (
    <div className="max-w-[860px]">
      <LibraryCard
        title="Pipeline stages"
        description="The stages you build a job's pipeline from. Default stages are added to every new job."
        what="pipeline stages"
        addLabel="Add stage"
        onAdd={() => setCreateOpen(true)}
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetch()}
        emptyTitle="No stages yet"
        emptyBody="Add the stages your jobs move candidates through."
        onceKey="settings-stages"
        items={(stages || []).map((s) => ({
          id: s.id,
          name: s.stage_name,
          meta: s.stage_description || undefined,
          chips: (
            <>
              <SpecChip tone={TYPE_TONE[s.stage_type] || 'gray'}>{TYPE_LABEL[s.stage_type] || s.stage_type}</SpecChip>
              {s.is_default && <SpecChip tone="green">Default</SpecChip>}
            </>
          ),
          onEdit: () => setEditing(s),
          onDelete: () => void confirmDeleteStage(s, { global: false, onDelete: () => deleteStage(s.id, { quiet: true }) }),
        }))}
      />

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New stage</SheetTitle>
            <SheetDescription>Add a stage to the library.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <JobStageForm onSuccess={() => { setCreateOpen(false); void refetch() }} onCancel={() => setCreateOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit stage</SheetTitle>
            <SheetDescription>Changes apply wherever the stage is used.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editing && <JobStageForm stage={editing} onSuccess={() => { setEditing(null); void refetch() }} onCancel={() => setEditing(null)} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
