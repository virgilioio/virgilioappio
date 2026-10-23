import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft, Calendar, Clock, DollarSign, Download, FileText, Globe, Mail, MapPin,
  PenLine, Phone, RefreshCw, Sparkles, ThumbsDown, Upload, UserPlus,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

import { ProfileHeroCard } from '@/components/candidates/profile/ProfileHeroCard'
import { ProfileTabs } from '@/components/candidates/profile/ProfileTabs'
import { ProfileActionMenu, type ActionMenuSection } from '@/components/candidates/profile/ProfileActionMenu'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { ProfileSidebar, SidebarBlock, MetaRow } from '@/components/candidates/profile/primitives/ProfileSidebar'
import { ResumeTabCard } from '@/components/candidates/profile/ResumeTabCard'
import { ResumeSidebar } from '@/components/candidates/profile/tabs/SidebarRouter'
import { CandidateTagsBlock } from '@/components/candidates/profile/CandidateTagsBlock'
import { CandidateInsightsTab } from '@/components/candidates/insights/CandidateInsightsTab'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import { AddOrTransferCandidateDialog } from '@/components/candidates/AddOrTransferCandidateDialog'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { SimpleScheduleInterviewSheet } from '@/components/candidates/SimpleScheduleInterviewSheet'
import { CandidateProfileDownloadDialog } from '@/components/candidates/CandidateProfileDownloadDialog'

import { useIndependentCandidate } from '@/hooks/useIndependentCandidate'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useSuggestedCandidateStatus } from '@/hooks/useSuggestedCandidateStatus'
import { useWhatsAppEnabled } from '@/hooks/useWhatsAppEnabled'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { buildWhatsAppUrl } from '@/utils/phoneUtils'
import { formatSalaryExpectation } from '@/lib/candidateHelpers'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { confirmDeleteResume, confirmReplaceResume } from '@/lib/removeOldResumes'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'

const fmtDate = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const monthYear = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export type SuggestedProfileTab = 'fit' | 'resume'

/** What the host's decision control needs to know and change. */
export interface DecisionState {
  addedStage: string | null
  setAddedStage: (stage: string | null) => void
  wasRejectedHere: boolean
  refetchAssociation: () => void
  openTransfer: () => void
}

export interface SuggestedProfileViewProps {
  candidateId: string
  /** The job Gio Fit is about. Null in a search with no job: `fitWithoutJob` fills the Gio Fit tab. */
  jobId: string | null
  activeTab: SuggestedProfileTab
  onTabChange: (tab: SuggestedProfileTab) => void
  /** Why this person is here: the number, the reasons and Gio's note. */
  match: { score: number | null; reasons: string[]; rationale: string | null }
  /** The hero's Gio Fit pill (defaults to `match.score`). */
  heroFitScore?: number | null
  /** The big number's label on the not-yet-assessed card. */
  scoreLabel?: string
  whyLabel?: string
  identityBadges: (state: { addedStage: string | null }) => ReactNode
  /** Replaces "Jobs › {job} › {last}" in the hero. */
  breadcrumb?: ReactNode
  backLabel: string
  breadcrumbLast: string
  /** The second half of the context line; defaults to "Matched against {job}". */
  matchedAgainst?: ReactNode
  hasPrev: boolean
  hasNext: boolean
  onNavigatePrev: () => void
  onNavigateNext: () => void
  prevLabel: string
  nextLabel: string
  onClose: () => void
  renderDecision: (size: 'sm' | 'lg', state: DecisionState) => ReactNode
  onDismiss: () => void
  dismissLabel?: string
  notInPipelineText?: string
  fitWithoutJob?: ReactNode
  /** Replaces the Add or transfer dialog (Find has its own job picker). */
  onAddToOtherJob?: () => void
  className?: string
}

/**
 * The profile of somebody Gio matched who has not applied: the job's Suggested
 * page and Find's profile of people already in Gio (Allan, 2026-10-22: "exactly
 * the same"). Nothing that belongs to an application exists yet, so it carries
 * only the dossier and the résumé, and one decision: add them, or don't.
 */
