import { useState, useEffect, useMemo, useRef } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Eye, Clock, ChevronRight, Users, GitBranch, Globe } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Job, CreateJobData, UpdateJobData } from '@/hooks/useJobs'
import { JobInfoStep } from './wizard/JobInfoStep'
import { SectionCard, ToggleRow } from './wizard/_parts'
import { cn } from '@/lib/utils'

interface JobFormSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateJobData | UpdateJobData) => Promise<void>
  job?: Job | null
  isLoading: boolean
  candidateCount?: number
  onPreviewPosting?: () => void
  onCloseJob?: () => void
  onArchiveJob?: () => void
  onGoToSetup?: (subtab: 'plan' | 'team' | 'posting') => void
}

const STATUS_TONE: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'neutral' }> = {
  open: { label: 'Open', tone: 'green' },
  draft: { label: 'Draft', tone: 'yellow' },
  closed: { label: 'Closed', tone: 'red' },
  archived: { label: 'Archived', tone: 'neutral' },
}

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'location', label: 'Location & employment' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'description', label: 'Description' },
  { id: 'skills', label: 'Skills' },
] as const

export function JobFormSheet({
  isOpen,
  onClose,
  onSubmit,
  job,
  isLoading,
  candidateCount,
  onPreviewPosting,
  onCloseJob,
  onArchiveJob,
  onGoToSetup,
}: JobFormSheetProps) {
  const [jobData, setJobData] = useState<Partial<CreateJobData>>({ status: 'draft', currency: 'USD' })
  const [activeSection, setActiveSection] = useState<string>('basics')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Hydrate from job
  useEffect(() => {
    if (!isOpen) return
    if (job) {
      setJobData({
        title: job.title,
        description: job.description || '',
        location: job.location || '',
        salary_min: job.salary_min ?? undefined,
        salary_max: job.salary_max ?? undefined,
        currency: job.currency || 'USD',
        status: job.status,
        organization_id: job.organization_id,
        skills: job.skills || [],
        internal_title: job.internal_title || undefined,
        job_level: job.job_level || undefined,
        work_mode: job.work_mode || undefined,
        employment_type: job.employment_type || undefined,
        additional_locations: job.additional_locations || [],
        show_salary_public: job.show_salary_public ?? true,
        include_equity: job.include_equity ?? false,
        include_signing_bonus: job.include_signing_bonus ?? false,
        min_years_experience: job.min_years_experience ?? undefined,
        max_years_experience: job.max_years_experience ?? undefined,
      })
    } else {
      setJobData({ status: 'draft', currency: 'USD', show_salary_public: true })
    }
  }, [isOpen, job])

  const updateJobData = (patch: Partial<CreateJobData>) =>
    setJobData((prev) => ({ ...prev, ...patch }))

  const isValid = !!jobData.title?.trim() && !!jobData.organization_id

  const handleSubmit = async () => {
    if (!isValid) return
    const payload: any = { ...jobData }
    if (job) delete payload.organization_id
    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      // toast in hook
    }
  }

  // Scroll-spy
  useEffect(() => {
    if (!isOpen) return
    const root = scrollRef.current
    if (!root) return
    const headers = SECTIONS.map((s) => root.querySelector<HTMLElement>(`[data-section="${s.id}"]`)).filter(Boolean) as HTMLElement[]
    const onScroll = () => {
      const top = root.scrollTop + 80
      let current = SECTIONS[0].id
      for (const h of headers) {
        if (h.offsetTop <= top) current = h.dataset.section || current
      }
      setActiveSection(current)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [isOpen])

  const scrollTo = (id: string) => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-section="${id}"]`)
    if (el) root.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
  }

  const statusInfo = STATUS_TONE[(jobData.status || 'draft').toLowerCase()] || STATUS_TONE.draft
  const lastEdited = job?.updated_at ? formatDistanceToNowStrict(new Date(job.updated_at), { addSuffix: false }) : null

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="w-full sm:max-w-[860px] p-0 flex flex-col bg-virgilio-cream gap-0"
        side="right"
      >
        {/* HEADER */}
        <header className="shrink-0 bg-white border-b border-virgilio-border px-6 sm:px-8 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-poppins font-semibold tracking-[0.16em] uppercase text-virgilio-purple mb-2">
                {job ? 'Edit job' : 'Create job'}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[24px] sm:text-[28px] leading-tight">
                  {jobData.title || job?.title || 'Untitled job'}
                  <span className="text-virgilio-purple">.</span>
                </h2>
                <Badge tone={statusInfo.tone} dot size="sm">{statusInfo.label}</Badge>
                {typeof candidateCount === 'number' && (
                  <Badge tone="neutral" size="sm">{candidateCount} candidates</Badge>
                )}
              </div>
              <p className="mt-2 text-[13px] text-text-secondary font-inter leading-relaxed max-w-[640px]">
                Update the role's basics, location, compensation, description, and skills.<br />
                Changes go live the moment you save.
              </p>
            </div>
            <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={onClose} />
          </div>

          {/* Section nav pills */}
          <nav className="mt-5 flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={cn(
                  'px-3.5 h-9 rounded-lg text-[12.5px] font-poppins font-medium whitespace-nowrap transition-colors',
                  activeSection === s.id
                    ? 'bg-white text-text-primary shadow-[0_1px_0_0_rgba(13,13,9,0.06),0_1px_2px_-1px_rgba(13,13,9,0.08)] border border-virgilio-border'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[#F1F0EC]'
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        {/* SCROLL BODY */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 sm:px-8 py-8 space-y-10">
            {/* Section anchors wrap the JobInfoStep sections.
                JobInfoStep already renders all five core SectionCards in order:
                Basics, Location & Employment, Compensation, Job description, Required skills */}
            <div data-section="basics" />
            <div className="-mt-10">
              {/* Reuse the wizard's rich form. We attach anchors via offsetTop tracking */}
              <AnchoredJobInfo jobData={jobData} onUpdate={updateJobData} />
            </div>

            {/* Compensation toggles (job-level) — extend the wizard's compensation card */}
            <SectionCard title="Public posting compensation">
              <ToggleRow
                label="Show salary on public posting"
                hint="Recommended — applicant quality jumps 40% on jobs that publish salary."
                checked={!!jobData.show_salary_public}
                onChange={(v) => updateJobData({ show_salary_public: v })}
              />
              <ToggleRow
                label="Include equity"
                checked={!!jobData.include_equity}
                onChange={(v) => updateJobData({ include_equity: v })}
              />
              <ToggleRow
                label="Include signing bonus"
                checked={!!jobData.include_signing_bonus}
                onChange={(v) => updateJobData({ include_signing_bonus: v })}
              />
            </SectionCard>

            {/* EDITED ELSEWHERE */}
            {job && (
              <SectionCard title="Edited elsewhere">
                <ElsewhereRow
                  icon={GitBranch}
                  title="Hiring plan"
                  hint="Stages, SLAs, auto-screen rules"
                  cta="Job Setup → Plan"
                  onClick={() => onGoToSetup?.('plan')}
                />
                <ElsewhereRow
                  icon={Users}
                  title="Hiring team"
                  hint="Owners, panel, permissions"
                  cta="Job Setup → Team"
                  onClick={() => onGoToSetup?.('team')}
                />
                <ElsewhereRow
                  icon={Globe}
                  title="Job posting"
                  hint="Public listing, channels, form"
                  cta="Job Setup → Posting"
                  onClick={() => onGoToSetup?.('posting')}
                />
              </SectionCard>
            )}

            {/* DANGER ZONE */}
            {job && (onCloseJob || onArchiveJob) && (
              <section className="space-y-3">
                <h3 className="text-[11px] font-poppins font-semibold tracking-[0.12em] uppercase text-destructive">
                  Danger zone
                </h3>
                <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-5 sm:p-6 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-destructive/10 grid place-items-center text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-poppins font-medium text-text-primary">
                        Close or archive this job
                      </div>
                      <p className="text-[12.5px] text-text-secondary mt-0.5">
                        Closing stops new applications. Archiving moves it out of the active list — candidates stay in the talent pool.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onCloseJob && jobData.status !== 'closed' && jobData.status !== 'archived' && (
                      <Button variant="secondary" size="sm" onClick={onCloseJob}>Close job</Button>
                    )}
                    {onArchiveJob && jobData.status !== 'archived' && (
                      <Button variant="danger" size="sm" onClick={onArchiveJob}>Archive</Button>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="shrink-0 border-t border-virgilio-border bg-white px-6 sm:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={onClose} className="text-[13px] font-poppins font-medium text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            {lastEdited && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary">
                <Clock className="h-3.5 w-3.5" />
                Last edited <span className="text-text-secondary font-medium">{lastEdited} ago</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onPreviewPosting && (
              <Button variant="secondary" size="md" icon={Eye} onClick={onPreviewPosting}>
                Preview posting
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={!isValid || isLoading} loading={isLoading}>
              {job ? 'Save changes' : 'Create job'}
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

/* Wrapper to render JobInfoStep with scroll-anchor data attributes injected via wrapping divs.
   We render JobInfoStep as-is and place absolute anchor markers positioned by section index
   using a sibling-tracking trick: simple — wrap each SectionCard via JobInfoStep output is
   not feasible, so we approximate anchors by counting children. */
function AnchoredJobInfo({
  jobData,
  onUpdate,
}: {
  jobData: Partial<CreateJobData>
  onUpdate: (d: Partial<CreateJobData>) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = wrapRef.current
    if (!root) return
    // JobInfoStep's outer div has class space-y-8 with 5 child <section>s
    const inner = root.querySelector(':scope > div')
    if (!inner) return
    const sections = inner.querySelectorAll(':scope > section')
    const ids = ['basics', 'location', 'compensation', 'description', 'skills']
    sections.forEach((sec, i) => {
      if (ids[i]) sec.setAttribute('data-section', ids[i])
    })
  }, [])

  return (
    <div ref={wrapRef}>
      <JobInfoStep jobData={jobData} onUpdate={onUpdate} />
    </div>
  )
}

function ElsewhereRow({
  icon: Icon,
  title,
  hint,
  cta,
  onClick,
}: {
  icon: React.ComponentType<any>
  title: string
  hint: string
  cta: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 py-2.5 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-[#F1F0EC] grid place-items-center text-text-secondary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-left">
          <div className="text-[13.5px] font-poppins font-medium text-text-primary">{title}</div>
          <div className="text-[12px] text-text-tertiary">{hint}</div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[12.5px] font-poppins font-medium text-virgilio-purple shrink-0 group-hover:underline">
        {cta}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  )
}

export default JobFormSheet
