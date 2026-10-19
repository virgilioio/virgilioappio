import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GripVertical, Pencil, Trash2, Plus, Loader2 } from 'lucide-react'
import { SpecCard } from '../shared/SpecCard'
import { SpecRow, NOIR_BTN } from '../shared/SpecRow'
import { SpecChip, type SpecChipTone } from '../shared/SpecChip'
import { OfferTemplatesManager } from '../OfferTemplatesManager'
import { useJobStages, type JobStage, type StageType } from '@/hooks/useJobStages'
import { useApplicationFields, type ApplicationFieldWithRelations } from '@/hooks/useApplicationFields'
import { JobStageForm } from '../JobStageForm'
import { ApplicationFieldForm } from '../ApplicationFieldForm'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { IconTip } from '@/components/ui/tooltip'
import { confirmDeleteStage } from '../confirmDeleteStage'

type TopTab = 'stages' | 'fields' | 'templates'

// ─── Main pill row ───
function MainPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-inter transition-colors"
      style={{
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: active ? '#0d0d09' : '#FFFFFF',
        color: active ? '#fffcf9' : '#1F2230',
        border: active ? '1px solid #0d0d09' : '1px solid #E7E8EE',
      }}
    >
      {children}
    </button>
  )
}

function NoirBtn({ icon: Icon, children, onClick }: { icon?: LucideIcon; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={NOIR_BTN} style={{ height: 30, padding: '0 12px', fontSize: 11.5, fontWeight: 600 }}>
      {Icon && <Icon size={13} />} {children}
    </button>
  )
}

// ─── Stages ───
const STAGE_TYPE_LABEL: Record<StageType, { label: string; tone: SpecChipTone }> = {
  application:        { label: 'Application',     tone: 'blue' },
  application_review: { label: 'Application',     tone: 'blue' },
  screening:          { label: 'Screening',       tone: 'blue' },
  interview:          { label: 'Interview',       tone: 'purple' },
  assessment:         { label: 'Assessment',      tone: 'amber' },
  reference_check:    { label: 'Reference check', tone: 'amber' },
  offer:              { label: 'Offer',           tone: 'green' },
  onboarding:         { label: 'Onboarding',      tone: 'green' },
  custom:             { label: 'Custom',          tone: 'gray' },
}

