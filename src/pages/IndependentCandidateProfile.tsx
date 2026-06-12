import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon,
  Heart, Briefcase, MapPin, Mail, Phone, DollarSign, Calendar, Sparkles,
  FileText, File as FileIcon, GraduationCap, Info, MessageSquare, UserPlus,
  Pencil, MoreHorizontal, ExternalLink, Upload,
} from 'lucide-react'

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

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'
}

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

function computeCompleteness(c: IndependentCandidate, resumeOnFile: boolean, expCount: number, eduCount: number, linksCount: number) {
  const checks = [
    !!c.email,
    !!c.phone,
    !!(c.location_city || c.location_country),
    resumeOnFile,
    expCount > 0,
    eduCount > 0,
    Array.isArray(c.skills) && c.skills.length > 0,
    linksCount > 0,
    !!c.profile_summary,
    !!c.salary_amount,
  ]
  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
}

function outcomeBadge(status: string | null, stageName: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'hired') return { tone: 'green' as const, label: 'Hired' }
  if (s === 'rejected') return { tone: 'red' as const, label: 'Rejected' }
  if (s === 'offer') return { tone: 'orange' as const, label: 'Offer' }
  if (stageName) return { tone: 'yellow' as const, label: `Reached ${stageName}` }
  return { tone: 'green' as const, label: 'Active' }
}

// ─────────────────────── small primitives (local) ───────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('bg-white border border-virgilio-border rounded-[14px] shadow-sm', className)}>
      {children}
    </section>
  )
}

