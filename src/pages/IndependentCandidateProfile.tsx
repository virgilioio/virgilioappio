import { useState, useEffect, useMemo, useRef } from 'react'
import { confirmReplaceResume } from '@/lib/removeOldResumes'
import { useResumeRefresh } from '@/hooks/useResumeRefresh'
import { ResumeStatusLine } from '@/components/candidates/profile/ResumeStatus'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon,
  Heart, Briefcase, MapPin, Mail, Phone, Activity, DollarSign, Calendar, Sparkles,
  FileText, File as FileIcon, GraduationCap, Info, UserPlus,
  Upload, Globe, Download, Clock, User as UserIcon, Plus, PenLine,
} from 'lucide-react'
import { ProfileActionMenu } from '@/components/candidates/profile/ProfileActionMenu'
import { CandidateProfileDownloadDialog } from '@/components/candidates/CandidateProfileDownloadDialog'
import { ExperienceTimeline, EducationTimeline } from '@/components/candidates/profile/tabs/ExperienceTimeline'

import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SafeHtml } from '@/components/ui/safe-html'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'

import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { ProfileTabs, type ProfileTabDef } from '@/components/candidates/profile/ProfileTabs'
import {
  ProfileSidebar, SidebarBlock, MetaRow, LinkRow, FileRow,
} from '@/components/candidates/profile/primitives/ProfileSidebar'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { ContactPair, PhoneContactPair } from '@/components/candidates/profile/primitives/ContactPair'
import { useWhatsAppEnabled } from '@/hooks/useWhatsAppEnabled'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
import { buildWhatsAppUrl } from '@/utils/phoneUtils'
import { ProfileSummaryCard } from '@/components/candidates/profile/ProfileSummaryCard'
import { DataSourcesBlock } from '@/components/candidates/profile/DataSourcesBlock'
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { experienceSummary, unionExperienceMonths } from '@/lib/experience/groupExperience'
import { CandidateEducationComponent, type CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { ResumeTabCard, NoResumeFileSlot } from '@/components/candidates/profile/ResumeTabCard'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { useQueryClient } from '@tanstack/react-query'

import { CommentsCard } from '@/components/candidates/comments/CommentsCard'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import AddToJobPipelineDialog from '@/components/candidates/AddToJobPipelineDialog'
import { ActivityTabCard, ActivityTabSidebar } from '@/components/candidates/profile/tabs/ActivityTab'
import { useCandidateActivity } from '@/hooks/useCandidateActivity'
import { fetchEmailForReply } from '@/lib/emailLog'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import type { EmailHistoryCardEmail } from '@/components/candidates/EmailHistoryCard'
import { getReplySubject, getForwardSubject, formatQuotedReply, formatForwardedMessage } from '@/utils/emailFormatUtils'

import { useIndependentCandidates, type IndependentCandidate } from '@/hooks/useIndependentCandidates'
import { useIndependentCandidate } from '@/hooks/useIndependentCandidate'

import { useUserDisplayName } from '@/hooks/useUserDisplayNames'

import { useCandidateJobAssociations } from '@/hooks/useCandidateJobAssociations'

// ───────────────────────────── helpers ─────────────────────────────

function formatLocation(c: IndependentCandidate) {
  return [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ')
}

function formatSalary(c: IndependentCandidate) {
  if (!c.salary_amount) return null
  return `${c.salary_currency || 'USD'} ${c.salary_amount.toLocaleString()} ${c.salary_period || 'annually'}`
}

function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', opts)
}

function outcomeBadge(status: string | null, stageName: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'hired') return { tone: 'green' as const, label: 'Hired' }
  if (s === 'rejected') return { tone: 'neutral' as const, label: 'Rejected' }
  if (s === 'withdrawn') return { tone: 'neutral' as const, label: 'Withdrawn' }
  if (s === 'offer') return { tone: 'orange' as const, label: 'Offer' }
  if (stageName) return { tone: 'yellow' as const, label: `Reached ${stageName}` }
  return { tone: 'purple' as const, label: 'Active' }
}