function StagesTab() {
  const { stages, isLoading, deleteStage } = useJobStages('platform-defaults')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<JobStage | null>(null)

  const sorted = useMemo(
    () => [...stages].sort((a, b) => (a.stage_priority ?? 0) - (b.stage_priority ?? 0)),
    [stages]
  )

  return (
    <>
      <SpecCard
        title="Default job stages"
        description="Every organization inherits these out of the box; they can copy and customize in their own library. 'Default' stages are added to new jobs automatically."
        action={<NoirBtn icon={Plus} onClick={() => setCreateOpen(true)}>Add stage</NoirBtn>}
      >
        {isLoading ? (
          <div className="flex justify-center" style={{ padding: 28 }}><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center font-inter text-[#8B8F9E]" style={{ padding: '28px 18px', fontSize: 12 }}>No default stages yet.</div>
        ) : (
          sorted.map((stage, i) => {
            const typeMeta = STAGE_TYPE_LABEL[stage.stage_type] ?? STAGE_TYPE_LABEL.custom
            return (
              <SpecRow key={stage.id} last={i === sorted.length - 1} style={{ padding: '9px 18px', gap: 11 }}>
                <GripVertical size={13} color="#B5B9C4" style={{ cursor: 'grab', flexShrink: 0 }} />
                <span className="font-inter truncate flex-1" style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>
                  {stage.stage_name}
                </span>
                <SpecChip tone={typeMeta.tone}>{typeMeta.label}</SpecChip>
                {stage.is_default && <SpecChip tone="green">Default</SpecChip>}
                <button type="button" aria-label="Edit" onClick={() => setEditing(stage)} className="text-[#8B8F9E] hover:text-[#0d0d09]">
                  <Pencil size={12} />
                </button>
                <IconTip label={`Delete ${stage.stage_name}`}>
                  <button
                    type="button"
                    aria-label={`Delete ${stage.stage_name}`}
                    onClick={() => void confirmDeleteStage(stage, { global: true, onDelete: () => deleteStage(stage.id, { quiet: true }) })}
                    className="text-[#8B8F9E] hover:text-[#B91C1C]"
                  >
                    <Trash2 size={12} />
                  </button>
                </IconTip>
              </SpecRow>
            )
          })
        )}
      </SpecCard>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Create default stage</SheetTitle></SheetHeader>
          <div className="mt-6">
            <JobStageForm onCancel={() => setCreateOpen(false)} onSuccess={() => setCreateOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Edit default stage</SheetTitle></SheetHeader>
          <div className="mt-6">
            {editing && <JobStageForm stage={editing} onCancel={() => setEditing(null)} onSuccess={() => setEditing(null)} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ─── Application fields ───
const FIELD_TYPE_LABEL: Record<string, string> = {
  text: 'Text', email: 'Email', number: 'Number', file: 'File',
  url: 'URL', textarea: 'Textarea', select: 'Select', checkbox: 'Checkbox', date: 'Date',
}
const CORE_FIELD_NAMES = new Set(['resume', 'first_name', 'last_name', 'email', 'phone'])

function FieldsTab() {
  const { fields, isLoading, deleteField, refetch } = useApplicationFields('platform-defaults')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ApplicationFieldWithRelations | null>(null)

  const sorted = useMemo(
    () => [...fields].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [fields]
  )

  // S9 (Block B §16): name the field, say what goes and what stays.
  const handleDeleteField = async (field: ApplicationFieldWithRelations) => {
    const label = field.field_label || field.field_name
    const ok = await confirmDestructive({
      title: `Delete the \u201c${label}\u201d field?`,
      description: 'It\u2019s removed from the default application form that every organization inherits, and new postings stop asking it. Answers candidates already gave stay. This can\u2019t be undone.',
      confirmLabel: 'Delete field',
    })
    if (!ok) return
    try {
      await deleteField(field.id)
    } catch {
      toast.error(`Couldn\u2019t delete \u201c${label}\u201d. Nothing was removed; try again.`)
    }
  }

  return (
    <>
      <SpecCard
        title="Default application fields"
        description="The field library organizations inherit for their application forms. Drag to set the default order; 'Default' fields are pre-added to new postings."
        action={<NoirBtn icon={Plus} onClick={() => setCreateOpen(true)}>Add field</NoirBtn>}
      >
        {isLoading ? (
          <div className="flex justify-center" style={{ padding: 28 }}><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center font-inter text-[#8B8F9E]" style={{ padding: '28px 18px', fontSize: 12 }}>No default fields yet.</div>
        ) : (
          sorted.map((field, i) => {
            const isCore = field.is_core_field || CORE_FIELD_NAMES.has(field.field_name)
            return (
              <SpecRow key={field.id} last={i === sorted.length - 1} style={{ padding: '9px 18px', gap: 11 }}>
                <GripVertical size={13} color="#B5B9C4" style={{ cursor: 'grab', flexShrink: 0 }} />
                <span className="flex items-baseline gap-2 flex-1 min-w-0">
                  <span className="font-inter truncate" style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>{field.field_label}</span>
                  <span className="truncate" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8B8F9E' }}>{field.field_name}</span>
                </span>
                <SpecChip tone="gray">{FIELD_TYPE_LABEL[field.field_type] || field.field_type}</SpecChip>
                {field.is_default && <SpecChip tone="green">Default</SpecChip>}
                <button type="button" aria-label="Edit" onClick={() => setEditing(field)} className="text-[#8B8F9E] hover:text-[#0d0d09]">
                  <Pencil size={12} />
                </button>
                {!isCore && (
                  <IconTip label={`Delete ${field.field_label || field.field_name}`}>
                    <button
                      type="button"
                      aria-label={`Delete ${field.field_label || field.field_name}`}
                      onClick={() => void handleDeleteField(field)}
                      className="text-[#8B8F9E] hover:text-[#B91C1C]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </IconTip>
                )}
              </SpecRow>
            )
          })
        )}
      </SpecCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create default application field</DialogTitle></DialogHeader>
          <ApplicationFieldForm onClose={() => setCreateOpen(false)} onSaved={async () => { await refetch() }} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit default application field</DialogTitle></DialogHeader>
          {editing && (
            <ApplicationFieldForm field={editing} onClose={() => setEditing(null)} onSaved={async () => { await refetch() }} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PlatformJobDefaults() {
  const [tab, setTab] = useState<TopTab>('stages')
  return (
    <div className="max-w-[860px]">
      <div className="flex items-center mb-[14px]" style={{ gap: 6 }}>
        <MainPill active={tab === 'stages'} onClick={() => setTab('stages')}>Stages</MainPill>
        <MainPill active={tab === 'fields'} onClick={() => setTab('fields')}>Application fields</MainPill>
        <MainPill active={tab === 'templates'} onClick={() => setTab('templates')}>Templates</MainPill>
      </div>

      {tab === 'stages' && <StagesTab />}
      {tab === 'fields' && <FieldsTab />}
      {tab === 'templates' && <OfferTemplatesManager context="platform-defaults" />}
    </div>
  )
}
