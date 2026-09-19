import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRightLeft, Calendar, Clock, DollarSign, Download, FileText, Globe, Mail, MapPin,
  PenLine, Phone, RefreshCw, Sparkles, ThumbsDown, Upload, UserPlus,
} from 'lucide-react'

import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

import { ProfileHeroCard } from '@/components/candidates/profile/ProfileHeroCard'
import { ProfileTabs } from '@/components/candidates/profile/ProfileTabs'
import { ProfileActionMenu, type ActionMenuSection } from '@/components/candidates/profile/ProfileActionMenu'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { ProfileSidebar, SidebarBlock, MetaRow } from '@/components/candidates/profile/primitives/ProfileSidebar'
import { ResumeTabCard } from '@/components/candidates/profile/ResumeTabCard'
import { ResumeSidebar } from '@/components/candidates/profile/tabs/SidebarRouter'
import { CandidateTagsBlock } from '@/components/candidates/profile/CandidateTagsBlock'
import { CandidateInsightsTab } from '@/components/candidates/insights/CandidateInsightsTab'
import { AddToPipelineGroup } from '@/components/candidates/suggested/AddToPipelineGroup'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import { AddOrTransferCandidateDialog } from '@/components/candidates/AddOrTransferCandidateDialog'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { SimpleScheduleInterviewSheet } from '@/components/candidates/SimpleScheduleInterviewSheet'
import { CandidateProfileDownloadDialog } from '@/components/candidates/CandidateProfileDownloadDialog'

import { useIndependentCandidate } from '@/hooks/useIndependentCandidate'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useJobSuggestedCandidates } from '@/hooks/useJobSuggestedCandidates'
import { useSuggestedCandidateStatus } from '@/hooks/useSuggestedCandidateStatus'
import { useWhatsAppEnabled } from '@/hooks/useWhatsAppEnabled'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { buildWhatsAppUrl } from '@/utils/phoneUtils'
import { suggestedReasons, suggestedScore, suggestedCandidateId } from '@/components/jobs/suggested/suggestedFilters'
import { dismissSuggestion } from '@/components/jobs/suggested/suggestedDismissed'
import { formatSalaryExpectation } from '@/lib/candidateHelpers'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'