/** Detect whether content is HTML (has tags) vs plain/markdown. */
function looksLikeHtml(s?: string | null) {
  if (!s) return false
  return /<\w+[^>]*>/.test(s)
}

// ───────────────────────────── page ─────────────────────────────

type TabKey = 'overview' | 'resume' | 'experience' | 'education' | 'details' | 'activity'

export default function IndependentCandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()


  // Resolve THIS candidate directly by id — never search inside a capped list.
  const { candidate, isLoading: candidateLoading, isFetched: candidateFetched, updateCandidate } = useIndependentCandidate(candidateId)
  // The list is used only for the prev/next arrows and the "x of y" counter.
  const { candidates } = useIndependentCandidates()
  const { name: createdByName } = useUserDisplayName((candidate as any)?.created_by || null)
  const { isEnabled: whatsAppEnabled } = useWhatsAppEnabled()


  const idx = useMemo(() => candidates.findIndex(c => c.id === candidateId), [candidates, candidateId])
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < candidates.length - 1
  const total = candidates.length


  // The Comments tab became the Comments card in the sidebar, and the Emails tab
  // the Activity tab (2026-10-19); old links land where their content went.
  const tabParam = searchParams.get('tab')
  const tabFromUrl = (tabParam === 'comments' ? 'overview' : tabParam === 'emails' || tabParam === 'communications' ? 'activity' : (tabParam as TabKey)) || 'overview'
  const [activeTab, setActiveTab] = useState<TabKey>(tabFromUrl)
  useEffect(() => { setActiveTab(tabFromUrl) }, [tabFromUrl])
  const setTab = (t: TabKey) => {
    setActiveTab(t)
    const next = new URLSearchParams(searchParams)
    next.set('tab', t)
    setSearchParams(next, { replace: true })
  }

  // Everything about this person across every job, plus the emails.
  const activity = useCandidateActivity(candidateId)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [addToPipelineOpen, setAddToPipelineOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)

  // Email composer state — shared for Compose / Reply / Forward
  const [emailComposerOpen, setEmailComposerOpen] = useState(false)
  const [emailComposerMode, setEmailComposerMode] = useState<'compose' | 'reply' | 'forward'>('compose')
  const [emailComposerTo, setEmailComposerTo] = useState<string | undefined>(undefined)
  const [emailComposerCc, setEmailComposerCc] = useState<string | undefined>(undefined)
  const [emailComposerSubject, setEmailComposerSubject] = useState<string | undefined>(undefined)
  const [emailComposerBody, setEmailComposerBody] = useState<string | undefined>(undefined)
  const [emailComposerReplyToId, setEmailComposerReplyToId] = useState<string | undefined>(undefined)

  const openComposeEmail = () => {
    setEmailComposerMode('compose')
    setEmailComposerTo(undefined)
    setEmailComposerCc(undefined)
    setEmailComposerSubject(undefined)
    setEmailComposerBody(undefined)
    setEmailComposerReplyToId(undefined)
    setEmailComposerOpen(true)
  }
  const openReplyEmail = (email: EmailHistoryCardEmail) => {
    const isReceived = email.direction === 'received'
    setEmailComposerMode('reply')
    setEmailComposerTo(isReceived ? email.from_address : email.to_addresses[0])
    setEmailComposerCc(email.cc_addresses?.join(', ') || undefined)
    setEmailComposerSubject(getReplySubject(email.subject))
    setEmailComposerBody(formatQuotedReply(email))
    setEmailComposerReplyToId(email.id)
    setEmailComposerOpen(true)
  }
  const openForwardEmail = (email: EmailHistoryCardEmail) => {
    setEmailComposerMode('forward')
    setEmailComposerTo('')
    setEmailComposerCc(undefined)
    setEmailComposerSubject(getForwardSubject(email.subject))
    setEmailComposerBody(formatForwardedMessage(email))
    setEmailComposerReplyToId(email.id)
    setEmailComposerOpen(true)
  }

  const [workExperience, setWorkExperience] = useState<CandidateWorkExperience[]>([])
  const [education, setEducation] = useState<CandidateEducation[]>([])
  // Bumped when Gio finishes re-reading a resume so experience/education reload.
  const [profileDataKey, setProfileDataKey] = useState(0)

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false
    ;(async () => {
      const [{ data: expData }, { data: eduData }] = await Promise.all([
        supabase.from('candidate_work_experience').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
        supabase.from('candidate_education').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
      ])
      if (cancelled) return
      setWorkExperience((expData as any) || [])
      setEducation((eduData as any) || [])
    })()
    return () => { cancelled = true }
  }, [candidateId, profileDataKey])

  const { jobAssociations } = useCandidateJobAssociations(candidate?.id ?? null)

  // Resume upload — stored as a candidate attachment, then re-read by Gio
  const { attachments, uploadAttachment, isUploading: isResumeUploading, refetch: refetchAttachments } =
    useCandidateAttachments(candidateId || '')
  const replaceResumeInputRef = useRef<HTMLInputElement>(null)
  // Upload → Gio re-reads → Gio Fit re-scores, shown in the sidebar file row
  // and on the Resume tab wherever the replace was started.
  const resumeRefresh = useResumeRefresh(candidateId, {
    onProfileUpdated: () => {
      setProfileDataKey(k => k + 1)
      void refetchAttachments()
    },
  })
  const isEnriching = resumeRefresh.status?.phase === 'reading'
  const resumeBusy = resumeRefresh.busy || isResumeUploading

  const handleResumeUpload = async (file: File) => {
    if (!candidateId || resumeRefresh.busy) return
    // C17: a new résumé deletes the old one, so ask first when one is on file.
    const current = attachments.find((a) => a.is_resume)
    const ok = await confirmReplaceResume({
      candidateName: (candidate as any)?.candidate_name,
      oldFileName: current?.file_name,
      newFileName: file.name,
      hasResume: !!current,
    })
    if (!ok) return
    // uploadAttachment surfaces its own error; the status line says it too.
    void resumeRefresh.run(file, () => uploadAttachment(file, true))
  }

  const onReplaceResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleResumeUpload(file)
    e.currentTarget.value = ''
  }


  // ── Loading / not-found ──
  if (!candidate && (candidateLoading || !candidateFetched)) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-virgilio-cream overflow-hidden">
            <div className="layout-container pt-2 pb-3 sm:pt-3 sm:pb-4">
              <Skeleton className="h-[180px] w-full rounded-[16px]" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="layout-container max-w-[1400px] pb-10 mx-auto w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <Skeleton className="h-[420px] rounded-[14px]" />
                <Skeleton className="h-[420px] rounded-[14px]" />
              </div>
            </div>
          </div>
        </PermissionGate>
      </AuthGate>
    )
  }

  if (!candidate) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <div className="min-h-screen bg-virgilio-cream flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-xl font-poppins font-semibold text-[#1F2230] mb-2">Candidate not found</h1>
              <p className="text-[#5A6072] mb-4">This candidate doesn't exist or you don't have access.</p>
              <Link to="/candidates">
                <Button variant="secondary" icon={ArrowLeft}>Back to candidates</Button>
              </Link>
            </div>
          </div>
        </PermissionGate>
      </AuthGate>
    )
  }

  // ── Derived ──
  const location = formatLocation(candidate)
  const salary = formatSalary(candidate)
  const resumeAttachment = attachments.find(a => a.is_resume) ?? attachments[0] ?? null
  const resumeOnFile = !!resumeAttachment || !!candidate.resume_url
  const resumeFileName = resumeAttachment?.file_name || 'Resume.pdf'
  const resumeUploadedDate = formatDate(resumeAttachment?.created_at) || formatDate(candidate.created_at)

  const unionMonths = unionExperienceMonths(workExperience)
  const yearsExp = unionMonths > 0 ? Math.round((unionMonths / 12) * 10) / 10 : candidate.years_experience ?? null
  const currentRole = candidate.current_job_title || candidate.standardized_title
  const currentCompany = candidate.company_current
  const addedDate = formatDate(candidate.created_at)

  const linksList: { label: string; url: string; icon: any }[] = []
  if (candidate.linkedin_url) linksList.push({ label: 'LinkedIn', url: candidate.linkedin_url, icon: LinkedInFilled as any })
  // Future: portfolio_url, github_url — only render if data exists

  const tabs: ProfileTabDef[] = [
    { value: 'overview', label: 'Overview', Icon: FileText },
    { value: 'resume', label: 'Resume', Icon: FileIcon },
    { value: 'experience', label: 'Experience', Icon: Briefcase, count: workExperience.length || null },
    { value: 'education', label: 'Education', Icon: GraduationCap, count: education.length || null },
    { value: 'details', label: 'Details', Icon: Info },
    { value: 'activity', label: 'Activity', Icon: Activity, count: activity.isLoading ? null : activity.events.length || null },
  ]

  const goPrev = () => hasPrev && navigate(`/candidates/${candidates[idx - 1].id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)
  const goNext = () => hasNext && navigate(`/candidates/${candidates[idx + 1].id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)

  const onAddToPipeline = () => setAddToPipelineOpen(true)
  const onSendEmail = () => {
    if (!candidate.email) {
      toast({ title: 'No email on file', description: 'Add an email address first.', variant: 'destructive' })
      return
    }
    openComposeEmail()
  }
  // Reply / Forward from an email in the Activity feed: read the full message, then open the composer.
  const onActivityEmail = async (emailLogId: string, mode: 'reply' | 'forward') => {
    const email = await fetchEmailForReply(emailLogId)
    if (!email) {
      toast({ title: 'Couldn\u2019t open that email', description: 'It may have been removed. Refresh the activity and try again.', variant: 'destructive' })
      return
    }
    if (mode === 'reply') openReplyEmail(email)
    else openForwardEmail(email)
  }
  const onSchedule = () => toast({ title: 'Schedule', description: 'Pick a job application to schedule from.' })

  const sortedAssociations = [...jobAssociations].sort((a, b) => {
    const closed = (s: string | null) => ['hired', 'rejected', 'withdrawn'].includes((s || '').toLowerCase())
    const aClosed = closed(a.status), bClosed = closed(b.status)
    if (aClosed !== bClosed) return aClosed ? 1 : -1
    return 0
  })

  // ───── Persistent sidebar ─────
  const sidebar = (
    <ProfileSidebar>
      <SidebarBlock
        label="Details"
        action={
          <Button variant="ghost" size="xs" icon={PenLine} onClick={() => setIsFormOpen(true)}>
            Edit
          </Button>
        }
      >
        <div>
          <MetaRow icon={MapPin} label="Location" value={location || null} />
          <MetaRow icon={Globe} label="Open to" value={(candidate as any).location || null} />
          <MetaRow icon={Mail} label="Email" value={candidate.email || null} />
          <MetaRow
            icon={Phone}
            label="Phone"
            value={candidate.phone || null}
            action={
              whatsAppEnabled && candidate.phone && buildWhatsAppUrl(candidate.phone) ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    const waUrl = buildWhatsAppUrl(candidate.phone)
                    if (waUrl) window.open(waUrl, '_blank')
                  }}
                  className="shrink-0 p-1 rounded-md hover:bg-[#F1F0EC] transition-colors text-[#25D366]"
                  aria-label="Start WhatsApp conversation"
                  title="Start WhatsApp conversation"
                >
                  <WhatsAppIcon size={14} />
                </button>
              ) : undefined
            }
          />
          <MetaRow icon={DollarSign} label="Salary expectation" value={salary || null} />
          <MetaRow icon={Info} label="Source" value={candidate.source || null} />
          <MetaRow icon={Calendar} label="Added" value={addedDate} />
          <MetaRow icon={UserIcon} label="Added by" value={createdByName || null} />
        </div>
      </SidebarBlock>

      <DataSourcesBlock candidate={candidate} onRefreshed={() => setProfileDataKey((k) => k + 1)} />

      {linksList.length > 0 && (
        <SidebarBlock label="Links">
          <div>
            {linksList.map((l) => (
              <LinkRow key={l.url} icon={l.icon} label={l.label} url={ensureAbsoluteUrl(l.url)} />
            ))}
          </div>
        </SidebarBlock>
      )}

      <SidebarBlock
        label="Files (1)"
        action={
          <Button variant="ghost" size="xs" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()}>
            Upload
          </Button>
        }
      >
        {resumeOnFile ? (
          <FileRow
            icon={FileIcon}
            name={resumeRefresh.status?.phase === 'uploading' ? resumeRefresh.status.fileName : resumeFileName}
            meta={resumeUploadedDate ? `Uploaded ${resumeUploadedDate}` : undefined}
            status={resumeRefresh.status ? <ResumeStatusLine status={resumeRefresh.status} compact /> : undefined}
            isResume
            downloadIcon={Download}
            onDownload={() => setTab('resume')}
          />

        ) : (
          <NoResumeFileSlot />
        )}
        <input ref={replaceResumeInputRef} type="file" className="hidden" onChange={onReplaceResume} accept=".pdf,.doc,.docx" />
      </SidebarBlock>

      {candidate.skills && candidate.skills.length > 0 && (
        <SidebarBlock
          label="Tags"
          action={<Button variant="ghost" size="xs" onClick={() => setIsFormOpen(true)}>Add</Button>}
        >
          <div className="flex flex-wrap gap-1">
            {candidate.skills.slice(0, 12).map((s) => (
              <Badge key={s} tone="neutral" size="xs">{s}</Badge>
            ))}
          </div>
        </SidebarBlock>
      )}
    </ProfileSidebar>
  )

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-virgilio-cream overflow-hidden">
          <div className="layout-container pt-2 pb-3 sm:pt-3 sm:pb-4 shrink-0">
            <div className="space-y-4">
            {/* ───── Hero card (breadcrumbs · actions · identity · meta · tabs) ───── */}
            <section className="bg-white border border-[#E7E8EE] rounded-[16px] shadow-[0_1px_2px_rgba(13,13,9,0.04)] pt-3.5 px-6 pb-0">
              {/* Row 1 — breadcrumb + actions */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate('/candidates')}
                    className="inline-flex items-center gap-1.5 font-poppins font-medium text-[12.5px] text-[#5A6072] hover:text-[#1F2230] transition-colors shrink-0"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to candidates
                  </button>
                  <span className="text-[#D1D5DB]">·</span>
                  <nav aria-label="breadcrumb" className="hidden md:flex items-center gap-1.5 font-inter text-[11.5px] text-[#8B8F9E] min-w-0">
                    <Link to="/candidates" className="hover:text-[#5A6072] transition-colors">Candidates</Link>
                    <span className="text-[#D1D5DB]">›</span>
                    <span className="text-[#1F2230] font-medium truncate max-w-[260px]">{candidate.candidate_name?.trim() || 'Unnamed candidate'}</span>
                  </nav>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {total > 0 && idx >= 0 && (
                    <span className="font-inter text-[11.5px] text-[#8B8F9E] tabular-nums ml-1">
                      {idx + 1} of {total}
                    </span>
                  )}
                  <Button variant="secondary" size="md" iconOnly aria-label="Previous candidate" icon={ChevronLeft} onClick={goPrev} disabled={!hasPrev} />
                  <Button variant="secondary" size="md" iconOnly aria-label="Next candidate" icon={ChevronRight} onClick={goNext} disabled={!hasNext} />
                  <ProfileActionMenu
                    sections={[
                      { items: [{ id: 'pipeline', label: 'Add to job pipeline', icon: UserPlus, onClick: onAddToPipeline }] },
                      {
                        label: 'Reach out',
                        items: [
                          { id: 'email', label: 'Send email', icon: Mail, onClick: onSendEmail },
                          { id: 'schedule', label: 'Schedule meeting', icon: Calendar, onClick: onSchedule },
                        ],
                      },
                      {
                        items: [
                          { id: 'edit', label: 'Edit profile', icon: PenLine, onClick: () => setIsFormOpen(true) },
                          { id: 'download', label: 'Download profile', icon: Download, onClick: () => setDownloadOpen(true) },
                        ],
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Row 2 — identity */}
              <div className="mt-3.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-poppins font-semibold tracking-[-0.04em] text-[#1F2230] text-[28px] sm:text-[30px] leading-tight truncate">
                    {candidate.candidate_name?.trim() || 'Unnamed candidate'}
                    <span className="text-[#D7C5FB]">.</span>
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsFavorite(v => !v)}
                    className="p-1 rounded-md hover:bg-[#F1F0EC] transition-colors"
                    aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Heart className={cn('h-[18px] w-[18px]', isFavorite ? 'fill-[#FA5252] text-[#FA5252]' : 'text-[#8B8F9E] hover:text-red-400')} />
                  </button>
                  <Badge tone="neutral" size="sm" dot>Independent</Badge>
                  {candidate.linkedin_url && (
                    <button
                      type="button"
                      onClick={() => window.open(ensureAbsoluteUrl(candidate.linkedin_url!), '_blank')}
                      className="p-1 rounded-md hover:bg-[#F1F0EC] transition-colors text-[#8B8F9E] hover:text-[#5A6072]"
                      aria-label="Open LinkedIn"
                    >
                      <LinkedInFilled className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Row 3 — meta */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap font-inter text-[12.5px] text-[#5A6072]">
                  {(currentRole || currentCompany) && (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-[#8B8F9E]" />
                      <span>
                        {currentRole || '—'}
                        {currentCompany && <> at <span className="font-semibold text-[#1F2230]">{currentCompany}</span></>}
                        {yearsExp != null && <> · {yearsExp}y exp</>}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row 4 — tabs */}
              <div className="mt-2.5">
                <ProfileTabs tabs={tabs} activeTab={activeTab} onTabChange={(v) => setTab(v as TabKey)} className="border-b-0" />
              </div>
            </section>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="layout-container max-w-[1400px] pb-10 pt-4 mx-auto w-full">
            {/* ───── Body: main + persistent sidebar ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
              <div className="space-y-4 min-w-0">
                {activeTab === 'overview' && (
                  <>
                    <ProfileSummaryCard
                      candidateId={candidate.id}
                      candidateName={candidate.candidate_name}
                      summary={candidate.profile_summary}
                      externallyRunning={isEnriching}
                      onRegenerated={() => {
                        queryClient.invalidateQueries({ queryKey: ['independent-candidate', candidate.id] })
                        queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
                        setProfileDataKey(k => k + 1)
                      }}
                    />

                    {workExperience.length > 0 && (
                      <ProfileCard title="Experience" subtitle={experienceSummary(workExperience)}>
                        <ExperienceTimeline experiences={workExperience} />
                      </ProfileCard>
                    )}

                    <ProfileCard
                      title="Pipeline history"
                      subtitle="Every job this candidate has been considered for"
                      action={
                        <Button variant="purple" size="sm" icon={UserPlus} onClick={onAddToPipeline}>
                          Add to job pipeline
                        </Button>
                      }
                      bodyPadding={sortedAssociations.length === 0 ? 'default' : 'none'}
                    >
                      {sortedAssociations.length === 0 ? (
                        <p className="font-inter text-[13px] text-[#8B8F9E]">Not yet considered for any job.</p>
                      ) : (
                        <ul className="divide-y divide-[#F1F0EC]">
                          {sortedAssociations.map((a) => {
                            const status = (a.status || '').toLowerCase()
                            const isClosed = status === 'hired' || status === 'rejected' || status === 'withdrawn'
                            const stageName = a.current_stage?.custom_stage_name || a.current_stage?.stage?.stage_name || null
                            const ob = isClosed ? outcomeBadge(a.status, null) : outcomeBadge(null, stageName ? null : null) // active path below
                            const activeBadge = stageName ? { tone: 'purple' as const, label: `Active · ${stageName}` } : { tone: 'purple' as const, label: 'Active' }
                            const badge = isClosed ? ob : activeBadge
                            const department = (a.job as any)?.department || null
                            const detail = isClosed
                              ? ((a.job as any)?.organization?.name || department || null)
                              : (stageName ? `${stageName} — act from the in-job profile` : 'Open application — act from the in-job profile')
                            const rowDate = formatDate((a as any).rejected_at || (a as any).hired_at || (a as any).entered_stage_at || (a as any).created_at, { month: 'short', day: 'numeric' })
                            return (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/jobs/${a.job_id}/candidates/${candidate.id}`)}
                                  className="group w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF7] transition-colors cursor-pointer"
                                >
                                  <div className={cn(
                                    'h-[34px] w-[34px] rounded-[9px] flex items-center justify-center shrink-0',
                                    isClosed ? 'bg-[#F1F0EC]' : 'bg-[#EDE4FF]',
                                  )}>
                                    <Briefcase className={cn('h-4 w-4', isClosed ? 'text-[#5A6072]' : 'text-virgilio-purple')} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-poppins font-semibold text-[13px] text-[#1F2230] truncate">
                                        {a.job?.title || 'Untitled job'}
                                      </span>
                                      <Badge tone={badge.tone} size="xs" dot>{badge.label}</Badge>
                                    </div>
                                    <div className="font-inter text-[11.5px] text-[#8B8F9E] mt-0.5 truncate">
                                      {department ? <>{department}{detail ? ` · ${detail}` : ''}</> : detail}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    {rowDate && <span className="font-inter text-[11px] text-[#8B8F9E]">{rowDate}</span>}
                                    <span className="inline-flex items-center gap-1 font-inter font-semibold text-[11px] text-virgilio-purple">
                                      Open <ArrowRight className="h-[11px] w-[11px]" />
                                    </span>
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </ProfileCard>

                    {candidate.skills && candidate.skills.length > 0 && (
                      <ProfileCard
                        title="Skills"
                        subtitle={`${candidate.skills.length} skills · ${candidate.skills.length} from resume, 0 added by recruiter`}
                        action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Edit</Button>}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.skills.map((skill) => (
                            <Badge key={skill} tone="neutral" size="sm">{skill}</Badge>
                          ))}
                        </div>
                      </ProfileCard>
                    )}
                  </>
                )}

                {activeTab === 'resume' && (
                  <ResumeTabCard
                    candidateId={candidate.id}
                    resumeOnFile={resumeOnFile}
                    fileName={resumeFileName}
                    uploadedDate={resumeUploadedDate}
                    fallbackResumeUrl={candidate.resume_url}
                    parsing={resumeBusy}
                    status={resumeRefresh.status}
                    onFile={(file) => void handleResumeUpload(file)}
                    onAskCandidate={onSendEmail}
                    viewerActions={
                      <>
                        <input ref={replaceResumeInputRef} type="file" className="hidden" onChange={onReplaceResume} accept=".pdf,.doc,.docx" />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Upload}
                          onClick={() => replaceResumeInputRef.current?.click()}
                          disabled={resumeBusy}
                          loading={resumeRefresh.status?.phase === 'uploading'}
                        >
                          Replace
                        </Button>
                      </>
                    }
                  />
                )}



                {activeTab === 'experience' && (
                    <ProfileCard
                      title="Experience"
                      subtitle={experienceSummary(workExperience)}
                      action={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsFormOpen(true)}>Add role</Button>}
                    >
                      <ExperienceTimeline experiences={workExperience} />
                    </ProfileCard>
                )}

                {activeTab === 'education' && (
                  <ProfileCard
                    title="Education"
                    subtitle={`${education.length} entr${education.length === 1 ? 'y' : 'ies'}`}
                    action={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsFormOpen(true)}>Add</Button>}
                  >
                    <EducationTimeline education={education} />
                  </ProfileCard>
                )}

                {activeTab === 'details' && (
                  <>
                    <ProfileCard
                      title="Contact & preferences"
                      action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Edit</Button>}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <ContactPair icon={Mail} label="Email" value={candidate.email || null} />
                        <PhoneContactPair icon={Phone} phone={candidate.phone} whatsAppEnabled={whatsAppEnabled} />
                        <ContactPair icon={MapPin} label="Location" value={location || null} />
                        <ContactPair icon={DollarSign} label="Salary expectations" value={salary} />
                        <ContactPair icon={Info} label="Work authorization" value={(candidate as any).work_authorization || null} />
                        <ContactPair icon={Calendar} label="Available from" value={(candidate as any).available_from ? formatDate((candidate as any).available_from) : null} />
                        <ContactPair icon={Clock} label="Notice period" value={(candidate as any).notice_period || null} />
                        <ContactPair icon={Globe} label="Languages" value={Array.isArray((candidate as any).languages) ? (candidate as any).languages.join(', ') : null} />
                      </div>
                    </ProfileCard>

                    <ProfileCard title="Record details" subtitle="How this profile got here and who owns it">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <ContactPair icon={Calendar} label="Added" value={addedDate} />
                        <ContactPair icon={UserIcon} label="Added by" value={createdByName} />
                        <ContactPair icon={Info} label="Source" value={candidate.source || null} />
                        {(candidate as any).data_consent_expires_at && (
                          <ContactPair
                            icon={Info}
                            label="Data consent"
                            value={`On file · expires ${formatDate((candidate as any).data_consent_expires_at)}`}
                          />
                        )}
                      </div>
                    </ProfileCard>
                  </>
                )}


                {activeTab === 'activity' && (
                  <ActivityTabCard activity={activity} candidateId={candidate.id} onEmailAction={onActivityEmail} />
                )}

              </div>

              {/* Sidebar — sticky on tall screens */}
              <div className="space-y-4 lg:sticky lg:top-6">
                {activeTab === 'activity' ? (
                  <ActivityTabSidebar activity={activity} candidateId={candidate.id} />
                ) : (
                  <>
                    <CommentsCard candidateId={candidate.id} jobId={null} />
                    {sidebar}
                  </>
                )}
              </div>
            </div>
            </div>
          </div>

          {/* ── Dialogs ── */}
          <CandidateFormSheet
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={async (data: any) => {
              await updateCandidate(candidate.id, data)
              setIsFormOpen(false)
            }}
            isLoading={candidateLoading}
            candidate={candidate as any}
          />

          <CandidateProfileDownloadDialog
            open={downloadOpen}
            onOpenChange={setDownloadOpen}
            pdfOptions={{ candidate: candidate as any, workExperience, education }}
          />

          {addToPipelineOpen && (
            <PipelineDialogPortal
              candidateId={candidate.id}
              onClose={() => setAddToPipelineOpen(false)}
            />
          )}

          <MinimizableEmailComposer
            isOpen={emailComposerOpen}
            onOpenChange={setEmailComposerOpen}
            candidateId={candidate.id}
            defaultTo={emailComposerTo ?? candidate.email ?? undefined}
            candidateName={candidate.candidate_name || undefined}
            mode={emailComposerMode}
            inReplyToMessageId={emailComposerReplyToId}
            defaultSubject={emailComposerSubject}
            defaultBody={emailComposerBody}
            defaultCc={emailComposerCc}
          />
        </div>
      </PermissionGate>
    </AuthGate>
  )
}


/**
 * AddToJobPipelineDialog ships its own trigger; we mount it auto-opened
 * by simulating a click on its trigger button on first render.
 */
function PipelineDialogPortal({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const btn = wrapperRef.current?.querySelector('button')
    btn?.click()
  }, [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div ref={wrapperRef} className="hidden">
      <AddToJobPipelineDialog candidateId={candidateId} />
    </div>
  )
}