function CardHead({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#F1F0EC]">
      <div className="min-w-0">
        <h3 className="font-poppins font-semibold text-[14px] tracking-[-0.01em] text-text-primary">
          {title}<span className="text-virgilio-purple">.</span>
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-text-tertiary font-inter">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

function SidebarBlock({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 border-b border-[#F1F0EC] last:border-b-0">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-text-tertiary">
          {label}
        </h4>
        {action}
      </div>
      {children}
    </div>
  )
}

function MetaRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
      <span className="flex items-center gap-2 text-text-tertiary min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-text-primary font-medium text-right truncate min-w-0">{value}</span>
    </div>
  )
}

function ContactPair({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="h-9 w-9 rounded-[9px] bg-[#F1F0EC] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-[0.06em] font-poppins font-semibold text-text-tertiary">
          {label}
        </div>
        <div className="text-[13px] text-text-primary font-medium truncate">{value || <span className="text-text-tertiary">—</span>}</div>
      </div>
    </div>
  )
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

  // Experience / education — currently unused on independent candidates (legacy);
  // kept empty so the components show their built-in empty states.
  const [workExperience] = useState<CandidateWorkExperience[]>([])
  const [education] = useState<CandidateEducation[]>([])

  const { jobAssociations } = useCandidateJobAssociations(candidate?.id ?? null)

  // Resume upload (preserve legacy behavior)
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
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-[180px] w-full rounded-[14px]" />
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
              <h1 className="text-xl font-poppins font-semibold text-text-primary mb-2">Candidate not found</h1>
              <p className="text-text-secondary mb-4">This candidate doesn't exist or you don't have access.</p>
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
  const links = [
    candidate.linkedin_url && { label: 'LinkedIn', url: candidate.linkedin_url, icon: LinkedInFilled as any },
  ].filter(Boolean) as { label: string; url: string; icon: any }[]
  const completeness = computeCompleteness(candidate, resumeOnFile, workExperience.length, education.length, links.length)
  const yearsExp = candidate.years_experience ?? null
  const currentRole = candidate.current_job_title || candidate.standardized_title
  const currentCompany = candidate.company_current

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

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <div className="min-h-screen bg-[#F6F5F1]">
          <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">
            {/* ── Nav header ── */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/candidates')}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to candidates
                </button>
                <nav className="hidden md:flex items-center gap-1.5 text-[12.5px] text-text-tertiary min-w-0">
                  <span className="text-text-tertiary/60">·</span>
                  <Link to="/candidates" className="hover:text-text-secondary">Candidates</Link>
                  <ChevronRightIcon className="h-3 w-3 text-text-tertiary/60" />
                  <span className="text-text-secondary truncate max-w-[260px]">{candidate.candidate_name}</span>
                </nav>
              </div>

              <div className="flex items-center gap-2">
                {total > 0 && idx >= 0 && (
                  <span className="text-[12px] text-text-tertiary tabular-nums">
                    {idx + 1} of {total}
                  </span>
                )}
                <Button variant="secondary" size="md" iconOnly aria-label="Previous candidate" icon={ChevronLeft} onClick={goPrev} disabled={!hasPrev} />
                <Button variant="secondary" size="md" iconOnly aria-label="Next candidate" icon={ChevronRight} onClick={goNext} disabled={!hasNext} />
              </div>
            </div>

            {/* ── Hero card ── */}
            <SectionCard className="px-6 pt-5 pb-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="h-[72px] w-[72px] rounded-2xl flex items-center justify-center text-white font-poppins font-semibold text-[22px] shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6F3FF5, #8B5CF6)' }}
                  aria-hidden
                >
                  {initialsOf(candidate.candidate_name)}
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[26px] leading-tight truncate">
                      {candidate.candidate_name}
                      <span className="text-[#D7C5FB]">.</span>
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsFavorite(v => !v)}
                      className="p-1 rounded-md hover:bg-muted transition-colors"
                      aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Heart className={cn('h-[18px] w-[18px]', isFavorite ? 'fill-[#FA5252] text-[#FA5252]' : 'text-text-tertiary hover:text-red-400')} />
                    </button>
                    <Badge tone="neutral" size="sm" dot>Independent</Badge>
                    {candidate.linkedin_url && (
                      <button
                        type="button"
                        onClick={() => window.open(ensureAbsoluteUrl(candidate.linkedin_url!), '_blank')}
                        className="p-1 rounded-md hover:bg-muted transition-colors text-text-tertiary hover:text-text-secondary"
                        aria-label="Open LinkedIn"
                      >
                        <LinkedInFilled className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[12.5px] text-text-secondary font-inter">
                    {(currentRole || currentCompany) && (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-text-tertiary" />
                        <span>
                          {currentRole || '—'}
                          {currentCompany && <> at <span className="font-semibold text-text-primary">{currentCompany}</span></>}
                          {yearsExp != null && <> · {yearsExp}y exp</>}
                        </span>
                      </span>
                    )}
                    {location && (
                      <>
                        <span className="text-text-tertiary/60">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
                          <span>{location}</span>
                        </span>
                      </>
                    )}
                    {candidate.source && (
                      <>
                        <span className="text-text-tertiary/60">·</span>
                        <span>Source: <span className="text-text-primary font-medium">{candidate.source}</span></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Completeness tile */}
                <div
                  className="shrink-0 px-4 py-2 rounded-[12px] border text-center min-w-[96px]"
                  style={{ borderColor: '#EDE4FF', background: 'linear-gradient(180deg, #FAF8FF, #FFFFFF)' }}
                >
                  <div className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary font-inter">PROFILE</div>
                  <div className="font-poppins font-semibold text-[30px] leading-none text-virgilio-purple tabular-nums">{completeness}%</div>
                  <div className="text-[9.5px] text-text-tertiary font-inter mt-0.5">complete</div>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-4 pt-3.5 border-t border-[#F1F0EC] flex items-center gap-2 flex-wrap">
                <Button variant="primary" size="md" icon={UserPlus} onClick={onAddToPipeline}>
                  Add to job pipeline
                </Button>
                <Button variant="secondary" size="md" icon={Mail} onClick={onSendEmail}>Send email</Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" size="md" icon={Pencil} onClick={() => setIsFormOpen(true)}>Edit</Button>
                  <Button variant="secondary" size="md" iconOnly aria-label="More actions" icon={MoreHorizontal} />
                </div>
              </div>
            </SectionCard>

            {/* ── Tabs (real nav) ── */}
            <SectionCard className="px-2">
              <ProfileTabs tabs={tabs} activeTab={activeTab} onTabChange={(v) => setTab(v as TabKey)} className="border-b-0" />
            </SectionCard>

            {/* ── Body: main + persistent sidebar ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
              {/* ── Main column ── */}
              <div className="space-y-4 min-w-0">
                {activeTab === 'overview' && (
                  <>
                    {/* Profile summary */}
                    <SectionCard>
                      <CardHead
                        title="Profile summary"
                        action={
                          <div className="flex items-center gap-2">
                            <Badge tone="lilac" size="sm" icon={Sparkles}>Gio summary</Badge>
                            <Button variant="ghost" size="sm">Regenerate</Button>
                          </div>
                        }
                      />
                      <div className="px-5 py-4">
                        {candidate.profile_summary ? (
                          <SafeHtml
                            content={candidate.profile_summary}
                            className="text-[13.5px] leading-relaxed text-text-primary [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          />
                        ) : (
                          <p className="text-[13px] text-text-tertiary italic">No summary yet. Regenerate to let Gio write one from the candidate's profile.</p>
                        )}
                      </div>
                    </SectionCard>

                    {/* Contact info */}
                    <SectionCard>
                      <CardHead
                        title="Contact information"
                        action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Edit</Button>}
                      />
                      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
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
                    </SectionCard>

                    {/* Pipeline history */}
                    <SectionCard>
                      <CardHead
                        title="Pipeline history"
                        subtitle="Every job this candidate has been considered for"
                        action={
                          <Button variant="purple" size="sm" icon={UserPlus} onClick={onAddToPipeline}>
                            Add to job pipeline
                          </Button>
                        }
                      />
                      {jobAssociations.length === 0 ? (
                        <div className="px-5 py-6 text-[13px] text-text-tertiary">
                          Not yet considered for any job.
                        </div>
                      ) : (
                        <ul className="divide-y divide-[#F1F0EC]">
                          {jobAssociations.map((a) => {
                            const ob = outcomeBadge(a.status, null)
                            return (
                              <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                                <div className="h-[34px] w-[34px] rounded-[9px] bg-[#F1F0EC] flex items-center justify-center shrink-0">
                                  <Briefcase className="h-4 w-4 text-text-secondary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-poppins font-semibold text-[13px] text-text-primary truncate">
                                      {a.job?.title || 'Untitled job'}
                                    </span>
                                    <Badge tone={ob.tone} size="xs" dot>{ob.label}</Badge>
                                  </div>
                                  {a.job?.organization?.name && (
                                    <div className="text-[11.5px] text-text-tertiary font-inter mt-0.5 truncate">
                                      {a.job.organization.name}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => window.open(`/jobs/${a.job_id}?candidate=${candidate.id}`, '_blank')}
                                  className="p-1.5 rounded-md hover:bg-muted text-text-tertiary hover:text-text-secondary transition-colors"
                                  aria-label="Open in job"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </SectionCard>

                    {/* Skills */}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <SectionCard>
                        <CardHead
                          title="Skills"
                          subtitle={`${candidate.skills.length} skills`}
                          action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Edit</Button>}
                        />
                        <div className="px-5 py-4 flex flex-wrap gap-1.5">
                          {candidate.skills.map((skill) => (
                            <Badge key={skill} tone="neutral" size="sm">{skill}</Badge>
                          ))}
                        </div>
                      </SectionCard>
                    )}
                  </>
                )}

                {activeTab === 'resume' && (
                  <SectionCard>
                    <CardHead
                      title="Resume"
                      action={
                        <div className="flex items-center gap-2">
                          <Badge tone="lilac" size="sm" icon={Sparkles}>Parsed by Gio</Badge>
                          {resumeOnFile && (
                            <>
                              <input ref={replaceResumeInputRef} type="file" className="hidden" onChange={onReplaceResume} accept=".pdf,.doc,.docx" />
                              <Button variant="secondary" size="sm" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading}>
                                Replace
                              </Button>
                            </>
                          )}
                        </div>
                      }
                    />
                    <div className="p-4 bg-[#FAFAF7] rounded-b-[14px]">
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
                  </SectionCard>
                )}

                {activeTab === 'experience' && (
                  <SectionCard>
                    <CardHead title="Experience" action={<Button variant="secondary" size="sm" onClick={() => setIsFormOpen(true)}>Add role</Button>} />
                    <div className="p-2">
                      <CandidateWorkExperienceComponent experiences={workExperience} />
                    </div>
                  </SectionCard>
                )}

                {activeTab === 'education' && (
                  <SectionCard>
                    <CardHead title="Education" action={<Button variant="secondary" size="sm" onClick={() => setIsFormOpen(true)}>Add</Button>} />
                    <div className="p-2">
                      <CandidateEducationComponent education={education} />
                    </div>
                  </SectionCard>
                )}

                {activeTab === 'details' && (
                  <>
                    <SectionCard>
                      <CardHead title="Contact & preferences" action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Edit</Button>} />
                      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <ContactPair icon={Mail} label="Email" value={candidate.email} />
                        <ContactPair icon={Phone} label="Phone" value={candidate.phone} />
                        <ContactPair icon={MapPin} label="Location" value={location} />
                        <ContactPair icon={DollarSign} label="Salary expectations" value={salary} />
                        <ContactPair icon={Info} label="Seniority" value={candidate.seniority_level} />
                        <ContactPair icon={Info} label="Functional area" value={candidate.functional_area} />
                        <ContactPair icon={Info} label="Specialization" value={candidate.specialization} />
                        <ContactPair icon={Briefcase} label="Years of experience" value={yearsExp != null ? `${yearsExp}y` : null} />
                      </div>
                    </SectionCard>

                    <SectionCard>
                      <CardHead title="Record details" subtitle="How this profile got here and who owns it" />
                      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <ContactPair icon={Calendar} label="Added" value={formatDate(candidate.created_at)} />
                        <ContactPair icon={Info} label="Source" value={candidate.source} />
                        <ContactPair icon={Calendar} label="Last updated" value={formatDate(candidate.updated_at)} />
                        <ContactPair icon={Info} label="Status" value={candidate.status} />
                      </div>
                    </SectionCard>
                  </>
                )}

                {activeTab === 'comments' && (
                  <SectionCard>
                    <div className="p-2">
                      <CandidateComments
                        candidateId={candidate.id}
                        jobId={null as any}
                        organizationId={null as any}
                      />
                    </div>
                  </SectionCard>
                )}
              </div>

              {/* ── Persistent sidebar ── */}
              <aside className="space-y-4">
                <SectionCard className="px-5 py-2">
                  <SidebarBlock label="Quick actions">
                    <div className="space-y-2">
                      <Button variant="primary" size="md" icon={UserPlus} onClick={onAddToPipeline} className="w-full justify-center">
                        Add to job pipeline
                      </Button>
                      <Button variant="secondary" size="md" icon={Mail} onClick={onSendEmail} className="w-full justify-center">
                        Send email
                      </Button>
                    </div>
                  </SidebarBlock>

                  <SidebarBlock label="Details">
                    <div className="space-y-0.5">
                      <MetaRow icon={Calendar} label="Added" value={formatDate(candidate.created_at) || '—'} />
                      <MetaRow icon={Info} label="Source" value={candidate.source || '—'} />
                      {currentRole && <MetaRow icon={Briefcase} label="Last role" value={currentRole} />}
                      {yearsExp != null && <MetaRow icon={Info} label="Years exp" value={`${yearsExp}y`} />}
                      {location && <MetaRow icon={MapPin} label="Location" value={location} />}
                    </div>
                  </SidebarBlock>

                  {links.length > 0 && (
                    <SidebarBlock label="Links">
                      <ul className="space-y-1">
                        {links.map((l) => (
                          <li key={l.url} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="flex items-center gap-2 text-[12.5px] text-text-primary min-w-0">
                              <l.icon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                              <span className="truncate">{l.label}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => window.open(ensureAbsoluteUrl(l.url), '_blank')}
                              className="p-1 rounded-md hover:bg-muted text-text-tertiary hover:text-text-secondary"
                              aria-label={`Open ${l.label}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </SidebarBlock>
                  )}

                  <SidebarBlock
                    label={`Files (${resumeOnFile ? 1 : 0})`}
                    action={
                      <Button variant="ghost" size="sm" icon={Upload} onClick={() => replaceResumeInputRef.current?.click()}>
                        Upload
                      </Button>
                    }
                  >
                    {resumeOnFile ? (
                      <div className="flex items-center justify-between gap-2 py-1.5">
                        <span className="flex items-center gap-2 text-[12.5px] text-text-primary min-w-0">
                          <FileIcon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                          <span className="truncate">Resume</span>
                          <Badge tone="purple" size="xs">Resume</Badge>
                        </span>
                        <button
                          type="button"
                          onClick={() => setTab('resume')}
                          className="p-1 rounded-md hover:bg-muted text-text-tertiary hover:text-text-secondary"
                          aria-label="View resume"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[12px] text-text-tertiary py-1">No files uploaded.</p>
                    )}
                    <input ref={replaceResumeInputRef} type="file" className="hidden" onChange={onReplaceResume} accept=".pdf,.doc,.docx" />
                  </SidebarBlock>

                  {candidate.skills && candidate.skills.length > 0 && (
                    <SidebarBlock
                      label="Tags"
                      action={<Button variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>Add</Button>}
                    >
                      <div className="flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 12).map((s) => (
                          <Badge key={s} tone="neutral" size="xs">{s}</Badge>
                        ))}
                      </div>
                    </SidebarBlock>
                  )}
                </SectionCard>
              </aside>
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

          {/* AddToJobPipelineDialog renders its own trigger; mount inside a hidden wrapper that we control via state */}
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
  // Wrap in a one-shot close listener: when its dialog closes, fire onClose.
  // We can't directly subscribe; use a MutationObserver fallback.
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
