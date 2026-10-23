import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, CircleAlert, ExternalLink, Lock, Rocket } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { WizardSheet, type WizardStep } from '@/components/ui/wizard-sheet'
import { Button } from '@/components/ui/button'
import { useJobs, type CreateJobData } from '@/hooks/useJobs'
import { useJobOpenings } from '@/hooks/useJobOpenings'
import { useJobSetupChecks } from '@/hooks/useJobDraftMeta'
import { JOB_DATA_KEYS, jobRowToData } from '@/lib/jobDraft'
import { readSkillPriorities, priorityOf } from '@/lib/skillPriority'
import type { SalesTeam } from '@/lib/jobTeam'
import { JobInfoStep } from './wizard/JobInfoStep'
import { HiringPlanStep } from './wizard/HiringPlanStep'
import { HiringTeamStep } from './wizard/HiringTeamStep'
import { SectionCard } from './wizard/_parts'

/**
 * Setting up a job that came from a Gio Sales deal (Allan, 2026-10-20). The deal
 * made a draft with the client, openings and Sales / Engagement Specialist; this
 * walks TA Ops through the rest, one thing per step, so nothing blocks the
 * publish at the end: job info, description and skills, hiring plan, hiring team,
 * then a checklist from job_setup_checks with a way to each gap. Every change
 * saves as it is made (job fields 1s after the last edit, the plan and the team
 * at once). Internal jobs keep JobWizard.
 */

const STEPS = ['The deal', 'Job info', 'Description & skills', 'Hiring plan', 'Hiring team', 'Review & publish'] as const
const SUBTITLES = [
  'What Gio Sales sent. Openings, Sales and the Engagement Specialist are set on the deal.',
  'The basics candidates and the team see: department, level, location and pay.',
  'Upload the intake or client brief, then let Gio draft the description and the skills candidates are scored on.',
  'The stages candidates move through.',
  'Who runs the search: the Recruiter, the Sourcer and the hiring manager.',
  'Everything the job needs before it opens.',
]

/** Each publish requirement, the step that fixes it, or the deal when Gio Sales owns it. */
const REQUIREMENTS: { key: string; label: string; step: number | 'deal' }[] = [
  { key: 'Job info', label: 'Job info: title and department', step: 1 },
  { key: 'Openings', label: 'Openings', step: 'deal' },
  { key: 'Hiring plan', label: 'Hiring plan', step: 3 },
  { key: 'Hiring team', label: 'Hiring team', step: 4 },
  { key: 'Recruiter', label: 'Recruiter', step: 4 },
  { key: 'Sourcer', label: 'Sourcer', step: 4 },
  { key: 'Sales', label: 'Sales', step: 'deal' },
  { key: 'Engagement Specialist', label: 'Engagement Specialist', step: 'deal' },
]

const OLD_NAMES: Record<string, string> = { 'TA Partner': 'Recruiter', 'Sourcing Partner': 'Sourcer' }

const SAVE_KEYS = JOB_DATA_KEYS.filter((k) => k !== 'status' && k !== 'organization_id')

type JobRow = Record<string, unknown> & {
  id: string
  title: string | null
  status: string
  sales_deal_id: string | null
  sales_deal_title: string | null
  sales_deal_url: string | null
  sales_deal_owner: string | null
  sales_deal_won_at: string | null
  sales_team: SalesTeam
  organizations?: { name: string | null } | null
}

const dateLabel = (d?: string | null) => (d ? format(new Date(d), 'd MMM yyyy') : '—')