export function SuggestedProfileView({
  candidateId, jobId, activeTab, onTabChange: setTab, match, heroFitScore, scoreLabel = 'Gio fit',
  whyLabel = 'Why Gio suggested them', identityBadges, breadcrumb, backLabel, breadcrumbLast, matchedAgainst,
  hasPrev, hasNext, onNavigatePrev, onNavigateNext, prevLabel, nextLabel, onClose, renderDecision, onDismiss,
  dismissLabel = 'Not a fit for this job', notInPipelineText = 'Suggested by Gio · not in this pipeline yet',
  fitWithoutJob, onAddToOtherJob, className,
}: SuggestedProfileViewProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { organizationId } = useAuth()

  const { candidate, updateCandidate } = useIndependentCandidate(candidateId)
  const { isEnabled: whatsAppEnabled } = useWhatsAppEnabled()
  const { loadHiringPlanInstances } = useJobHiringPlan()

  const [editOpen, setEditOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [addedStage, setAddedStage] = useState<string | null>(null)
  // The hero mirrors the Gio Fit tab's wait: pulsing dots cold, previous score while re-scoring.
  const [fitState, setFitState] = useState<'ready' | 'loading' | 'rescoring'>('ready')
  const replaceResumeInputRef = useRef<HTMLInputElement>(null)

  // A new person or a new job starts from their own state.
  useEffect(() => { setAddedStage(null); setFitState('ready') }, [candidateId, jobId])

  const { data: job } = useQuery({
    queryKey: ['suggested-profile-job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, description, skills, skill_priorities, must_have_skills, location, department, status, organization:organizations(name)')
        .eq('id', jobId!)
        .maybeSingle()
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any
    },
  })

  const { data: profileData } = useQuery({
    queryKey: ['suggested-profile-detail', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const [exp, edu] = await Promise.all([
        supabase.from('candidate_work_experience').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
        supabase.from('candidate_education').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
      ])
      return {
        workExperience: (exp.data || []) as unknown as CandidateWorkExperience[],
        education: (edu.data || []) as unknown as CandidateEducation[],
      }
    },
  })
  const workExperience = profileData?.workExperience ?? []
  const education = profileData?.education ?? []

  const { attachments, uploadAttachment, isUploading: isResumeUploading, deleteAttachment } =
    useCandidateAttachments(candidateId)
  const resume = attachments.find((a) => a.is_resume) || null
  // Upload → Gio re-reads → Gio Fit re-scores, shown in the Resume card's subtitle.
  const resumeRefresh = useResumeRefresh(candidateId, {
    onProfileUpdated: () => void queryClient.invalidateQueries({ queryKey: ['suggested-profile-detail', candidateId] }),
  })
  // C17: a new résumé deletes the old one, so ask first when one is on file.
  const replaceResume = async (file: File) => {
    const ok = await confirmReplaceResume({
      candidateName: candidate?.candidate_name,
      oldFileName: resume?.file_name,
      newFileName: file.name,
      hasResume: !!resume,
    })
    if (ok) void resumeRefresh.run(file, () => uploadAttachment(file, true))
  }

  const statuses = useSuggestedCandidateStatus(jobId || undefined, candidateId && jobId ? [candidateId] : [])
  const otherStatus = statuses[candidateId]

  // Where this person stands on THIS job — the only thing that decides the page state.
  const { data: association, refetch: refetchAssociation } = useQuery({
    queryKey: ['suggested-profile-association', jobId, candidateId],
    enabled: !!jobId && !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('id, status, current_stage_id, created_at, rejected_at')
        .eq('job_id', jobId!)
        .eq('candidate_id', candidateId)
        .maybeSingle()
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any
    },
  })

  // Resolve the stage name from the job's own plan — no hardcoded stage list.
  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      if (!jobId || !association || association.status !== 'active') return
      const plan = await loadHiringPlanInstances(jobId)
      const found = (plan || []).find((instance) => instance.jhsId === association.current_stage_id)
      if (!cancelled && found) setAddedStage(found.customStageName || found.stage.stage_name)
    }
    void resolve()
    return () => { cancelled = true }
  }, [association, jobId, loadHiringPlanInstances])

  const isInPipeline = Boolean(addedStage)
  const wasRejectedHere = association?.status === 'rejected'
  const name = candidate?.candidate_name || 'Candidate'
  const firstName = name.split(' ')[0] || name
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const role = (candidate as any)?.current_job_title || (candidate as any)?.role_current || null
  const company = (candidate as any)?.company_current || null
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const location = [candidate?.location_city, candidate?.location_state, candidate?.location_country].filter(Boolean).join(', ') || null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const salary = formatSalaryExpectation(candidate as any)
  const reasons = match.reasons

  const statusText = isInPipeline
    ? `Added to ${addedStage}`
    : wasRejectedHere
      ? `Rejected for this job · ${monthYear(association?.rejected_at || association?.created_at) || 'earlier'}`
      : otherStatus?.kind === 'pipeline'
        ? `In pipeline · ${otherStatus.note || 'another job'}`
        : 'Not in this pipeline yet'

  const openTransfer = () => (onAddToOtherJob ? onAddToOtherJob() : setTransferOpen(true))
  const decisionState: DecisionState = {
    addedStage,
    setAddedStage,
    wasRejectedHere,
    refetchAssociation: () => void refetchAssociation(),
    openTransfer,
  }
  const addGroup = (size: 'sm' | 'lg') => renderDecision(size, decisionState)

  /**
   * The slim decision strip. It carries the only decision on this page, so it stays
   * live while Gio is scoring, while it re-scores, and when scoring fails.
   */
  const decisionStrip = (text: string, size: 'sm' | 'lg') => (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#E7E8EE] bg-white px-3.5 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F4EFFE] text-virgilio-purple">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="font-inter text-[12.5px] text-[#5A6072]">{text}</span>
      <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
        {reasons.slice(0, 3).map((reason) => (
          <span key={reason} className="inline-flex h-[22px] items-center rounded-[7px] border border-[#E6DAFB] bg-[#F4EFFE] px-2 font-inter text-[11.5px] text-[#4B1FA8]">
            {reason}
          </span>
        ))}
      </span>
      <span className="flex-1" />
      {addGroup(size)}
    </div>
  )

  const menuSections: ActionMenuSection[] = [
    {
      items: [
        ...(isInPipeline || !jobId
          ? []
          : [{ id: 'add', label: 'Add to this pipeline', icon: UserPlus, onClick: () => setTab('fit') }]),
        { id: 'transfer', label: 'Add or transfer to job', icon: ArrowRightLeft, onClick: openTransfer },
      ],
    },
    {
      label: 'Reach out',
      items: [
        { id: 'email', label: 'Send email', icon: Mail, onClick: () => setEmailOpen(true) },
        { id: 'schedule', label: 'Schedule meeting', icon: Calendar, onClick: () => setScheduleOpen(true) },
      ],
    },
    {
      items: [
        ...(jobId ? [{ id: 'rerun', label: 'Re-run Gio Fit', icon: RefreshCw, onClick: () => setTab('fit') }] : []),
        { id: 'download', label: 'Download dossier', icon: Download, onClick: () => setDownloadOpen(true) },
        { id: 'edit', label: 'Edit profile', icon: PenLine, onClick: () => setEditOpen(true) },
      ],
    },
    {
      items: [
        { id: 'not-a-fit', label: dismissLabel, icon: ThumbsDown, danger: true, onClick: onDismiss },
      ],
    },
  ]

  if (!candidate) {
    return (
      <div className={cn('px-7 pb-8 pt-4', className)}>
        <Skeleton className="h-[180px] w-full rounded-2xl" />
        <Skeleton className="mt-4 h-[420px] w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className={cn('min-h-[100dvh] bg-virgilio-cream px-7 pb-8 pt-4', className)}>
      <ProfileHeroCard
        candidateName={name}
        candidateFirstName={firstName}
        candidateId={candidateId}
        jobId={jobId ?? ''}
        jobTitle={job?.title || null}
        backLabel={backLabel}
        breadcrumbLast={breadcrumbLast}
        breadcrumb={breadcrumb}
        favoriteMuted
        identityBadges={identityBadges({ addedStage })}
        fitScore={heroFitScore === undefined ? match.score : heroFitScore}
        fitPillState={activeTab === 'fit' && jobId ? fitState : 'ready'}
        onFitClick={() => setTab('fit')}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkedinUrl={(candidate as any)?.linkedin_url || null}
        onOpenFullProfile={() => navigate(`/candidates/${candidateId}`)}
        onClose={onClose}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
        contextLine={
          <span className="flex flex-wrap items-center gap-1.5">
            {role && (
              <span>
                {role}
                {company && <> at <span className="font-medium text-[#1F2230]">{company}</span></>}
              </span>
            )}
            {role && <span className="text-[#D1D5DB]">·</span>}
            {matchedAgainst ?? (
              <span>
                Matched against <span className="font-medium text-[#1F2230]">{job?.title || 'this job'}</span>
              </span>
            )}
          </span>
        }
        actionMenu={<ProfileActionMenu sections={menuSections} />}
        tabs={
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={(value) => setTab(value as SuggestedProfileTab)}
            tabs={[
              { value: 'fit', label: 'Gio Fit', Icon: Sparkles },
              { value: 'resume', label: 'Resume', Icon: FileText },
            ]}
          />
        }
      />

      <div className="mt-3.5">
        {activeTab === 'fit' && !jobId && fitWithoutJob}

        {activeTab === 'fit' && jobId && (
          <CandidateInsightsTab
            candidateId={candidateId}
            jobId={jobId}
            jobDescription={job?.description}
            job={job}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            candidate={candidate as any}
            workExperience={workExperience}
            education={education}
            showScorecards={false}
            // Before an application exists an assessment is offered, never assumed:
            // the top scorers are already assessed by the background pass.
            autoGenerate={Boolean(association)}
            renderEmpty={association ? undefined : ({ generate, isGenerating }) => (
              <PreAssociationDossier
                jobTitle={job?.title || null}
                score={match.score}
                scoreLabel={scoreLabel}
                whyLabel={whyLabel}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rationale={match.rationale || (candidate as any)?.profile_summary || null}
                reasons={reasons}
                statusText={statusText}
                location={location}
                actions={addGroup('sm')}
                onGenerate={generate}
                isGenerating={isGenerating}
              />
            )}
            suggested={{
              statusText,
              chips: reasons.slice(0, 3),
              overflow: Math.max(reasons.length - 3, 0),
              note: match.rationale,
              actions: addGroup('sm'),
            }}
            onStateChange={setFitState}
            renderWaitStrip={({ state, generatedAt }) =>
              decisionStrip(
                state === 'rescoring'
                  ? `Re-scoring · the dossier below is from ${fmtDate(generatedAt) || 'an earlier run'}`
                  : state === 'failed'
                    ? `Scoring did not finish · you can still add ${firstName} now`
                    : `Gio is scoring ${firstName} against this job · you can add them now`,
                'sm',
              )
            }
          />
        )}

        {activeTab === 'resume' && (
          <>
            <div className="mb-4">
              {decisionStrip(
                isInPipeline ? `${firstName} is on this pipeline` : notInPipelineText,
                'lg',
              )}
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <ResumeTabCard
                candidateId={candidateId}
                resumeOnFile={!!resume}
                fileName={resume?.file_name ?? null}
                uploadedBy={null}
                uploadedDate={fmtDate(resume?.created_at)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fallbackResumeUrl={(candidate as any)?.resume_url ?? null}
                parsing={isResumeUploading || resumeRefresh.busy}
                status={resumeRefresh.status}
                onFile={(file) => { void replaceResume(file) }}
                viewerActions={
                  <>
                    <input
                      ref={replaceResumeInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.currentTarget.value = ''
                        if (file) void replaceResume(file)
                      }}
                    />
                    <Button variant="ghost" size="sm" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading || resumeRefresh.busy} loading={resumeRefresh.status?.phase === 'uploading'}>
                      Replace
                    </Button>
                  </>
                }
              />

              <div className="space-y-3.5">
                <ResumeSidebar
                  fileName={resume?.file_name ?? null}
                  fileSize={resume?.file_size_bytes ? `${Math.round(resume.file_size_bytes / 1024)} KB` : null}
                  pages={null}
                  uploadedAt={resume?.created_at ?? null}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  uploadedBy={(candidate as any)?.source ? `${(candidate as any).source} import` : null}
                  parsedFields={null}
                  onReplace={() => replaceResumeInputRef.current?.click()}
                  onDelete={resume ? async () => { if (await confirmDeleteResume({ candidateName: candidate?.candidate_name, fileName: resume.file_name })) void deleteAttachment(resume.id, resume.file_url).catch(() => {}) } : undefined}
                />

                <ProfileSidebar>
                  <SidebarBlock label="Details">
                    <MetaRow icon={MapPin} label="Location" value={location} />
                    <MetaRow icon={Mail} label="Email" value={candidate.email || null} />
                    <MetaRow
                      icon={Phone}
                      label="Phone"
                      value={candidate.phone || null}
                      action={
                        whatsAppEnabled && candidate.phone ? (
                          <button
                            type="button"
                            aria-label="Message on WhatsApp"
                            onClick={() => window.open(buildWhatsAppUrl(candidate.phone as string), '_blank')}
                            className="text-[#25D366] hover:opacity-80"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : undefined
                      }
                    />
                    <MetaRow icon={DollarSign} label="Salary expectation" value={salary} />
                    {/* eslint-disable @typescript-eslint/no-explicit-any */}
                    <MetaRow icon={Clock} label="Notice period" value={(candidate as any)?.notice_period || null} />
                    <MetaRow icon={Globe} label="Work auth" value={(candidate as any)?.work_authorization || null} />
                  </SidebarBlock>
                  <SidebarBlock
                    label="In your database"
                    action={<Badge tone="neutral" size="xs">Not applied</Badge>}
                  >
                    <MetaRow icon={Sparkles} label="Source" value={(candidate as any)?.source || null} />
                    <MetaRow icon={Clock} label="On file since" value={fmtDate((candidate as any)?.created_at)} />
                    <MetaRow icon={Clock} label="Last active" value={fmtDate((candidate as any)?.updated_at)} />
                    {/* eslint-enable @typescript-eslint/no-explicit-any */}
                  </SidebarBlock>
                  <CandidateTagsBlock candidateId={candidateId} candidateName={name} />
                </ProfileSidebar>
              </div>
            </div>
          </>
        )}
      </div>

      <CandidateFormSheet
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit={async (data: any) => {
          await updateCandidate(candidateId, data)
          setEditOpen(false)
        }}
        isLoading={false}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candidate={candidate as any}
      />
      {!onAddToOtherJob && candidate.id && jobId && job?.title && (
        <AddOrTransferCandidateDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          candidateId={candidate.id}
          candidateName={name}
          currentJobId={jobId}
          currentJobTitle={job.title}
        />
      )}
      <MinimizableEmailComposer
        isOpen={emailOpen}
        onOpenChange={setEmailOpen}
        candidateId={candidateId}
        jobId={jobId ?? undefined}
        defaultTo={candidate.email || ''}
        candidateName={name}
      />
      {organizationId && (
        <SimpleScheduleInterviewSheet
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          candidateId={candidateId}
          candidateName={name}
          candidateEmail={candidate.email || ''}
          candidatePhone={candidate.phone || undefined}
          organizationId={organizationId}
        />
      )}
      <CandidateProfileDownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfOptions={{ candidate: candidate as any, job: job as any, workExperience, education }}
      />
    </div>
  )
}