const ordinal = (n: number) => {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

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

/**
 * The profile of somebody Gio matched against this job who has not applied.
 * Nothing that belongs to an application exists yet, so the page carries only
 * the dossier and the résumé — and one decision: add them, or don't.
 */
function SuggestedCandidateProfileInner() {
  const { jobId = '', candidateId = '' } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { organizationId } = useAuth()
  const activeTab = searchParams.get('tab') === 'resume' ? 'resume' : 'fit'
  const setTab = (tab: 'fit' | 'resume') => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const { candidate, updateCandidate } = useIndependentCandidate(candidateId)
  const { isEnabled: whatsAppEnabled } = useWhatsAppEnabled()
  const { loadHiringPlanInstances } = useJobHiringPlan()

  const [editOpen, setEditOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [addedStage, setAddedStage] = useState<string | null>(null)
  const replaceResumeInputRef = useRef<HTMLInputElement>(null)

  const { data: job } = useQuery({
    queryKey: ['suggested-profile-job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, description, skills, must_have_skills, location, department, status, organization:organizations(name)')
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
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

  // The suggestion list gives the match score, the reasons and the list order.
  const { candidates: suggestions } = useJobSuggestedCandidates({
    jobId,
    jobSkills: (job as any)?.skills || null,
    limit: 50,
  })
  const ordered = useMemo(
    () => suggestions.slice().sort((a, b) => (suggestedScore(b) ?? 0) - (suggestedScore(a) ?? 0)),
    [suggestions],
  )
  const index = ordered.findIndex((c) => suggestedCandidateId(c) === candidateId)
  const suggestion = index >= 0 ? ordered[index] : null
  const matchScore = suggestion ? suggestedScore(suggestion) : null
  const reasons = useMemo(
    () => (suggestion ? suggestedReasons(suggestion, (job as any)?.skills || null) : []),
    [suggestion, job],
  )
  const statuses = useSuggestedCandidateStatus(jobId, candidateId ? [candidateId] : [])
  const otherStatus = statuses[candidateId]

  // Where this person stands on THIS job — the only thing that decides the page state.
  const { data: association, refetch: refetchAssociation } = useQuery({
    queryKey: ['suggested-profile-association', jobId, candidateId],
    enabled: !!jobId && !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('id, status, current_stage_id, created_at, rejected_at')
        .eq('job_id', jobId)
        .eq('candidate_id', candidateId)
        .maybeSingle()
      if (error) throw error
      return data as any
    },
  })

  // Resolve the stage name from the job's own plan — no hardcoded stage list.
  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      if (!association || association.status !== 'active') return
      const plan = await loadHiringPlanInstances(jobId)
      const match = (plan || []).find((instance) => instance.jhsId === association.current_stage_id)
      if (!cancelled && match) setAddedStage(match.customStageName || match.stage.stage_name)
    }
    void resolve()
    return () => { cancelled = true }
  }, [association, jobId, loadHiringPlanInstances])

  const isInPipeline = Boolean(addedStage)
  const wasRejectedHere = association?.status === 'rejected'
  const name = candidate?.candidate_name || 'Candidate'
  const firstName = name.split(' ')[0] || name
  const role = (candidate as any)?.current_job_title || (candidate as any)?.role_current || null
  const company = (candidate as any)?.company_current || null
  const location = [candidate?.location_city, candidate?.location_state, candidate?.location_country].filter(Boolean).join(', ') || null
  const salary = formatSalaryExpectation(candidate as any)

  const statusText = isInPipeline
    ? `Added to ${addedStage}`
    : wasRejectedHere
      ? `Rejected for this job · ${monthYear(association?.rejected_at || association?.created_at) || 'earlier'}`
      : otherStatus?.kind === 'pipeline'
        ? `In pipeline · ${otherStatus.note || 'another job'}`
        : 'Not in this pipeline yet'

  const goBack = () => navigate(`/jobs/${jobId}?tab=pipeline&section=suggested`)
  const goToSuggestion = (offset: number) => {
    const next = ordered[index + offset]
    const id = next ? suggestedCandidateId(next) : null
    if (id) navigate(`/jobs/${jobId}/suggested/${id}?tab=${activeTab}`)
  }

  const handleDismiss = () => {
    dismissSuggestion(jobId, candidateId)
    // Not a fit for this job: the suggestion and any dossier written for it go together.
    void supabase
      .from('job_suggested_candidates_cache')
      .delete()
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
    toast({ title: 'Suggestion dismissed', description: `${firstName} will not be suggested for this job again.` })
    goBack()
  }

  const addGroup = (size: 'sm' | 'lg') => (
    <AddToPipelineGroup
      jobId={jobId}
      candidateId={candidateId}
      addedStage={addedStage}
      size={size}
      previouslyRejected={wasRejectedHere}
      onAdded={(stage) => setAddedStage(stage)}
      onUndo={() => { setAddedStage(null); void refetchAssociation() }}
      onDismiss={handleDismiss}
      onOpenInPipeline={() => navigate(`/jobs/${jobId}/candidates/${candidateId}`)}
      onAddToOtherJob={() => setTransferOpen(true)}
    />
  )

  const menuSections: ActionMenuSection[] = [
    {
      items: [
        ...(isInPipeline
          ? []
          : [{ id: 'add', label: 'Add to this pipeline', icon: UserPlus, onClick: () => setTab('fit') }]),
        { id: 'transfer', label: 'Add or transfer to job', icon: ArrowRightLeft, onClick: () => setTransferOpen(true) },
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
        { id: 'rerun', label: 'Re-run Gio Fit', icon: RefreshCw, onClick: () => setTab('fit') },
        { id: 'download', label: 'Download dossier', icon: Download, onClick: () => setDownloadOpen(true) },
        { id: 'edit', label: 'Edit profile', icon: PenLine, onClick: () => setEditOpen(true) },
      ],
    },
    {
      items: [
        { id: 'not-a-fit', label: 'Not a fit for this job', icon: ThumbsDown, danger: true, onClick: handleDismiss },
      ],
    },
  ]

  const identityBadges = (
    <>
      <Badge tone="lilac" size="sm" icon={Sparkles}>Suggested by Gio</Badge>
      {isInPipeline ? (
        <Badge tone="green" size="sm" dot>{addedStage}</Badge>
      ) : index >= 0 ? (
        <Badge tone="neutral" size="sm">Ranks {ordinal(index + 1)} of {ordered.length}</Badge>
      ) : null}
    </>
  )

  if (!candidate) {
    return (
      <div className="px-7 pb-8 pt-4">
        <Skeleton className="h-[180px] w-full rounded-2xl" />
        <Skeleton className="mt-4 h-[420px] w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#F6F5F1] px-7 pb-8 pt-4">
      <ProfileHeroCard
        candidateName={name}
        candidateFirstName={firstName}
        candidateId={candidateId}
        jobId={jobId}
        jobTitle={job?.title || null}
        backLabel="Back to suggestions"
        breadcrumbLast="Suggested"
        favoriteMuted
        identityBadges={identityBadges}
        fitScore={matchScore}
        onFitClick={() => setTab('fit')}
        linkedinUrl={(candidate as any)?.linkedin_url || null}
        onOpenFullProfile={() => navigate(`/candidates/${candidateId}`)}
        onClose={goBack}
        hasPrev={index > 0}
        hasNext={index >= 0 && index < ordered.length - 1}
        onNavigatePrev={() => goToSuggestion(-1)}
        onNavigateNext={() => goToSuggestion(1)}
        prevLabel="Previous suggestion"
        nextLabel="Next suggestion"
        contextLine={
          <span className="flex flex-wrap items-center gap-1.5">
            {role && (
              <span>
                {role}
                {company && <> at <span className="font-medium text-[#1F2230]">{company}</span></>}
              </span>
            )}
            {role && <span className="text-[#D1D5DB]">·</span>}
            <span>
              Matched against <span className="font-medium text-[#1F2230]">{job?.title || 'this job'}</span>
            </span>
          </span>
        }
        actionMenu={<ProfileActionMenu sections={menuSections} />}
        tabs={
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={(value) => setTab(value as 'fit' | 'resume')}
            tabs={[
              { value: 'fit', label: 'Gio Fit', Icon: Sparkles },
              { value: 'resume', label: 'Resume', Icon: FileText },
            ]}
          />
        }
      />

      <div className="mt-3.5">
        {activeTab === 'fit' && (
          <CandidateInsightsTab
            candidateId={candidateId}
            jobId={jobId}
            jobDescription={job?.description}
            job={job}
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
                score={matchScore}
                rationale={(suggestion as any)?.ai_fit_rationale || (candidate as any)?.profile_summary || null}
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
              note: (suggestion as any)?.ai_fit_rationale || null,
              actions: addGroup('sm'),
            }}
          />
        )}

        {activeTab === 'resume' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#E7E8EE] bg-white px-3.5 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F4EFFE] text-virgilio-purple">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="font-inter text-[12.5px] text-[#5A6072]">
                {isInPipeline ? `${firstName} is on this pipeline` : 'Suggested by Gio · not in this pipeline yet'}
              </span>
              <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
                {reasons.slice(0, 3).map((reason) => (
                  <span key={reason} className="inline-flex h-[22px] items-center rounded-[7px] border border-[#E6DAFB] bg-[#F4EFFE] px-2 font-inter text-[11.5px] text-[#4B1FA8]">
                    {reason}
                  </span>
                ))}
              </span>
              <span className="flex-1" />
              {addGroup('lg')}
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <ResumeTabCard
                candidateId={candidateId}
                resumeOnFile={!!resume}
                fileName={resume?.file_name ?? null}
                uploadedBy={null}
                uploadedDate={fmtDate(resume?.created_at)}
                fallbackResumeUrl={(candidate as any)?.resume_url ?? null}
                parsing={isResumeUploading}
                onFile={(file) => { void uploadAttachment(file, true) }}
                viewerActions={
                  <>
                    <input
                      ref={replaceResumeInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void uploadAttachment(file, true)
                        event.currentTarget.value = ''
                      }}
                    />
                    <Button variant="ghost" size="sm" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading}>
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
                  uploadedBy={(candidate as any)?.source ? `${(candidate as any).source} import` : null}
                  parsedFields={null}
                  onReplace={() => replaceResumeInputRef.current?.click()}
                  onDelete={resume ? () => { void deleteAttachment(resume.id, resume.file_url) } : undefined}
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
        onSubmit={async (data: any) => {
          await updateCandidate(candidateId, data)
          setEditOpen(false)
        }}
        isLoading={false}
        candidate={candidate as any}
      />
      {candidate.id && job?.title && (
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
        jobId={jobId}
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
        pdfOptions={{ candidate: candidate as any, job: job as any, workExperience, education }}
      />
    </div>
  )
}

/**
 * Shown when no dossier has been produced for this suggestion yet. Gio's strongest
 * matches are assessed automatically; everyone else is assessed on request, so the
 * assessment is offered here rather than started unasked.
 */
function PreAssociationDossier({
  jobTitle, score, rationale, reasons, statusText, location, actions, onGenerate, isGenerating,
}: {
  jobTitle: string | null
  score: number | null
  rationale: string | null
  reasons: string[]
  statusText: string
  location: string | null
  actions: React.ReactNode
  onGenerate?: () => void
  isGenerating?: boolean
}) {
  return (
    <ProfileCard title="Gio Fit" subtitle={`Match against ${jobTitle || 'this job'}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
            Why Gio suggested them
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
          {rationale && <p className="mt-3 font-inter text-[13px] leading-[1.6] text-[#1F2230]">{rationale}</p>}
          <p className="mt-3 font-inter text-[12px] leading-[1.55] text-[#8B8F9E]">
            The full dossier — dimension breakdown, evidenced skills and validation points — has not been written for
            this match yet. Gio writes it automatically for its strongest matches on this job.
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
              Generate full dossier
            </Button>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8B8F9E]">Gio fit</p>
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

export default function SuggestedCandidateProfile() {
  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <JobAssignmentGuard>
          <SuggestedCandidateProfileInner />
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