export function CrmJobSetup({
  jobId,
  open,
  onClose,
  onPublished,
}: {
  jobId: string | null
  open: boolean
  onClose: () => void
  onPublished?: (jobId: string) => void
}) {
  const qc = useQueryClient()
  const { updateJob } = useJobs()
  const [step, setStep] = React.useState(0)
  const [jobData, setJobData] = React.useState<Partial<CreateJobData> | null>(null)
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = React.useState(false)
  const [publishError, setPublishError] = React.useState<string | null>(null)
  const [planUi, setPlanUi] = React.useState({ selectedTemplate: null as 'workspace_default' | 'lean_tech' | 'exec_leadership' | null })
  const [teamUi, setTeamUi] = React.useState({ memberSearch: '' })
  const lastSaved = React.useRef('')

  const jobQuery = useQuery({
    queryKey: ['crm-setup-job', jobId],
    enabled: open && !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*, organizations(name)').eq('id', jobId!).single()
      if (error) throw error
      return data as unknown as JobRow
    },
  })
  const job = jobQuery.data
  const { openings } = useJobOpenings(open ? jobId : null)
  const checksQuery = useJobSetupChecks(open ? jobId : null)
  // The checks said TA Partner / Sourcing Partner before 2026-10-23: read either.
  const missing = (checksQuery.data?.missing ?? []).map((k: string) => OLD_NAMES[k] ?? k)

  // Start from the saved job each time the sheet opens.
  React.useEffect(() => {
    if (!open) {
      setJobData(null)
      setStep(0)
      setPublishError(null)
      setSaveState('idle')
      return
    }
    if (job && !jobData) {
      const data = jobRowToData(job) as Partial<CreateJobData>
      lastSaved.current = JSON.stringify(pick(data))
      setJobData(data)
    }
  }, [open, job, jobData])

  // The checklist follows every step change and save.
  React.useEffect(() => {
    if (open && jobId) void checksQuery.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, saveState === 'saved'])

  const save = React.useCallback(
    async (data: Partial<CreateJobData>) => {
      if (!jobId) return
      const payload = pick(data)
      const snap = JSON.stringify(payload)
      if (snap === lastSaved.current) return
      setSaveState('saving')
      try {
        await updateJob(jobId, payload as never, { silent: true })
        lastSaved.current = snap
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    },
    [jobId, updateJob],
  )

  // Job fields save 1s after the last edit (the draft cadence, CLAUDE.md).
  React.useEffect(() => {
    if (!jobData) return
    const t = setTimeout(() => void save(jobData), 1000)
    return () => clearTimeout(t)
  }, [jobData, save])

  const update = (patch: Partial<CreateJobData>) => setJobData((prev) => ({ ...(prev ?? {}), ...patch }))

  const close = async () => {
    if (jobData) await save(jobData)
    qc.invalidateQueries({ queryKey: ['job-draft-meta'] })
    onClose()
  }

  const publish = async () => {
    if (!jobId || !jobData) return
    setPublishError(null)
    setPublishing(true)
    await save(jobData)
    const { error } = await supabase.from('jobs').update({ status: 'open' } as never).eq('id', jobId)
    setPublishing(false)
    if (error) {
      setPublishError(error.message.replace(/^Complete the setup before publishing:\s*/i, 'Still needed: '))
      void checksQuery.refetch()
      return
    }
    toast.success(`${jobData.title || 'The job'} is open`)
    qc.invalidateQueries({ queryKey: ['jobs'] })
    qc.invalidateQueries({ queryKey: ['job-draft-meta'] })
    window.dispatchEvent(new CustomEvent('job-detail:refresh'))
    onPublished?.(jobId)
    onClose()
  }

  const skills = jobData?.skills ?? []
  const priorities = readSkillPriorities(jobData?.skill_priorities)
  const tierCount = (t: 'must' | 'nice' | 'bonus') => skills.filter((s) => priorityOf(priorities, s) === t).length
  const has = (k: string) => !missing.includes(k)
  const stepStates: WizardStep['state'][] = [
    openings.length ? 'done' : 'error',
    has('Job info') ? 'done' : 'todo',
    (jobData?.description || '').trim() && skills.length ? 'done' : 'todo',
    has('Hiring plan') ? 'done' : 'todo',
    has('Recruiter') && has('Sourcer') && has('Hiring team') ? 'done' : 'todo',
    missing.length ? 'todo' : 'done',
  ]
  const steps: WizardStep[] = STEPS.map((title, i) => ({ title, state: i === step ? 'todo' : stepStates[i] }))

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? "Couldn't save. Keep editing to retry." : null
  const clientName = job?.organizations?.name ?? null
  const last = step === STEPS.length - 1

  return (
    <WizardSheet
      open={open}
      onClose={() => void close()}
      eyebrow={`Set up from Gio Sales · Step ${step + 1} of ${STEPS.length}`}
      title={STEPS[step]}
      swapTitle
      subtitle={SUBTITLES[step]}
      steps={steps}
      current={step}
      onStep={setStep}
      railNote={{
        title: job?.title || 'Job from Gio Sales',
        body: clientName ? `For ${clientName}. Changes save as you go.` : 'Changes save as you go.',
      }}
      hint={last ? (missing.length ? `${missing.length} thing${missing.length === 1 ? '' : 's'} left` : 'Ready to publish') : saveLabel}
      primary={
        last
          ? { label: 'Publish job', onClick: () => void publish(), disabled: missing.length > 0 || !checksQuery.data, loading: publishing, icon: Rocket }
          : { label: 'Continue', onClick: () => setStep((s) => s + 1), iconRight: ArrowRight, disabled: !jobData }
      }
    >
      {!job || !jobData ? (
        <div className="space-y-4">
          {jobQuery.error ? (
            <div className="rounded-2xl border border-virgilio-border bg-white p-6 font-inter text-[13px]">
              <p className="text-text-primary">Couldn't load this job.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void jobQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="h-64 rounded-2xl bg-white/70 gio-shimmer" />
          )}
        </div>
      ) : step === 0 ? (
        <DealStep job={job} clientName={clientName} openings={openings} />
      ) : step === 1 ? (
        <JobInfoStep
          jobData={jobData}
          onUpdate={update}
          jobId={jobId}
          sections={['basics', 'location', 'compensation']}
          clientLocked={clientName ?? ''}
          hideStatus
          openings={{ mode: 'edit', jobId: jobId!, onManage: () => setStep(0) }}
        />
      ) : step === 2 ? (
        <JobInfoStep jobData={jobData} onUpdate={update} jobId={jobId} sections={['description', 'skills']} clientLocked={clientName ?? ''} />
      ) : step === 3 ? (
        <HiringPlanStep
          jobId={jobId}
          job={jobData}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
          ui={planUi}
          onUiChange={(p) => setPlanUi((u) => ({ ...u, ...p }))}
        />
      ) : step === 4 ? (
        <div className="space-y-8">
          <FromTheDeal job={job} />
          <HiringTeamStep
            jobId={jobId}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
            ui={teamUi}
            onUiChange={(p) => setTeamUi((u) => ({ ...u, ...p }))}
            reportsToId={jobData.reports_to_user_id ?? ''}
            coordinatorId={jobData.coordinator_user_id ?? '__same__'}
            onReportsToChange={(v) => update({ reports_to_user_id: v || null })}
            onCoordinatorChange={(v) => update({ coordinator_user_id: !v || v === '__same__' ? null : v })}
          />
        </div>
      ) : (
        <ReviewStep
          missing={missing}
          loading={checksQuery.isLoading}
          dealUrl={job.sales_deal_url}
          onGo={setStep}
          description={!!(jobData.description || '').trim()}
          tiers={{ must: tierCount('must'), nice: tierCount('nice'), bonus: tierCount('bonus') }}
          publishError={publishError}
        />
      )}
    </WizardSheet>
  )
}

