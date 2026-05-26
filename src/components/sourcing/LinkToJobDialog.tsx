import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Search, Loader2, Link2, ChevronLeft, Plus, Building2, Flame, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useJobsForCandidateAssignment, type JobOption } from '@/hooks/useJobsForCandidateAssignment'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import type { SourcingProject } from '@/types/sourcing'
import { JobWizard } from '@/components/jobs/JobWizard'

export interface LinkToJobPayload {
  jobId: string
  stageJhsId: string | null
  stageName: string | null
  backfill: boolean
  careersLink: boolean
}

export type EnrichedJob = JobOption & {
  applicantCount?: number
  recruiterName?: string
  matchScore?: number
}

// --- Match scoring against project.job_spec_data --------------------------------
function scoreJob(job: JobOption, spec: any): number {
  if (!spec) return 0
  let score = 0
  const tokens = (s?: string) =>
    (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2)

  const jobTitleTokens = new Set(tokens(job.title))
  const specTitleTokens = tokens(spec.job_title)
  const titleOverlap = specTitleTokens.filter(t => jobTitleTokens.has(t)).length
  if (specTitleTokens.length) score += (titleOverlap / specTitleTokens.length) * 70

  if (Array.isArray(spec.skills)) {
    const titleSig = job.title.toLowerCase()
    const skillHits = spec.skills.filter((s: string) =>
      titleSig.includes(String(s).toLowerCase().slice(0, 8))
    ).length
    score += Math.min(20, skillHits * 5)
  }

  if (spec.department && job.organization_name.toLowerCase().includes(String(spec.department).toLowerCase())) {
    score += 10
  }

  return Math.min(100, Math.round(score))
}

// ================================================================
// LinkToJobPopoverContent — Step 1 job picker, anchored popover body
// ================================================================
interface PopoverContentProps {
  project?: SourcingProject | null
  onSelect: (job: EnrichedJob) => void
  onClose: () => void
  onCreateNew?: () => void
}

