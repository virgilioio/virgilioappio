import React, { useState } from 'react'
import { GitBranch, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HiringPlanTab } from '../HiringPlanTab'
import { SectionCard, ToggleRow } from './_parts'
import { useJobStages, type JobStage } from '@/hooks/useJobStages'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'


interface HiringPlanStepProps {
  jobId: string | null
  onNext: () => void
  onBack: () => void
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

export function HiringPlanStep({ jobId }: HiringPlanStepProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null)
  const [applyingTemplate, setApplyingTemplate] = useState<TemplateId | null>(null)
  const [planVersion, setPlanVersion] = useState(0) // bump → remount HiringPlanTab
  const { stages: libraryStages, isLoading: stagesLoading } = useJobStages()
  const { saveHiringPlan } = useJobHiringPlan()

  // Auto-rejection rules (UI state — wired to backend in a follow-up)
  const [rejectOutsideLocations, setRejectOutsideLocations] = useState(true)
  const [rejectSalaryAbove, setRejectSalaryAbove] = useState(true)
  const [rejectRepeatApplicant, setRejectRepeatApplicant] = useState(false)

  // AI auto-screen
  const [autoScore, setAutoScore] = useState(true)
  const [autoRejectBelow, setAutoRejectBelow] = useState(true)
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(35)
  const [generateSummary, setGenerateSummary] = useState(true)

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
      // Prefer platform defaults so the same stage_type repeats consistently.
      const usedIds = new Set<string>()
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

        // Same stage_type can appear multiple times (e.g. interview twice).
        // Allow reuse — saveHiringPlan dedupes by id, so distinct stages are needed.
        // Fall back to any candidate, even if already used.
        const fresh = candidates.find((c) => !usedIds.has(c.id))
        const pick = fresh || candidates[0]
        if (!pick) {
          skipped += 1
          continue
        }
        if (!usedIds.has(pick.id)) {
          usedIds.add(pick.id)
          resolved.push(pick as unknown as JobStage)
        } else {
          // Already in the plan — duplicate not possible without a distinct stage row.
          skipped += 1
        }
      }

      if (resolved.length === 0) {
        toast.error("None of this template's stages exist in your library.")
        return
      }

      await saveHiringPlan(jobId, resolved.map((s) => ({ id: s.id })))
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


      {/* AUTO-REJECTION RULES */}
      <SectionCard title="Auto-rejection rules">
        <div className="divide-y divide-virgilio-border/60">
          <div className="pb-3">
            <ToggleRow
              label="Outside listed locations"
              hint="Reject candidates not in the job's open regions."
              checked={rejectOutsideLocations}
              onChange={setRejectOutsideLocations}
            />
          </div>
          <div className="py-3">
            <ToggleRow
              label="Salary expectation >25% above range"
              hint="Reject and keep on file."
              checked={rejectSalaryAbove}
              onChange={setRejectSalaryAbove}
            />
          </div>
          <div className="pt-3">
            <ToggleRow
              label="Same candidate, last 90 days"
              hint="Auto-reject re-applicants for the same role."
              checked={rejectRepeatApplicant}
              onChange={setRejectRepeatApplicant}
            />
          </div>
        </div>
      </SectionCard>

      {/* AI AUTO-SCREEN */}
      <SectionCard title="AI auto-screen" trailing={<GioRecommendsChip label="Gio" />}>
        <div className="divide-y divide-virgilio-border/60">
          <div className="pb-3">
            <ToggleRow
              label="Auto-score every application"
              hint="Scores 0–100 based on required skills and experience."
              checked={autoScore}
              onChange={setAutoScore}
            />
          </div>
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-poppins font-medium text-text-primary">
                Auto-reject scores below
              </p>
              <p className="text-[12px] text-text-tertiary mt-0.5">
                Sends a polite rejection email. Reviewable in the Rejected tab.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 items-center rounded-lg border border-virgilio-border bg-white px-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={autoRejectThreshold}
                  onChange={(e) => setAutoRejectThreshold(Number(e.target.value || 0))}
                  className="w-10 bg-transparent text-[13px] tabular-nums text-text-primary outline-none text-right"
                />
                <span className="text-[12px] text-text-tertiary pl-1">/100</span>
              </div>
              <button
                role="switch"
                aria-checked={autoRejectBelow}
                onClick={() => setAutoRejectBelow(!autoRejectBelow)}
                className={cn(
                  'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
                  autoRejectBelow ? 'bg-pastel-green-foreground' : 'bg-virgilio-border'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                    autoRejectBelow ? 'translate-x-[18px]' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>
          <div className="pt-3">
            <ToggleRow
              label="Generate AI candidate summary"
              hint="3-paragraph summary attached to each candidate profile."
              checked={generateSummary}
              onChange={setGenerateSummary}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