function pick(data: Partial<CreateJobData>) {
  const out: Record<string, unknown> = {}
  for (const k of SAVE_KEYS) if (k in data) out[k] = (data as Record<string, unknown>)[k]
  return out
}

function DealStep({
  job,
  clientName,
  openings,
}: {
  job: JobRow
  clientName: string | null
  openings: Array<{ id?: string; req_id: string; target_hire_date?: string | null; target_start_date?: string | null }>
}) {
  return (
    <div className="space-y-8">
      <SectionCard title="Deal">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-inter text-[13px]">
          <Field label="Client" value={clientName || '—'} />
          <Field
            label="Deal"
            value={
              job.sales_deal_url ? (
                <a href={job.sales_deal_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-virgilio-purple hover:underline">
                  {job.sales_deal_title || 'Open in Gio Sales'} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                job.sales_deal_title || '—'
              )
            }
          />
          <Field label="Won" value={dateLabel(job.sales_deal_won_at)} />
          <Field label="Role on the deal" value={job.title || '—'} />
        </dl>
      </SectionCard>
      <SectionCard title={`Openings · ${openings.length}`}>
        {openings.length ? (
          <ul className="divide-y divide-[#F1F0EC] font-inter text-[13px]">
            {openings.map((o) => (
              <li key={o.id ?? o.req_id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2 first:pt-0 last:pb-0">
                <span className="font-medium text-text-primary tabular-nums">{o.req_id}</span>
                <span className="text-text-secondary">Hire by <span className="tabular-nums">{dateLabel(o.target_hire_date)}</span></span>
                <span className="text-text-secondary">Start <span className="tabular-nums">{dateLabel(o.target_start_date)}</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-inter text-[13px] text-destructive">No openings came with the deal. Add them on the deal in Gio Sales.</p>
        )}
      </SectionCard>
      <FromTheDeal job={job} />
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 truncate text-text-primary">{value}</dd>
    </div>
  )
}

/** Sales and the Engagement Specialist: set on the deal, read-only here. */
function FromTheDeal({ job }: { job: JobRow }) {
  const team = job.sales_team ?? null
  return (
    <SectionCard title="From the deal">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {([['Sales', team?.sales], ['Engagement Specialist', team?.es]] as const).map(([label, people]) => (
          <div key={label} className="min-w-0 font-inter">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-text-primary">
              {label} <Lock className="h-3 w-3 text-text-tertiary" aria-label="Set on the deal in Gio Sales" />
            </div>
            <div className="mt-1.5 rounded-lg border border-virgilio-border bg-surface-secondary px-3 py-2 text-[12.5px] text-text-primary">
              {people && people.length ? people.map((p) => p.name || p.email).join(', ') : <span className="text-destructive">Not set yet: add it on the deal in Gio Sales</span>}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ReviewStep({
  missing,
  loading,
  dealUrl,
  onGo,
  description,
  tiers,
  publishError,
}: {
  missing: string[]
  loading: boolean
  dealUrl: string | null
  onGo: (step: number) => void
  description: boolean
  tiers: { must: number; nice: number; bonus: number }
  publishError: string | null
}) {
  const skillsNote =
    tiers.must + tiers.nice + tiers.bonus === 0
      ? 'No skills yet: candidates are scored without a skills ruler.'
      : tiers.must > 6
        ? `${tiers.must} must-haves: each one a candidate lacks caps their score. Consider moving some to nice-to-have.`
        : tiers.must === 0
          ? 'No must-haves: scoring can be too loose.'
          : null
  return (
    <div className="space-y-8">
      <SectionCard title="Needed to publish">
        <ul className="space-y-2 font-inter text-[13px]" aria-busy={loading || undefined}>
          {REQUIREMENTS.map((r) => {
            const ok = !loading && !missing.includes(r.key)
            return (
              <li key={r.key} className="flex items-center gap-3">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: ok ? '#E3F6EE' : loading ? '#F1F0EC' : '#FDECEA' }}
                >
                  {ok ? <Check className="h-3 w-3 text-[#0B7A52]" strokeWidth={2.5} /> : !loading && <CircleAlert className="h-3 w-3 text-[#C2372B]" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-primary">{r.label}</span>
                {!ok && !loading && (
                  r.step === 'deal' ? (
                    dealUrl ? (
                      <a href={dealUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-virgilio-purple hover:underline">
                        Set on the deal <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="shrink-0 text-[12.5px] text-text-tertiary">Set on the deal in Gio Sales</span>
                    )
                  ) : (
                    <Button size="xs" variant="ghost" className="shrink-0 text-virgilio-purple" onClick={() => onGo(r.step as number)}>
                      Go to {STEPS[r.step as number]}
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      </SectionCard>
      <SectionCard title="Worth a look">
        <ul className="space-y-2 font-inter text-[13px] text-text-secondary">
          <li className="flex items-center justify-between gap-3">
            <span>{description ? 'Job description written' : 'No job description yet'}</span>
            {!description && (
              <Button size="xs" variant="ghost" className="text-virgilio-purple" onClick={() => onGo(2)}>
                Draft it
              </Button>
            )}
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="tabular-nums">
              Skills: {tiers.must} must-have · {tiers.nice} nice-to-have · {tiers.bonus} extra
            </span>
            <Button size="xs" variant="ghost" className="text-virgilio-purple" onClick={() => onGo(2)}>
              Review
            </Button>
          </li>
          {skillsNote && <li className="text-[12.5px] text-[#B45309]">{skillsNote}</li>}
        </ul>
      </SectionCard>
      {publishError && (
        <p role="alert" className="font-inter text-[13px] text-destructive">
          {publishError}
        </p>
      )}
    </div>
  )
}
