import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { EnhancedSkillBadge } from '@/components/ui/enhanced-skill-badge'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'
import { CandidateWorkExperienceComponent, CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { CandidateCertificationsComponent, CandidateCertification } from '@/components/candidates/CandidateCertifications'
import { CandidateEducationComponent, CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { CandidateJobSidebar } from '@/components/candidates/CandidateJobSidebar'
import { MobileJobSelector } from '@/components/candidates/MobileJobSelector'
import { Edit, FileText, Download, ChevronLeft, ChevronRight, Mail, Phone, Copy, ExternalLink, Send, Activity, StickyNote, Sparkles, User, Globe, Loader2, Bell, Calendar, Briefcase, Award, TrendingUp } from 'lucide-react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SafeHtml } from '@/components/ui/safe-html'
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import { Badge } from '@/components/ui/badge'
import { generateCandidatePdf } from '@/utils/candidatePdfGenerator'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import { toast } from '@/hooks/use-toast'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'
import { copyToClipboard } from '@/utils/clipboard'
import { getEmailFromEntry, getPhoneFromEntry } from '@/utils/parseContactEntry'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'

import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { EmailHistoryList } from './EmailHistoryList'
import { EmailHistoryCardEmail } from './EmailHistoryCard'
import { formatQuotedReply, formatForwardedMessage, getReplySubject, getForwardSubject } from '@/utils/emailFormatUtils'
import { ActivityFeedList } from './ActivityFeedList'
import AddToJobPipelineDialog from './AddToJobPipelineDialog'
import { Separator } from '@/components/ui/separator'
import { CandidateReminders } from './CandidateReminders'
import { useEnrichCandidate } from '@/hooks/useEnrichCandidate'
import { SimpleScheduleInterviewSheet } from './SimpleScheduleInterviewSheet'

interface IndependentCandidateProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
}

export function IndependentCandidateProfileSheet({
  open,
  onOpenChange,
  candidateId,
  hasPrev,
  hasNext,
  onNavigatePrev,
  onNavigateNext,
}: IndependentCandidateProfileSheetProps) {
  const { canEditCandidates } = usePermissions()
  const { organizationId, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [candidate, setCandidate] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'comments'>('overview')
  const [rightActiveTab, setRightActiveTab] = useState<'feed' | 'notes' | 'emails' | 'reminders'>('feed')
  const [workExperience, setWorkExperience] = useState<CandidateWorkExperience[]>([])
  const [education, setEducation] = useState<CandidateEducation[]>([])
  const [certifications, setCertifications] = useState<CandidateCertification[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [emailComposerOpen, setEmailComposerOpen] = useState(false)
  const [emailComposerMode, setEmailComposerMode] = useState<'compose' | 'reply' | 'forward'>('compose')
  const [emailComposerSubject, setEmailComposerSubject] = useState<string | undefined>(undefined)
  const [emailComposerBody, setEmailComposerBody] = useState<string | undefined>(undefined)
  const [emailComposerTo, setEmailComposerTo] = useState<string | undefined>(undefined)
  const [emailComposerCc, setEmailComposerCc] = useState<string | undefined>(undefined)
  const [emailComposerReplyToId, setEmailComposerReplyToId] = useState<string | undefined>(undefined)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  // Handler for job sidebar navigation
  const handleJobSelect = (jobId: string) => {
    onOpenChange(false) // Close the sheet
    navigate(`/jobs/${jobId}?candidate=${candidateId}`)
  }

  const { attachments, uploadAttachment: uploadResume, isUploading: isResumeUploading, deleteAttachment } = useCandidateAttachments(candidateId || '')

  const resumeAttachment = attachments.find((a) => a.is_resume)
  const replaceResumeInputRef = useRef<HTMLInputElement>(null)
  
  const handleReplaceResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void uploadResume(file, true)
    }
    e.currentTarget.value = ''
  }
  
  const handleDeleteResume = async () => {
    if (!resumeAttachment) return
    await deleteAttachment(resumeAttachment.id, resumeAttachment.file_url)
  }

  const { enrichByLinkedIn, canEnrich, isEnriching } = useEnrichCandidate()

  const handleEnrichFromLinkedIn = async () => {
    if (!candidateId) return
    
    const result = await enrichByLinkedIn(candidateId)
    
    // Refresh candidate data after enrichment
    if (result?.enriched_count && result.enriched_count > 0) {
      const { data } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single()
      setCandidate(data || null)
    }
  }

  // Email Reply/Forward handlers
  const handleEmailReply = (email: EmailHistoryCardEmail) => {
    const isReceived = email.direction === 'received'
    setEmailComposerMode('reply')
    setEmailComposerTo(isReceived ? email.from_address : email.to_addresses[0])
    setEmailComposerSubject(getReplySubject(email.subject))
    setEmailComposerBody(formatQuotedReply(email))
    setEmailComposerCc(email.cc_addresses?.join(', ') || undefined)
    setEmailComposerReplyToId(email.id)
    setEmailComposerOpen(true)
  }

  const handleEmailForward = (email: EmailHistoryCardEmail) => {
    setEmailComposerMode('forward')
    setEmailComposerTo('')
    setEmailComposerSubject(getForwardSubject(email.subject))
    setEmailComposerBody(formatForwardedMessage(email))
    setEmailComposerCc(undefined)
    setEmailComposerReplyToId(email.id)
    setEmailComposerOpen(true)
  }

  const resetEmailComposer = () => {
    setEmailComposerMode('compose')
    setEmailComposerSubject(undefined)
    setEmailComposerBody(undefined)
    setEmailComposerTo(undefined)
    setEmailComposerCc(undefined)
    setEmailComposerReplyToId(undefined)
    setEmailComposerOpen(false)
  }

  useEffect(() => {
    if (open) setActiveTab('overview')
    
    // CRITICAL: Clear stale data immediately when candidateId changes to prevent race conditions
    // This fixes a data integrity bug where booking links could contain wrong candidate info
    setCandidate(null)
    setWorkExperience([])
    setEducation([])
    setCertifications([])
    
    const load = async () => {
      if (!open || !candidateId) return
      setLoading(true)
      try {
        const { data } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single()
        setCandidate(data || null)

        // Load work experience
        const { data: expData } = await supabase
          .from('candidate_work_experience')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('start_date', { ascending: false })
        setWorkExperience(expData || [])

        // Load education
        const { data: eduData } = await supabase
          .from('candidate_education')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('start_date', { ascending: false })
        setEducation(eduData || [])

        // Load certifications
        const { data: certData } = await supabase
          .from('candidate_certifications')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('year_obtained', { ascending: false })
        setCertifications(certData || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, candidateId])

  const handleUpdateCandidate = async (candidateData: any) => {
    if (!candidateId) return
    setEditLoading(true)
    try {
      const { notes, ...globalCandidateData } = candidateData
      
      const allowedCandidateFields = {
        candidate_name: globalCandidateData.candidate_name,
        email: globalCandidateData.email,
        phone: globalCandidateData.phone,
        location_country: globalCandidateData.location_country,
        location_state: globalCandidateData.location_state,
        location_city: globalCandidateData.location_city,
        salary_amount: globalCandidateData.salary_amount,
        salary_currency: globalCandidateData.salary_currency,
        salary_period: globalCandidateData.salary_period,
        profile_summary: globalCandidateData.profile_summary,
        linkedin_url: globalCandidateData.linkedin_url,
        skills: globalCandidateData.skills
      }
      
      const filteredCandidateData = Object.fromEntries(
        Object.entries(allowedCandidateFields).filter(([_, value]) => value !== undefined)
      )
      
      const { data, error } = await supabase
        .from('candidates')
        .update(filteredCandidateData)
        .eq('id', candidateId)
        .select('*')
        .single()
      
      if (error) throw error
      
      setCandidate(data)
      toast({ title: 'Success', description: 'Candidate updated successfully' })
      setEditOpen(false)
    } catch (err) {
      console.error('Error updating candidate:', err)
      toast({ title: 'Error', description: 'Failed to update candidate', variant: 'destructive' })
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[96vw] sm:max-w-none h-full p-0" showOverlay={false}>
          <div className="flex h-full flex-col relative">
            <SheetHeader className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-poppins font-bold tracking-page-title text-text-primary text-4xl">
                      {candidate?.candidate_name || 'Loading...'}
                      <span className="text-purple-period">.</span>
                    </h2>
                    {candidate?.enrichment_status === 'processing' && (
                      <Badge variant="secondary" className="gap-1 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI Enriching...
                      </Badge>
                    )}
                    {candidate?.linkedin_url && (
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(candidate.linkedin_url, '_blank')}
                        aria-label="Open LinkedIn profile"
                      >
                        <LinkedInFilled className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 sm:gap-sm text-text-secondary hover:text-text-primary px-2 sm:px-3"
                    onClick={onNavigatePrev}
                    disabled={!hasPrev}
                    title="Previous candidate"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 sm:gap-sm text-text-secondary hover:text-text-primary px-2 sm:px-3"
                    onClick={onNavigateNext}
                    disabled={!hasNext}
                    title="Next candidate"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="text-text-secondary text-sm">Loading profile…</div>
              ) : !candidate ? (
                <div className="text-text-secondary text-sm">No data available.</div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Mobile Job Selector - show on small screens */}
                  {candidateId && (
                    <div className="lg:hidden">
                      <MobileJobSelector
                        candidateId={candidateId}
                        currentJobId=""
                        onJobSelect={handleJobSelect}
                      />
                    </div>
                  )}
                  
                  {/* Job Associations Sidebar - desktop only */}
                  {candidateId && (
                    <CandidateJobSidebar
                      candidateId={candidateId}
                      currentJobId=""
                      onJobSelect={handleJobSelect}
                      className="hidden lg:block"
                    />
                  )}
                  
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'resume' | 'comments')}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column (50%) */}
                    <div className="space-y-6 min-w-0">
                      {/* Controls Card */}
                      <Card className="bg-surface-primary border-border">
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-center gap-2 w-full">
                              {candidate.job_board_source && (
                                <Badge variant="secondary" className="gap-1">
                                  <Globe className="h-3 w-3" />
                                  Applied via {candidate.job_board_source}
                                </Badge>
                              )}
                              <AddToJobPipelineDialog candidateId={candidate.id} />
                              {canEnrich(candidate) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleEnrichFromLinkedIn}
                                  disabled={isEnriching}
                                  className="gap-1.5"
                                >
                                  {isEnriching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                  Enrich from LinkedIn
                                </Button>
                              )}
                          </div>
                        </CardContent>
                      </Card>

                      <CandidateNameCard
                        email={candidate.email}
                        phone={candidate.phone}
                        tabs={[
                          { value: 'overview', label: 'Overview', Icon: FileText },
                          { value: 'resume', label: 'Resume', Icon: FileText },
                          { value: 'comments', label: 'Comments', Icon: User },
                        ]}
                        activeTab={activeTab}
                        onTabChange={(v) => setActiveTab(v as 'overview' | 'resume' | 'comments')}
                      />

                      {/* Resume Tab */}
                      {activeTab === 'resume' && (
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle>Resume</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {resumeAttachment ? (
                              <>
                                <div className="flex gap-2">
                                  <input
                                    ref={replaceResumeInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleReplaceResumeChange}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                                  />
                                  <Button variant="outline" onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading}>
                                    Replace Resume
                                  </Button>
                                  <Button variant="destructive" onClick={handleDeleteResume}>
                                    Delete Resume
                                  </Button>
                                </div>
                                <CandidateResumeViewer candidateId={candidateId} />
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                                <FileText className="h-12 w-12 text-muted-foreground" />
                                <div>
                                  <p className="text-sm text-muted-foreground">No resume uploaded yet</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Upload a resume to auto-extract candidate information
                                  </p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setEditOpen(true)}
                                  disabled={!canEditCandidates}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Upload Resume
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Comments Tab */}
                      {activeTab === 'comments' && (
                        <>
                          {organizationId && candidateId ? (
                            <CandidateComments candidateId={candidateId} jobId={undefined} organizationId={organizationId} />
                          ) : (
                            <Card className="bg-surface-primary border-border">
                              <CardHeader>
                                <CardTitle>Comments</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-sm text-text-secondary">No candidate data available.</div>
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}

                      {activeTab === 'overview' && (
                        <Accordion type="multiple" defaultValue={['career', 'contact', 'summary', 'experience', 'education', 'certifications']} className="space-y-4">
                          
                          {/* Career Summary - NEW */}
                          {(candidate?.current_job_title || candidate?.seniority_level || candidate?.functional_area) && (
                            <AccordionItem value="career" className="border-0">
                              <Card className="bg-surface-primary border-border">
                                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle>Career Summary</CardTitle>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <CardContent className="pt-0 space-y-4">
                                    {/* Title row */}
                                    <div className="space-y-1">
                                      {candidate.current_job_title && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-sm">{candidate.current_job_title}</span>
                                          {candidate.standardized_title && candidate.standardized_title !== candidate.current_job_title && (
                                            <Badge variant="outline" className="text-xs gap-1">
                                              <Sparkles className="h-3 w-3" />
                                              {candidate.standardized_title}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                      {candidate.company_current && (
                                        <p className="text-sm text-muted-foreground">at {candidate.company_current}</p>
                                      )}
                                    </div>
                                    
                                    {/* Badges row */}
                                    <div className="flex flex-wrap gap-2">
                                      {candidate.seniority_level && (
                                        <Badge variant="secondary" className="capitalize text-xs">
                                          {candidate.seniority_level.replace('_', ' ')}
                                        </Badge>
                                      )}
                                      {candidate.functional_area && (
                                        <Badge variant="secondary" className="text-xs">
                                          {candidate.functional_area}
                                        </Badge>
                                      )}
                                      {candidate.specialization && (
                                        <Badge variant="outline" className="text-xs">
                                          {candidate.specialization}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Metrics row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      {candidate.years_experience != null && (
                                        <div className="text-center p-2 rounded-md bg-muted/50">
                                          <div className="text-lg font-semibold">{candidate.years_experience}</div>
                                          <div className="text-xs text-muted-foreground">Years Exp.</div>
                                        </div>
                                      )}
                                      {candidate.company_count != null && candidate.company_count > 0 && (
                                        <div className="text-center p-2 rounded-md bg-muted/50">
                                          <div className="text-lg font-semibold">{candidate.company_count}</div>
                                          <div className="text-xs text-muted-foreground">Companies</div>
                                        </div>
                                      )}
                                      {candidate.avg_tenure_months != null && candidate.avg_tenure_months > 0 && (
                                        <div className="text-center p-2 rounded-md bg-muted/50">
                                          <div className="text-lg font-semibold">
                                            {candidate.avg_tenure_months >= 12 
                                              ? `${Math.round(candidate.avg_tenure_months / 12)}y`
                                              : `${candidate.avg_tenure_months}m`}
                                          </div>
                                          <div className="text-xs text-muted-foreground">Avg. Tenure</div>
                                        </div>
                                      )}
                                      {candidate.years_in_leadership != null && candidate.years_in_leadership > 0 && (
                                        <div className="text-center p-2 rounded-md bg-muted/50">
                                          <div className="text-lg font-semibold">{candidate.years_in_leadership}</div>
                                          <div className="text-xs text-muted-foreground">Yrs Leadership</div>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </AccordionContent>
                              </Card>
                            </AccordionItem>
                          )}

                          {/* Contact Information */}
                          <AccordionItem value="contact" className="border-0">
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <CardTitle>Contact Information</CardTitle>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="space-y-4 pt-0">
                                      {/* Emails Section */}
                                      <div className="space-y-2">
                                        {candidate?.contact_emails && candidate.contact_emails.length > 0 ? (
                                          candidate.contact_emails.map((ce: any, idx: number) => {
                                            const { email: emailValue, type: emailType } = getEmailFromEntry(ce);
                                            if (!emailValue) return null;
                                            return (
                                              <div key={`email-${idx}`} className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                  <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                                  <div className="flex flex-col min-w-0">
                                                    <a href={`mailto:${emailValue}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                                      {emailValue}
                                                    </a>
                                                    <span className="text-xs text-text-tertiary capitalize">{emailType}</span>
                                                  </div>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(emailValue, 'Email copied to clipboard')}>
                                                  <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            );
                                          })
                                        ) : candidate?.email ? (
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                              <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                              <a href={`mailto:${candidate.email}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                                {candidate.email}
                                              </a>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(candidate.email, 'Email copied to clipboard')}>
                                              <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ) : null}
                                      </div>

                                      {/* Phones Section */}
                                      <div className="space-y-2">
                                        {candidate?.contact_phones && candidate.contact_phones.length > 0 ? (
                                          candidate.contact_phones.map((cp: any, idx: number) => {
                                            const { phone: phoneValue, type: phoneType } = getPhoneFromEntry(cp);
                                            if (!phoneValue) return null;
                                            return (
                                              <div key={`phone-${idx}`} className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                  <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                                  <div className="flex flex-col min-w-0">
                                                    <a href={`tel:${phoneValue}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                                      {phoneValue}
                                                    </a>
                                                    <span className="text-xs text-text-tertiary capitalize">{phoneType}</span>
                                                  </div>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(phoneValue, 'Phone number copied to clipboard')}>
                                                  <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            );
                                          })
                                        ) : (
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                              <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                              {candidate?.phone ? (
                                                <a href={`tel:${candidate.phone}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                                  {candidate.phone}
                                                </a>
                                              ) : (
                                                <span className="text-sm text-text-tertiary italic">Phone not available</span>
                                              )}
                                            </div>
                                            {candidate?.phone && (
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(candidate.phone, 'Phone number copied to clipboard')}>
                                                <Copy className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {candidate?.linkedin_url && (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                            <a
                                              href={candidate.linkedin_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                            >
                                              LinkedIn Profile
                                            </a>
                                          </div>
                                          <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                                        </div>
                                      )}
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          </AccordionItem>

                          {/* URLs - hidden on mobile */}
                          <div className="hidden md:block">
                            <AccordionItem value="urls" className="border-0">
                              {candidateId ? (
                                <CandidateUrls candidateId={candidateId} />
                              ) : (
                                <Card className="bg-surface-primary border-border">
                                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                    <CardTitle>URLs</CardTitle>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <CardContent className="pt-0">
                                      <div className="text-sm text-text-secondary">No candidate data available.</div>
                                    </CardContent>
                                  </AccordionContent>
                                </Card>
                              )}
                            </AccordionItem>
                          </div>

                          {/* Attachments - hidden on mobile */}
                          <div className="hidden md:block">
                            <AccordionItem value="attachments" className="border-0">
                              {candidateId ? (
                                <CandidateAttachments candidateId={candidateId} />
                              ) : (
                                <Card className="bg-surface-primary border-border">
                                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                    <CardTitle>Attachments</CardTitle>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <CardContent className="pt-0">
                                      <div className="text-sm text-text-secondary">No candidate data available.</div>
                                    </CardContent>
                                  </AccordionContent>
                                </Card>
                              )}
                            </AccordionItem>
                          </div>

                          {/* Skills - hidden on mobile */}
                          <div className="hidden md:block">
                            <AccordionItem value="skills" className="border-0">
                              <Card className="bg-surface-primary border-border">
                                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                  <div className="flex items-center justify-between flex-1 pr-4">
                                    <CardTitle>Skills</CardTitle>
                                    <div className="text-xs text-text-tertiary">
                                      Added {new Date(candidate.created_at as string).toLocaleDateString()}
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <CardContent className="pt-0">
                                    {(() => {
                                      const manualSkills = candidate?.skills || []
                                      const autoGenerated = Array.isArray((candidate as any)?.auto_generated_skills)
                                        ? ((candidate as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
                                        : []
                                      
                                      const displaySkills = manualSkills.length > 0 ? manualSkills : autoGenerated

                                      return displaySkills && displaySkills.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                          {displaySkills.map((s: string, i: number) => (
                                            <EnhancedSkillBadge 
                                              key={`${s}-${i}`} 
                                              skill={s}
                                              variant="compact"
                                              showTooltip={true}
                                              interactive={false}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-text-secondary">No skills specified</div>
                                      )
                                    })()}
                                  </CardContent>
                                </AccordionContent>
                              </Card>
                            </AccordionItem>
                          </div>

                          {/* Profile Summary */}
                          <AccordionItem value="summary" className="border-0">
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <CardTitle>Profile Summary</CardTitle>
                                  <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="pt-0">
                                  {candidate.profile_summary ? (
                                    <ProfileSummaryMarkdown
                                      content={candidate.profile_summary}
                                      className="text-text-primary leading-relaxed"
                                    />
                                  ) : (
                                    <div className="text-sm text-text-secondary">No summary available.</div>
                                  )}
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          </AccordionItem>

                          {/* Work Experience - hidden on mobile */}
                          <div className="hidden md:block">
                            <AccordionItem value="experience" className="border-0">
                              <CandidateWorkExperienceComponent experiences={workExperience} />
                            </AccordionItem>
                          </div>

                          {/* Education - hidden on mobile */}
                          <div className="hidden md:block">
                            <AccordionItem value="education" className="border-0">
                              <CandidateEducationComponent education={education} />
                            </AccordionItem>
                          </div>
                        </Accordion>
                      )}
                    </div>

                    {/* Right column (50%) - hidden on mobile */}
                    <div className="space-y-6 hidden lg:block">
                      {/* Controls Card - Right Side */}
                      <Card className="bg-surface-primary border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              {canEditCandidates && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditOpen(true)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await generateCandidatePdf({ candidate })
                                    toast({ 
                                      title: 'Success', 
                                      description: 'Profile PDF downloaded successfully' 
                                    })
                                  } catch (error) {
                                    console.error('PDF generation failed:', error)
                                    toast({ 
                                      title: 'Error', 
                                      description: 'Failed to generate PDF. Please try again.', 
                                      variant: 'destructive' 
                                    })
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                            
                            <Separator orientation="vertical" className="h-6" />
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRightActiveTab('notes')}
                              >
                                <StickyNote className="h-4 w-4 mr-2" />
                                Add Note
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEmailComposerOpen(true)}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setScheduleOpen(true)}
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule Interview
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tab Navigation */}
                      <CandidateNameCard
                        email={candidate.email}
                        phone={candidate.phone}
                        tabs={[
                          { value: 'feed', label: 'Feed', Icon: Activity },
                          { value: 'notes', label: 'Notes', Icon: StickyNote },
                          { value: 'emails', label: 'Emails', Icon: Mail },
                          { value: 'reminders', label: 'Reminders', Icon: Bell },
                        ]}
                        activeTab={rightActiveTab}
                        onTabChange={(v) => setRightActiveTab(v as 'feed' | 'notes' | 'emails' | 'reminders')}
                      />

                      {/* Feed Tab */}
                      {rightActiveTab === 'feed' && (
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle>Activity Feed</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                              <div className="p-6">
                                <ActivityFeedList 
                                  candidateId={candidate.id}
                                />
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}

                      {/* Notes Tab */}
                      {rightActiveTab === 'notes' && (
                        <>
                          {organizationId && candidateId ? (
                            <CandidateComments candidateId={candidateId} jobId={undefined} organizationId={organizationId} />
                          ) : (
                            <Card className="bg-surface-primary border-border">
                              <CardHeader>
                                <CardTitle>Notes</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-sm text-text-secondary">No candidate data available.</div>
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}

                      {/* Emails Tab */}
                      {rightActiveTab === 'emails' && (
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle>Email History</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="h-[500px] overflow-y-auto">
                              <div className="p-6">
                                <EmailHistoryList 
                                  candidateId={candidate.id}
                                  onReply={handleEmailReply}
                                  onForward={handleEmailForward}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Reminders Tab */}
                      {rightActiveTab === 'reminders' && candidateId && (
                        <CandidateReminders candidateId={candidateId} />
                      )}
                    </div>
                  </div>
                </Tabs>
                  </div>
                </div>
              )}
              <CandidateFormSheet
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                onSubmit={handleUpdateCandidate}
                candidate={candidate}
                isLoading={editLoading}
              />
            </div>
          </div>

          {/* Minimizable Email Composer (portal to body) */}
          <MinimizableEmailComposer
            isOpen={emailComposerOpen}
            onOpenChange={(open) => {
              if (!open) resetEmailComposer()
              else setEmailComposerOpen(open)
            }}
            candidateId={candidateId || undefined}
            defaultTo={emailComposerTo ?? candidate?.email}
            candidateName={candidate?.candidate_name}
            onSuccess={resetEmailComposer}
            mode={emailComposerMode}
            inReplyToMessageId={emailComposerReplyToId}
            defaultSubject={emailComposerSubject}
            defaultBody={emailComposerBody}
            defaultCc={emailComposerCc}
          />

          {/* Simple Schedule Interview Sheet */}
          {candidateId && organizationId && candidate && (
            <SimpleScheduleInterviewSheet
              open={scheduleOpen}
              onOpenChange={setScheduleOpen}
              candidateId={candidateId}
              candidateName={candidate.candidate_name || 'Candidate'}
              candidateEmail={candidate.email || ''}
              candidatePhone={candidate.phone}
              organizationId={organizationId}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
