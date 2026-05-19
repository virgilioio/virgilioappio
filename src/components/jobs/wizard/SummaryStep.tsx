import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Briefcase,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  Pencil,
  FileText,
  Sparkles,
  Clock,
  Ban,
  ClipboardList,
  Eye,
  Globe,
  Calendar,
  Shield,
  Search,
  Send,
  Zap,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { CreateJobData } from '@/hooks/useJobs'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useJobPostings } from '@/hooks/useJobPostings'
import { useMembers } from '@/hooks/useMembers'
import { MemberAvatar } from './_parts'
import type { JobStage } from '@/hooks/useJobStages'
import { cn } from '@/lib/utils'

interface SummaryStepProps {
  jobData: Partial<CreateJobData>
  jobId: string | null
  hasPosting: boolean
  postingMeta: { channels: number; fields: number }
  onGoToStep: (step: number) => void
  autoSource?: boolean
  onAutoSourceChange?: (v: boolean) => void
}

const STAGE_TONES = ['blue', 'purple', 'yellow', 'pink', 'green', 'orange', 'lilac'] as const

function Eyebrow({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        {children}
      </p>
      {action}
    </div>
  )
}

function EditLink({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11.5px] font-poppins font-medium text-text-secondary hover:text-virgilio-purple transition-colors"
    >
      <Pencil className="h-3 w-3" />
      {label}
    </button>
  )
}

function FieldRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F6F5F1] text-text-tertiary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.1em] text-text-tertiary">
          {label}
        </p>
        <p className="text-[13px] text-text-primary leading-snug mt-0.5 truncate">
          {value || <span className="text-text-tertiary">—</span>}
        </p>
      </div>
    </div>
  )
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'green' | 'amber'
  children: React.ReactNode
}) {
  const map = {
    green: 'bg-[#E8F5EC] text-[#1F7A3D] border-[#C8E6CF]',
    amber: 'bg-[#FFF3D6] text-[#8A5A00] border-[#F1DDA1]',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-poppins font-medium',
        map[tone],
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'green' ? 'bg-[#1F7A3D]' : 'bg-[#C58A00]',
        )}
      />
      {children}
    </span>
  )
}