/**
 * Shown when no dossier has been produced for this match yet. Gio's strongest
 * matches are assessed automatically; everyone else is assessed on request, so the
 * assessment is offered here rather than started unasked.
 */
export function PreAssociationDossier({
  jobTitle, score, scoreLabel = 'Gio fit', whyLabel = 'Why Gio suggested them', title = 'Gio Fit', subtitle,
  rationale, reasons, statusText, location, actions, onGenerate, isGenerating, generateLabel = 'Generate full dossier',
  note, children,
}: {
  jobTitle: string | null
  score: number | null
  scoreLabel?: string
  whyLabel?: string
  title?: string
  subtitle?: string
  rationale: string | null
  reasons: string[]
  statusText: string
  location: string | null
  actions: ReactNode
  onGenerate?: () => void
  isGenerating?: boolean
  generateLabel?: string
  /** Replaces the line about the full dossier. */
  note?: ReactNode
  /** Extra rows under the reasons (Find: the skills found, by tier). */
  children?: ReactNode
}) {
  return (
    <ProfileCard title={title} subtitle={subtitle ?? `Match against ${jobTitle || 'this job'}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
            {whyLabel}
            <span className="text-[#C2C6D2]">·</span>
            <span className="font-medium normal-case tracking-normal">{statusText}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {reasons.map((reason) => (
              <span key={reason} className="inline-flex h-[22px] items-center rounded-[7px] border border-[#E6DAFB] bg-[#F4EFFE] px-2 font-inter text-[11.5px] text-[#4B1FA8]">
                {reason}
              </span>
            ))}
          </div>
          {location && (
            <p className="mt-3 flex items-center gap-1.5 font-inter text-[12px] text-[#5A6072]">
              <MapPin className="h-3 w-3 text-[#8B8F9E]" />
              {location}
            </p>
          )}
          {children}
          {rationale && <p className="mt-3 font-inter text-[13px] leading-[1.6] text-[#1F2230]">{rationale}</p>}
          <p className="mt-3 font-inter text-[12px] leading-[1.55] text-[#8B8F9E]">
            {note ?? (
              <>
                The full dossier — dimension breakdown, evidenced skills and validation points — has not been written for
                this match yet. Gio writes it automatically for its strongest matches on this job.
              </>
            )}
          </p>
          {onGenerate && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              icon={Sparkles}
              loading={isGenerating}
              onClick={onGenerate}
            >
              {generateLabel}
            </Button>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8B8F9E]">{scoreLabel}</p>
          <p className="mt-1 font-poppins text-[44px] font-semibold leading-none tracking-[-0.04em] text-virgilio-purple">
            {score === null ? '—' : Math.round(score)}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#F1F0EC] pt-4">
        <span className="flex-1" />
        {actions}
      </div>
    </ProfileCard>
  )
}