export function LinkToJobPopoverContent({ project, onSelect, onClose, onCreateNew }: PopoverContentProps) {
  const { jobs, isLoading } = useJobsForCandidateAssignment()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [enriched, setEnriched] = useState<Record<string, { applicants: number }>>({})

  const spec = project?.job_spec_data ?? null

  useEffect(() => {
    if (!jobs.length) return
    const ids = jobs.map(j => j.id)
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('job_id')
        .in('job_id', ids)
      if (cancelled || !data) return
      const counts: Record<string, { applicants: number }> = {}
      for (const row of data as any[]) {
        counts[row.job_id] = { applicants: (counts[row.job_id]?.applicants || 0) + 1 }
      }
      setEnriched(counts)
    })()
    return () => { cancelled = true }
  }, [jobs])

  const scored: EnrichedJob[] = useMemo(() => {
    return jobs.map(j => ({
      ...j,
      applicantCount: enriched[j.id]?.applicants ?? 0,
      matchScore: scoreJob(j, spec),
    }))
  }, [jobs, enriched, spec])

  const filtered = scored.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.organization_name.toLowerCase().includes(search.toLowerCase())
  )

  const gioMatches = filtered
    .filter(j => (j.matchScore ?? 0) >= 70)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 3)
  const gioIds = new Set(gioMatches.map(j => j.id))
  const others = filtered.filter(j => !gioIds.has(j.id))

  return (
    <div className="flex flex-col">
      {/* Sheet-style header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDE4FF]">
            <Link2 className="h-4 w-4 text-virgilio-purple" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="text-[15px] font-semibold font-poppins tracking-[-0.02em] text-text-primary leading-snug">
              Link this project to a job
            </div>
            <div className="mt-0.5 text-[12.5px] text-text-tertiary leading-snug">
              Future collects will route into the chosen pipeline stage.
            </div>
          </div>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={X}
            aria-label="Close"
            onClick={onClose}
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="h-9 pl-9 pr-12 text-[13px]"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-5 px-1.5 rounded border border-border bg-background text-[10px] font-mono text-text-tertiary">
            esc
          </kbd>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="max-h-[420px] px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
            <Briefcase className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-[13px]">{search ? 'No matching jobs' : 'No open jobs'}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {gioMatches.length > 0 && (
              <JobGroup label={`Gio thinks these match · ${gioMatches.length}`} jobs={gioMatches} onSelect={onSelect} showMatch />
            )}
            {others.length > 0 && (
              <JobGroup label={`Other open jobs · ${others.length}`} jobs={others} onSelect={onSelect} />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="h-px bg-border" />
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[12px] text-text-tertiary">Can't find it?</span>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          className="text-virgilio-purple hover:text-virgilio-purple"
          onClick={() => {
            if (onCreateNew) { onCreateNew(); return }
            toast({ title: 'Coming soon', description: 'Create job from this dialog is coming soon.' })
          }}
        >
          Create new job
        </Button>
      </div>
    </div>
  )
}

function JobGroup({
  label,
  jobs,
  onSelect,
  showMatch,
}: {
  label: string
  jobs: EnrichedJob[]
  onSelect: (job: EnrichedJob) => void
  showMatch?: boolean
}) {
  return (
    <div>
      <div className="px-2 mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
        {label}
      </div>
      <div className="space-y-0.5">
        {jobs.map(job => {
          const initials = job.organization_name
            .split(/\s+/)
            .map(w => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase()
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelect(job)}
              className="group relative w-full text-left px-2.5 py-2.5 rounded-lg hover:bg-[#F1F0EC] transition-colors flex items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground/[0.04] text-text-secondary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold font-poppins tracking-[-0.01em] text-text-primary">{job.title}</span>
                  {showMatch && (job.matchScore ?? 0) >= 70 && (
                    <Badge tone="purple" size="xs" shape="pill">
                      {job.matchScore}% match
                    </Badge>
                  )}
                  {showMatch && (job.matchScore ?? 0) >= 85 && (
                    <Badge tone="orange" size="xs" shape="pill" icon={Flame}>Hot</Badge>
                  )}
                </div>
                <div className="mt-0.5 text-[11.5px] text-text-tertiary truncate">
                  {job.organization_name}
                  {job.applicantCount !== undefined && job.applicantCount > 0 && (
                    <> · <span className="text-text-secondary font-medium">{job.applicantCount}</span> applicant{job.applicantCount !== 1 ? 's' : ''}</>
                  )}
                </div>
              </div>
              <div className="h-7 w-7 shrink-0 rounded-full bg-virgilio-purple/90 text-background flex items-center justify-center text-[10.5px] font-semibold font-poppins">
                {initials || 'JB'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ================================================================
// Step 2 — Stage + backfill (centered dialog)
// ================================================================
function StageStep({
  job,
  savedCount,
  organizationName,
  onBack,
  onConfirm,
  isSubmitting,
}: {
  job: EnrichedJob
  savedCount: number
  organizationName?: string
  onBack: () => void
  onConfirm: (stageJhsId: string, stageName: string, backfill: boolean, careersLink: boolean) => void
  isSubmitting: boolean
}) {
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const [stages, setStages] = useState<{ jhsId: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJhsId, setSelectedJhsId] = useState<string>('')
  const [backfill, setBackfill] = useState(savedCount > 0)
  const [careersLink, setCareersLink] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const opts = await loadHiringPlanInstances(job.id)
      if (cancelled) return
      const mapped = opts.map(s => ({
        jhsId: s.jhsId,
        label: s.customStageName || s.stage.stage_name,
      }))
      setStages(mapped)
      if (mapped.length) setSelectedJhsId(mapped[0].jhsId)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [job.id, loadHiringPlanInstances])

  const selectedStage = stages.find(s => s.jhsId === selectedJhsId)

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-start gap-3 pb-3 mb-3 border-b border-border">
        <Button variant="ghost" size="xs" iconOnly icon={ChevronLeft} aria-label="Back to job pick" onClick={onBack} />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="truncate text-[14px] font-medium text-text-primary">{job.title}</div>
          <div className="mt-0.5 text-[11.5px] text-text-tertiary truncate">
            {job.organization_name}
            {job.applicantCount !== undefined && job.applicantCount > 0 && (
              <> · {job.applicantCount} applicant{job.applicantCount !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary px-1">
          Default stage for new collects
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
          </div>
        ) : stages.length === 0 ? (
          <div className="text-[13px] text-text-tertiary px-1 py-4">
            This job has no pipeline stages configured.
          </div>
        ) : (
          <div className="space-y-1">
            {stages.map((stage, idx) => {
              const isSelected = selectedJhsId === stage.jhsId
              return (
                <button
                  key={stage.jhsId}
                  type="button"
                  onClick={() => setSelectedJhsId(stage.jhsId)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors text-left',
                    isSelected ? 'bg-[#EDE4FF]' : 'hover:bg-[#F1F0EC]'
                  )}
                >
                  <div className={cn(
                    'h-4 w-4 shrink-0 rounded-full border flex items-center justify-center',
                    isSelected ? 'border-virgilio-purple bg-virgilio-purple' : 'border-border'
                  )}>
                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                  </div>
                  <div className="h-3 w-3 rounded-sm bg-foreground/15" />
                  <div className="flex-1 text-[13px] text-text-primary">{stage.label}</div>
                  {idx === 0 && (
                    <Badge tone="lilac" size="xs" shape="pill">Recommended</Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="pt-3 border-t border-border">
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary px-1 mb-2">
            Backfill
          </div>
          <div className="space-y-2 px-1">
            {savedCount > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={backfill}
                  onCheckedChange={(v) => setBackfill(v === true)}
                  className="mt-0.5"
                />
                <span className="text-[13px] text-text-primary leading-tight">
                  Drop <strong>{savedCount}</strong> already-collected candidate{savedCount !== 1 ? 's' : ''} into <strong>{selectedStage?.label || 'this stage'}</strong>
                </span>
              </label>
            )}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={careersLink}
                onCheckedChange={(v) => setCareersLink(v === true)}
                className="mt-0.5"
              />
              <span className="text-[13px] text-text-primary leading-tight">
                Send {organizationName || 'your'} careers page link to all future collects
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
        <span className="text-[12px] text-text-tertiary">
          {backfill && savedCount > 0 ? `${savedCount} will move on link` : 'No backfill'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={isSubmitting}>
            Back
          </Button>
          <Button
            size="sm"
            icon={Link2}
            onClick={() => selectedStage && onConfirm(selectedStage.jhsId, selectedStage.label, backfill, careersLink)}
            disabled={!selectedStage || isSubmitting}
            loading={isSubmitting}
          >
            Link project
          </Button>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// LinkToJobDialog — root dialog. Handles either:
//   (a) Step 2 only (when `pickedJob` is provided — banner flow), or
//   (b) Full Step 1 → Step 2 sequence (legacy callers like SourcingProjectActions).
// ================================================================
interface LinkToJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: LinkToJobPayload) => void | Promise<void>
  currentJobId?: string | null
  project?: SourcingProject | null
  savedCandidatesCount?: number
  organizationName?: string
  /** When provided, the dialog opens directly at Step 2 for that job (banner flow). */
  pickedJob?: EnrichedJob | null
  /** Called when the user hits Back from Step 2 (banner flow re-opens its popover). */
  onBackToPick?: () => void
}

export function LinkToJobDialog({
  open,
  onOpenChange,
  onConfirm,
  project,
  savedCandidatesCount = 0,
  organizationName,
  pickedJob: pickedJobProp = null,
  onBackToPick,
}: LinkToJobDialogProps) {
  const { jobs, isLoading } = useJobsForCandidateAssignment()
  const { toast } = useToast()
  const externallyPicked = !!pickedJobProp
  const [step, setStep] = useState<'pick' | 'stage'>(externallyPicked ? 'stage' : 'pick')
  const [pickedJob, setPickedJob] = useState<EnrichedJob | null>(pickedJobProp)
  const [submitting, setSubmitting] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep(externallyPicked ? 'stage' : 'pick')
      setPickedJob(pickedJobProp)
      setSubmitting(false)
    } else {
      setPickedJob(pickedJobProp)
      setStep(externallyPicked ? 'stage' : 'pick')
    }
  }, [open, pickedJobProp, externallyPicked])

  const spec = project?.job_spec_data ?? null

  const handleConfirm = async (jhsId: string, stageName: string, backfill: boolean, careersLink: boolean) => {
    if (!pickedJob) return
    setSubmitting(true)
    try {
      await onConfirm({
        jobId: pickedJob.id,
        stageJhsId: jhsId,
        stageName,
        backfill,
        careersLink,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col gap-0">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground/[0.06]">
              <Link2 className="h-3.5 w-3.5 text-text-primary" />
            </div>
            {step === 'pick' ? 'Link this project to a job' : 'Pick the default stage'}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-text-tertiary">
            {step === 'pick'
              ? 'Future collects will route into the chosen pipeline stage.'
              : 'Where new collects land. Backfill options also live here.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col min-h-0 pt-2">
          {step === 'pick' ? (
            <LegacyPickerInsideDialog
              jobs={jobs}
              isLoading={isLoading}
              spec={spec}
              onSelect={(job) => { setPickedJob(job); setStep('stage') }}
              onCreateNew={() => toast({ title: 'Coming soon', description: 'Create job from this dialog is coming soon.' })}
            />
          ) : pickedJob ? (
            <StageStep
              job={pickedJob}
              savedCount={savedCandidatesCount}
              organizationName={organizationName}
              onBack={() => {
                if (externallyPicked && onBackToPick) {
                  onOpenChange(false)
                  onBackToPick()
                } else {
                  setStep('pick')
                }
              }}
              onConfirm={handleConfirm}
              isSubmitting={submitting}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Legacy inline picker for non-banner callers (e.g. SourcingProjectActions "Change linked job").
function LegacyPickerInsideDialog({
  jobs,
  isLoading,
  spec,
  onSelect,
  onCreateNew,
}: {
  jobs: JobOption[]
  isLoading: boolean
  spec: any
  onSelect: (job: EnrichedJob) => void
  onCreateNew: () => void
}) {
  const [search, setSearch] = useState('')
  const [enriched, setEnriched] = useState<Record<string, { applicants: number }>>({})

  useEffect(() => {
    if (!jobs.length) return
    const ids = jobs.map(j => j.id)
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('job_id')
        .in('job_id', ids)
      if (cancelled || !data) return
      const counts: Record<string, { applicants: number }> = {}
      for (const row of data as any[]) {
        counts[row.job_id] = { applicants: (counts[row.job_id]?.applicants || 0) + 1 }
      }
      setEnriched(counts)
    })()
    return () => { cancelled = true }
  }, [jobs])

  const scored: EnrichedJob[] = useMemo(() => jobs.map(j => ({
    ...j,
    applicantCount: enriched[j.id]?.applicants ?? 0,
    matchScore: scoreJob(j, spec),
  })), [jobs, enriched, spec])

  const filtered = scored.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.organization_name.toLowerCase().includes(search.toLowerCase())
  )

  const gioMatches = filtered
    .filter(j => (j.matchScore ?? 0) >= 70)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 3)
  const gioIds = new Set(gioMatches.map(j => j.id))
  const others = filtered.filter(j => !gioIds.has(j.id))

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-1 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="h-9 pl-9 text-[13px]"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 max-h-[440px] -mx-1 px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
            <Briefcase className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-[13px]">{search ? 'No matching jobs' : 'No open jobs'}</p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {gioMatches.length > 0 && (
              <JobGroup label={`Gio thinks these match · ${gioMatches.length}`} jobs={gioMatches} onSelect={onSelect} showMatch />
            )}
            {others.length > 0 && (
              <JobGroup label={`Other open jobs · ${others.length}`} jobs={others} onSelect={onSelect} />
            )}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
        <span className="text-[12px] text-text-tertiary">Can't find it?</span>
        <Button variant="ghost" size="sm" icon={Plus} onClick={onCreateNew}>
          Create new job
        </Button>
      </div>
    </div>
  )
}
