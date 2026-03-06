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

import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'
import { CandidateWorkExperienceComponent, CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { CandidateCertificationsComponent, CandidateCertification } from '@/components/candidates/CandidateCertifications'
import { CandidateEducationComponent, CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { CandidateJobSidebar } from '@/components/candidates/CandidateJobSidebar'
import { MobileJobSelector } from '@/components/candidates/MobileJobSelector'
import { Edit, FileText, Download, ChevronLeft, ChevronRight, Mail, Phone, Copy, ExternalLink, Send, Sparkles, User, Globe, Loader2, Calendar, Briefcase, Award, TrendingUp, MapPin } from 'lucide-react'
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

import AddToJobPipelineDialog from './AddToJobPipelineDialog'
import { Separator } from '@/components/ui/separator'
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
  const [activeTab, setActiveTab] = useState<'overview' | 'resume'>('overview')
  const [workExperience, setWorkExperience] = useState<CandidateWorkExperience[]>([])
  const [education, setEducation] = useState<CandidateEducation[]>([])
  const [certifications, setCertifications] = useState<CandidateCertification[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
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
        <div className="flex h-full w-full">
          {/* Job Associations Sidebar - desktop only, fixed outside scroll */}
          {candidateId && (
            <CandidateJobSidebar
              candidateId={candidateId}
              currentJobId=""
              onJobSelect={handleJobSelect}
              className="hidden lg:flex"
            />
          )}

          {/* Main Profile Content */}
          <div className="flex-1 flex flex-col min-w-0">
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
                  <div className="flex flex-wrap items-center gap-2">
                    {candidate?.job_board_source && (
                      <Badge variant="secondary" className="gap-1">
                        <Globe className="h-3 w-3" />
                        Applied via {candidate.job_board_source}
                      </Badge>
                    )}
                    {candidate && <AddToJobPipelineDialog candidateId={candidate.id} />}
                    {candidate && canEnrich(candidate) && (
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
                <div>
                  {/* Mobile Job Selector - show on small screens */}
                  {candidateId && (
                    <div className="lg:hidden mb-6">
                      <MobileJobSelector
                        candidateId={candidateId}
                        currentJobId=""
                        onJobSelect={handleJobSelect}
                      />
                    </div>
                  )}
                  
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'resume')}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column (50%) */}
                    <div className="space-y-6 min-w-0">

                      <CandidateNameCard
                        email={candidate.email}
                        phone={candidate.phone}
                        tabs={[
                          { value: 'overview', label: 'Overview', Icon: FileText },
                          { value: 'resume', label: 'Resume', Icon: FileText },
                        ]}
                        activeTab={activeTab}
                        onTabChange={(v) => setActiveTab(v as 'overview' | 'resume')}
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


                      {activeTab === 'overview' && (
                        <Accordion type="multiple" defaultValue={['summary', 'experience', 'education', 'certifications', 'skills']} className="space-y-4">

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

                          {/* Work Experience */}
                          <AccordionItem value="experience" className="border-0">
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                                  <CardTitle>Work Experience</CardTitle>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="pt-0">
                                  <CandidateWorkExperienceComponent experiences={workExperience} />
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          </AccordionItem>

                          {/* Education */}
                          <AccordionItem value="education" className="border-0">
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <Award className="h-4 w-4 text-muted-foreground" />
                                  <CardTitle>Education</CardTitle>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="pt-0">
                                  <CandidateEducationComponent education={education} />
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          </AccordionItem>

                          {/* Certifications */}
                          <AccordionItem value="certifications" className="border-0">
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <Award className="h-4 w-4 text-muted-foreground" />
                                  <CardTitle>Certifications</CardTitle>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="pt-0">
                                  <CandidateCertificationsComponent certifications={certifications} />
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          </AccordionItem>

                          {/* Skills */}
                          <AccordionItem value="skills" className="border-0">
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <CardTitle>Skills</CardTitle>
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
                        </Accordion>
                      )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-6 hidden lg:block">
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
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle>Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm text-text-secondary">Notes are available in the job-associated profile view.</div>
                          </CardContent>
                        </Card>
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