function ToggleRow({
  title,
  helper,
  defaultOn,
  disabled,
}: {
  title: string
  helper: string
  defaultOn: boolean
  disabled?: boolean
}) {
  const [on, setOn] = useState(defaultOn)
  useEffect(() => setOn(defaultOn), [defaultOn])
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p
          className={cn(
            'text-[13.5px] font-poppins font-medium',
            disabled ? 'text-text-tertiary' : 'text-text-primary',
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-[12px] text-text-secondary leading-snug">{helper}</p>
      </div>
      <Switch checked={on && !disabled} onCheckedChange={setOn} disabled={disabled} />
    </div>
  )
}

export function SummaryStep({
  jobData,
  jobId,
  hasPosting,
  postingMeta,
  onGoToStep,
  autoSource = true,
  onAutoSourceChange,
}: SummaryStepProps) {
  const { organizations } = useOrganizations()
  const organization = organizations.find((o) => o.id === jobData.organization_id)

  const { loadHiringPlan } = useJobHiringPlan()
  const [stages, setStages] = useState<JobStage[]>([])
  useEffect(() => {
    if (jobId && jobId !== 'created') {
      loadHiringPlan(jobId).then(setStages).catch(() => setStages([]))
    }
  }, [jobId, loadHiringPlan])

  const { assignments } = useJobAssignments(jobId && jobId !== 'created' ? jobId : undefined)
  const { postings } = useJobPostings(jobId && jobId !== 'created' ? jobId : '')
  const { members } = useMembers(true)
  const posting = postings[0]

  const memberByUserId = React.useMemo(() => {
    const map = new Map<string, (typeof members)[number]>()
    for (const m of members) if (m.user_id) map.set(m.user_id, m)
    return map
  }, [members])

  const resolveMember = (userId: string) => {
    const m = memberByUserId.get(userId)
    if (!m) return { name: 'Unknown user', subtitle: '', avatarUrl: null as string | null }
    const name =
      `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim() ||
      m.user_email ||
      'Unknown user'
    return { name, subtitle: m.user_email ?? '', avatarUrl: m.user_avatar_url ?? null }
  }

  const formatSalary = () => {
    const { salary_min, salary_max, currency } = jobData
    if (!salary_min && !salary_max) return '—'
    const cur = currency || 'USD'
    if (salary_min && salary_max)
      return `${cur} ${salary_min.toLocaleString()}–${salary_max.toLocaleString()}`
    if (salary_min) return `${cur} ${salary_min.toLocaleString()}+`
    return `Up to ${cur} ${salary_max!.toLocaleString()}`
  }

  const yearsLabel = () => {
    const { min_years_experience: mn, max_years_experience: mx } = jobData
    if (!mn && !mx) return null
    if (mn && mx) return `${mn}–${mx} yrs`
    if (mn) return `${mn}+ yrs`
    return `≤${mx} yrs`
  }

  const teamCount = assignments.length
  const stageCount = stages.length
  const dept = jobData.department || organization?.name || 'General'
  const employmentLabel = (jobData.employment_type || '').replace('_', ' ')
  const workModeLabel = (jobData.work_mode || '').replace('_', ' ')

  return (
    <div className="space-y-8 pb-8">
      {/* 1. HERO */}
      <section className="rounded-2xl bg-[#0d0d09] text-[#F6F5F1] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-poppins font-medium uppercase tracking-[0.1em]">
                <span className="rounded-full bg-virgilio-purple/30 text-[#E9DDFF] px-2 py-0.5">
                  {dept}
                </span>
                {jobData.job_level && <span className="text-white/70">L{jobData.job_level}</span>}
                {employmentLabel && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-white/70 capitalize">{employmentLabel}</span>
                  </>
                )}
                {workModeLabel && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-white/70 capitalize">{workModeLabel}</span>
                  </>
                )}
              </div>
              <h2 className="mt-2 font-poppins font-semibold tracking-[-0.03em] text-[26px] leading-tight">
                {jobData.title || 'Untitled role'}
                <span className="text-virgilio-purple">.</span>
              </h2>
            </div>
          </div>
          <StatusPill tone={hasPosting ? 'green' : 'amber'}>
            {hasPosting ? 'Ready' : 'Internal'}
          </StatusPill>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            {formatSalary()}
          </span>
          {yearsLabel() && (
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {yearsLabel()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {teamCount} hiring team {teamCount === 1 ? 'member' : 'members'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {stageCount} pipeline {stageCount === 1 ? 'stage' : 'stages'}
          </span>
        </div>
      </section>

      {/* 2. JOB INFORMATION */}
      <section>
        <Eyebrow action={<EditLink onClick={() => onGoToStep(1)} label="Edit step 1" />}>
          Job information
        </Eyebrow>
        <div className="rounded-2xl bg-white border border-virgilio-border p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <FieldRow icon={Briefcase} label="Title" value={jobData.title} />
            <FieldRow icon={Briefcase} label="Internal title" value={jobData.internal_title} />
            <FieldRow icon={Building2} label="Department" value={dept} />
            <FieldRow icon={TrendingUp} label="Level" value={jobData.job_level ? `L${jobData.job_level}` : null} />
            <FieldRow icon={Globe} label="Work mode" value={<span className="capitalize">{workModeLabel || '—'}</span>} />
            <FieldRow
              icon={MapPin}
              label="Locations"
              value={
                [jobData.location, ...(jobData.additional_locations || [])]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
            <FieldRow icon={ClipboardList} label="Type" value={<span className="capitalize">{employmentLabel || '—'}</span>} />
            <FieldRow icon={DollarSign} label="Salary" value={formatSalary()} />
          </div>

          {jobData.description && (
            <div className="mt-5">
              <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                Description preview
              </p>
              <div className="rounded-lg border border-virgilio-border bg-[#FAFAF7] p-3 text-[12.5px] text-text-secondary leading-relaxed line-clamp-3">
                {jobData.description.replace(/<[^>]+>/g, ' ')}
              </div>
            </div>
          )}

          {!!(jobData.skills && jobData.skills.length) && (
            <div className="mt-5">
              <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                Required skills · {jobData.skills.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {jobData.skills.map((s, i) => (
                  <Badge key={s + i} tone="lilac" size="sm">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. HIRING PLAN */}
      <section>
        <Eyebrow action={<EditLink onClick={() => onGoToStep(2)} label="Edit step 2" />}>
          Hiring plan · {stageCount} stages
        </Eyebrow>
        <div className="rounded-2xl bg-white border border-virgilio-border p-2">
          {stages.length === 0 ? (
            <p className="p-4 text-[12.5px] text-text-tertiary">No stages configured yet.</p>
          ) : (
            <ul className="divide-y divide-virgilio-border">
              {stages.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11.5px] font-poppins font-semibold',
                      'bg-[#F2EBFF] text-virgilio-purple',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[13px] font-poppins font-medium text-text-primary truncate">
                    {s.stage_name}
                  </span>
                  {s.is_default && (
                    <Badge tone="neutral" size="xs">
                      Required
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-virgilio-border px-4 py-2.5 text-[11.5px] text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-virgilio-purple" />
              AI auto-screen enabled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Est. time-to-hire 28d
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Ban className="h-3 w-3" />
              Auto-reject rules active
            </span>
          </div>
        </div>
      </section>

      {/* 4. HIRING TEAM */}
      <section>
        <Eyebrow action={<EditLink onClick={() => onGoToStep(3)} label="Edit step 3" />}>
          Hiring team · {teamCount} {teamCount === 1 ? 'member' : 'members'}
        </Eyebrow>
        <div className="rounded-2xl bg-white border border-virgilio-border p-2">
          {teamCount === 0 ? (
            <p className="p-4 text-[12.5px] text-text-tertiary">No team members assigned.</p>
          ) : (
            <ul className="divide-y divide-virgilio-border">
              {assignments.map((a) => {
                const { name, subtitle, avatarUrl } = resolveMember(a.user_id)
                return (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <MemberAvatar name={name} url={avatarUrl} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-poppins font-medium text-text-primary truncate">
                        {name}
                      </p>
                      {subtitle && (
                        <p className="text-[11.5px] text-text-tertiary truncate">{subtitle}</p>
                      )}
                    </div>
                    <Badge
                      tone={
                        a.role === 'recruiter'
                          ? 'purple'
                          : a.role === 'hiring_manager'
                            ? 'yellow'
                            : 'neutral'
                      }
                      size="xs"
                    >
                      {a.role === 'recruiter'
                        ? 'Recruiter'
                        : a.role === 'hiring_manager'
                          ? 'Hiring manager'
                          : 'Interviewer'}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 5. JOB POSTING */}
      <section>
        <Eyebrow
          action={
            <div className="flex items-center gap-3">
              <StatusPill tone={hasPosting ? 'green' : 'amber'}>
                {hasPosting ? 'Ready to publish' : 'Not configured'}
              </StatusPill>
              <EditLink onClick={() => onGoToStep(4)} label="Edit step 4" />
            </div>
          }
        >
          Job posting
        </Eyebrow>

        {hasPosting ? (
          <div className="rounded-2xl bg-white border border-virgilio-border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
              <div className="p-5 border-b lg:border-b-0 lg:border-r border-virgilio-border">
                <div className="rounded-xl bg-gradient-to-br from-virgilio-purple/15 via-[#F2EBFF] to-[#FFF3D6] p-4">
                  <div className="flex items-center justify-between text-[11px] font-poppins font-medium">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 text-text-primary">
                      <Building2 className="h-3 w-3" />
                      {organization?.name || 'Your company'} · Hiring
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0d0d09]/80 text-white px-2 py-0.5">
                      <Clock className="h-3 w-3" />
                      48h response
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-[10.5px] font-poppins font-semibold uppercase tracking-[0.1em] text-text-tertiary">
                  Public URL
                </p>
                <p className="text-[12.5px] font-mono text-text-secondary truncate">
                  /careers/{posting?.slug || 'your-job-slug'}
                </p>
                <h3 className="mt-3 font-poppins font-semibold text-[18px] tracking-[-0.02em] text-text-primary">
                  {posting?.title || jobData.title}
                </h3>
                <p className="mt-1 text-[12.5px] text-text-secondary leading-snug line-clamp-2">
                  {(posting?.description || jobData.description || '').replace(/<[^>]+>/g, ' ')}
                </p>
              </div>
              <div className="p-5 bg-[#FAFAF7]">
                <div className="space-y-3 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary inline-flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Language
                    </span>
                    <span className="text-text-primary font-medium">English</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Deadline
                    </span>
                    <span className="text-text-primary font-medium">No deadline</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Application form
                    </span>
                    <span className="text-text-primary font-medium">{postingMeta.fields} fields</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary inline-flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" /> Inclusion score
                    </span>
                    <Badge tone="green" size="xs">
                      92 · A
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary inline-flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5" /> SEO
                    </span>
                    <span className="text-text-primary font-medium">Gio generated</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-virgilio-border p-5">
              <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                Publishing to · {postingMeta.channels} {postingMeta.channels === 1 ? 'channel' : 'channels'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral" size="sm">Careers page</Badge>
                <Badge tone="blue" size="sm">LinkedIn</Badge>
                <Badge tone="green" size="sm">WTTJ · free</Badge>
                <Badge tone="orange" size="sm">ZipRecruiter · $99</Badge>
              </div>
            </div>

            <div className="bg-[#0d0d09] text-[#F6F5F1] px-5 py-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[12.5px]">
                <Zap className="h-3.5 w-3.5 text-virgilio-purple" />
                <span className="font-poppins font-semibold">$99</span>
                <span className="text-white/60">+ 1 sourcing credit</span>
              </span>
              <span className="text-[11.5px] text-white/60">Charged on publish. Cancel anytime.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#F1DDA1] bg-[#FFF8E5] p-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFE6B0] text-[#8A5A00]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-poppins font-semibold text-text-primary">
                  No public posting configured
                </p>
                <p className="mt-0.5 text-[12.5px] text-text-secondary leading-snug">
                  This job will be created as <strong>internal-only</strong>. Candidates can be added
                  manually or sourced — but the role won't appear on your careers page or job boards.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Pencil}
                onClick={() => onGoToStep(4)}
              >
                Configure posting
              </Button>
            </div>

            <p className="mt-5 text-[10.5px] font-poppins font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">
              What's skipped
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { icon: Globe, label: 'Careers page listing' },
                { icon: Send, label: 'Cross-posting to job boards' },
                { icon: FileText, label: 'Public application form' },
                { icon: Search, label: 'SEO & social card' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2.5 rounded-lg border border-virgilio-border bg-[#FAFAF7] px-3 py-2.5 text-[12.5px] text-text-secondary"
                >
                  <s.icon className="h-3.5 w-3.5 text-text-tertiary" />
                  {s.label}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-virgilio-border bg-white px-3 py-2.5 text-[12px] text-text-secondary">
              You can publish this job at any time from <strong>Job Setup → Posting</strong>.
            </div>
          </>
        )}
      </section>

      {/* 6. ON CREATION */}
      <section>
        <Eyebrow>On creation</Eyebrow>
        <div className="rounded-2xl bg-white border border-virgilio-border px-5 divide-y divide-virgilio-border">
          <ToggleRow
            title="Publish to careers page immediately"
            helper={
              hasPosting
                ? 'Otherwise stays in draft — you can publish later.'
                : 'Disabled — no posting configured. Add posting info to enable.'
            }
            defaultOn={hasPosting}
            disabled={!hasPosting}
          />
          <ToggleRow
            title="Cross-post to LinkedIn, WTTJ, ZipRecruiter"
            helper={
              hasPosting
                ? '3 free + 1 paid placement. Charged on publish.'
                : 'Disabled — no posting configured.'
            }
            defaultOn={hasPosting}
            disabled={!hasPosting}
          />
          <ToggleRow
            title="Open sourcing project linked to this job"
            helper={
              hasPosting
                ? 'Gio starts surfacing candidates automatically.'
                : 'Gio can still source candidates directly without a public listing.'
            }
            checked={autoSource}
            onChange={(v) => onAutoSourceChange?.(v)}
          />
          <ToggleRow
            title="Notify hiring team in Slack"
            helper={`Send a '${hasPosting ? 'job is live' : 'job created'}' message to #hiring-${(dept || 'general').toLowerCase().replace(/\s+/g, '-')}.`}
            defaultOn={false}
          />
        </div>
      </section>

      {/* 7. Closing nudge */}
      {hasPosting ? (
        <section className="rounded-2xl bg-[#F2EBFF] border border-virgilio-purple/20 p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-virgilio-purple">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13.5px] font-poppins font-semibold text-text-primary">
                Gio is ready to start sourcing
              </p>
              <p className="text-[12.5px] text-text-secondary mt-0.5">
                We'll surface matching candidates as soon as the job is live.
              </p>
            </div>
          </div>
          <Button type="button" variant="purple" size="sm" icon={Sparkles}>
            Auto-source
          </Button>
        </section>
      ) : (
        <section className="rounded-2xl bg-[#FFF8E5] border border-[#F1DDA1] p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#8A5A00]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13.5px] font-poppins font-semibold text-text-primary">
                You'll only get candidates through direct sourcing
              </p>
              <p className="text-[12.5px] text-text-secondary mt-0.5">
                Add posting info to also accept applications from your careers page and job boards.
              </p>
            </div>
          </div>
          <Button type="button" variant="purple" size="sm" onClick={() => onGoToStep(4)}>
            Set up posting now →
          </Button>
        </section>
      )}
    </div>
  )
}
