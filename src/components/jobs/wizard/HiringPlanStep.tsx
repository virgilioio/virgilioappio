import React, { useState } from 'react'
import { GitBranch, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HiringPlanTab } from '../HiringPlanTab'
import { SectionCard } from './_parts'
import { ScreeningRulesCard, AiScreenCard } from '@/components/jobs/settings/JobAutomationCards'
import { useJobStages, type JobStage } from '@/hooks/useJobStages'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'


interface HiringPlanUi {
  selectedTemplate: TemplateId | null
}

interface HiringPlanStepProps {
  jobId: string | null
  /** The job's salary range and period (the salary rule needs both). */
  job?: { salary_max?: number | null; salary_period?: string | null } | null
  onNext: () => void
  onBack: () => void
  ui: HiringPlanUi
  onUiChange: (patch: Partial<HiringPlanUi>) => void
}

/* ---------- Template cards (UI-level preset chooser) ---------- */
type TemplateId = 'workspace_default' | 'lean_tech' | 'exec_leadership'

// Each template is a desired sequence of stage_types resolved against the
// user's stage library (platform defaults + tenant stages).
const TEMPLATES: Array<{
  id: TemplateId
  name: string
  description: string
  tileBg: string
  tileFg: string
  stageTypes: string[]
}> = [
  {
    id: 'workspace_default',
    name: 'Workspace default',
    description: 'Application → Screen → Take-home → Onsite → Final → Offer',
    tileBg: '#0d0d09',
    tileFg: '#fffcf9',
    stageTypes: ['application_review', 'screening', 'assessment', 'interview', 'interview', 'offer'],
  },
  {
    id: 'lean_tech',
    name: 'Lean tech hire',
    description: 'Application → Screen → Tech onsite → Offer · 4 stages',
    tileBg: '#3FA7F2',
    tileFg: '#FFFFFF',
    stageTypes: ['application_review', 'screening', 'interview', 'offer'],
  },
  {
    id: 'exec_leadership',
    name: 'Exec / leadership',
    description: 'Adds 2 leadership rounds + back-channel references',
    tileBg: '#8B5CF6',
    tileFg: '#FFFFFF',
    stageTypes: ['application_review', 'screening', 'interview', 'interview', 'interview', 'reference_check', 'offer'],
  },
]


function TemplateCard({
  template,
  selected,
  applying,
  onSelect,
}: {
  template: (typeof TEMPLATES)[number]
  selected: boolean
  applying: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={applying}
      className={cn(
        'group relative flex flex-col items-start gap-4 rounded-xl border p-5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
        'disabled:cursor-wait',
        selected
          ? 'border-virgilio-purple bg-[#F6F1FF] shadow-[0_0_0_1px_hsl(var(--virgilio-purple))]'
          : 'border-virgilio-border bg-white hover:bg-[#FAFAF7]'
      )}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: template.tileBg, color: template.tileFg }}
      >
        {applying ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <GitBranch className="h-[18px] w-[18px]" />}
      </span>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h4 className="text-[15px] font-poppins font-semibold tracking-[-0.01em] text-text-primary">
            {template.name}
          </h4>
          {selected && (
            <span className="inline-flex items-center rounded-full bg-[#EDE4FF] px-2 py-0.5 text-[10.5px] font-poppins font-semibold uppercase tracking-[0.08em] text-virgilio-purple">
              {applying ? 'Applying…' : 'Selected'}
            </span>
          )}
        </div>
        <p className="text-[12.5px] leading-relaxed text-text-secondary">
          {template.description}
        </p>
      </div>
    </button>
  )
}


function GioRecommendsChip({ label = 'Gio recommends' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE4FF] px-2.5 py-1 text-[11.5px] font-poppins font-medium text-virgilio-purple">
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  )
}

export function HiringPlanStep({ jobId, job, ui, onUiChange }: HiringPlanStepProps) {
  const { selectedTemplate } = ui
  const setSelectedTemplate = (v: TemplateId | null) => onUiChange({ selectedTemplate: v })

  const [applyingTemplate, setApplyingTemplate] = useState<TemplateId | null>(null)
  const [planVersion, setPlanVersion] = useState(0) // bump → remount HiringPlanTab
  const { stages: libraryStages, isLoading: stagesLoading } = useJobStages()
  const { saveHiringPlan } = useJobHiringPlan()

  const applyTemplate = async (template: (typeof TEMPLATES)[number]) => {
    if (!jobId) {
      toast.error('Create the job first before applying a template.')
      return
    }
    if (stagesLoading || libraryStages.length === 0) {
      toast.error('Stage library is still loading — try again in a moment.')
      return
    }

    setApplyingTemplate(template.id)
    try {
      // Resolve each stage_type to the first matching active library stage.
      // Duplicates of the same library stage are allowed in the plan, so a
      // template like ['interview','interview'] now produces two interview rows.
      const resolved: JobStage[] = []
      let skipped = 0

      for (const type of template.stageTypes) {
        const candidates = libraryStages
          .filter((s) => s.stage_type === type)
          .sort((a, b) => {
            // Platform > tenant, then is_default first
            if (a.source !== b.source) return a.source === 'platform' ? -1 : 1
            return Number(b.is_default) - Number(a.is_default)
          })

        const pick = candidates[0]
        if (!pick) {
          skipped += 1
          continue
        }
        resolved.push(pick as unknown as JobStage)
      }

      if (resolved.length === 0) {
        toast.error("None of this template's stages exist in your library.")
        return
      }

      await saveHiringPlan(jobId, resolved.map((s) => ({ stage_id: s.id })))
      setSelectedTemplate(template.id)
      setPlanVersion((v) => v + 1)

      if (skipped > 0) {
        toast.success(`Template applied · ${resolved.length} stages`, {
          description: `${skipped} stage${skipped > 1 ? 's were' : ' was'} skipped (not in your library).`,
        })
      } else {
        toast.success(`Template applied · ${resolved.length} stages`)
      }
    } catch (err: any) {
      console.error('Apply template failed:', err)
      toast.error(err?.message || 'Failed to apply template')
    } finally {
      setApplyingTemplate(null)
    }
  }

  return (
    <div className="space-y-8 pb-6">
      {/* TEMPLATE */}
      <SectionCard
        title="Template"
        trailing={<GioRecommendsChip />}
        className=""
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 -m-1">
          {TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={selectedTemplate === t.id}
              applying={applyingTemplate === t.id}
              onSelect={() => applyTemplate(t)}
            />
          ))}
        </div>
      </SectionCard>

      {/* STAGES — backed by existing HiringPlanTab */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-poppins font-semibold tracking-[0.12em] uppercase text-text-secondary">
          Stages
        </h3>
        <div className="rounded-2xl border border-virgilio-border bg-white p-2 sm:p-3">
          {jobId ? (
            <HiringPlanTab key={planVersion} jobId={jobId} hideHeader />
          ) : (
            <div className="flex items-center justify-center py-12 text-[13px] text-text-secondary">
              Job must be created before configuring hiring plan.
            </div>
          )}
        </div>
      </section>


      {/* SCREENING (job_settings) */}
      <ScreeningRulesCard jobId={jobId} job={job} />
      <AiScreenCard jobId={jobId} />
    </div>
  )
}
