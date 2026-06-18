import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon,
  Heart, Briefcase, MapPin, Mail, Phone, DollarSign, Calendar, Sparkles,
  FileText, File as FileIcon, GraduationCap, Info, MessageSquare, UserPlus,
  Upload, Globe, Download, Clock, User as UserIcon, Plus,
} from 'lucide-react'
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
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import { CandidateWorkExperienceComponent, type CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { CandidateEducationComponent, type CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { EnhancedResumeDropzone } from '@/components/candidates/EnhancedResumeDropzone'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { IndependentCandidateForm } from '@/components/candidates/IndependentCandidateForm'
import AddToJobPipelineDialog from '@/components/candidates/AddToJobPipelineDialog'

import { useIndependentCandidates, type IndependentCandidate } from '@/hooks/useIndependentCandidates'
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

type TabKey = 'overview' | 'resume' | 'experience' | 'education' | 'details' | 'comments'

export default function IndependentCandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { candidates, isLoading: candidatesLoading, updateCandidate } = useIndependentCandidates()
  const candidate = useMemo(() => candidates.find(c => c.id === candidateId) || null, [candidates, candidateId])

  const idx = useMemo(() => candidates.findIndex(c => c.id === candidateId), [candidates, candidateId])
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < candidates.length - 1
  const total = candidates.length

  const tabFromUrl = (searchParams.get('tab') as TabKey) || 'overview'
  const [activeTab, setActiveTab] = useState<TabKey>(tabFromUrl)
  useEffect(() => { setActiveTab(tabFromUrl) }, [tabFromUrl])
  const setTab = (t: TabKey) => {
    setActiveTab(t)
    const next = new URLSearchParams(searchParams)
    next.set('tab', t)
    setSearchParams(next, { replace: true })
  }

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [addToPipelineOpen, setAddToPipelineOpen] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)

  const [workExperience, setWorkExperience] = useState<CandidateWorkExperience[]>([])
  const [education, setEducation] = useState<CandidateEducation[]>([])

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
  }, [candidateId])

  const { jobAssociations } = useCandidateJobAssociations(candidate?.id ?? null)

  // Resume upload
  const [isResumeUploading, setIsResumeUploading] = useState(false)
  const replaceResumeInputRef = useRef<HTMLInputElement>(null)
  const handleResumeUpload = async (file: File) => {
    if (!candidate) return
    setIsResumeUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `independent/${candidate.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage.from('candidate-attachments').upload(path, file)
      if (storageError) throw storageError
      const { error: dbError } = await supabase.from('candidates').update({ resume_url: path }).eq('id', candidate.id)
      if (dbError) throw dbError
      toast({ title: 'Resume uploaded', description: 'Resume updated successfully' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to upload resume', variant: 'destructive' })
    } finally {
      setIsResumeUploading(false)
    }
  }
  const onReplaceResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleResumeUpload(file)
    e.currentTarget.value = ''
  }

  // ── Loading / not-found ──
  if (candidatesLoading && !candidate) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <div className="min-h-screen bg-[#F6F5F1]">
            <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">
              <Skeleton className="h-[180px] w-full rounded-[16px]" />
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
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
          <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center">
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
  const resumeOnFile = !!candidate.resume_url
  const yearsExp = candidate.years_experience ?? null
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
    { value: 'comments', label: 'Comments', Icon: MessageSquare },
  ]

  const goPrev = () => hasPrev && navigate(`/candidates/${candidates[idx - 1].id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)
  const goNext = () => hasNext && navigate(`/candidates/${candidates[idx + 1].id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)

  const onAddToPipeline = () => setAddToPipelineOpen(true)
  const onSendEmail = () => {
    if (!candidate.email) {
      toast({ title: 'No email on file', description: 'Add an email address first.', variant: 'destructive' })
      return
    }
    window.location.href = `mailto:${candidate.email}`
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
      <SidebarBlock label="Quick actions">
        <div className="space-y-2">
          <Button variant="primary" size="md" icon={UserPlus} onClick={onAddToPipeline} className="w-full justify-center">
            Add to job pipeline
          </Button>
          <Button variant="secondary" size="md" icon={Mail} onClick={onSendEmail} className="w-full justify-center">
            Send email
          </Button>
          <Button variant="secondary" size="md" icon={Calendar} onClick={onSchedule} className="w-full justify-center">
            Schedule meeting
          </Button>
        </div>
      </SidebarBlock>

      <SidebarBlock label="Details">
        <div>
          <MetaRow icon={Calendar} label="Added" value={addedDate} />
          <MetaRow icon={Info} label="Source" value={candidate.source || null} />
          <MetaRow icon={Briefcase} label="Last role" value={currentRole || null} />
          <MetaRow icon={Clock} label="Years exp" value={yearsExp != null ? `${yearsExp}y` : null} />
        </div>
      </SidebarBlock>

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
        label={`Files (${resumeOnFile ? 1 : 0})`}
        action={
          <Button variant="ghost" size="xs" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()}>
            Upload
          </Button>
        }
      >
        {resumeOnFile ? (
          <FileRow
            icon={FileIcon}
            name="Resume.pdf"
            meta={addedDate ? `Uploaded ${addedDate}` : undefined}
            isResume
            downloadIcon={Download}
            onDownload={() => setTab('resume')}
          />
        ) : (
          <p className="font-inter text-[12px] text-[#8B8F9E] py-1">No files uploaded.</p>
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

  // ───── Contact-pair primitive (kept local to this page) ─────
  const ContactPair = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3 min-w-0">
      <div className="h-8 w-8 rounded-[9px] bg-[#FAFAF7] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[#5A6072]" />
      </div>
      <div className="min-w-0">
        <div className="font-inter text-[10.5px] uppercase tracking-[0.06em] text-[#8B8F9E]">{label}</div>
        <div className="font-inter text-[13px] font-medium text-[#1F2230] truncate mt-0.5">
          {value || <span className="text-[#8B8F9E]">—</span>}
        </div>
      </div>
    </div>
  )

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <div className="min-h-screen bg-[#F6F5F1]">
          <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">
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
                    <span className="text-[#1F2230] font-medium truncate max-w-[260px]">{candidate.candidate_name}</span>
                  </nav>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="primary" size="md" icon={UserPlus} onClick={onAddToPipeline}>
                    Add to job pipeline
                  </Button>
                  <Button variant="secondary" size="md" icon={Mail} onClick={onSendEmail}>Send email</Button>
                  <Button variant="secondary" size="md" icon={Calendar} onClick={onSchedule}>Schedule</Button>
                  {total > 0 && idx >= 0 && (
                    <span className="font-inter text-[11.5px] text-[#8B8F9E] tabular-nums ml-1">
                      {idx + 1} of {total}
                    </span>
                  )}
                  <Button variant="secondary" size="md" iconOnly aria-label="Previous candidate" icon={ChevronLeft} onClick={goPrev} disabled={!hasPrev} />
                  <Button variant="secondary" size="md" iconOnly aria-label="Next candidate" icon={ChevronRight} onClick={goNext} disabled={!hasNext} />
                </div>
              </div>

              {/* Row 2 — identity */}
              <div className="mt-3.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-poppins font-semibold tracking-[-0.04em] text-[#1F2230] text-[28px] sm:text-[30px] leading-tight truncate">
                    {candidate.candidate_name}
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
                  {location && (
                    <>
                      <span className="text-[#D1D5DB]">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#8B8F9E]" />
                        <span>{location}</span>
                      </span>
                    </>
                  )}
                  {candidate.source && (
                    <>
                      <span className="text-[#D1D5DB]">·</span>
                      <span>Source: <span className="text-[#1F2230] font-medium">{candidate.source}</span></span>
                    </>
                  )}
                  {addedDate && (
                    <>
                      <span className="text-[#D1D5DB]">·</span>
                      <span>Added {addedDate}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Row 4 — tabs */}
              <div className="mt-2.5">
                <ProfileTabs tabs={tabs} activeTab={activeTab} onTabChange={(v) => setTab(v as TabKey)} className="border-b-0" />
              </div>
            </section>

            {/* ───── Body: main + persistent sidebar ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
              <div className="space-y-4 min-w-0">
                {activeTab === 'overview' && (
                  <>
                    <ProfileCard
                      title="Profile summary"
                      badge={<Badge tone="lilac" size="xs" icon={Sparkles}>Gio summary</Badge>}
                      action={<Button variant="ghost" size="sm">Regenerate</Button>}
                    >
                      {candidate.profile_summary ? (
                        looksLikeHtml(candidate.profile_summary) ? (
                          <SafeHtml
                            content={candidate.profile_summary}
                            className="font-inter text-[13.5px] leading-relaxed text-[#1F2230] [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          />
                        ) : (
                          <ProfileSummaryMarkdown content={candidate.profile_summary} />
                        )
                      ) : (
                        <p className="font-inter text-[13px] text-[#8B8F9E] italic">
                          No summary yet. Regenerate to let Gio write one from the candidate's profile.
                        </p>
                      )}
                    </ProfileCard>

                    <ProfileCard
                      title="Contact information"
                      action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Edit</Button>}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <ContactPair
                          icon={Mail}
                          label="Email"
                          value={candidate.email ? (
                            <a href={`mailto:${candidate.email}`} className="text-virgilio-purple hover:underline">{candidate.email}</a>
                          ) : null}
                        />
                        <ContactPair icon={Phone} label="Phone" value={candidate.phone || null} />
                        <ContactPair icon={MapPin} label="Location" value={location || null} />
                        <ContactPair icon={DollarSign} label="Salary expectations" value={salary} />
                      </div>
                    </ProfileCard>

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
                  <ProfileCard
                    title="Resume"
                    subtitle={resumeOnFile ? `Resume.pdf · uploaded ${addedDate || '—'}` : undefined}
                    badge={resumeOnFile ? <Badge tone="lilac" size="xs" icon={Sparkles}>Parsed by Gio</Badge> : undefined}
                    action={
                      resumeOnFile ? (
                        <>
                          <input ref={replaceResumeInputRef} type="file" className="hidden" onChange={onReplaceResume} accept=".pdf,.doc,.docx" />
                          <Button variant="ghost" size="sm" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading}>
                            Replace
                          </Button>
                        </>
                      ) : undefined
                    }
                    bodyPadding="none"
                  >
                    <div className="bg-[#FAFAF7] p-4">
                      {resumeOnFile ? (
                        <CandidateResumeViewer fallbackResumeUrl={candidate.resume_url!} />
                      ) : (
                        <EnhancedResumeDropzone
                          onUpload={handleResumeUpload}
                          isUploading={isResumeUploading}
                          candidateId={candidate.id}
                          showUpload={false}
                          parseOnly={true}
                        />
                      )}
                    </div>
                  </ProfileCard>
                )}

                {activeTab === 'experience' && (() => {
                  const totalMonths = workExperience.reduce((sum, e) => {
                    if (!e.start_date) return sum
                    const s = new Date(e.start_date).getTime()
                    const end = (e.is_current || !e.end_date) ? Date.now() : new Date(e.end_date).getTime()
                    if (isNaN(s) || isNaN(end)) return sum
                    return sum + Math.max(0, Math.round((end - s) / (1000 * 60 * 60 * 24 * 30.4375)))
                  }, 0)
                  const totalYears = Math.round((totalMonths / 12) * 10) / 10
                  return (
                    <ProfileCard
                      title="Experience"
                      subtitle={`${workExperience.length} role${workExperience.length === 1 ? '' : 's'}${totalMonths > 0 ? ` · ${totalYears}y total` : ''}`}
                      action={<Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsFormOpen(true)}>Add role</Button>}
                    >
                      <ExperienceTimeline experiences={workExperience} />
                    </ProfileCard>
                  )
                })()}

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
                        <ContactPair icon={Phone} label="Phone" value={candidate.phone || null} />
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
                        <ContactPair icon={UserIcon} label="Added by" value={(candidate as any).added_by_name || null} />
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

                {activeTab === 'comments' && (
                  <ProfileCard title="Comments" subtitle="Person-level — visible across all jobs">
                    <CandidateComments
                      candidateId={candidate.id}
                      jobId={null as any}
                      organizationId={null as any}
                    />
                  </ProfileCard>
                )}
              </div>

              {/* Sidebar — sticky on tall screens */}
              <div className="lg:sticky lg:top-6">
                {sidebar}
              </div>
            </div>
          </div>

          {/* ── Dialogs ── */}
          <IndependentCandidateForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={async (data: any) => {
              await updateCandidate(candidate.id, data)
              setIsFormOpen(false)
            }}
            isLoading={candidatesLoading}
            initialData={candidate}
            title="Edit candidate"
          />

          {addToPipelineOpen && (
            <PipelineDialogPortal
              candidateId={candidate.id}
              onClose={() => setAddToPipelineOpen(false)}
            />
          )}
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
